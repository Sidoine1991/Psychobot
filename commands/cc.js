const userSession = require('../src/services/userSession');

module.exports = {
    name: 'cc',
    description: 'Ajouter CC',
    category: 'productivity',
    usage: '!cc <email>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;
        
        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !cc <email>' }, { quoted: msg });
                return;
            }
            
            const session = userSession.getSession(userId);
            if (!session.compose.active) {
                await sock.sendMessage(remoteJid, { text: '❌ Mode compose non actif. Utilisez !compose' }, { quoted: msg });
                return;
            }
            
            const email = args[0];
            session.compose.cc.push(email);
            
            await sock.sendMessage(remoteJid, { text: `✅ CC ajouté: ${email}` }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
