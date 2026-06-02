// Message Type Classifier
// Detects audio, image, voice notes, trading content, etc.

function detectMessageType(message) {
    if (!message) return 'unknown';

    // Audio message (voice note / audio)
    if (message.audioMessage) {
        return message.audioMessage.mimetype?.includes('audio') ? 'voice_note' : 'audio';
    }

    // Document with audio MIME type (some platforms wrap audio as document)
    if (message.documentMessage) {
        const mime = message.documentMessage.mimetype || '';
        if (mime.startsWith('audio/') || mime === 'application/ogg') {
            return 'audio_document';
        }
        return 'document';
    }

    // Image message
    if (message.imageMessage) return 'image';

    // Video message
    if (message.videoMessage) return 'video';

    // Sticker
    if (message.stickerMessage) return 'sticker';

    // Extended text message
    if (message.extendedTextMessage) {
        const text = message.extendedTextMessage.text || '';
        return classifyTextContent(text);
    }

    // Simple text
    if (message.conversation) {
        return classifyTextContent(message.conversation);
    }

    return 'other';
}

function classifyTextContent(text) {
    if (!text || text.length === 0) return 'empty';

    const lowerText = text.toLowerCase();

    // Trading/technical content keywords
    const tradingKeywords = [
        'trade', 'signal', 'buy', 'sell', 'tp', 'sl', 'entry', 'exit',
        'xauusd', 'gold', 'btc', 'crypto', 'boom', 'crash', 'forex',
        'chart', 'level', 'support', 'resistance', 'cassure', 'retest',
        'ordre', 'position', 'scalp', 'swing', 'profit', 'loss',
        'gom', 'smc', 'orderblock', 'fvg', 'liquidity',
    ];

    const isTradingContent =
        tradingKeywords.some(kw => lowerText.includes(kw)) &&
        text.length > 80;

    if (isTradingContent) return 'trading_analysis';

    // Greeting/simple reply
    if (text.length < 50 && /^(hello|hi|bonjour|salut|coucou|hey|ça va|comment|quoi)/i.test(text)) {
        return 'greeting';
    }

    return 'text';
}

function shouldTranscribeAudio(messageType) {
    return messageType === 'voice_note' || messageType === 'audio_document';
}

module.exports = {
    detectMessageType,
    classifyTextContent,
    shouldTranscribeAudio,
};
