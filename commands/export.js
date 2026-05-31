/**
 * !export - Export jobs and data
 * Usage:
 *   !export - Export current jobs to CSV
 *   !export csv - Same as above
 *   !export digest - Show daily digest
 */

const jobOrchestrator = require('../src/services/jobOrchestrator');
const quickWinsService = require('../src/services/quickWinsService');

module.exports = {
    name: 'export',
    description: 'Exporter données offres',
    category: 'productivity',
    usage: '!export [csv|digest]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const action = args[0]?.toLowerCase() || 'csv';

            await sock.sendPresenceUpdate('composing', remoteJid);

            const dailyJobs = jobOrchestrator.getDailyJobs();

            // CSV export
            if (action === 'csv' || action === 'export') {
                if (dailyJobs.length === 0) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Aucune offre à exporter. Utilisez: !jobs search'
                    }, { quoted: msg });
                    return;
                }

                const exportInfo = quickWinsService.exportJobsToCSV(dailyJobs);

                if (!exportInfo) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Erreur export'
                    }, { quoted: msg });
                    return;
                }

                const downloadUrl = `https://psychobot-1si7.onrender.com/download/export/${exportInfo.token}`;

                let message = `📊 *EXPORT OFFRES*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `📁 Fichier: ${exportInfo.filename}\n`;
                message += `📋 Lignes: ${exportInfo.rows}\n`;
                message += `💾 Taille: ${Math.round(exportInfo.size / 1024)} KB\n\n`;

                message += `🔗 Télécharger:\n`;
                message += downloadUrl + `\n\n`;

                message += `⏱️ Lien valide 24h\n`;
                message += `💡 Ouvrable dans Excel/Sheets`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Digest
            else if (action === 'digest') {
                const digest = quickWinsService.generateDigest(dailyJobs);
                await sock.sendMessage(remoteJid, { text: digest }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Export] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
