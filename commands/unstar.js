const gmail = require('../src/services/gmail');

module.exports = {
    name: 'unstar',
    description: 'Retirer étoile',
    category: 'productivity',
    usage: '!unstar <message_id>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !unstar <message_id>' }, { quoted: msg });
                return;
            }
            const messageId = args[0];
            await gmail.unstarMessage(messageId);
            await sock.sendMessage(remoteJid, { text: `✅ Étoile retirée` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
