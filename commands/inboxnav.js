/**
 * !inbox with navigation (next/prev/page N)
 *
 * Usage:
 *   !inbox - Page 1 (défaut 5 emails)
 *   !inbox next - Page suivante
 *   !inbox prev - Page précédente
 *   !inbox page 3 - Aller à la page 3
 *   !inbox 10 - Afficher 10 emails par page
 */

const gmail = require('../src/services/gmail');
const userSession = require('../src/services/userSession');

module.exports = {
    name: 'inbox',
    description: 'Voir inbox Gmail avec navigation',
    category: 'productivity',
    usage: '!inbox [next|prev|page N|nombre]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const userId = msg.key.remoteJid; // Use phone number as user ID

        try {
            await sock.sendPresenceUpdate('composing', remoteJid);

            const session = userSession.getSession(userId);
            let action = 'display'; // display, next, prev, page

            // Parse arguments
            if (args.length > 0) {
                const firstArg = args[0].toLowerCase();

                if (firstArg === 'next') {
                    action = 'next';
                } else if (firstArg === 'prev' || firstArg === 'previous') {
                    action = 'prev';
                } else if (firstArg === 'page' && args[1]) {
                    action = 'page';
                    const pageNum = parseInt(args[1]);
                    if (!isNaN(pageNum)) {
                        session.gmail.targetPage = pageNum;
                    }
                } else if (firstArg === 'unread') {
                    // Handled by unread filter
                    action = 'display';
                    session.gmail.filter = 'unread';
                } else {
                    // Number = page size
                    const num = parseInt(firstArg);
                    if (!isNaN(num) && num > 0 && num <= 50) {
                        session.gmail.pageSize = num;
                        session.gmail.currentPage = 1; // Reset to page 1
                        action = 'display';
                    }
                }
            }

            // Handle navigation
            if (action === 'next') {
                const newPage = userSession.nextPage(userId);
                if (!newPage) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Vous êtes déjà sur la dernière page.'
                    }, { quoted: msg });
                    return;
                }
            } else if (action === 'prev') {
                const newPage = userSession.prevPage(userId);
                if (!newPage) {
                    await sock.sendMessage(remoteJid, {
                        text: '❌ Vous êtes déjà sur la première page.'
                    }, { quoted: msg });
                    return;
                }
            } else if (action === 'page') {
                const targetPage = session.gmail.targetPage;
                const newPage = userSession.goToPage(userId, targetPage);
                if (!newPage) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Page ${targetPage} invalide.`
                    }, { quoted: msg });
                    return;
                }
            }

            // Fetch messages
            const pageSize = session.gmail.pageSize;
            const currentPage = session.gmail.currentPage;
            const category = session.gmail.category || 'INBOX';

            console.log(`[Inbox Nav] User: ${userId}, Page: ${currentPage}, Size: ${pageSize}`);

            const result = await gmail.getMessagesByCategory(category, pageSize, session.gmail.pageToken);

            if (result.messages.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '📭 *Inbox vide*\n\nAucun message.'
                }, { quoted: msg });
                return;
            }

            // Update session
            userSession.updateGmailState(userId, {
                emails: result.messages,
                totalEmails: result.totalEstimate,
                pageToken: result.nextPageToken
            });

            const pageInfo = userSession.getPageInfo(userId);

            // Format messages
            let message = `📬 *Inbox Gmail*\n`;
            message += `📄 Page ${pageInfo.currentPage}/${pageInfo.totalPages} (${pageInfo.totalEmails} total)\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            result.messages.forEach((email, index) => {
                const emailNumber = (currentPage - 1) * pageSize + index + 1;
                const unreadIcon = email.isUnread ? '🔵 ' : '';
                const starIcon = email.isStarred ? '⭐ ' : '';

                message += `${unreadIcon}${starIcon}*${emailNumber}.* ${email.subject || '(Sans sujet)'}\n`;
                message += `   ID: \`${email.id.substring(0, 8)}\`\n`;
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

            // Navigation hints
            const navHints = [];
            if (pageInfo.hasPrev) navHints.push('⬅️ !inbox prev');
            if (pageInfo.hasMore) navHints.push('➡️ !inbox next');
            navHints.push(`📄 !inbox page N`);

            message += navHints.join(' • ') + '\n\n';
            message += `📝 Actions: !delete <id> • !archive <id> • !star <id>`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Inbox Nav] ✅ Page ${currentPage} displayed (${result.messages.length} emails)`);

        } catch (error) {
            console.error('[Inbox Nav] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la lecture de l\'inbox.\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
