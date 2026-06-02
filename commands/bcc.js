const userSession = require('../src/services/userSession');

module.exports = {
    name: 'bcc',
    description: 'Ajouter BCC',
    category: 'productivity',
    usage: '!bcc <email>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;
        
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !bcc <email>' }, { quoted: msg });
                return;
            }
            
            const session = userSession.getSession(userId);
            if (!session.compose.active) {
                await sock.sendMessage(remoteJid, { text: '❌ Mode compose non actif. Utilisez !compose' }, { quoted: msg });
                return;
            }
            
            const email = args[0];
            session.compose.bcc.push(email);
            
            await sock.sendMessage(remoteJid, { text: `✅ BCC ajouté: ${email}` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
