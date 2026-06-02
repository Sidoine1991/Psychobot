/**
 * !prospect - Job prospecting and screening
 * Usage:
 *   !prospect search <keywords> [location] - Search and prospect jobs
 *   !prospect pending - Show jobs pending review
 *   !prospect score <ID> <A-F> <0-100> - Score a job
 *   !prospect high - Show high-score jobs (ready to apply)
 */

const jobProspector = require('../src/services/jobProspector');
const rdsClient = require('../src/db/rdsClient');

module.exports = {
    name: 'prospect',
    description: 'Prospect et score des offres d\'emploi',
    category: 'productivity',
    usage: '!prospect [search|pending|score|high]',

    async run({ sock, msg, args, text }) {
        const remoteJid = msg.key.remoteJid;

        try {
            let action = args?.[0]?.toLowerCase() || 'help';

            await sock.sendPresenceUpdate('composing', remoteJid);

            // ACTION 1: Search and prospect jobs from web
            if (action === 'search') {
                const keywords = args[1] || 'software engineer';
                const location = args[2] || 'Remote';

                await sock.sendMessage(remoteJid, {
                    text: `🔍 *PROSPECTION EN COURS*\n━━━━━━━━━━━━━━━━━━━━\n\n📍 Mots-clés: ${keywords}\n📌 Localisation: ${location}\n\n⏳ Scrapping Indeed, LinkedIn, Glassdoor...`
                }, { quoted: msg });

                try {
                    const result = await jobProspector.prospectJobs(keywords, location, 20);

                    let message = `✅ *PROSPECTION TERMINÉE*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                    message += `📊 *Résultats:*\n`;
                    message += `  • Stockées: ${result.stored}/${result.total}\n`;
                    message += `  • Status: PENDING_REVIEW\n\n`;

                    if (result.errors.length > 0) {
                        message += `⚠️ *Erreurs:* ${result.errors.length}\n\n`;
                    }

                    message += `📋 *Prochaines étapes:*\n`;
                    message += `1️⃣ Voir les offres: !prospect pending\n`;
                    message += `2️⃣ Scorer une offre: !prospect score <ID> A 90\n`;
                    message += `3️⃣ Voir top scores: !prospect high`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Erreur prospection: ${err.message}`
                    }, { quoted: msg });
                }
            }

            // ACTION 2: Show pending jobs for review
            else if (action === 'pending') {
                await sock.sendMessage(remoteJid, {
                    text: `📋 Chargement des offres en attente...`
                }, { quoted: msg });

                try {
                    const pending = await jobProspector.getPendingJobs(15);

                    if (pending.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: `❌ Aucune offre en attente de review\n\nLancez: !prospect search`
                        }, { quoted: msg });
                        return;
                    }

                    let message = `📋 *OFFRES EN ATTENTE (${pending.length})*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

                    pending.slice(0, 10).forEach((job, i) => {
                        message += `${i + 1}. *${job.company}*\n`;
                        message += `   📌 ${job.role}\n`;
                        message += `   🔗 ${job.source}\n`;
                        message += `   ID: ${job.id}\n\n`;
                    });

                    if (pending.length > 10) {
                        message += `... et ${pending.length - 10} autres\n\n`;
                    }

                    message += `💬 *Pour scorer:*\n`;
                    message += `!prospect score <ID> <A-F> <0-100>\n\n`;
                    message += `Exemple: !prospect score ${pending[0]?.id} B 75`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Erreur: ${err.message}`
                    }, { quoted: msg });
                }
            }

            // ACTION 3: Score a job
            else if (action === 'score') {
                const jobId = parseInt(args[1]);
                const letterGrade = args[2]?.toUpperCase() || 'C';
                const numericScore = parseInt(args[3]) || 50;

                if (!jobId || isNaN(jobId)) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Format: !prospect score <ID> <A-F> <0-100>\n\nExemple: !prospect score 42 A 90`
                    }, { quoted: msg });
                    return;
                }

                try {
                    const gradeMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };
                    const scored = await jobProspector.scoreJob(jobId, letterGrade, numericScore, {
                        cvMatch: Math.random() * 100,
                        roleClarity: Math.random() * 100,
                        levelStrategy: Math.random() * 100,
                        compensationResearch: Math.random() * 100,
                        growthTrajectory: Math.random() * 100
                    });

                    if (!scored) {
                        await sock.sendMessage(remoteJid, {
                            text: `❌ Offre non trouvée (ID: ${jobId})`
                        }, { quoted: msg });
                        return;
                    }

                    let message = `✅ *OFFRE SCORÉE*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                    message += `🏢 ${scored.company}\n`;
                    message += `📌 ${scored.role}\n\n`;
                    message += `⭐ *Score:* ${letterGrade} (${numericScore}/100)\n`;
                    message += `📊 Status: SCORED\n\n`;

                    if (numericScore >= 75) {
                        message += `🎯 *PRÊT POUR CANDIDATURE!*\n`;
                        message += `!jobs apply ${jobId}`;
                    } else {
                        message += `💭 À revoir plus tard`;
                    }

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Erreur scoring: ${err.message}`
                    }, { quoted: msg });
                }
            }

            // ACTION 4: Show high-score jobs (ready to apply)
            else if (action === 'high') {
                try {
                    const highScore = await jobProspector.getHighScoreJobs(75);

                    if (highScore.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: `⚠️ Aucune offre avec score >= 75\n\n1. Lancez prospection: !prospect search\n2. Scorez les offres: !prospect pending`
                        }, { quoted: msg });
                        return;
                    }

                    let message = `🎯 *TOP SCORES (>= 75) - PRÊT POUR CANDIDATURE*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

                    highScore.slice(0, 10).forEach((job, i) => {
                        message += `${i + 1}. ${job.company} - ${job.role}\n`;
                        message += `   ⭐ ${job.overall_score} (${job.numeric_score}/100)\n`;
                        message += `   🔗 ${job.source}\n\n`;
                    });

                    if (highScore.length > 10) {
                        message += `... et ${highScore.length - 10} autres\n\n`;
                    }

                    message += `💼 *Pour candidater:*\n`;
                    message += `!jobs apply <ID>`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } catch (err) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Erreur: ${err.message}`
                    }, { quoted: msg });
                }
            }

            // Help
            else {
                let message = `📋 *COMMANDE PROSPECT*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `🔍 *Search & Prospect*\n`;
                message += `!prospect search <keywords> [location]\n`;
                message += `Exemple: !prospect search "senior engineer" "Remote"\n\n`;

                message += `📋 *Review Jobs*\n`;
                message += `!prospect pending - Voir offres en attente\n\n`;

                message += `⭐ *Score Jobs*\n`;
                message += `!prospect score <ID> <A-F> <0-100>\n`;
                message += `Exemple: !prospect score 42 A 90\n\n`;

                message += `🎯 *High Scores*\n`;
                message += `!prospect high - Offres prêtes (>= 75)\n\n`;

                message += `💡 *Workflow:*\n`;
                message += `1️⃣ Search → 2️⃣ Pending → 3️⃣ Score → 4️⃣ High → 5️⃣ Apply`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Prospect] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
