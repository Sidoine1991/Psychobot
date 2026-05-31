const gmail = require('../src/services/gmail');
const userSession = require('../src/services/userSession');

module.exports = {
    name: 'primary',
    description: 'Onglet Principal Gmail',
    category: 'productivity',
    usage: '!primary',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;
        
        try {
            userSession.updateGmailState(userId, { category: 'INBOX', currentPage: 1 });
            
            const result = await gmail.getMessagesByCategory('INBOX', 5);
            
            if (result.messages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📭 Aucun message dans Principal' }, { quoted: msg });
                return;
            }
            
            let message = `📬 *Principal* (${result.totalEstimate} messages)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            result.messages.forEach((email, i) => {
                const unread = email.isUnread ? '🔵 ' : '';
                message += `${unread}*${i+1}.* ${email.subject || '(Sans sujet)'}\n`;
                message += `   ID: \`${email.id.substring(0,8)}\`\n`;
                message += `   📤 ${email.from}\n`;
                message += `   💬 ${email.snippet}\n\n`;
            });
            
            message += `━━━━━━━━━━━━━━━━━━━━\n➡️ !inbox next • !delete <id> • !archive <id>`;
            
            await sock.sendMessage(remoteJid, { text: message }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
