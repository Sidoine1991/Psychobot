module.exports = {
    name: "about",
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        const text = `
🤖 *Psycho-Bot*
Version : 1.1.0
Auteur : PSYCHO
Description : Bot WhatsApp multifonctions basé sur Baileys
⚡ Fonctions : Audio, Sticker, Mini-jeux, Admin, Utilitaires et plus

📱 Suivez l'auteur :
- Portfolio : https://huggingface.co/spaces/Sidoineko/portfolio
- GitHub : https://github.com/psycho237-prog
- TikTok : https://www.tiktok.com/@gregoire_legrand
- LinkedIn : https://www.linkedin.com/in/onana-gregoire-legrand-a18529282
        `;

        await sock.sendMessage(from, { text });
    }
};