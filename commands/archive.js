const gmail = require('../src/services/gmail');

module.exports = {
    name: 'archive',
    description: 'Archiver un email',
    category: 'productivity',
    usage: '!archive <message_id>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !archive <message_id>' }, { quoted: msg });
                return;
            }
            const messageId = args[0];
            await gmail.archiveMessage(messageId);
            await sock.sendMessage(remoteJid, { text: `✅ Email archivé\n\n📦 Message archivé.` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
