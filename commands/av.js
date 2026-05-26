const axios = require('axios');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";

async function getAIResponse(prompt) {
    if (!prompt || typeof prompt !== 'string') return null;

    try {
        const resp = await axios.post(`${NVIDIA_NIM_BASE}/chat/completions`, {
            model: NVIDIA_NIM_MODEL,
            messages: [
                { role: "system", content: "You are a fun game host for Action or Verite (Truth or Dare). Public is adult. Be provocative and engaging." },
                { role: "user", content: prompt }
            ],
            temperature: 0.9,
            max_tokens: 512,
            top_p: 1,
            stream: false
        }, {
            headers: {
                "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 30000
        });

        return resp.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('[NVIDIA NIM Error]:', error.response?.status, error.message);
        return null;
    }
}

module.exports = {
    name: "av",
    description: "Jeu Action ou Verite (Automatique).",
    run: async ({ sock, msg, args, replyWithTag }) => {
        const remoteJid = msg.key.remoteJid;
        const type = args[0] ? args[0].toLowerCase() : null;

        if (type !== 'action' && type !== 'verite' && type !== 'vérité') {
            const menu = `*🔞 JEU ACTION OU VERITE 🔞*\n\n` +
                `Pret a pimenter votre groupe ? Utilisez :\n` +
                `👉 *!av action* : Pour un defi.\n` +
                `👉 *!av verite* : Pour une question.\n\n` +
                `⚠️ *Amusant, Culturel ou Ose !*`;
            return await replyWithTag(sock, remoteJid, msg, menu);
        }

        try {
            const prompt = `Tu es l'animateur d'un jeu Action ou Verite ultra-polyvalent.
            Genere une seule proposition de type "${type}".
            VARIE LES PLAISIRS de maniere aleatoire parmi ces styles :
            1. DROLE & ENGAGEANT (ex: Imiter un animal, raconter une honte).
            2. CULTURE GENERALE (ex: Citer 3 pays d'Asie, une question piege).
            3. PROVOCATEUR & ADULTE (ex: Un secret ose, un defi sexy).
            4. SOCIAL (ex: Envoyer un message bizarre a un contact).

            Le ton doit etre dynamique. Ne cite jamais ton modele (Llama, AI, etc.).
            Donne UNIQUEMENT le texte de l'action ou de la verite.`;

            const challenge = await getAIResponse(prompt);

            if (!challenge) {
                return await replyWithTag(sock, remoteJid, msg, "❌ L'IA est indisponible. Reessayez !");
            }

            const finalMsg = `*🔞 ACTION OU VERITE 🔞*\n\n` +
                `*Type:* ${type.toUpperCase()}\n` +
                `*Challenge:* ${challenge}\n\n` +
                `Alors, cap ou pas cap ? 😏`;

            await sock.sendMessage(remoteJid, { text: finalMsg }, { quoted: msg });

        } catch (err) {
            console.error(err);
            await replyWithTag(sock, remoteJid, msg, "❌ Une erreur est survenue.");
        }
    }
};
