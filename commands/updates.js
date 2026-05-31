const gmail = require('../src/services/gmail');

module.exports = {
    name: 'updates',
    description: 'Onglet Mises à jour',
    category: 'productivity',
    usage: '!updates',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;
        try {
            const result = await gmail.getMessagesByCategory('CATEGORY_UPDATES', 5);
            
            if (result.messages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📭 Aucune mise à jour' }, { quoted: msg });
                return;
            }
            
            let message = `📢 *Mises à jour* (${result.totalEstimate})\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            result.messages.forEach((email, i) => {
                message += `*${i+1}.* ${email.subject || '(Sans sujet)'}\n   📤 ${email.from}\n\n`;
            });
            
            await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
