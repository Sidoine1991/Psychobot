/**
 * Quick Wins Service - Cron jobs, reminders, exports
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const jobOrchestrator = require('./jobOrchestrator');

class QuickWinsService {
    constructor() {
        this.jobs = [];
        this.reminders = new Map(); // userId -> [{jobIndex, daysLeft}]
        this.cronJobs = [];
        this.exportDir = path.join(process.cwd(), 'tmp', 'exports');

        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    /**
     * Schedule daily job search at specific time
     * @param {string} time - Cron time (e.g., "0 8 * * *" = 8am daily)
     * @param {Object} sock - Socket reference
     */
    scheduleDailyJobSearch(time = '0 8 * * *', sock) {
        const cronJob = cron.schedule(time, async () => {
            try {
                console.log('[QuickWins] Running scheduled job search...');

                const jobs = await jobOrchestrator.runFullPipeline({
                    keywords: ['Data Analyst', 'Python Developer', 'IA Engineer', 'Full Stack Developer'],
                    location: 'remote',
                    limit: 5
                });

                if (jobs.length > 0 && sock?.user) {
                    const ownerJid = process.env.OWNER_NUMBER + '@s.whatsapp.net';
                    const message = jobOrchestrator.formatJobsForWhatsApp();

                    await sock.sendMessage(ownerJid, { text: message });
                    console.log('[QuickWins] Daily digest sent');
                }

            } catch (error) {
                console.error('[QuickWins] Scheduled search error:', error.message);
            }
        });

        this.cronJobs.push(cronJob);
        console.log('[QuickWins] Daily job search scheduled:', time);
    }

    /**
     * Set reminder for job application follow-up
     * @param {string} userId - User ID
     * @param {number} jobIndex - Job index
     * @param {number} daysFromNow - Days until reminder
     */
    setReminder(userId, jobIndex, daysFromNow = 7) {
        const reminders = this.reminders.get(userId) || [];
        reminders.push({
            jobIndex: jobIndex,
            daysLeft: daysFromNow,
            createdAt: Date.now()
        });
        this.reminders.set(userId, reminders);

        console.log(`[QuickWins] Reminder set for job ${jobIndex} in ${daysFromNow} days`);
    }

    /**
     * Check reminders and send notifications
     * @param {Object} sock - Socket reference
     */
    async checkReminders(sock) {
        const now = Date.now();

        for (const [userId, reminders] of this.reminders.entries()) {
            const updatedReminders = [];

            for (const reminder of reminders) {
                const daysPassed = (now - reminder.createdAt) / (1000 * 60 * 60 * 24);
                const daysLeft = reminder.daysLeft - daysPassed;

                if (daysLeft <= 0) {
                    // Send reminder
                    const job = jobOrchestrator.getJobDetails(reminder.jobIndex);
                    if (job && sock?.user) {
                        let message = `⏰ *RAPPEL CANDIDATURE*\n`;
                        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                        message += `Offre: ${job.job.title}\n`;
                        message += `Entreprise: ${job.job.company}\n\n`;
                        message += `💡 N'oubliez pas de relancer si aucune réponse !\n`;
                        message += `🔗 ${job.job.url}\n\n`;
                        message += `!jobs apply ${reminder.jobIndex + 1} - Marquer comme relancé`;

                        try {
                            await sock.sendMessage(userId, { text: message });
                        } catch (error) {
                            console.error('[QuickWins] Reminder send error:', error.message);
                        }
                    }
                } else {
                    updatedReminders.push(reminder);
                }
            }

            if (updatedReminders.length > 0) {
                this.reminders.set(userId, updatedReminders);
            } else {
                this.reminders.delete(userId);
            }
        }
    }

    /**
     * Export jobs to CSV
     * @param {Array} jobs - Jobs to export
     * @param {string} filename - Output filename
     * @returns {Object} {filepath, token, size}
     */
    exportJobsToCSV(jobs, filename = 'offres_emploi.csv') {
        try {
            console.log('[QuickWins] Exporting jobs to CSV...');

            const token = require('crypto').randomBytes(8).toString('hex');
            const filepath = path.join(this.exportDir, `${token}_${filename}`);

            // CSV header
            let csv = 'Poste,Entreprise,Localisation,Type,Remote,Matching %,Compétences,URL\n';

            // Add jobs
            jobs.forEach(item => {
                const job = item.job;
                const match = item.match;
                const skills = match.analysis.strengths.join('; ');

                const row = [
                    `"${job.title}"`,
                    `"${job.company}"`,
                    `"${job.location}"`,
                    `"${job.type}"`,
                    job.remote ? 'Oui' : 'Non',
                    match.fitPercentage,
                    `"${skills}"`,
                    `"${job.url}"`
                ];

                csv += row.join(',') + '\n';
            });

            fs.writeFileSync(filepath, csv, 'utf-8');

            const stats = fs.statSync(filepath);

            console.log('[QuickWins] ✅ CSV exported:', filename);

            return {
                filepath: filepath,
                filename: filename,
                token: token,
                size: stats.size,
                rows: jobs.length
            };

        } catch (error) {
            console.error('[QuickWins] CSV export error:', error.message);
            return null;
        }
    }

    /**
     * Export jobs to Excel (via CSV, open with Excel)
     * @param {Array} jobs - Jobs to export
     * @returns {Object} Export info
     */
    exportJobsToExcel(jobs) {
        // Excel can open CSV files directly
        return this.exportJobsToCSV(jobs, 'offres_emploi.xlsx');
    }

    /**
     * Generate digest email/message
     * @param {Array} jobs - Jobs for digest
     * @returns {string} Digest text
     */
    generateDigest(jobs) {
        if (jobs.length === 0) {
            return '❌ Aucune offre trouvée.';
        }

        let digest = `📋 *RÉSUMÉ OFFRES D'EMPLOI*\n`;
        digest += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Summary
        digest += `📊 Statistiques:\n`;
        digest += `• Total: ${jobs.length} offres\n`;

        const avgMatch = Math.round(jobs.reduce((sum, j) => sum + j.match.fitPercentage, 0) / jobs.length);
        digest += `• Moyenne matching: ${avgMatch}%\n`;

        const remote = jobs.filter(j => j.job.remote).length;
        digest += `• Remote: ${remote}/${jobs.length}\n\n`;

        // Top offers
        digest += `🏆 Top 3 meilleures offres:\n`;
        jobs.slice(0, 3).forEach((item, i) => {
            digest += `${i + 1}. ${item.job.title} (${item.job.company}) - ${item.match.fitPercentage}%\n`;
        });

        digest += `\n💡 Actions:\n`;
        digest += `!jobs search - Nouvelle recherche\n`;
        digest += `!export - Exporter en CSV\n`;

        return digest;
    }

    /**
     * Get export file
     * @param {string} token - Export token
     * @returns {Object} Export metadata
     */
    getExport(token) {
        try {
            const files = fs.readdirSync(this.exportDir);
            const file = files.find(f => f.startsWith(token));

            if (!file) return null;

            const filepath = path.join(this.exportDir, file);
            const stats = fs.statSync(filepath);

            return {
                filepath: filepath,
                filename: file,
                size: stats.size,
                mimeType: 'text/csv'
            };

        } catch (error) {
            console.error('[QuickWins] Get export error:', error.message);
            return null;
        }
    }

    /**
     * Cleanup old exports
     */
    cleanupExports() {
        try {
            const files = fs.readdirSync(this.exportDir);
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            let deleted = 0;

            files.forEach(file => {
                const filepath = path.join(this.exportDir, file);
                const stats = fs.statSync(filepath);

                if (now - stats.mtimeMs > oneDayMs) {
                    fs.unlinkSync(filepath);
                    deleted++;
                }
            });

            if (deleted > 0) {
                console.log(`[QuickWins] Cleanup: Deleted ${deleted} old exports`);
            }

        } catch (error) {
            console.error('[QuickWins] Cleanup error:', error.message);
        }
    }

    /**
     * Stop all cron jobs
     */
    stopAllJobs() {
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs = [];
        console.log('[QuickWins] All cron jobs stopped');
    }

    /**
     * Get stats
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cronJobsActive: this.cronJobs.length,
            reminders: this.reminders.size,
            exports: fs.readdirSync(this.exportDir).length
        };
    }
}

// Singleton instance
const quickWinsServiceInstance = new QuickWinsService();

// Cleanup exports every 1 hour
setInterval(() => {
    quickWinsServiceInstance.cleanupExports();
}, 60 * 60 * 1000);

module.exports = quickWinsServiceInstance;
