/**
 * Follow-Up Service - Track applications and suggest when to follow up
 * Manages follow-up cadence and timing
 */

const fs = require('fs');
const path = require('path');

class FollowUpService {
    constructor() {
        this.applicationsPath = path.join(__dirname, '../../data/applications/applications.md');
        this.ensureApplicationsFileExists();
        this.applications = this.loadApplications();
    }

    /**
     * Ensure applications tracking file exists
     */
    ensureApplicationsFileExists() {
        const dir = path.dirname(this.applicationsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(this.applicationsPath)) {
            const template = `# Job Applications Tracker

## Active Applications

| Applied Date | Company | Role | Status | Score | Days Ago | Next Follow-up | Notes |
|---|---|---|---|---|---|---|---|

---

## Follow-up History

(Track all follow-ups here)

---

## Archived Applications

(Closed/rejected applications)

`;
            fs.writeFileSync(this.applicationsPath, template, 'utf-8');
        }
    }

    /**
     * Load all applications from file
     * @returns {Array} Parsed applications
     */
    loadApplications() {
        try {
            const content = fs.readFileSync(this.applicationsPath, 'utf-8');
            const applications = [];

            // Parse markdown table
            const lines = content.split('\n');
            let inTable = false;
            let tableStart = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('| Applied Date | Company')) {
                    inTable = true;
                    tableStart = i;
                    continue;
                }

                if (inTable && lines[i].includes('---')) {
                    continue;
                }

                if (inTable && lines[i].startsWith('|') && i > tableStart + 1) {
                    const cells = lines[i].split('|').map(c => c.trim()).filter(c => c);
                    if (cells.length >= 7) {
                        applications.push({
                            appliedDate: cells[0],
                            company: cells[1],
                            role: cells[2],
                            status: cells[3],
                            score: cells[4],
                            daysAgo: parseInt(cells[5]) || 0,
                            nextFollowUp: cells[6],
                            notes: cells[7] || ''
                        });
                    }
                }

                if (inTable && !lines[i].startsWith('|') && lines[i].trim().length > 0) {
                    inTable = false;
                }
            }

