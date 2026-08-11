const aiService = require('../src/services/ai');

const PAUSE_DURATIONS = {
    '30': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
};

module.exports = {
    name: 'pause',
    description: 'Met le bot en pause sur ce chat (ex: !pause 1h). Sans argument = 2h.',
    run: async ({ sock, msg, args }) => {
        const remoteJid = msg.key.remoteJid;
        const durationArg = args[0] || '2h';
        const durationMs = PAUSE_DURATIONS[durationArg] || PAUSE_DURATIONS['2h'];

        // Marquer le propriétaire comme actif sur ce chat avec la durée demandée
        aiService.markOwnerActivityFor(remoteJid, durationMs);

        const label = durationArg in PAUSE_DURATIONS ? durationArg : '2h';
        await sock.sendMessage(remoteJid, {
            text: `⏸️ Bot mis en silence sur ce chat pendant *${label}*. Utilise \`!resume\` pour réactiver immédiatement.`
        });
    }
};
