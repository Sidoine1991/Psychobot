const gmail = require('../src/services/gmail');

module.exports = {
    name: 'spam',
    description: 'Marquer comme spam',
    category: 'productivity',
    usage: '!spam <message_id>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !spam <message_id>' }, { quoted: msg });
                return;
            }
            const messageId = args[0];
            await gmail.markAsSpam(messageId);
            await sock.sendMessage(remoteJid, { text: `✅ Marqué comme spam\n\n🚫 Message déplacé vers spam.` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
