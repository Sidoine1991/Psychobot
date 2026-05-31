/**
 * !search - Rechercher dans Gmail
 *
 * Usage:
 *   !search sujet important - Recherche simple
 *   !search from:john@example.com - Recherche avancée
 *   !search subject:meeting after:2026/05/01 - Query Gmail complète
 */

const gmail = require('../src/services/gmail');

module.exports = {
    name: 'search',
    description: 'Rechercher des emails dans Gmail',
    category: 'productivity',
    usage: '!search <query>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            if (args.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !search <query>\n\n' +
                        'Exemples:\n' +
                        '• !search projet important\n' +
                        '• !search from:john@example.com\n' +
                        '• !search subject:meeting\n' +
                        '• !search has:attachment\n' +
                        '• !search after:2026/05/01\n\n' +
                        '📖 Syntaxe Gmail complète supportée'
                }, { quoted: msg });
                return;
            }

            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            const query = args.join(' ');
            console.log(`[Search Command] Searching: ${query}`);

            const messages = await gmail.searchMessages(query, 10);

            if (messages.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `🔍 *Recherche: "${query}"*\n\n❌ Aucun résultat trouvé.`
                }, { quoted: msg });
                return;
            }

            // Format results
            let message = `🔍 *Résultats pour: "${query}"*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            messages.forEach((email, index) => {
                const unreadIcon = email.isUnread ? '🔵 ' : '';
                const importantIcon = email.isImportant ? '⭐ ' : '';

                message += `${unreadIcon}${importantIcon}*${index + 1}.* ${email.subject || '(Sans sujet)'}\n`;
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
            message += `📊 Total: ${messages.length} résultat${messages.length > 1 ? 's' : ''}`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Search Command] ✅ Returned ${messages.length} results`);

        } catch (error) {
            console.error('[Search Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la recherche.\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
