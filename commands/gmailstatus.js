/**
 * !gmailstatus - Vérifier le statut d'autorisation Gmail
 *
 * Usage:
 *   !gmailstatus - Afficher le statut de l'autorisation Gmail
 */

const googleOAuth = require('../src/integrations/googleOAuth');

module.exports = {
    name: 'gmailstatus',
    description: 'Vérifier le statut d\'autorisation Gmail',
    category: 'productivity',
    usage: '!gmailstatus',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;

        try {
            const status = googleOAuth.getStatus();

            let message = `📊 *Statut Gmail OAuth*\n\n`;

            if (status.authorized) {
                message += `✅ *Autorisé*\n\n`;
                message += `🔑 Access Token: ${status.hasAccessToken ? 'Présent' : 'Absent'}\n`;
                message += `⏰ Expire le: ${status.expiryDate || 'N/A'}\n`;
                message += `📝 Statut: ${status.isExpired ? '⚠️ Expiré (sera renouvelé automatiquement)' : '✅ Valide'}\n\n`;

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `✅ *Commandes disponibles:*\n\n`;
                message += `• !inbox - Voir emails\n`;
                message += `• !send - Envoyer email\n`;
                message += `• !search - Rechercher\n`;
                message += `• !contacts - Contacts\n\n`;

                message += `🔄 Pour révoquer l'accès:\n`;
                const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://your-app.onrender.com';
                message += `${renderUrl}/oauth/revoke`;

            } else {
                message += `❌ *Non autorisé*\n\n`;
                message += `KolaBoT n'a pas encore accès à votre Gmail.\n\n`;
                message += `Pour autoriser l'accès, utilisez:\n`;
                message += `!authorize`;
            }

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log('[GmailStatus Command] Status sent');

        } catch (error) {
            console.error('[GmailStatus Command] Error:', error.message);

            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
