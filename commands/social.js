const gmail = require('../src/services/gmail');

module.exports = {
    name: 'social',
    description: 'Onglet Réseaux sociaux',
    category: 'productivity',
    usage: '!social',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;
        try {
            const result = await gmail.getMessagesByCategory('CATEGORY_SOCIAL', 5);
            
            if (result.messages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📭 Aucun message dans Réseaux sociaux' }, { quoted: msg });
                return;
            }
            
            let message = `👥 *Réseaux sociaux* (${result.totalEstimate})\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            result.messages.forEach((email, i) => {
                message += `*${i+1}.* ${email.subject || '(Sans sujet)'}\n   📤 ${email.from}\n\n`;
            });
            
            await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
