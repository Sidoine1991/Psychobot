/**
 * !prep - Interview preparation & STAR story management
 * Usage:
 *   !prep list - List all stories
 *   !prep add | Title | Situation | Task | Action | Result | Reflection | Confidence - Add story
 *   !prep roles <jobIndex> - Show relevant stories for job
 *   !prep story <N> - Show story N details
 */

const interviewPrepService = require('../src/services/interviewPrepService');
const jobOrchestrator = require('../src/services/jobOrchestrator');

module.exports = {
    name: 'prep',
    description: 'Préparation entretien et STAR stories',
    category: 'productivity',
    usage: '!prep [list|add|roles|story]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const action = args[0]?.toLowerCase();

            await sock.sendPresenceUpdate('composing', remoteJid);

            // ACTION 1: List all stories
            if (action === 'list') {
                const stories = interviewPrepService.listAllStories();

                if (stories.length === 0) {
                    await sock.sendMessage(remoteJid, {
                        text: '📚 No stories yet.\n\nAdd your first STAR story:\n!prep add | Title | Situation | Task | Action | Result | Reflection | High'
                    }, { quoted: msg });
                    return;
                }

                let message = `📚 *INTERVIEW PREP STORY BANK*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `Total stories: ${stories.length}\n\n`;

                stories.forEach((story, index) => {
                    const conf = `${story.confidence === 'High' ? '⭐' : story.confidence === 'Medium' ? '✓' : '○'}`;
                    message += `${index + 1}. ${story.title} ${conf}\n`;
                    if (story.roles.length > 0) {
                        message += `   For: ${story.roles.join(', ')}\n`;
                    }
                });

                message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
                message += `!prep story <N> - See details\n`;
                message += `!prep roles <jobN> - Stories for job N\n`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 2: Add new story
            else if (action === 'add') {
                const input = args.slice(1).join(' ');
                const parts = input.split('|').map(p => p.trim());

                if (parts.length < 6) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Format incorrect.\n\nUtilisez:\n!prep add | Title | Situation | Task | Action | Result | Reflection | Confidence\n\nExample:\n!prep add | Scaling | Had 1 customer | Scale to 100 | Built automation | 10x growth | Automation beats hiring | High`
                    }, { quoted: msg });
                    return;
                }

                const [title, situation, task, action2, result, reflection, confidence] = parts;

                const success = await interviewPrepService.addStory({
                    title,
                    situation,
                    task,
                    action: action2,
                    result,
                    reflection,
                    roles: [],
                    confidence: confidence || 'Medium',
                    keywords: []
                });

                if (success) {
                    let message = `✅ *Story Added!*\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                    message += `📖 ${title}\n`;
                    message += `🏆 ${result}\n\n`;
                    message += `⭐ Confidence: ${confidence}\n\n`;
                    message += `💡 Use this story in interviews:\n`;
                    message += `"${situation}\n...\nResult: ${result}"\n\n`;
                    message += `📚 Total stories: ${interviewPrepService.getStats().totalStories}`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Error adding story'
                    }, { quoted: msg });
                }
            }

            // ACTION 3: Show stories relevant to a job
            else if (action === 'roles') {
                const jobIndex = parseInt(args[1]) - 1;
                const job = jobOrchestrator.getJobDetails(jobIndex);

                if (!job) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Job not found.\n\nFirst: !jobs search'
                    }, { quoted: msg });
                    return;
                }

                const relevantStories = interviewPrepService.getStoriesForRole(job.job);

                if (relevantStories.length === 0) {
                    let message = `🤔 No stories yet for: *${job.job.title}*\n\n`;
                    message += `Let's add one!\n\n`;
                    message += `!prep add | Title | Situation | Task | Action | Result | Reflection | High`;

                    await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
                    return;
                }

                let message = `🎯 *TOP STORIES FOR THIS ROLE*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `*${job.job.title}* @ ${job.job.company}\n\n`;

                relevantStories.forEach((story, index) => {
                    message += `${index + 1}. *${story.title}*\n`;
                    message += `   ${story.result}\n`;
                    message += `   Confidence: ${story.confidence}\n\n`;
                });

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `!prep story <N> - Full details`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 4: Show single story details
            else if (action === 'story') {
                const storyIndex = parseInt(args[1]) - 1;
                const stories = interviewPrepService.listAllStories();

                if (storyIndex < 0 || storyIndex >= stories.length) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Story not found'
                    }, { quoted: msg });
                    return;
                }

                const story = stories[storyIndex];
                const formatted = interviewPrepService.formatStoryForWhatsApp(story);

                await sock.sendMessage(remoteJid, { text: formatted }, { quoted: msg });
            }

            // Stats
            else if (action === 'stats') {
                const stats = interviewPrepService.getStats();

                let message = `📊 *Interview Prep Stats*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `📚 Total stories: ${stats.totalStories}\n`;
                message += `💼 Role types: ${stats.rolesCount}\n`;
                message += `⭐ High confidence: ${stats.highConfidence}\n`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            else {
                let message = `❌ Unknown command\n\n`;
                message += `Usage:\n`;
                message += `!prep list - All stories\n`;
                message += `!prep add | Title | Situation | Task | Action | Result | Reflection | Confidence\n`;
                message += `!prep roles <jobN> - Stories for job N\n`;
                message += `!prep story <N> - Story details\n`;
                message += `!prep stats - Statistics`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Prep] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};
