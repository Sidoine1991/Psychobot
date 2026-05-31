const gmail = require('../src/services/gmail');

module.exports = {
    name: 'thread',
    description: 'Voir conversation complète',
    category: 'productivity',
    usage: '!thread <thread_id>',

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
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
