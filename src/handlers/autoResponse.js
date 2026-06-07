const aiService = require('../services/ai');
const db = require('../../database');
const { isConversationActive } = require('../db/conversationState');
const funMode = require('../services/funMode');

// Compter les échanges par JID pour proposer l'invite proactive
const _msgCount = new Map();

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

    // Si Sidoine a pris la main dans cette conversation (< 15 min), ne pas répondre
    if (isDM && isConversationActive(contactJid)) {
        console.log(`[AutoResponse] Sidoine actif sur ${contactJid} — auto-reply ignoré`);
        return;
    }

    try {
        await sock.sendPresenceUpdate('composing', remoteJid);

        // ── Compteur de messages par JID ──
        const count = (_msgCount.get(contactJid) || 0) + 1;
        _msgCount.set(contactJid, count);

        // ── Détection trigger fun mode (s'ennuie, veut jouer) ──
        const isFunActive = funMode.isActive(contactJid);

        if (!isFunActive && funMode.detectTrigger(text)) {
            funMode.activate(contactJid);
            const welcome = funMode.buildWelcomeMessage(contactName);
            await sock.sendMessage(remoteJid, { text: welcome }, { quoted: msg });
            console.log(`[AutoResponse] 🎉 Fun mode activé pour ${contactName}`);
            return;
        }

        // ── Si fun mode actif : répondre OUI à une invite précédente ──
        if (!isFunActive && funMode.isYesToPlay(text)) {
            // Vérifier si le dernier message du bot était une invite de jeu
            const history = aiService.getConversationHistory(contactJid);
            const lastBot = [...history].reverse().find(m => m.role === 'assistant');
            const wasInvited = lastBot && /on joue|tu veux|petite pause fun|blague|devinette/i.test(lastBot.content);
            if (wasInvited) {
                funMode.activate(contactJid);
                const welcome = funMode.buildWelcomeMessage(contactName);
                await sock.sendMessage(remoteJid, { text: welcome }, { quoted: msg });
                console.log(`[AutoResponse] 🎉 Fun mode activé (réponse OUI) pour ${contactName}`);
                return;
            }
        }

        // ── Si fun mode actif : dispatcher vers funMode ──
        if (isFunActive) {
            const result = funMode.handle(contactJid, text, contactName);
            if (result.handled && result.text) {
                await sock.sendMessage(remoteJid, { text: result.text }, { quoted: msg });
                console.log(`[AutoResponse] 🎲 Fun mode: ${result.text.substring(0, 60)}...`);
                return;
            }
            // Non géré dans fun mode (ne devrait pas arriver) → continuer normalement
        }

        // ── Invite proactive (tous les 12 messages d'un même contact) ──
        if (!isFunActive && count % 12 === 0) {
            const invite = funMode.buildPlayInvite(contactName);
            // Mémoriser l'invite dans l'historique pour que isYesToPlay fonctionne
            const mem = aiService.getConversationHistory(contactJid);
            mem.push({ role: 'assistant', content: invite });
            await sock.sendMessage(remoteJid, { text: invite });
            // Continuer quand même pour répondre au message en cours
        }

        // ── Historique de conversation pour le contexte ──
        const conversationHistory = aiService.getConversationHistory(contactJid);

        // ── Détecter si l'interlocuteur veut laisser un message ──
        const wantsToLeaveMsg = detectLeaveMessage(text);

        if (wantsToLeaveMsg) {
            await db.saveAgendaMessage(contactJid, contactName, text);

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

            const confirmPrompt = `L'utilisateur "${contactName}" vient de laisser ce message pour Sidoine : "${text}". `
                + `Confirme-lui poliment que son message a bien été enregistré et sera transmis à Sidoine. `
                + `Rappelle son prénom/nom dans la réponse si possible. Max 2 phrases.`;

            const aiReply = await aiService.getAIResponse(confirmPrompt, contactName, []);
            const formatted = `🤖 *Assistant de Sidoine*\n\n${aiReply}`;
            await sock.sendMessage(remoteJid, { text: formatted }, { quoted: msg });
            return;
        }

        // ── Réponse IA normale avec contexte ──
        const aiReply = await aiService.getAIResponse(text, contactName, conversationHistory, contactJid);

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
