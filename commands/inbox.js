/**
 * !inbox - Voir les derniers emails de la boîte de réception
 *
 * Usage:
 *   !inbox - Voir les 5 derniers emails
 *   !inbox 10 - Voir les 10 derniers emails
 *   !inbox unread - Voir uniquement les non-lus
 */

const gmail = require('../src/services/gmail');

module.exports = {
    name: 'inbox',
    description: 'Voir les derniers emails Gmail',
    category: 'productivity',
    usage: '!inbox [nombre|unread]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            let maxResults = 5;
            let unreadOnly = false;

            // Parse arguments
            if (args.length > 0) {
                if (args[0].toLowerCase() === 'unread') {
                    unreadOnly = true;
                } else {
                    const num = parseInt(args[0]);
                    if (!isNaN(num) && num > 0 && num <= 20) {
                        maxResults = num;
                    }
                }
            }

            console.log(`[Inbox Command] Fetching ${maxResults} messages (unread: ${unreadOnly})`);

            const messages = await gmail.getInbox(maxResults, unreadOnly);

            if (messages.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `📭 *Inbox vide*\n\n${unreadOnly ? 'Aucun message non-lu.' : 'Aucun message.'}`
                }, { quoted: msg });
                return;
            }

            // Format messages
            let message = `📬 *Inbox Gmail*${unreadOnly ? ' (non-lus)' : ''}\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            messages.forEach((email, index) => {
                const unreadIcon = email.isUnread ? '🔵 ' : '';
                const importantIcon = email.isImportant ? '⭐ ' : '';
                const starredIcon = email.isStarred ? '⭐ ' : '';

                message += `${unreadIcon}${importantIcon}${starredIcon}*${index + 1}.* ${email.subject || '(Sans sujet)'}\n`;
                message += `   📤 ${email.from}\n`;

                const dateStr = email.date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                message += `   🕐 ${dateStr}\n`;
                message += `   💬 ${email.snippet}\n\n`;
            });

            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `📊 Total: ${messages.length} message${messages.length > 1 ? 's' : ''}`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Inbox Command] ✅ Returned ${messages.length} messages`);

        } catch (error) {
            console.error('[Inbox Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la lecture de l\'inbox.\n\n' +
                `Détails: ${error.message}\n\n` +
                'Vérifiez que:\n' +
                '• Gmail API est activée sur Google Cloud\n' +
                '• Le Service Account a accès à Gmail\n' +
                '• Les scopes Gmail sont configurés';

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
