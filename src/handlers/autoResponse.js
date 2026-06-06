const aiService = require('../services/ai');
const db = require('../../database');

// Détecter si le message demande à laisser un message / agenda
const LEAVE_MSG_KEYWORDS = [
    'laisser un message', 'laisser message', 'transmettre un message',
    'noter un message', 'noter que', 'dis-lui', 'dis lui',
    'rappelle-lui', 'rappelle lui', 'enregistre', 'agenda',
    'leave a message', 'leave message', 'tell him', 'tell sidoine',
    'note that', 'pass the message', 'relay'
];

function detectLeaveMessage(text) {
    const lower = text.toLowerCase();
    return LEAVE_MSG_KEYWORDS.some(kw => lower.includes(kw));
}

// Résoudre le nom d'affichage du contact
function resolveContactName(msg, jid) {
    // pushName = nom affiché dans WhatsApp (défini par le contact lui-même)
    if (msg.pushName && msg.pushName.trim().length > 0) {
        return msg.pushName.trim();
    }
    // Fallback : numéro de téléphone extrait du JID
    const number = jid.split('@')[0].split(':')[0];
    return '+' + number;
}

module.exports = async (msg, sock) => {
    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const isDM = remoteJid.endsWith('@s.whatsapp.net');
    const senderId = msg.key.participant || remoteJid;

    // Détecter si le message vient du propriétaire (Sidoine)
    const isFromMe = msg.key.fromMe === true;
    if (isFromMe) {
        // Sidoine vient d'écrire dans cette conversation → marquer activité propriétaire
        aiService.markOwnerActivity(remoteJid);
        console.log(`[AutoResponse] Propriétaire actif détecté dans ${remoteJid} — bot en pause sur ce chat`);
        return; // Ne pas répondre aux propres messages de Sidoine
    }

    // Si Sidoine a été actif récemment dans cette conversation (< 30 min), le bot ne répond pas
    if (aiService.isOwnerRecentlyActive(remoteJid)) {
        console.log(`[AutoResponse] Propriétaire récemment actif dans ${remoteJid} — bot reste en pause`);
        return;
    }

    // Extraire le texte
    let text = '';
    let isMentioned = false;

    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage) {
        text = msg.message.extendedTextMessage.text;
        const mentions = msg.message.extendedTextMessage.contextInfo?.mentionedJid || [];
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        if (mentions.includes(botJid) || mentions.includes(sock.user?.id)) {
            isMentioned = true;
        }
    }

    if (!text || text.trim().length === 0) return;

    // Répondre uniquement en DM ou si mentionné dans un groupe
    if (!isDM && !isMentioned) return;

    // Résoudre le nom du contact
    const contactJid = isDM ? remoteJid : senderId;
    const contactName = resolveContactName(msg, contactJid);

    console.log(`[AutoResponse] Message de ${contactName} (${contactJid}): ${text.substring(0, 60)}`);

    try {
        await sock.sendPresenceUpdate('composing', remoteJid);

        // Historique de conversation pour le contexte
        const conversationHistory = aiService.getConversationHistory(contactJid);

        // Détecter si l'interlocuteur veut laisser un message
        const wantsToLeaveMsg = detectLeaveMessage(text);

        if (wantsToLeaveMsg) {
            // Enregistrer le message dans l'agenda
            await db.saveAgendaMessage(contactJid, contactName, text);

            // Notifier le propriétaire
            try {
                const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const notif = `📋 *Nouveau message agenda*\n`
                    + `👤 *De :* ${contactName} (${contactJid.split('@')[0]})\n`
                    + `💬 *Message :* ${text}\n`
                    + `🕐 *Reçu :* ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' })}`;
                await sock.sendMessage(ownerJid, { text: notif });
            } catch (e) {
                console.error('[AutoResponse] Notif owner agenda échouée:', e.message);
            }

            // Confirmer à l'expéditeur
            const confirmPrompt = `L'utilisateur "${contactName}" vient de laisser ce message pour Sidoine : "${text}". `
                + `Confirme-lui poliment que son message a bien été enregistré et sera transmis à Sidoine. `
                + `Rappelle son prénom/nom dans la réponse si possible. Max 2 phrases.`;

            const aiReply = await aiService.getAIResponse(confirmPrompt, contactName, []);
            const formatted = `🤖 *Assistant de Sidoine*\n\n${aiReply}`;
            await sock.sendMessage(remoteJid, { text: formatted }, { quoted: msg });
            return;
        }

        // Réponse IA normale avec contexte
        const aiReply = await aiService.getAIResponse(text, contactName, conversationHistory);

        if (aiReply && aiReply.trim().length > 0) {
            const formatted = `🤖 *Assistant de Sidoine*\n\n${aiReply}`;
            await sock.sendMessage(remoteJid, { text: formatted }, { quoted: msg });
            console.log(`[AutoResponse] Répondu à ${contactName}: ${aiReply.substring(0, 60)}...`);
        }

    } catch (error) {
        console.error('[AutoResponse] Erreur:', error.message);
        const fallback = `🤖 *Assistant de Sidoine*\n\nBonjour ${contactName} ! Je transmets votre message à Sidoine qui vous répondra dès que possible.`;
        await sock.sendMessage(remoteJid, { text: fallback }, { quoted: msg }).catch(() => {});
    }
};
