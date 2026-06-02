/**
 * !crm - Complete CRM management
 * Usage:
 *   !crm - Show all prospects
 *   !crm add <name> | <email> | <company> - Add prospect
 *   !crm hot - Show hot prospects
 *   !crm update <index> <status> - Update status
 */

const crmService = require('../src/services/crmService');

module.exports = {
    name: 'crm',
    description: 'Gestion CRM prospects',
    category: 'productivity',
    usage: '!crm [add|hot|update]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;

        try {
            const action = args[0]?.toLowerCase() || 'list';

            await sock.sendPresenceUpdate('composing', remoteJid);

            // List all
            if (action === 'list' || action === undefined) {
                const message = crmService.formatProspects(userId);
                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Add prospect
            else if (action === 'add') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 3) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Format: !crm add <nom> | <email> | <company>'
                    }, { quoted: msg });
                    return;
                }

                const prospect = crmService.addProspect(userId, {
                    name: parts[0],
                    email: parts[1],
                    company: parts[2],
                    source: 'Manual'
                });

                let message = `✅ Prospect ajouté\n\n`;
                message += `👤 ${prospect.name}\n`;
                message += `📧 ${prospect.email}\n`;
                message += `🏢 ${prospect.company}\n`;
                message += `📍 Statut: ${prospect.status}`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Hot prospects
            else if (action === 'hot') {
                const hot = crmService.getHotProspects(userId);

                if (hot.length === 0) {
                    await sock.sendMessage(remoteJid, {
                        text: '✅ Aucun prospect à relancer!'
                    }, { quoted: msg });
                    return;
                }

                let message = `🔥 *PROSPECTS À RELANCER*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

                hot.forEach((p, i) => {
                    const daysAgo = Math.floor((Date.now() - p.lastContact) / (1000 * 60 * 60 * 24));
                    message += `${i + 1}. ${p.name} (${p.company})\n`;
                    message += `   Dernier contact: ${daysAgo}j\n`;
                });

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Update status
            else if (action === 'update') {
                const index = parseInt(args[1]) - 1;
                const newStatus = args[2]?.toUpperCase() || 'CONTACTED';

                const all = crmService.getAllProspects(userId);
                if (index < 0 || index >= all.length) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Index invalide'
                    }, { quoted: msg });
                    return;
                }

                const prospect = all[index];
                crmService.updateStatus(userId, prospect.id, newStatus);

                await sock.sendMessage(remoteJid, {
                    text: `✅ Statut mis à jour: ${newStatus}`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('[CRM] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
