/**
 * Job Orchestrator - Coordinate job search, matching, and letter generation
 */

const jobScraper = require('./jobScraper');
const profileMatcher = require('./profileMatcher');
const letterGenerator = require('./letterGenerator');
const wordDocumentCreator = require('./wordDocumentCreator');

class JobOrchestrator {
    constructor() {
        this.lastSearch = null;
        this.dailyJobs = [];
        this.cache = new Map(); // Cache for 1 hour
    }

    /**
     * Run full job search + matching pipeline
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Top matching jobs with letters
     */
    async runFullPipeline(options = {}) {
        const {
            keywords = ['Data Analyst', 'Python Developer', 'IA Engineer', 'Full Stack Developer'],
            location = 'remote',
            limit = 5
        } = options;

        console.log('[JobOrchestrator] Starting full pipeline...');

        try {
            // Step 1: Scrape jobs
            console.log('[JobOrchestrator] 1️⃣ Scraping jobs...');
            const allJobs = await jobScraper.searchAll({ keywords, location });

            if (allJobs.length === 0) {
                console.log('[JobOrchestrator] ⚠️ No jobs found');
                return [];
            }

            console.log(`[JobOrchestrator] ✅ Found ${allJobs.length} jobs`);

            // Step 2: Match and rank
            console.log('[JobOrchestrator] 2️⃣ Matching profile with jobs...');
            const topJobs = profileMatcher.getTopJobs(allJobs, limit);

            if (topJobs.length === 0) {
                console.log('[JobOrchestrator] ⚠️ No matching jobs (score < 50%)');
                return [];
            }

            console.log(`[JobOrchestrator] ✅ Found ${topJobs.length} matching jobs`);

            // Step 3: Generate letters and documents
            console.log('[JobOrchestrator] 3️⃣ Generating letters and documents...');
            const profile = profileMatcher.getProfile();

            const jobsWithLetters = [];

            for (const jobResult of topJobs) {
                try {
                    // Generate letter
                    const letter = await letterGenerator.generateLetter(
                        jobResult,
                        profile,
                        jobResult.match
                    );

                    // Create Word document
                    const docInfo = await wordDocumentCreator.createLetterDocument(
                        letter,
                        jobResult,
                        profile,
                        jobResult.match
                    );

                    jobsWithLetters.push({
                        job: jobResult,
                        match: jobResult.match,
                        letter: letter,
                        document: docInfo
                    });

                    console.log(`[JobOrchestrator] ✅ Generated letter for ${jobResult.title}`);

                } catch (error) {
                    console.error(`[JobOrchestrator] Letter generation error for ${jobResult.title}:`, error.message);
                }
            }

            this.dailyJobs = jobsWithLetters;
            this.lastSearch = new Date();

            console.log(`[JobOrchestrator] ✅ Pipeline complete: ${jobsWithLetters.length} jobs ready`);

            return jobsWithLetters;

        } catch (error) {
            console.error('[JobOrchestrator] Pipeline error:', error.message);
            return [];
        }
    }

    /**
     * Get latest daily jobs
     * @returns {Array} Jobs from latest search
     */
    getDailyJobs() {
        return this.dailyJobs;
    }

    /**
     * Get job details with letter
     * @param {number} index - Job index
     * @returns {Object} Job with letter and document info
     */
    getJobDetails(index) {
        if (index < 0 || index >= this.dailyJobs.length) {
            return null;
        }

        return this.dailyJobs[index];
    }

    /**
     * Get download link for letter
     * @param {number} index - Job index
     * @returns {string} Download URL
     */
    getLetterDownloadUrl(index) {
        const job = this.getJobDetails(index);
        if (!job) return null;

        const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://psychobot-1si7.onrender.com';
        return `${baseUrl}/download/doc/${job.document.token}`;
    }

