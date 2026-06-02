const axios = require('axios');

module.exports = {
    name: 'wiki',
    description: 'Recherche rapide Wikipedia. Usage: !wiki Python',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const query = args.join(" ");
        if (!query) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Usage: !wiki <sujet>\nEx: !wiki Intelligence artificielle");

        try {
            const resp = await axios.get('https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(query), {
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const data = resp.data;
            if (!data.extract) {
                return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Aucun resultat pour: " + query);
            }

            const text = `📚 *${data.title}*\n━━━━━━━━━━━━━━\n${data.extract.substring(0, 800)}\n\n🔗 ${data.content_urls?.desktop?.page || ''}`;

            if (data.thumbnail?.source) {
                await sock.sendMessage(msg.key.remoteJid, {
                    image: { url: data.thumbnail.source },
                    caption: text
                }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
            }
        } catch (err) {
            if (err.response?.status === 404) {
                return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Page introuvable: " + query);
            }
            console.error('[Wiki]', err.message);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Erreur Wikipedia.");
        }
    }
};
