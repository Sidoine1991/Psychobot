/**
 * !track - Job application tracking
 * Usage:
 *   !track - Show all applications
 *   !track add <jobIndex> - Add job as application
 *   !track status <index> <newStatus> - Update status
 *   !track note <index> <note> - Add note
 */

const jobTracker = require('../src/services/jobTracker');
const jobOrchestrator = require('../src/services/jobOrchestrator');

module.exports = {
    name: 'track',
    description: 'Suivi des candidatures',
    category: 'productivity',
    usage: '!track [add|status|note]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;

        try {
            const action = args[0]?.toLowerCase() || 'list';

            await sock.sendPresenceUpdate('composing', remoteJid);

            // Show all
            if (action === 'list' || action === undefined) {
                const message = jobTracker.formatApplications(userId);
                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Add application
            else if (action === 'add') {
                const jobIndex = parseInt(args[1]) - 1;
                const jobItem = jobOrchestrator.getJobDetails(jobIndex);

                if (!jobItem) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Offre non trouvée'
                    }, { quoted: msg });
                    return;
                }

                jobTracker.addApplication(userId, jobItem.job, 'Applied');

                let message = `✅ Candidature enregistrée\n\n`;
                message += `Offre: ${jobItem.job.title}\n`;
                message += `Entreprise: ${jobItem.job.company}\n`;
                message += `Date: ${new Date().toLocaleDateString('fr-FR')}\n\n`;
                message += `💡 !track note ${args[1]} <note> - Ajouter une note`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Update status
            else if (action === 'status' && args[1]) {
                const index = parseInt(args[1]) - 1;
                const newStatus = args[2]?.toUpperCase() || 'FOLLOW_UP';

                const apps = jobTracker.getAllApplications(userId);
                if (index < 0 || index >= apps.length) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Index invalide'
                    }, { quoted: msg });
                    return;
                }

                const app = apps[index];
                jobTracker.updateStatus(userId, app.jobId, newStatus);

                await sock.sendMessage(remoteJid, {
                    text: `✅ Statut mis à jour: ${newStatus}`
                }, { quoted: msg });
            }

            // Add note
            else if (action === 'note' && args[1]) {
                const index = parseInt(args[1]) - 1;
                const note = args.slice(2).join(' ');

                const apps = jobTracker.getAllApplications(userId);
                if (index < 0 || index >= apps.length) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Index invalide'
                    }, { quoted: msg });
                    return;
                }

                const app = apps[index];
                jobTracker.addNote(userId, app.jobId, note);

                await sock.sendMessage(remoteJid, {
                    text: `✅ Note ajoutée`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Track] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