    /**
     * Format jobs for WhatsApp display
     * @returns {string} Formatted message
     */
    formatJobsForWhatsApp() {
        if (this.dailyJobs.length === 0) {
            return '❌ Aucune offre trouvée pour aujourd\'hui.';
        }

        let message = `📋 *OFFRES D'EMPLOI DU JOUR*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Trouvées: ${this.dailyJobs.length} | Mis à jour: ${this.lastSearch.toLocaleTimeString('fr-FR')}\n\n`;

        this.dailyJobs.forEach((item, index) => {
            const job = item.job;
            const match = item.match;

            message += `*${index + 1}. ${job.title}*\n`;
            message += `🏢 ${job.company}\n`;
            message += `📍 ${job.location}\n`;
            message += `💼 ${job.type} | 📱 ${job.remote ? 'Remote' : 'On-site'}\n`;

            // Use new A-F scoring if available, fallback to old %
            const scoreDisplay = match.overall_score
                ? `${match.overall_score} (${match.numeric_score}/100)`
                : `${match.fitPercentage}%`;

            message += `✅ Score: *${scoreDisplay}*\n`;
            message += `${match.recommendation?.emoji} ${match.recommendation?.text}\n`;

            message += `🔗 ${job.url}\n\n`;
        });

        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `💡 Commandes:\n`;
        message += `!jobs details <N> - Voir détails\n`;
        message += `!jobs letter <N> - Télécharger lettre\n`;
        message += `!jobs apply <N> - Candidature rapide\n`;

        return message;
    }

    /**
     * Format single job for WhatsApp
     * @param {number} index - Job index
     * @returns {string} Formatted job details
     */
    formatJobDetails(index) {
        const item = this.getJobDetails(index);
        if (!item) return '❌ Offre non trouvée.';

        const job = item.job;
        const match = item.match;

        let message = `📄 *${job.title}*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        message += `🏢 **${job.company}**\n`;
        message += `📍 ${job.location}\n`;
        message += `💼 ${job.type} | 🌐 ${job.remote ? 'Remote' : 'On-site'}\n`;
        message += `📅 Publié: ${new Date(job.postedDate).toLocaleDateString('fr-FR')}\n\n`;

        // SCORING SECTION - with new 10-dimension system
        if (match.overall_score) {
            message += `**📊 CAREER-OPS SCORING (A-F)**\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `*Overall Score: ${match.overall_score} (${match.numeric_score}/100)*\n`;
            message += `${match.recommendation?.emoji} ${match.recommendation?.text}\n\n`;

            message += `**10 Dimensions:**\n`;

            const dims = match.dimensions;
            const order = [
                'cv_match',
                'role_clarity',
                'level_strategy',
                'comp_research',
                'growth',
                'interview_prep',
                'location_fit',
                'sector_alignment',
                'team_dynamics',
                'life_integration'
            ];

            order.forEach(dimKey => {
                const dim = dims[dimKey];
                if (dim) {
                    const barLength = Math.round(dim.score / 10);
                    const bar = '█'.repeat(Math.floor(barLength)) + '░'.repeat(10 - Math.floor(barLength));

                    const label = dimKey
                        .split('_')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');

                    message += `${label}: ${bar} ${dim.score}\n`;
                    message += `  └─ ${dim.reason}\n`;
                }
            });

            message += `\n`;
        } else {
            // Fallback to old format
            message += `**MATCHING:**\n`;
            message += `✅ Score: ${match.fitPercentage}%\n`;
            message += `🎯 Compétences: ${match.analysis.strengths.join(', ')}\n`;
            message += `⚠️ À développer: ${match.analysis.gaps.join(', ')}\n\n`;
        }

        message += `**DESCRIPTION (résumé):**\n`;
        message += `${job.description.substring(0, 250)}...\n\n`;

        message += `🔗 Lien: ${job.url}\n`;
        message += `📝 Document: ${item.document?.filename || 'En cours de génération...'}\n\n`;

        message += `⏭️ !jobs letter ${index + 1} - Télécharger la lettre`;

        return message;
    }

    /**
     * Get stats
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            lastSearch: this.lastSearch,
            jobsFound: this.dailyJobs.length,
            scraper: jobScraper.getStats(),
            documents: wordDocumentCreator.getStats()
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.dailyJobs = [];
        this.lastSearch = null;
    }
}

// Singleton instance
const jobOrchestratorInstance = new JobOrchestrator();

module.exports = jobOrchestratorInstance;
