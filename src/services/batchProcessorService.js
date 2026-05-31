/**
 * Batch Processor Service - Process 10+ job offers in parallel
 * Handles concurrent evaluation, ranking, and PDF generation
 */

const fs = require('fs');
const path = require('path');
const profileMatcher = require('./profileMatcher');
const letterGenerator = require('./letterGenerator');
const wordDocumentCreator = require('./wordDocumentCreator');

/**
 * Simple promise limiter (no external dependency)
 */
class PLimit {
    constructor(limit) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.running >= this.limit) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

class BatchProcessorService {
    constructor() {
        this.maxWorkers = 5; // Parallel evaluations (API rate limit)
        this.batchReportsDir = path.join(__dirname, '../../data/batch-reports');
        this.ensureBatchReportsDir();
    }

    /**
     * Ensure batch reports directory exists
     */
    ensureBatchReportsDir() {
        if (!fs.existsSync(this.batchReportsDir)) {
            fs.mkdirSync(this.batchReportsDir, { recursive: true });
        }
    }

    /**
     * Process batch of jobs
     * @param {Array} jobs - Job array
     * @param {Object} options - Processing options
     * @returns {Object} Batch results with rankings and stats
     */
    async processBatch(jobs, options = {}) {
        const {
            generatePDFs = true,
            exportCSV = true,
            minScore = 'C',
            maxWorkers = this.maxWorkers
        } = options;

        console.log(`[BatchProcessor] Starting batch processing of ${jobs.length} jobs...`);

        try {
            // Step 1: Score all jobs
            console.log(`[BatchProcessor] 1️⃣ Scoring ${jobs.length} jobs...`);
            const scoredJobs = this.scoreJobs(jobs);

            // Step 2: Rank and filter
            console.log(`[BatchProcessor] 2️⃣ Ranking and filtering...`);
            const ranked = this.rankAndFilter(scoredJobs, minScore);

            console.log(`[BatchProcessor] Results: ${ranked.A.length} A-rated, ${ranked.B.length} B, ${ranked.C.length} C, ${ranked.D.length} D+F`);

            // Step 3: Generate letters and PDFs (parallel with limiter)
            if (generatePDFs) {
                console.log(`[BatchProcessor] 3️⃣ Generating ${ranked.A.length + ranked.B.length} PDFs in parallel (max ${maxWorkers} workers)...`);
                const limiter = new PLimit(maxWorkers);

                const jobsToGenerate = [...ranked.A, ...ranked.B];
                await Promise.all(
                    jobsToGenerate.map(job =>
                        limiter.run(async () => {
                            try {
                                const letter = await letterGenerator.generateLetter(
                                    job,
                                    profileMatcher.getProfile(),
                                    job.match
                                );

                                const docInfo = await wordDocumentCreator.createLetterDocument(
                                    letter,
                                    job,
                                    profileMatcher.getProfile(),
                                    job.match
                                );

                                job.letter = letter;
                                job.document = docInfo;
                                console.log(`[BatchProcessor] ✅ PDF: ${job.title}`);
                            } catch (error) {
                                console.error(`[BatchProcessor] ❌ PDF error for ${job.title}:`, error.message);
                            }
                        })
                    )
                );
            }

            // Step 4: Export CSV
            if (exportCSV) {
                console.log(`[BatchProcessor] 4️⃣ Exporting to CSV...`);
                const csvPath = this.exportToCSV(ranked, jobs.length);
                console.log(`[BatchProcessor] ✅ CSV exported: ${csvPath}`);
            }

            // Step 5: Generate report
            console.log(`[BatchProcessor] 5️⃣ Generating report...`);
            const report = this.generateReport(ranked, jobs.length);

            console.log(`[BatchProcessor] ✅ Batch processing complete!`);

            return {
                success: true,
                summary: {
                    total: jobs.length,
                    scoreA: ranked.A.length,
                    scoreB: ranked.B.length,
                    scoreC: ranked.C.length,
                    scoreDF: ranked.D.length + ranked.F.length
                },
                ranked: ranked,
                report: report
            };

        } catch (error) {
            console.error('[BatchProcessor] Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Score all jobs
     * @param {Array} jobs - Jobs to score
     * @returns {Array} Jobs with scores
     */
    scoreJobs(jobs) {
        return jobs.map(job => ({
            ...job,
            match: profileMatcher.scoreJob(job)
        }));
    }

    /**
     * Rank and filter jobs by score
     * @param {Array} scoredJobs - Scored jobs
     * @param {string} minScore - Minimum score (A-F)
     * @returns {Object} Grouped by score
     */
    rankAndFilter(scoredJobs, minScore = 'C') {
        const scoreOrder = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
        const minValue = scoreOrder[minScore] || 3;

        const grouped = {
            A: [],
            B: [],
            C: [],
            D: [],
            E: [],
            F: []
        };

        scoredJobs.forEach(job => {
            const grade = job.match.overall_score;
            if (grouped[grade]) {
                grouped[grade].push(job);
            }
        });

        // Sort each group by numeric score
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => b.match.numeric_score - a.match.numeric_score);
        });

        return grouped;
    }

    /**
     * Export batch results to CSV
     * @param {Object} ranked - Grouped ranked jobs
     * @param {number} total - Total jobs processed
     * @returns {string} CSV file path
     */
    exportToCSV(ranked, total) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `batch-results-${timestamp}.csv`;
        const filepath = path.join(this.batchReportsDir, filename);

