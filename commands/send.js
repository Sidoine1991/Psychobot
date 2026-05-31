/**
 * !send - Envoyer un email via Gmail
 *
 * Usage:
 *   !send john@example.com | Sujet du message | Corps du message ici
 */

const gmail = require('../src/services/gmail');

module.exports = {
    name: 'send',
    description: 'Envoyer un email via Gmail',
    category: 'productivity',
    usage: '!send <email> | <sujet> | <message>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !send <email> | <sujet> | <message>\n\n' +
                        'Exemple:\n' +
                        '!send john@example.com | Réunion demain | Bonjour John, confirmes-tu pour demain 10h ?'
                }, { quoted: msg });
                return;
            }

            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            // Parse arguments (separated by |)
            const fullText = args.join(' ');
            const parts = fullText.split('|').map(p => p.trim());

            if (parts.length < 3) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Format incorrect. Utilisez:\n' +
                        '!send <email> | <sujet> | <message>\n\n' +
                        'Les 3 parties doivent être séparées par |'
                }, { quoted: msg });
                return;
            }

            const to = parts[0];
            const subject = parts[1];
            const body = parts[2];

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(to)) {
                await sock.sendMessage(remoteJid, {
                    text: `❌ Format d'email invalide: ${to}\n\n` +
                        'Veuillez fournir un email valide.'
                }, { quoted: msg });
                return;
            }

            console.log(`[Send Command] Sending email to: ${to}`);

            const result = await gmail.sendEmail({
                to,
                subject,
                body
            });

            let message = '✅ *Email envoyé avec succès*\n\n';
            message += `📧 *À:* ${to}\n`;
            message += `📝 *Sujet:* ${subject}\n`;
            message += `💬 *Message:* ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}\n\n`;
            message += `🆔 ID: ${result.id}`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Send Command] ✅ Email sent: ${result.id}`);

        } catch (error) {
            console.error('[Send Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de l\'envoi de l\'email.\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
