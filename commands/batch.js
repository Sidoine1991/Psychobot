/**
 * !batch - Batch process multiple job offers
 * Usage:
 *   !batch search <keyword1> <keyword2> - Search and process 50+ offers
 *   !batch process - Process already-scraped jobs
 *   !batch report - Show batch report
 */

const batchProcessorService = require('../src/services/batchProcessorService');
const jobScraper = require('../src/services/jobScraper');

module.exports = {
    name: 'batch',
    description: 'Traitement par lot de 50+ offres',
    category: 'productivity',
    usage: '!batch [search|process|report]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const action = args[0]?.toLowerCase();

            await sock.sendPresenceUpdate('composing', remoteJid);

            // ACTION 1: Search and process batch
            if (action === 'search') {
                const keywords = args.slice(1);

                if (keywords.length === 0) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Usage: !batch search <keyword1> <keyword2> ...\n\nExample:\n!batch search "Data Engineer" "Python" "Remote"`
                    }, { quoted: msg });
                    return;
                }

                let message = `🔍 *BATCH SEARCH STARTED*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `Keywords: ${keywords.join(', ')}\n`;
                message += `⏳ This will take 2-3 minutes...\n`;
                message += `📊 Processing up to 50 offers\n`;
                message += `⚙️ Evaluating with Career-Ops scoring\n\n`;
                message += `Status updates incoming...`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });

                try {
                    // Step 1: Scrape jobs
                    const statusMsg1 = await sock.sendMessage(remoteJid, {
                        text: `🔍 Step 1/4: Scraping job offers...`
                    });

                    const allJobs = await jobScraper.searchAll({
                        keywords: keywords,
                        location: 'remote',
                        limit: 50
                    });

                    console.log(`[Batch] Scraped ${allJobs.length} jobs`);

                    if (allJobs.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: `❌ No jobs found for: ${keywords.join(', ')}`
                        }, { quoted: msg });
                        return;
                    }

                    const statusMsg2 = await sock.sendMessage(remoteJid, {
                        text: `✅ Found ${allJobs.length} offers\n\n📊 Step 2/4: Scoring with Career-Ops...`
                    });

                    // Step 2: Process batch
                    const batchResult = await batchProcessorService.processBatch(allJobs, {
                        generatePDFs: false, // Skip PDFs for now (too slow)
                        exportCSV: true,
                        minScore: 'C',
                        maxWorkers: 5
                    });

                    if (!batchResult.success) {
                        await sock.sendMessage(remoteJid, {
                            text: `❌ Batch processing failed: ${batchResult.error}`
                        }, { quoted: msg });
                        return;
                    }

                    // Step 3: Send summary
                    const summary = batchProcessorService.formatBatchSummaryForWhatsApp(batchResult);

                    await sock.sendMessage(remoteJid, {
                        text: `✅ Step 3/4: Ranking complete\n\n${summary}`
                    });

                    // Store for further use
                    global.lastBatchResult = batchResult;

                    const statusMsg3 = await sock.sendMessage(remoteJid, {
                        text: `✅ Step 4/4: Complete!\n\n💡 Next: !batch report - See details`
                    });

                } catch (error) {
                    console.error('[Batch] Error during search:', error);
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Batch search error: ${error.message}`
                    }, { quoted: msg });
                }
            }

            // ACTION 2: Show batch report
            else if (action === 'report') {
                if (!global.lastBatchResult) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ No batch results available.\n\nFirst: !batch search <keywords>`
                    }, { quoted: msg });
                    return;
                }

                const { ranked } = global.lastBatchResult;

                let message = `📄 *TOP OPPORTUNITIES (A-RATED)*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

                if (ranked.A.length === 0) {
                    message += `No A-rated offers found.`;
                } else {
                    ranked.A.slice(0, 5).forEach((job, i) => {
                        message += `${i + 1}. *${job.company}*\n`;
                        message += `   Role: ${job.title}\n`;
                        message += `   Score: A (${job.match.numeric_score}/100)\n`;
                        message += `   Location: ${job.location} (Remote: ${job.remote ? 'Yes' : 'No'})\n`;
                        message += `   Link: ${job.url}\n\n`;
                    });

                    if (ranked.A.length > 5) {
                        message += `... and ${ranked.A.length - 5} more A-rated offers\n\n`;
                    }
                }

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `B-Rated: ${ranked.B.length}\n`;
                message += `C-Rated: ${ranked.C.length}\n\n`;

                message += `💡 Use: !track add | Company | Role | A`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            // ACTION 3: Export details
            else if (action === 'export') {
                if (!global.lastBatchResult) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ No batch results available`
                    }, { quoted: msg });
                    return;
                }

                const stats = batchProcessorService.getStats();
                let message = `📊 *BATCH EXPORT INFO*\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `Reports saved to: ${stats.reportsDir}\n`;
                message += `Max workers: ${stats.maxWorkers}\n\n`;
                message += `Files generated:\n`;
                message += `✅ CSV with all offers and scores\n`;
                message += `📊 Full ranking by dimension\n\n`;

                message += `Download from server:\n`;
                message += `${stats.reportsDir}/batch-results-*.csv`;

                await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
            }

            else {
                let helpMessage = `❌ Unknown command\n\n`;
                helpMessage += `Usage:\n`;
                helpMessage += `!batch search <keyword1> <keyword2> - Search 50+ offers\n`;
                helpMessage += `!batch report - Show top opportunities\n`;
                helpMessage += `!batch export - Export info\n\n`;

                helpMessage += `Examples:\n`;
                helpMessage += `!batch search "Data Engineer" "Python" "Remote"\n`;
                helpMessage += `!batch search "FinTech" "ML" "Remote"`;

                await sock.sendMessage(remoteJid, { text: helpMessage }, { quoted: msg });
            }

        } catch (error) {
            console.error('[Batch] Error:', error.message);
            await sock.sendMessage(remoteJid, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};