        let csv = 'Rank,Company,Role,Location,Type,Remote,Score,Recommendation,CV Match,Role Clarity,Comp,Growth,Interview Prep,Location Fit,Days Ago\n';

        let rank = 1;
        const allJobs = [...ranked.A, ...ranked.B, ...ranked.C, ...ranked.D, ...ranked.E, ...ranked.F];

        allJobs.forEach(job => {
            const match = job.match;
            const dims = match.dimensions || {};

            const row = [
                rank++,
                `"${job.company}"`,
                `"${job.title}"`,
                `"${job.location}"`,
                job.type,
                job.remote ? 'Yes' : 'No',
                match.overall_score,
                `"${match.recommendation?.text || ''}"`,
                dims.cv_match?.score || 'N/A',
                dims.role_clarity?.score || 'N/A',
                dims.comp_research?.score || 'N/A',
                dims.growth?.score || 'N/A',
                dims.interview_prep?.score || 'N/A',
                dims.location_fit?.score || 'N/A',
                (job.daysAgo || 0)
            ];

            csv += row.join(',') + '\n';
        });

        fs.writeFileSync(filepath, csv, 'utf-8');
        return filepath;
    }

    /**
     * Generate batch report
     * @param {Object} ranked - Grouped ranked jobs
     * @param {number} total - Total jobs processed
     * @returns {string} Report content
     */
    generateReport(ranked, total) {
        const timestamp = new Date().toLocaleString('fr-FR');
        const scoreA = ranked.A.length;
        const scoreB = ranked.B.length;
        const scoreC = ranked.C.length;
        const scoreDF = ranked.D.length + ranked.E.length + ranked.F.length;

        let report = `# BATCH PROCESSING REPORT\n\n`;
        report += `Generated: ${timestamp}\n`;
        report += `Total Offers Processed: ${total}\n\n`;

        report += `## SUMMARY\n`;
        report += `- A-Rated (Strong Fit): ${scoreA}\n`;
        report += `- B-Rated (Good Fit): ${scoreB}\n`;
        report += `- C-Rated (Moderate): ${scoreC}\n`;
        report += `- D-F Rated (Weak): ${scoreDF}\n`;
        report += `- Success Rate: ${((scoreA + scoreB) / total * 100).toFixed(1)}%\n\n`;

        report += `## TOP OPPORTUNITIES (A-Rated)\n\n`;
        ranked.A.slice(0, 10).forEach((job, i) => {
            report += `${i + 1}. **${job.company}** - ${job.title}\n`;
            report += `   - Score: ${job.match.overall_score} (${job.match.numeric_score}/100)\n`;
            report += `   - Location: ${job.location} (Remote: ${job.remote ? 'Yes' : 'No'})\n`;
            report += `   - ${job.match.recommendation?.text}\n\n`;
        });

        report += `## RECOMMENDATIONS\n`;
        report += `1. **Apply Immediately**: All ${scoreA} A-rated positions\n`;
        report += `2. **Review**: ${scoreB} B-rated positions for specific interest\n`;
        report += `3. **Archive**: ${scoreDF} below-rated positions\n\n`;

        report += `## NEXT STEPS\n`;
        report += `- Download generated letters for A-rated positions\n`;
        report += `- Review top B-rated positions\n`;
        report += `- Track applications with !track add\n`;
        report += `- Follow-up timeline: 7, 14, 21 days\n`;

        return report;
    }

    /**
     * Format batch summary for WhatsApp
     * @param {Object} batchResult - Batch processing result
     * @returns {string} Formatted message
     */
    formatBatchSummaryForWhatsApp(batchResult) {
        if (!batchResult.success) {
            return `❌ Batch processing failed: ${batchResult.error}`;
        }

        const { summary, ranked } = batchResult;

        let message = `📊 *BATCH PROCESSING COMPLETE*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        message += `📈 *Results:*\n`;
        message += `Total: ${summary.total} offers\n`;
        message += `✅ A-Rated: ${summary.scoreA}\n`;
        message += `👍 B-Rated: ${summary.scoreB}\n`;
        message += `🤔 C-Rated: ${summary.scoreC}\n`;
        message += `❌ D-F: ${summary.scoreDF}\n\n`;

        message += `📊 Success rate: ${((summary.scoreA + summary.scoreB) / summary.total * 100).toFixed(1)}%\n\n`;

        if (ranked.A.length > 0) {
            message += `🏆 *Top 3 A-Rated:*\n`;
            ranked.A.slice(0, 3).forEach((job, i) => {
                message += `${i + 1}. ${job.company} - ${job.title}\n`;
            });
            message += `\n`;
        }

        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📁 Export: CSV generated\n`;
        message += `📄 Letters: ${summary.scoreA + summary.scoreB} PDFs\n\n`;

        message += `💡 Next: !track add | Company | Role | Score`;

        return message;
    }

    /**
     * Get batch stats
     * @returns {Object} Stats
     */
    getStats() {
        return {
            maxWorkers: this.maxWorkers,
            reportsDir: this.batchReportsDir
        };
    }
}

// Singleton instance
const batchProcessorInstance = new BatchProcessorService();

module.exports = batchProcessorInstance;
