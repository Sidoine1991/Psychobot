/**
 * !authorize - Obtenir le lien d'autorisation Gmail
 *
 * Usage:
 *   !authorize - Obtenir le lien pour autoriser l'accès Gmail
 */

module.exports = {
    name: 'authorize',
    description: 'Autoriser KolaBoT à accéder à Gmail',
    category: 'productivity',
    usage: '!authorize',

    async run({ sock, msg }) {
        const remoteJid = msg.key.remoteJid;

        try {
            // Get the authorization URL
            const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://your-app.onrender.com';
            const authUrl = `${renderUrl}/oauth/authorize`;

            const message = `🔐 *Autorisation Gmail*\n\n` +
                `Pour que KolaBoT puisse accéder à votre Gmail personnel, cliquez sur ce lien:\n\n` +
                `🔗 ${authUrl}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📋 *Que va-t-il se passer ?*\n\n` +
                `1️⃣ Vous serez redirigé vers Google\n` +
                `2️⃣ Connectez-vous avec votre compte Gmail\n` +
                `3️⃣ Autorisez l'accès (lecture + envoi emails)\n` +
                `4️⃣ KolaBoT recevra un token d'accès sécurisé\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `✅ *Une fois autorisé, vous pourrez :*\n\n` +
                `• !inbox - Voir vos emails\n` +
                `• !send - Envoyer des emails\n` +
                `• !search - Rechercher dans Gmail\n` +
                `• !contacts - Gérer vos contacts\n\n` +
                `🔒 *Sécurité:* KolaBoT ne stocke jamais votre mot de passe,\n` +
                `uniquement un token temporaire que vous pouvez révoquer à tout moment.`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log('[Authorize Command] Authorization link sent');

        } catch (error) {
            console.error('[Authorize Command] Error:', error.message);

            await sock.sendMessage(remoteJid, {
                text: `❌ Erreur: ${error.message}`
            }, { quoted: msg });
        }
    }
};
