const gmail = require('../src/services/gmail');
const attachmentManager = require('../src/services/attachmentManager');

module.exports = {
    name: 'thread',
    description: 'Voir conversation complète avec pièces jointes',
    category: 'productivity',
    usage: '!thread <thread_id> ou lire l\'email 9',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !thread <thread_id>' }, { quoted: msg });
                return;
            }

            const threadId = args[0];
            const thread = await gmail.getThread(threadId);

            let message = `💬 *Conversation* (${thread.messageCount} messages)\n━━━━━━━━━━━━━━━━━━━━\n\n`;

            thread.messages.forEach((email, i) => {
                message += `*Message ${i+1}*\n`;
                message += `📤 ${email.from}\n`;
                message += `📝 ${email.subject}\n`;
                message += `🕐 ${email.date.toLocaleString('fr-FR')}\n`;
                message += `💬 ${email.body.substring(0, 200)}...\n\n`;
            });

            await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });

            // Check for attachments in the first message
            if (thread.messages.length > 0) {
                const firstMessage = thread.messages[0];
                const attachments = await gmail.getAttachmentsList(firstMessage.id);

                if (attachments.length > 0) {
                    // Send attachment info
                    let attachmentMsg = `📎 *${attachments.length} Pièce(s) jointe(s)*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

                    for (const attachment of attachments) {
                        try {
                            // Download and cache attachment
                            const cached = await attachmentManager.downloadAndCache(
                                firstMessage.id,
                                attachment.partId,
                                attachment.filename,
                                attachment.mimeType
                            );

                            if (cached) {
                                const sizeStr = cached.size < 1024 ? `${cached.size} KB` : `${(cached.size / 1024).toFixed(1)} MB`;
                                const downloadUrl = `https://psychobot-1si7.onrender.com/download/${cached.token}`;

                                attachmentMsg += `📄 *${attachment.filename}* (${sizeStr})\n`;
                                attachmentMsg += `🔗 ${downloadUrl}\n\n`;
                            }
                        } catch (error) {
                            console.error('[Thread] Attachment cache error:', error.message);
                            attachmentMsg += `❌ ${attachment.filename} - Erreur cache\n`;
                        }
                    }

                    attachmentMsg += `⏱️ Les liens expirent dans 24h`;

                    await sock.sendMessage(remoteJid, { text: attachmentMsg }, { quoted: msg });
                }
            }

        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
