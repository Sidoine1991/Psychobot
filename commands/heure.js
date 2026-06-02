module.exports = {
    name: 'heure',
    description: 'Affiche la date et l\'heure actuelle.',
    run: async ({ sock, msg, replyWithTag }) => {
        const now = new Date();
        const options = {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Africa/Porto-Novo'
        };
        const formatted = now.toLocaleDateString('fr-FR', options);
        const utc = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

        const text = `🕐 *Date & Heure*\n━━━━━━━━━━━━━━\n` +
            `📅 ${formatted}\n` +
            `🌍 ${utc}\n` +
            `⏰ Fuseau: Africa/Porto-Novo (WAT)`;

        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
    }
};
