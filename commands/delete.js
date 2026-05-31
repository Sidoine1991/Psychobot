/**
 * !delete - Supprimer un email
 */

const gmail = require('../src/services/gmail');

module.exports = {
    name: 'delete',
    description: 'Supprimer un email Gmail',
    category: 'productivity',
    usage: '!delete <message_id>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !delete <message_id>\n\nL\'ID se trouve dans !inbox\nExemple: !delete 18f5a1b2'
                }, { quoted: msg });
                return;
            }

            await sock.sendPresenceUpdate('composing', remoteJid);

            const messageId = args[0];
            await gmail.deleteMessage(messageId);

            await sock.sendMessage(remoteJid, {
                text: `✅ Email supprimé\n\n🗑️ Message \`${messageId}\` supprimé.`
            }, { quoted: msg });

        } catch (error) {
            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
