/**
 * !jobs - Daily job offers management
 * Usage:
 *   !jobs - Show today's offers
 *   !jobs search - Search fresh jobs
 *   !jobs details <N> - Show offer N details
 *   !jobs letter <N> - Generate letter for offer N
 *   !jobs apply <N> - Quick apply
 */

const jobOrchestrator = require('../src/services/jobOrchestrator');
const interviewPrepService = require('../src/services/interviewPrepService');
const rdsClient = require('../src/db/rdsClient');

module.exports = {
    name: 'jobs',
    description: 'Recherche d\'emploi et génération de lettres',
    category: 'productivity',
    usage: '!jobs [search|details|letter|apply]',

    async run({ sock, msg, args, text }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;

        try {
            // Parse action from either args or message text
            let action = 'list';
            let jobIndex = -1;

            if (args && args[0]) {
                action = args[0].toLowerCase();
                jobIndex = parseInt(args[1]) - 1 || -1;
            } else if (text) {
                // Parse from natural language text
                const lowerText = text.toLowerCase();
                if (lowerText.includes('search')) {
                    action = 'search';
                } else if (lowerText.includes('details')) {
                    action = 'details';
                    const match = lowerText.match(/details\s*(\d+)/);
                    if (match) jobIndex = parseInt(match[1]) - 1;
                } else if (lowerText.includes('letter')) {
                    action = 'letter';
                    const match = lowerText.match(/letter\s*(\d+)/);
                    if (match) jobIndex = parseInt(match[1]) - 1;
                } else if (lowerText.includes('apply')) {
                    action = 'apply';
                    const match = lowerText.match(/apply\s*(\d+)/);
                    if (match) jobIndex = parseInt(match[1]) - 1;
                }
            }

            await sock.sendPresenceUpdate('composing', remoteJid);

            // ACTION 1: List daily jobs
            if (action === 'list' || action === undefined) {
                const dailyJobs = jobOrchestrator.getDailyJobs();

                if (dailyJobs.length === 0) {
                    await sock.sendMessage(remoteJid, {
                        text: '⚠️ Aucune offre en cache.\n\nUtilisez: !jobs search'
                    }, { quoted: msg });
                    return;
                }

                const message = jobOrchestrator.formatJobsForWhatsApp();
                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 2: Search fresh jobs from RDS
            else if (action === 'search') {
                await sock.sendMessage(remoteJid, {
                    text: '🔍 Recherche en cours...\n⏳ Traitement des offres'
                }, { quoted: msg });

                try {
                    // Get jobs from RDS database
                    const jobs = await rdsClient.getJobs(10);

                    if (jobs.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ Aucune offre trouvée dans la base de données.'
                        }, { quoted: msg });
                        return;
                    }

                    // Format jobs for WhatsApp
                    let message = '✅ *OFFRES D\'EMPLOI TROUVÉES*\n\n';
                    jobs.forEach((job, i) => {
                        message += `*${i + 1}. ${job.company}*\n`;
                        message += `   Role: ${job.role}\n`;
                        message += `   Score: ${job.overall_score} (${job.numeric_score}/100)\n\n`;
                    });
                    message += 'Utilisez: !jobs details <N> pour les détails\n';
                    message += 'Utilisez: !jobs letter <N> pour générer une lettre\n';
                    message += 'Utilisez: !jobs apply <N> pour appliquer';

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } catch (err) {
                    console.error('[Jobs] Search error:', err);
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Erreur lors de la recherche: ' + err.message
                    }, { quoted: msg });
                }
            }

            // ACTION 3: Show job details
            else if (action === 'details' && jobIndex >= 0) {
                const message = jobOrchestrator.formatJobDetails(jobIndex);
                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 4: Download letter
            else if (action === 'letter' && jobIndex >= 0) {
                const jobItem = jobOrchestrator.getJobDetails(jobIndex);

                if (!jobItem) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Offre non trouvée.'
                    }, { quoted: msg });
                    return;
                }

                const downloadUrl = jobOrchestrator.getLetterDownloadUrl(jobIndex);

                let message = `📝 *Lettre de Motivation*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `Offre: ${jobItem.job.title}\n`;
                message += `Entreprise: ${jobItem.job.company}\n`;
                message += `Score: ${jobItem.match.overall_score || jobItem.match.fitPercentage + '%'}\n\n`;

                message += `**Aperçu:**\n`;
                message += `${jobItem.letter.substring(0, 300)}...\n\n`;

                message += `📥 **Télécharger le document:**\n`;
                message += `🔗 ${downloadUrl}\n\n`;

                message += `⏱️ Le lien expire dans 24h`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });

                // Send interview prep prompt after 1 second
                setTimeout(async () => {
                    const prepPrompt = interviewPrepService.generateStoryPrompt(jobItem.job);
                    await sock.sendMessage(remoteJid, { text: prepPrompt });
                }, 1000);
            }

            // ACTION 5: Quick apply
            else if (action === 'apply' && jobIndex >= 0) {
                const jobItem = jobOrchestrator.getJobDetails(jobIndex);

                if (!jobItem) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Offre non trouvée.'
                    }, { quoted: msg });
                    return;
                }

                let message = `✅ *Candidature enregistrée*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

                message += `Offre: ${jobItem.job.title}\n`;
                message += `Entreprise: ${jobItem.job.company}\n`;
                message += `Lien: ${jobItem.job.url}\n\n`;

                message += `📋 **Prochaines étapes:**\n`;
                message += `1️⃣ Télécharger la lettre: !jobs letter ${jobIndex + 1}\n`;
                message += `2️⃣ Ajouter à votre profil LinkedIn\n`;
                message += `3️⃣ Envoyer CV + Lettre\n`;
                message += `4️⃣ Suivre l'avancement\n\n`;

                message += `💡 Conseil: Rappel dans 7 jours`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // Stats
            else if (action === 'stats') {
                const stats = jobOrchestrator.getStats();

                let message = `📊 *Statistiques*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

                message += `📋 Offres trouvées: ${stats.jobsFound}\n`;
                message += `🕐 Dernière recherche: ${stats.lastSearch ? stats.lastSearch.toLocaleString('fr-FR') : 'N/A'}\n`;
                message += `📄 Documents: ${stats.documents.count}\n`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            else {
                await sock.sendMessage(remoteJid, {
                    text: `❌ Commande inconnue\n\nUtilisation:\n!jobs - Liste offres\n!jobs search - Rechercher\n!jobs details <N>\n!jobs letter <N>\n!jobs apply <N>`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Jobs] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
