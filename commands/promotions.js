const gmail = require('../src/services/gmail');

module.exports = {
    name: 'promotions',
    description: 'Onglet Promotions',
    category: 'productivity',
    usage: '!promotions',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;
        try {
            const result = await gmail.getMessagesByCategory('CATEGORY_PROMOTIONS', 5);
            
            if (result.messages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📭 Aucune promotion' }, { quoted: msg });
                return;
            }
            
            let message = `🏷️ *Promotions* (${result.totalEstimate})\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            result.messages.forEach((email, i) => {
                message += `*${i+1}.* ${email.subject || '(Sans sujet)'}\n   📤 ${email.from}\n\n`;
            });
            
            await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
