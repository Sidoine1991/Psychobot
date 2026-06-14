/**
 * !historique [nom] — Voir les échanges passés avec un contact WhatsApp
 *
 * Usage:
 *   !historique                     → liste les contacts les plus récents
 *   !historique inbox               → alias pour la liste
 *   !historique Jean                → échanges avec "Jean" (exact ou partiel)
 *   !historique +2290196911346      → recherche par numéro
 *   !historique Jean 50             → 50 derniers messages
 *
 * Accès réservé au propriétaire.
 */

const chatHistory = require('../src/services/chatHistory');

const ROLE_ICONS = {
    owner: '👤',
    user: '💬',
    bot: '🤖'
};

const TYPE_ICONS = {
    audio: '🎙️',
    image: '🖼️',
    video: '🎬',
    sticker: '🎭',
    document: '📎',
    text: ''
};

function formatDate(iso) {
    if (!iso) return '?';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMessage(entry, index) {
    const icon = ROLE_ICONS[entry.role] || '•';
    const typeIcon = TYPE_ICONS[entry.type] || '';
    const time = formatDate(entry.timestamp);
    const label = entry.role === 'owner' ? 'Toi' : entry.role === 'bot' ? 'Bot' : 'Eux';
    const preview = typeIcon
        ? `${typeIcon} [${entry.type}] ${entry.content}`
        : entry.content;

    return `${icon} *${label}* (${time})\n${preview}`;
}

module.exports = {
    name: 'historique',
    description: 'Voir les échanges WhatsApp passés avec un contact',
    category: 'admin',
    adminOnly: true,
    usage: '!historique [nom|numero|inbox] [limite]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        await sock.sendPresenceUpdate('composing', remoteJid);

        // --- Mode LISTE (aucun argument ou "inbox") ---
        const query = args[0];
        if (!query || query.toLowerCase() === 'inbox') {
            const contacts = chatHistory.listContacts(20);

            if (contacts.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '📭 *Historique vide*\n\nAucun échange enregistré pour le moment.\n_Les messages sont capturés au fil des conversations._'
                }, { quoted: msg });
                return;
            }

            let text = '📋 *Contacts récents*\n';
            text += '━━━━━━━━━━━━━━━━━━━━\n\n';

            contacts.forEach((c, i) => {
                const name = c.name || c.jid.split('@')[0];
                const last = formatDate(c.lastActivity);
                const count = c.messageCount || 0;
                text += `*${i + 1}.* ${name}\n`;
                text += `   📱 ${c.jid.split('@')[0]}\n`;
                text += `   🕐 ${last} | 💬 ${count} msg\n\n`;
            });

            text += '━━━━━━━━━━━━━━━━━━━━\n';
            text += `💡 _!historique [nom] pour voir les échanges_`;

            await sock.sendMessage(remoteJid, { text }, { quoted: msg });
            return;
        }

        // --- Mode RECHERCHE ---
        // Dernier argument peut être un nombre (limite)
        let limit = 30;
        let nameParts = [...args];
        const lastArg = args[args.length - 1];
        if (args.length > 1 && /^\d+$/.test(lastArg)) {
            limit = Math.min(parseInt(lastArg), 100);
            nameParts = args.slice(0, -1);
        }
        const searchName = nameParts.join(' ').replace(/^\+/, '');

        const contact = chatHistory.findContactByName(searchName);
        if (!contact) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *Contact introuvable*\n\nAucun historique pour "*${searchName}*".\n\n💡 Tapez _!historique_ pour voir tous les contacts enregistrés.`
            }, { quoted: msg });
            return;
        }

        const { jid, messages, total, lastActivity } = chatHistory.getHistory(contact.jid, limit);
        const displayName = contact.name || jid.split('@')[0];
        const phone = jid.split('@')[0];

        if (messages.length === 0) {
            await sock.sendMessage(remoteJid, {
                text: `📭 *${displayName}* — aucun message enregistré.`
            }, { quoted: msg });
            return;
        }

        // Header
        let text = `💬 *Échanges avec ${displayName}*\n`;
        text += `📱 ${phone}\n`;
        text += `📊 Affichage: ${messages.length}/${total} messages\n`;
        text += `🕐 Dernier: ${formatDate(lastActivity)}\n`;
        text += '━━━━━━━━━━━━━━━━━━━━\n\n';

        for (const [i, entry] of messages.entries()) {
            const formatted = formatMessage(entry, i);
            text += formatted + '\n\n';
        }

        text += '━━━━━━━━━━━━━━━━━━━━\n';
        if (total > limit) {
            text += `_💡 ${total - limit} messages plus anciens. !historique ${displayName} ${limit + 30} pour en voir plus._`;
        }

        // Split si trop long (WhatsApp max ~65000 chars, on découpe à 4000 par sécurité)
        const CHUNK = 4000;
        if (text.length <= CHUNK) {
            await sock.sendMessage(remoteJid, { text }, { quoted: msg });
        } else {
            const parts = [];
            let remaining = text;
            while (remaining.length > 0) {
                parts.push(remaining.substring(0, CHUNK));
                remaining = remaining.substring(CHUNK);
            }
            for (let i = 0; i < parts.length; i++) {
                const header = parts.length > 1 ? `_(${i + 1}/${parts.length})_\n` : '';
                await sock.sendMessage(remoteJid, { text: header + parts[i] });
            }
        }
    }
};
