const gmail = require('../src/services/gmail');

module.exports = {
    name: 'star',
    description: 'Ajouter étoile',
    category: 'productivity',
    usage: '!star <message_id>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !star <message_id>' }, { quoted: msg });
                return;
            }
            const messageId = args[0];
            await gmail.starMessage(messageId);
            await sock.sendMessage(remoteJid, { text: `✅ Étoile ajoutée ⭐` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
