const aiService = require('../src/services/ai');

module.exports = {
    name: 'botgo',
    description: 'Réactive le bot sur ce chat (annule une pause !pause active).',
    run: async ({ sock, msg }) => {
        const remoteJid = msg.key.remoteJid;
        aiService.clearOwnerActivity(remoteJid);
        await sock.sendMessage(remoteJid, {
            text: `▶️ Bot réactivé sur ce chat. Il répondra à nouveau aux messages entrants.`
        });
    }
};
