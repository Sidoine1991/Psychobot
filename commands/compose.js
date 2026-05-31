const userSession = require('../src/services/userSession');

module.exports = {
    name: 'compose',
    description: 'Composer email interactif',
    category: 'productivity',
    usage: '!compose',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;
        const userId = remoteJid;
        
        try {
            userSession.startCompose(userId);
            
            const helpText = `✉️ *Mode Compose Activé*

Commandes disponibles:

📤 !to <email> - Destinataire
📋 !cc <email> - Copie  
🔒 !bcc <email> - Copie cachée
📝 !subject <texte> - Sujet
💬 !body <texte> - Message
📨 !sendemail - Envoyer
❌ !cancel - Annuler

Exemple:
!to john@example.com
!subject Reunion demain
!body Bonjour John, confirmes-tu?
!sendemail`;
            
            await sock.sendMessage(remoteJid, { text: helpText }, { quoted: msg });
        } catch (error) {
            await sock.sendMessage(remoteJid, { text: `❌ Erreur: ${error.message}` }, { quoted: msg });
        }
    }
};
