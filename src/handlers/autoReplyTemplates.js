// Auto-Reply Response Templates
// Contextual responses based on message type and owner activity

const OWNER_JID = process.env.OWNER_NUMBER || "2290196911346";

function getAutoReplyTemplate(decision, messageType, userMessage = '') {
    const templates = {
        audio_ack: {
            emoji: '🎤',
            text: 'Votre message vocal a bien été reçu ✓',
            action: 'send_ack_only',
            withIcon: true,
        },
        image_ack: {
            emoji: '🖼️',
            text: 'Image reçue ✓',
            action: 'send_ack_only',
            withIcon: true,
        },
        context_aware: {
            emoji: '✓',
            text: 'Sidoine prendra connaissance de votre message très bientôt.',
            action: 'send_brief',
            withIcon: false,
        },
        generic_absent: {
            emoji: '🙏',
            text: buildGenericAbsentReply(userMessage),
            action: 'send_full',
            withIcon: true,
        },
        skip: {
            text: null,
            action: 'no_reply',
        },
    };

    return templates[decision] || templates.skip;
}

function buildGenericAbsentReply(userMessage) {
    let contextLine = '';
    if (userMessage && userMessage.length > 0) {
        const lines = userMessage.split('\n').slice(0, 2);
        const snippet = lines.join('\n').substring(0, 80);
        contextLine = `\n\n_Votre message: "${snippet}..."_`;
    }

    return `Bonjour ! 🙏 Je suis l'assistant virtuel de Sidoine en son absence.${contextLine}

J'ai bien reçu votre message et Sidoine vous répondra dès que possible. 😊`;
}

function formatReplyForWhatsApp(template, withIcon = true) {
    if (!template.text) return null;

    if (withIcon && template.emoji) {
        return `${template.emoji} *Assistant de Sidoine*\n\n${template.text}`;
    }
    return template.text;
}

module.exports = {
    getAutoReplyTemplate,
    buildGenericAbsentReply,
    formatReplyForWhatsApp,
    OWNER_JID,
};