const aiService = require('../services/ai');
const db = require('../../database');
const { isConversationActive } = require('../db/conversationState');
const funMode = require('../services/funMode');

// Compteur d'échanges par JID (invite proactive fun mode)
const _msgCount = new Map();

// ── Détection type de média ───────────────────────────────────────────────────

function detectMediaType(message) {
    if (!message) return null;
    if (message.stickerMessage)  return 'sticker';
    if (message.imageMessage)    return 'image';
    if (message.videoMessage)    return 'video';
    if (message.audioMessage)    return 'audio';
    if (message.documentMessage) return 'document';
    if (message.reactionMessage) return 'reaction';
    if (message.locationMessage) return 'location';
    if (message.contactMessage)  return 'contact';
    return null;
}

// Réactions emoji aléatoires par type de média
const MEDIA_REACTIONS = {
    sticker: ['😂', '🤣', '👌', '🔥', '😍', '💀', '🙌'],
    image:   ['😍', '🔥', '✨', '👀', '💯', '🫶', '🙌'],
    video:   ['🎬', '🔥', '👀', '🎥', '🤩', '💯', '🙌'],
    audio:   ['🎵', '🎤', '👂', '🎶', '🔊'],
};

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Réponses texte courtes et variées pour les médias (anti-répétition légère)
const MEDIA_TEXT_RESPONSES = {
    sticker: [
        '😂 Ce sticker dit tout !',
        '💀 Je suis mort(e) 😂',
        '🔥 Ce sticker est parfait',
        '😂 Classique !',
        '👌 Trop bon ce sticker',
    ],
    image: [
        '📸 Belle photo !',
        '😍 Sympa cette image !',
        '✨ J\'aime bien ça !',
        '👀 Ooh, je vois !',
        '🔥 Belle image !',
    ],
    video: [
        '🎬 Vidéo reçue 👀',
        '🎥 Je regarde ça !',
        '🤩 Super vidéo !',
        '🔥 Trop bien cette vidéo !',
        '🎬 Bien vu !',
    ],
    audio: [
        '🎵 Message vocal reçu ✓',
        '🎤 Je t\'écoute...',
        '👂 Message audio noté !',
    ],
    document: [
        '📄 Document reçu ✓',
        '📎 Fichier bien reçu !',
    ],
    location: [
        '📍 Localisation reçue !',
        '🗺️ Je vois où tu es !',
    ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEAVE_MSG_KEYWORDS = [
    'laisser un message', 'laisser message', 'transmettre un message',
    'noter un message', 'noter que', 'dis-lui', 'dis lui',
    'rappelle-lui', 'rappelle lui', 'enregistre', 'agenda',
    'leave a message', 'leave message', 'tell him', 'tell sidoine',
    'note that', 'pass the message', 'relay',
];

function detectLeaveMessage(text) {
    const lower = text.toLowerCase();
    return LEAVE_MSG_KEYWORDS.some(kw => lower.includes(kw));
}

function resolveContactName(msg, jid) {
    if (msg.pushName && msg.pushName.trim().length > 0) return msg.pushName.trim();
    return '+' + jid.split('@')[0].split(':')[0];
}

// ── Handler principal ─────────────────────────────────────────────────────────

module.exports = async (msg, sock) => {
    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const isDM    = remoteJid.endsWith('@s.whatsapp.net');
    const senderId = msg.key.participant || remoteJid;

    // Messages de Sidoine lui-même → déjà géré dans bot.js
    if (msg.key.fromMe) return;

    // Sidoine récemment actif (< 30 min) → bot en retrait
    if (aiService.isOwnerRecentlyActive(remoteJid)) return;

    const contactJid  = isDM ? remoteJid : senderId;
    const contactName = resolveContactName(msg, contactJid);

    // ── Détection type de message ──
    const mediaType = detectMediaType(msg.message);
    let text = '';
    let isMentioned = false;

    if (msg.message?.conversation) {
        text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage) {
        text = msg.message.extendedTextMessage.text || '';
        const mentions = msg.message.extendedTextMessage.contextInfo?.mentionedJid || [];
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        isMentioned = mentions.includes(botJid) || mentions.includes(sock.user?.id);
    } else if (msg.message?.imageMessage?.caption) {
        text = msg.message.imageMessage.caption;
    } else if (msg.message?.videoMessage?.caption) {
        text = msg.message.videoMessage.caption;
    }

    // ── Médias sans texte (sticker, image muette, vidéo muette, audio) ──
    if (mediaType && !text.trim()) {
        if (!isDM && !isMentioned) return;
        if (isDM && isConversationActive(contactJid)) return;

        const responses = MEDIA_TEXT_RESPONSES[mediaType];
        if (!responses) return; // reaction/contact → ignorer silencieusement

        // Réaction emoji d'abord (si le type le supporte)
        const emojiPool = MEDIA_REACTIONS[mediaType];
        if (emojiPool) {
            try {
                await sock.sendMessage(remoteJid, {
                    react: { text: randomFrom(emojiPool), key: msg.key }
                });
            } catch (_) { /* réaction optionnelle */ }
        }

        // Réponse texte courte
        const reply = randomFrom(responses);
        await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
        console.log(`[AutoResponse] Média ${mediaType} de ${contactName} → "${reply}"`);
        return;
    }

    // ── Pas de texte et pas de média connu → ignorer ──
    if (!text.trim()) return;

    // Répondre uniquement en DM ou si mentionné dans un groupe
    if (!isDM && !isMentioned) return;

    // Sidoine a pris la main (< 15 min) → bot silencieux
    if (isDM && isConversationActive(contactJid)) return;

    console.log(`[AutoResponse] Message de ${contactName}: ${text.substring(0, 60)}`);

    try {
        await sock.sendPresenceUpdate('composing', remoteJid);

        const count = (_msgCount.get(contactJid) || 0) + 1;
        _msgCount.set(contactJid, count);

        const isFunActive = funMode.isActive(contactJid);

        // ── Trigger fun mode ──
        if (!isFunActive && funMode.detectTrigger(text)) {
            funMode.activate(contactJid);
            await sock.sendMessage(remoteJid, { text: funMode.buildWelcomeMessage(contactName) }, { quoted: msg });
            return;
        }

        // ── OUI à une invite de jeu précédente ──
        if (!isFunActive && funMode.isYesToPlay(text)) {
            const history = aiService.getConversationHistory(contactJid);
            const lastBot = [...history].reverse().find(m => m.role === 'assistant');
            if (lastBot && /on joue|tu veux|petite pause fun|blague|devinette/i.test(lastBot.content)) {
                funMode.activate(contactJid);
                await sock.sendMessage(remoteJid, { text: funMode.buildWelcomeMessage(contactName) }, { quoted: msg });
                return;
            }
        }

        // ── Fun mode actif : dispatcher ──
        if (isFunActive) {
            const result = funMode.handle(contactJid, text, contactName);
            if (result.handled && result.text) {
                await sock.sendMessage(remoteJid, { text: result.text }, { quoted: msg });
                return;
            }
        }

        // ── Invite proactive tous les 12 messages ──
        if (!isFunActive && count % 12 === 0) {
            const invite = funMode.buildPlayInvite(contactName);
            aiService.getConversationHistory(contactJid).push({ role: 'assistant', content: invite });
            await sock.sendMessage(remoteJid, { text: invite });
        }

        const conversationHistory = aiService.getConversationHistory(contactJid);

        // ── Message agenda ──
        if (detectLeaveMessage(text)) {
            await db.saveAgendaMessage(contactJid, contactName, text);
            try {
                const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                await sock.sendMessage(ownerJid, {
                    text: `📋 *Message agenda*\n👤 ${contactName} (${contactJid.split('@')[0]})\n💬 ${text}\n🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' })}`,
                });
            } catch (_) {}
            const aiReply = await aiService.getAIResponse(
                `L'utilisateur "${contactName}" laisse ce message pour Sidoine : "${text}". Confirme poliment en 1-2 phrases.`,
                contactName, [], contactJid,
            );
            await sock.sendMessage(remoteJid, { text: `🤖 *Assistant de Sidoine*\n\n${aiReply}` }, { quoted: msg });
            return;
        }

        // ── Réponse IA normale ──
        // Si le message accompagne un média, on l'enrichit du contexte
        const prompt = mediaType
            ? `[L'utilisateur a envoyé une ${mediaType === 'image' ? 'image' : mediaType === 'video' ? 'vidéo' : mediaType} avec ce texte] ${text}`
            : text;

        const aiReply = await aiService.getAIResponse(prompt, contactName, conversationHistory, contactJid);

        if (aiReply && aiReply.trim()) {
            await sock.sendMessage(remoteJid, { text: `🤖 *Assistant de Sidoine*\n\n${aiReply}` }, { quoted: msg });
        }

    } catch (error) {
        console.error('[AutoResponse] Erreur:', error.message);
        // Fallback minimaliste — pas de "Bonjour", pas de "difficulté technique"
        await sock.sendMessage(remoteJid, {
            text: `🙏 Message bien reçu${contactName ? ` _*${contactName}*_` : ''} ! _*Sidoine*_ reviendra vers toi dès que possible.`,
        }, { quoted: msg }).catch(() => {});
    }
};