            return applications;
        } catch (error) {
            console.error('[FollowUpService] Error loading applications:', error.message);
            return [];
        }
    }

    /**
     * Add new application to tracker
     * @param {Object} app - Application object
     * @returns {boolean} Success
     */
    addApplication(app) {
        const {
            appliedDate = new Date().toISOString().split('T')[0],
            company = '',
            role = '',
            score = 'B',
            notes = ''
        } = app;

        // Calculate next follow-up (7 days from now)
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);
        const nextFollowUp = nextDate.toISOString().split('T')[0];

        const tableRow = `| ${appliedDate} | ${company} | ${role} | Applied | ${score} | 0 | ${nextFollowUp} | ${notes} |\n`;

        try {
            const content = fs.readFileSync(this.applicationsPath, 'utf-8');

            // Find where to insert (before the --- separator)
            const lines = content.split('\n');
            let insertIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('| Applied Date | Company')) {
                    // Find next empty line or separator
                    for (let j = i + 2; j < lines.length; j++) {
                        if (lines[j].includes('---') || lines[j].trim() === '') {
                            insertIndex = j;
                            break;
                        }
                    }
                    break;
                }
            }

            if (insertIndex > 0) {
                lines.splice(insertIndex, 0, tableRow);
                fs.writeFileSync(this.applicationsPath, lines.join('\n'), 'utf-8');
                this.applications = this.loadApplications();
                console.log('[FollowUpService] Application added:', company, role);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[FollowUpService] Error adding application:', error.message);
            return false;
        }
    }

    /**
     * Get follow-up suggestions
     * @returns {Object} Categorized suggestions
     */
    getFollowUpSuggestions() {
        const now = new Date();

        const suggestions = {
            now: [],         // Follow up TODAY
            thisWeek: [],    // 3-5 days
            nextWeek: [],    // 7+ days
            archive: []      // 30+ days, consider closing
        };

        this.applications.forEach(app => {
            const appliedDate = new Date(app.appliedDate);
            const daysSinceApplied = Math.floor((now - appliedDate) / (1000 * 60 * 60 * 24));

            if (app.status === 'Applied' || app.status === 'Contacted') {
                if (daysSinceApplied >= 7 && daysSinceApplied < 14) {
                    // First follow-up (7 days)
                    suggestions.now.push({
                        ...app,
                        daysSinceApplied,
                        action: '📌 First follow-up: Reach out via LinkedIn',
                        priority: 'HIGH'
                    });
                } else if (daysSinceApplied >= 3 && daysSinceApplied < 7) {
                    // Check if still active
                    suggestions.thisWeek.push({
                        ...app,
                        daysSinceApplied,
                        action: '📅 Check if role still active + prepare follow-up',
                        priority: 'MEDIUM'
                    });
                } else if (daysSinceApplied < 3) {
                    suggestions.nextWeek.push({
                        ...app,
                        daysSinceApplied,
                        action: '⏳ Wait before following up',
                        priority: 'LOW'
                    });
                }
            }

            if (daysSinceApplied >= 30 && (app.status === 'Applied' || app.status === 'Contacted')) {
                suggestions.archive.push({
                    ...app,
                    daysSinceApplied,
                    action: '📦 Consider archiving (30+ days, no response)',
                    priority: 'INFO'
                });
            }
        });

        return suggestions;
    }

    /**
     * Get applications by status
     * @returns {Object} Grouped by status
     */
    getApplicationsByStatus() {
        const grouped = {
            'Applied': [],
            'Contacted': [],
            'Interview': [],
            'Offered': [],
            'Rejected': [],
            'Archived': []
        };

        this.applications.forEach(app => {
            if (grouped[app.status]) {
                grouped[app.status].push(app);
            }
        });

        return grouped;
    }

    /**
     * Update application status
     * @param {string} company - Company name
     * @param {string} newStatus - New status (Applied, Contacted, Interview, Offered, Rejected)
     * @returns {boolean} Success
     */
    updateStatus(company, newStatus) {
        try {
            const content = fs.readFileSync(this.applicationsPath, 'utf-8');
            let updated = false;

            const lines = content.split('\n').map(line => {
                if (line.includes(`| ${company}`) || line.includes(company)) {
                    const cells = line.split('|').map(c => c.trim());
                    if (cells.length > 3) {
                        cells[3] = newStatus; // Update status column
                        updated = true;
                        return '| ' + cells.join(' | ');
                    }
                }
                return line;
            });

            if (updated) {
                fs.writeFileSync(this.applicationsPath, lines.join('\n'), 'utf-8');
                this.applications = this.loadApplications();
                console.log('[FollowUpService] Status updated for', company);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[FollowUpService] Error updating status:', error.message);
            return false;
        }
    }

    /**
     * Generate follow-up message
     * @param {Object} app - Application object
     * @returns {string} Follow-up message
     */
    generateFollowUpMessage(app) {
        const daysSince = app.daysSinceApplied || 7;

        if (daysSince < 7) {
            return `Hi there! 👋\n\nI applied for the ${app.role} position at ${app.company} a few days ago and I'm very excited about this opportunity.\n\nI wanted to check if you've had a chance to review my application. I'd love to discuss how my experience aligns with your needs.\n\nLooking forward to hearing from you!\n\nBest regards,\nSidoine`;
        } else if (daysSince < 14) {
            return `Hi there! 👋\n\nFollowing up on my application for the ${app.role} position at ${app.company} that I submitted ${daysSince} days ago.\n\nI remain very interested in joining your team and contributing to your mission. If you'd like to learn more about my background and how I can add value, I'd be happy to discuss.\n\nThank you for considering my application!\n\nBest regards,\nSidoine`;
        } else {
            return `Hi there! 👋\n\nI wanted to reach out one more time regarding the ${app.role} position at ${app.company}. I'm very enthusiastic about this opportunity and would love to understand if there's any movement on your end.\n\nIf the position has been filled, I appreciate you letting me know. Either way, I'd love to stay connected for future opportunities.\n\nThank you!\n\nBest regards,\nSidoine`;
        }
    }

    /**
     * Get stats
     * @returns {Object} Statistics
     */
    getStats() {
        const statuses = this.getApplicationsByStatus();

        return {
            total: this.applications.length,
            applied: statuses['Applied'].length,
            contacted: statuses['Contacted'].length,
            interview: statuses['Interview'].length,
            offered: statuses['Offered'].length,
            rejected: statuses['Rejected'].length,
            avgDaysInPipeline: this.applications.length > 0
                ? Math.round(
                    this.applications.reduce((sum, app) => sum + (app.daysAgo || 0), 0) / this.applications.length
                )
                : 0
        };
    }

    /**
     * Format suggestions for WhatsApp
     * @returns {string} Formatted message
     */
    formatSuggestionsForWhatsApp() {
        const suggestions = this.getFollowUpSuggestions();

        let message = `📞 *FOLLOW-UP SUGGESTIONS*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (suggestions.now.length > 0) {
            message += `🔴 *ACT NOW (${suggestions.now.length}):*\n`;
            suggestions.now.forEach(app => {
                message += `• ${app.company} - ${app.role}\n`;
                message += `  ${app.action}\n`;
            });
            message += `\n`;
        }

        if (suggestions.thisWeek.length > 0) {
            message += `🟡 *THIS WEEK (${suggestions.thisWeek.length}):*\n`;
            suggestions.thisWeek.forEach(app => {
                message += `• ${app.company} - ${app.role}\n`;
                message += `  ${app.action}\n`;
            });
            message += `\n`;
        }

        if (suggestions.nextWeek.length > 0) {
            message += `🟢 *KEEP WAITING (${suggestions.nextWeek.length}):*\n`;
            message += `${suggestions.nextWeek.length} applications are too new for follow-up\n\n`;
        }

        if (suggestions.archive.length > 0) {
            message += `⚫ *ARCHIVE? (${suggestions.archive.length}):*\n`;
            suggestions.archive.forEach(app => {
                message += `• ${app.company} - ${app.role} (${app.daysSinceApplied} days)\n`;
            });
            message += `\n`;
        }

        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `!track followup <company> - Send follow-up\n`;
        message += `!track status <company> | <status> - Update status`;

        return message;
    }
}

// Singleton instance
const followUpInstance = new FollowUpService();

module.exports = followUpInstance;
