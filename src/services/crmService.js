/**
 * CRM Service - Complete prospect management
 */

class CRMService {
    constructor() {
        // Store: {userId -> {prospectId -> {name, email, phone, company, status, tags, notes, interactions}}}
        this.prospects = new Map();
        this.pipelines = new Map(); // userId -> {stage1, stage2, ...}
    }

    /**
     * Add new prospect
     * @param {string} userId - User ID
     * @param {Object} data - {name, email, phone, company, role, source}
     * @returns {Object} Prospect record
     */
    addProspect(userId, data) {
        if (!this.prospects.has(userId)) {
            this.prospects.set(userId, {});
        }

        const prospectId = `prospect_${Date.now()}`;
        const prospect = {
            id: prospectId,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            company: data.company,
            role: data.role || null,
            source: data.source || 'Manual', // Job, LinkedIn, Email, Referral, etc.
            status: 'NEW', // NEW, CONTACTED, INTERESTED, QUALIFIED, NEGOTIATING, WON, LOST
            tags: data.tags || [],
            notes: data.notes || '',
            addedDate: new Date(),
            lastContact: null,
            interactions: [],
            followUpDate: null
        };

        this.prospects.get(userId)[prospectId] = prospect;

        console.log(`[CRM] Prospect added: ${data.name}`);

        return prospect;
    }

    /**
     * Add interaction (call, email, meeting)
     * @param {string} userId - User ID
     * @param {string} prospectId - Prospect ID
     * @param {Object} interaction - {type, note, outcome}
     */
    addInteraction(userId, prospectId, interaction) {
        if (!this.prospects.has(userId)) return null;

        const prospect = this.prospects.get(userId)[prospectId];
        if (!prospect) return null;

        prospect.interactions.push({
            type: interaction.type, // CALL, EMAIL, MEETING, MESSAGE
            date: new Date(),
            note: interaction.note,
            outcome: interaction.outcome // POSITIVE, NEUTRAL, NEGATIVE
        });

        prospect.lastContact = new Date();

        // Update follow-up date
        if (interaction.outcome === 'POSITIVE') {
            prospect.followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
        } else if (interaction.outcome === 'NEUTRAL') {
            prospect.followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        console.log(`[CRM] Interaction added: ${prospect.name} - ${interaction.type}`);

        return prospect;
    }

    /**
     * Update prospect status
     * @param {string} userId - User ID
     * @param {string} prospectId - Prospect ID
     * @param {string} newStatus - New status
     */
    updateStatus(userId, prospectId, newStatus) {
        if (!this.prospects.has(userId)) return null;

        const prospect = this.prospects.get(userId)[prospectId];
        if (!prospect) return null;

        prospect.status = newStatus;

        if (newStatus === 'LOST') {
            prospect.followUpDate = null;
        } else if (newStatus === 'WON') {
            prospect.followUpDate = null;
        }

        console.log(`[CRM] Status updated: ${prospect.name} → ${newStatus}`);

        return prospect;
    }

    /**
     * Get all prospects
     * @param {string} userId - User ID
     * @returns {Array} Prospects
     */
    getAllProspects(userId) {
        if (!this.prospects.has(userId)) {
            return [];
        }

        return Object.values(this.prospects.get(userId));
    }

    /**
     * Get prospects by status
     * @param {string} userId - User ID
     * @param {string} status - Status filter
     * @returns {Array} Filtered prospects
     */
    getByStatus(userId, status) {
        const all = this.getAllProspects(userId);
        return all.filter(p => p.status === status);
    }

    /**
     * Get hot prospects (pending follow-up)
     * @param {string} userId - User ID
     * @returns {Array} Hot prospects
     */
    getHotProspects(userId) {
        const all = this.getAllProspects(userId);
        const now = new Date();

        return all.filter(p => {
            if (!p.followUpDate) return false;
            return p.followUpDate <= now && p.status !== 'WON' && p.status !== 'LOST';
        }).sort((a, b) => a.followUpDate - b.followUpDate);
    }

    /**
     * Get prospect pipeline stats
     * @param {string} userId - User ID
     * @returns {Object} Pipeline data
     */
    getPipeline(userId) {
        const all = this.getAllProspects(userId);

        const stages = {
            'NEW': all.filter(p => p.status === 'NEW').length,
            'CONTACTED': all.filter(p => p.status === 'CONTACTED').length,
            'INTERESTED': all.filter(p => p.status === 'INTERESTED').length,
            'QUALIFIED': all.filter(p => p.status === 'QUALIFIED').length,
            'NEGOTIATING': all.filter(p => p.status === 'NEGOTIATING').length,
            'WON': all.filter(p => p.status === 'WON').length,
            'LOST': all.filter(p => p.status === 'LOST').length
        };

        return {
            total: all.length,
            stages: stages,
            conversionRate: stages.WON / (all.length || 1),
            hotCount: this.getHotProspects(userId).length
        };
    }

    /**
     * Format prospects for WhatsApp
     * @param {string} userId - User ID
     * @returns {string} Formatted message
     */
    formatProspects(userId) {
        const all = this.getAllProspects(userId);

        if (all.length === 0) {
            return '📭 Aucun prospect enregistré.';
        }

        const hot = this.getHotProspects(userId);

        let message = `💼 *MON CRM*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Hot prospects
        if (hot.length > 0) {
            message += `🔥 À relancer immédiatement:\n`;
            hot.slice(0, 3).forEach(p => {
                message += `  • ${p.name} (${p.company})\n`;
            });
            message += `\n`;
        }

        // Stats
        const pipeline = this.getPipeline(userId);
        message += `📊 Pipeline:\n`;
        message += `  New: ${pipeline.stages.NEW}\n`;
        message += `  Contacté: ${pipeline.stages.CONTACTED}\n`;
        message += `  Intéressé: ${pipeline.stages.INTERESTED}\n`;
        message += `  Qualifié: ${pipeline.stages.QUALIFIED}\n`;
        message += `  En négociation: ${pipeline.stages.NEGOTIATING}\n`;
        message += `  🎉 Gagné: ${pipeline.stages.WON}\n`;
        message += `  ❌ Perdu: ${pipeline.stages.LOST}\n\n`;

        message += `💡 Commandes:\n`;
        message += `!crm add - Ajouter prospect\n`;
        message += `!crm hot - Voir hot prospects\n`;
        message += `!crm stats - Statistiques`;

        return message;
    }

    /**
     * Search prospects
     * @param {string} userId - User ID
     * @param {string} query - Search query
     * @returns {Array} Matching prospects
     */
    search(userId, query) {
        const all = this.getAllProspects(userId);
        const q = query.toLowerCase();

        return all.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.company.toLowerCase().includes(q)
        );
    }

    /**
     * Get stats
     * @param {string} userId - User ID
     * @returns {Object} Stats
     */
    getStats(userId) {
        const all = this.getAllProspects(userId);

        return {
            total: all.length,
            new: all.filter(p => p.status === 'NEW').length,
            hot: this.getHotProspects(userId).length,
            won: all.filter(p => p.status === 'WON').length,
            lost: all.filter(p => p.status === 'LOST').length
        };
    }

    /**
     * Delete prospect
     * @param {string} userId - User ID
     * @param {string} prospectId - Prospect ID
     */
    deleteProspect(userId, prospectId) {
        if (this.prospects.has(userId)) {
            delete this.prospects.get(userId)[prospectId];
        }
    }
}

// Singleton instance
const crmServiceInstance = new CRMService();

module.exports = crmServiceInstance;
