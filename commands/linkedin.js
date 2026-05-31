/**
 * !linkedin - LinkedIn auto-posting helper
 * Usage:
 *   !linkedin job <jobIndex> - Generate post for job application
 *   !linkedin success <title> | <company> - Post job success
 *   !linkedin project <name> | <description> - Post project
 */

const linkedinAutoService = require('../src/services/linkedinAutoService');
const jobOrchestrator = require('../src/services/jobOrchestrator');

module.exports = {
    name: 'linkedin',
    description: 'Générer posts LinkedIn',
    category: 'productivity',
    usage: '!linkedin [job|success|project]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const action = args[0]?.toLowerCase();

            await sock.sendPresenceUpdate('composing', remoteJid);

            // Generate post from job
            if (action === 'job') {
                const jobIndex = parseInt(args[1]) - 1;
                const jobItem = jobOrchestrator.getJobDetails(jobIndex);

                if (!jobItem) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Offre non trouvée'
                    }, { quoted: msg });
                    return;
                }

                const post = linkedinAutoService.generatePostFromApplication(
                    jobItem.job,
                    jobItem.match
                );

                const preview = linkedinAutoService.formatPreview(post);
                await sock.sendMessage(remoteJid, { text: preview }, { quoted: msg });

                // Send copyable text
                await sock.sendMessage(remoteJid, {
                    text: `\n\n📋 Copier-coller sur LinkedIn:\n\n${post}`
                }, { quoted: msg });
            }

            // Generate success post
            else if (action === 'success') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 2) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Format: !linkedin success <title> | <company>'
                    }, { quoted: msg });
                    return;
                }

                const post = linkedinAutoService.generatePostFromSuccess(
                    parts[0],
                    parts[1],
                    'Data Science'
                );

                const preview = linkedinAutoService.formatPreview(post);
                await sock.sendMessage(remoteJid, { text: preview }, { quoted: msg });

                await sock.sendMessage(remoteJid, {
                    text: `\n\n📋 Texte LinkedIn:\n\n${post}`
                }, { quoted: msg });
            }

            // Generate project post
            else if (action === 'project') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 2) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Format: !linkedin project <nom> | <description>'
                    }, { quoted: msg });
                    return;
                }

                const post = linkedinAutoService.generatePostFromProject(
                    parts[0],
                    parts[1]
                );

                const preview = linkedinAutoService.formatPreview(post);
                await sock.sendMessage(remoteJid, { text: preview }, { quoted: msg });

                await sock.sendMessage(remoteJid, {
                    text: `\n\n📋 Texte LinkedIn:\n\n${post}`
                }, { quoted: msg });
            }

            else {
                await sock.sendMessage(remoteJid, {
                    text: `❌ Commande inconnue\n\nUsage:\n!linkedin job <N>\n!linkedin success <title>|<company>\n!linkedin project <nom>|<desc>`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('[LinkedIn] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
