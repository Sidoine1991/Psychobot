/**
 * !track - Job application tracking with follow-up cadence
 * Usage:
 *   !track - Show all applications
 *   !track followup - Show follow-up suggestions
 *   !track add <company> | <role> | <score> - Add application manually
 *   !track status <company> | <status> - Update status
 */

const followUpService = require('../src/services/followUpService');
const jobOrchestrator = require('../src/services/jobOrchestrator');

module.exports = {
    name: 'track',
    description: 'Suivi des candidatures et relances',
    category: 'productivity',
    usage: '!track [followup|add|status]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const action = args[0]?.toLowerCase() || 'list';

            await sock.sendPresenceUpdate('composing', remoteJid);

            // ACTION 1: Show all applications
            if (action === 'list' || action === undefined) {
                const stats = followUpService.getStats();
                const statusGroups = followUpService.getApplicationsByStatus();

                let message = `📊 *APPLICATIONS TRACKER*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `📈 *Stats:*\n`;
                message += `Total: ${stats.total} | Applied: ${stats.applied} | Interviews: ${stats.interview} | Offers: ${stats.offered}\n`;
                message += `Avg pipeline: ${stats.avgDaysInPipeline} days\n\n`;

                // Show by status
                if (stats.applied > 0) {
                    message += `🟡 *Applied (${stats.applied}):*\n`;
                    statusGroups['Applied'].slice(0, 3).forEach((app, i) => {
                        message += `${i + 1}. ${app.company} - ${app.role}\n`;
                    });
                    if (stats.applied > 3) message += `   ... and ${stats.applied - 3} more\n`;
                    message += `\n`;
                }

                if (stats.interview > 0) {
                    message += `🟢 *Interview (${stats.interview}):*\n`;
                    statusGroups['Interview'].forEach((app, i) => {
                        message += `${i + 1}. ${app.company} - ${app.role}\n`;
                    });
                    message += `\n`;
                }

                if (stats.offered > 0) {
                    message += `🎉 *Offers (${stats.offered}):*\n`;
                    statusGroups['Offered'].forEach((app, i) => {
                        message += `${i + 1}. ${app.company} - ${app.role}\n`;
                    });
                    message += `\n`;
                }

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `!track followup - See follow-up suggestions\n`;
                message += `!track add | Company | Role | Score - Add application`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 2: Show follow-up suggestions
            else if (action === 'followup') {
                const formatted = followUpService.formatSuggestionsForWhatsApp();
                await sock.sendMessage(remoteJid, { text: formatted }, { quoted: msg });
            }

            // ACTION 3: Add application manually
            else if (action === 'add') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 2) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Format: !track add | Company | Role | Score (optional)\n\nExample:\n!track add | TechCorp | Data Engineer | A`
                    }, { quoted: msg });
                    return;
                }

                const [company, role, score] = parts;

                const success = followUpService.addApplication({
                    company,
                    role,
                    score: score || 'B',
                    notes: ''
                });

                if (success) {
                    let message = `✅ *Application Added*\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                    message += `🏢 ${company}\n`;
                    message += `💼 ${role}\n`;
                    message += `⭐ Score: ${score || 'B'}\n`;
                    message += `📅 Applied: Today\n`;
                    message += `📞 First follow-up: In 7 days\n\n`;
                    message += `💡 Tip: !track followup - See when to follow up`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Error adding application'
                    }, { quoted: msg });
                }
            }

            // ACTION 4: Update status
            else if (action === 'status') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 2) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Format: !track status | Company | Status\n\nStatus options: Applied, Contacted, Interview, Offered, Rejected`
                    }, { quoted: msg });
                    return;
                }

                const [company, status] = parts;

                const success = followUpService.updateStatus(company, status);

                if (success) {
                    await sock.sendMessage(remoteJid, {
                        text: `✅ Status updated for ${company}: ${status}`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Company not found: ${company}`
                    }, { quoted: msg });
                }
            }

            // ACTION 5: Generate and send follow-up message
            else if (action === 'followup-send') {
                const company = args.slice(1).join(' ');
                const apps = followUpService.loadApplications();
                const app = apps.find(a => a.company.toLowerCase().includes(company.toLowerCase()));

                if (!app) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Application not found for: ${company}`
                    }, { quoted: msg });
                    return;
                }

                const message = followUpService.generateFollowUpMessage(app);

                let preview = `📨 *Follow-up Message*\n`;
                preview += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                preview += `To: ${app.company}\n`;
                preview += `Role: ${app.role}\n\n`;
                preview += `Message:\n${message}\n\n`;
                preview += `━━━━━━━━━━━━━━━━━━━━\n`;
                preview += `💡 Copy this to LinkedIn/email`;

                await sock.sendMessage(remoteJid, { text: preview }, { quoted: msg });

                // Send actual message to copy
                await sock.sendMessage(remoteJid, { text: `📋 Copy message:\n\n${message}` });
            }

            else {
                let helpMessage = `❌ Unknown command\n\n`;
                helpMessage += `Usage:\n`;
                helpMessage += `!track - List all applications\n`;
                helpMessage += `!track followup - Follow-up suggestions\n`;
                helpMessage += `!track add | Company | Role | Score\n`;
                helpMessage += `!track status | Company | Status\n`;
                helpMessage += `!track followup-send | Company - Generate follow-up message`;

                await sock.sendMessage(remoteJid, { text: helpMessage }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Track] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};
