/**
 * Job Tracker - Track job applications and follow-ups
 */

class JobTracker {
    constructor() {
        // Store: {userId -> {jobId -> {status, appliedDate, followUpDate, notes}}}
        this.applications = new Map();
    }

    /**
     * Add job application
     * @param {string} userId - User ID
     * @param {Object} job - Job object
     * @param {string} notes - Optional notes
     * @returns {Object} Application record
     */
    addApplication(userId, job, notes = '') {
        if (!this.applications.has(userId)) {
            this.applications.set(userId, {});
        }

        const apps = this.applications.get(userId);
        const jobId = job.id;

        const application = {
            jobId: jobId,
            title: job.title,
            company: job.company,
            url: job.url,
            status: 'APPLIED', // APPLIED, INTERVIEW, OFFER, REJECTED, FOLLOW_UP
            appliedDate: new Date(),
            followUpDate: null,
            notes: notes,
            stages: [
                {
                    stage: 'APPLIED',
                    date: new Date(),
                    note: 'Candidature envoyée'
                }
            ]
        };

        apps[jobId] = application;

        console.log(`[JobTracker] Application added: ${job.title} - ${job.company}`);

        return application;
    }

    /**
     * Update application status
     * @param {string} userId - User ID
     * @param {string} jobId - Job ID
     * @param {string} newStatus - New status
     * @param {string} note - Stage note
     */
    updateStatus(userId, jobId, newStatus, note = '') {
        if (!this.applications.has(userId)) {
            return null;
        }

        const apps = this.applications.get(userId);
        const app = apps[jobId];

        if (!app) {
            return null;
        }

        app.status = newStatus;
        app.stages.push({
            stage: newStatus,
            date: new Date(),
            note: note
        });

        // Set follow-up date if needed
        if (newStatus === 'INTERVIEW') {
            app.followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
        } else if (newStatus === 'FOLLOW_UP') {
            app.followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        console.log(`[JobTracker] Status updated: ${app.title} → ${newStatus}`);

        return app;
    }

    /**
     * Add follow-up note
     * @param {string} userId - User ID
     * @param {string} jobId - Job ID
     * @param {string} note - Note content
     */
    addNote(userId, jobId, note) {
        if (!this.applications.has(userId)) {
            return null;
        }

        const apps = this.applications.get(userId);
        const app = apps[jobId];

        if (!app) {
            return null;
        }

        app.notes += `\n[${new Date().toLocaleDateString('fr-FR')}] ${note}`;

        console.log(`[JobTracker] Note added to ${app.title}`);

        return app;
    }

    /**
     * Get all applications
     * @param {string} userId - User ID
     * @returns {Array} Applications
     */
    getAllApplications(userId) {
        if (!this.applications.has(userId)) {
            return [];
        }

        const apps = this.applications.get(userId);
        return Object.values(apps);
    }

    /**
     * Get applications by status
     * @param {string} userId - User ID
     * @param {string} status - Status filter
     * @returns {Array} Filtered applications
     */
    getByStatus(userId, status) {
        const all = this.getAllApplications(userId);
        return all.filter(app => app.status === status);
    }

    /**
     * Get pending follow-ups
     * @param {string} userId - User ID
     * @returns {Array} Applications needing follow-up
     */
    getPendingFollowUps(userId) {
        const all = this.getAllApplications(userId);
        const now = new Date();

        return all.filter(app => {
            if (!app.followUpDate) return false;
            return app.followUpDate <= now && app.status !== 'REJECTED';
        });
    }

    /**
     * Get application details
     * @param {string} userId - User ID
     * @param {string} jobId - Job ID
     * @returns {Object} Application details
     */
    getApplication(userId, jobId) {
        if (!this.applications.has(userId)) {
            return null;
        }

        const apps = this.applications.get(userId);
        return apps[jobId] || null;
    }

    /**
     * Format applications for WhatsApp display
     * @param {string} userId - User ID
     * @returns {string} Formatted message
     */
    formatApplications(userId) {
        const all = this.getAllApplications(userId);

        if (all.length === 0) {
            return '📭 Aucune candidature enregistrée.';
        }

        let message = `📊 *MES CANDIDATURES*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Stats
        const stats = {
            total: all.length,
            applied: all.filter(a => a.status === 'APPLIED').length,
            interview: all.filter(a => a.status === 'INTERVIEW').length,
            offer: all.filter(a => a.status === 'OFFER').length,
            rejected: all.filter(a => a.status === 'REJECTED').length,
            followup: all.filter(a => a.status === 'FOLLOW_UP').length
        };

        message += `📈 Statistiques:\n`;
        message += `• Total: ${stats.total}\n`;
        message += `• En attente: ${stats.applied}\n`;
        message += `• Entretien: ${stats.interview}\n`;
        message += `• Offre: ${stats.offer}\n`;
        message += `• Rejetée: ${stats.rejected}\n\n`;

        // By status
        const byStatus = {
            'APPLIED': '⏳ En attente',
            'INTERVIEW': '🎤 Entretien',
            'OFFER': '🎉 Offre reçue',
            'REJECTED': '❌ Rejetée',
            'FOLLOW_UP': '📞 À relancer'
        };

        for (const [status, label] of Object.entries(byStatus)) {
            const apps = all.filter(a => a.status === status);
            if (apps.length > 0) {
                message += `${label}:\n`;
                apps.forEach(app => {
                    const daysAgo = Math.floor((Date.now() - app.appliedDate) / (1000 * 60 * 60 * 24));
                    message += `  • ${app.title} - ${app.company} (${daysAgo}j)\n`;
                });
                message += `\n`;
            }
        }

        message += `💡 !track details <index> - Voir détails`;

        return message;
    }

    /**
     * Get stats
     * @param {string} userId - User ID
     * @returns {Object} Statistics
     */
    getStats(userId) {
        const all = this.getAllApplications(userId);

        return {
            total: all.length,
            applied: all.filter(a => a.status === 'APPLIED').length,
            interview: all.filter(a => a.status === 'INTERVIEW').length,
            offer: all.filter(a => a.status === 'OFFER').length,
            rejected: all.filter(a => a.status === 'REJECTED').length,
            followup: all.filter(a => a.status === 'FOLLOW_UP').length
        };
    }

    /**
     * Delete application
     * @param {string} userId - User ID
     * @param {string} jobId - Job ID
     */
    deleteApplication(userId, jobId) {
        if (this.applications.has(userId)) {
            const apps = this.applications.get(userId);
            delete apps[jobId];
        }
    }

    /**
     * Export applications to array
     * @param {string} userId - User ID
     * @returns {Array} Applications
     */
    export(userId) {
        return this.getAllApplications(userId);
    }
}

// Singleton instance
const jobTrackerInstance = new JobTracker();

module.exports = jobTrackerInstance;
