const fetch = require('node-fetch');

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY || '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';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

// Mémoire de conversation par JID (clé = remoteJid du contact)
const conversationMemory = new Map();

function buildSystemPrompt(contactName, hasHistory) {
    const nameFormatted = contactName ? `_*${contactName}*_` : null;
    const nameClause = nameFormatted
        ? `La personne avec qui tu parles s'appelle ${nameFormatted}. Utilise son prénom dans chaque réponse — écrit exactement ainsi : _*${contactName}*_ (format WhatsApp gras+italique).`
        : `Tu ne connais pas encore le nom de l'interlocuteur. Commence par "Bonjour ! 😊".`;

    const historyClause = hasHistory
        ? `Tu as déjà eu des échanges avec cette personne (l'historique est inclus dans la conversation). Si sa question fait référence à un échange passé, réponds en tenant compte du contexte précédent sans lui demander de répéter. Montre que tu te souviens.`
        : `C'est le premier échange avec cette personne. Sois chaleureux et accueillant.`;

    return `Tu es l'assistant virtuel personnel de Sidoine Kolaolé YEBADOKPO. Tu gères ses échanges WhatsApp en son absence avec beaucoup de bienveillance.

${nameClause}

${historyClause}

RÈGLES DE COMMUNICATION :
- Réponds TOUJOURS dans la langue de l'interlocuteur (français si français, anglais si anglais, etc.).
- Ton style : chaleureux, convivial, poli, professionnel. Jamais froid ni robotique.
- Longueur : concis (2-3 phrases max) sauf si on te demande une explication longue.
- Tu ne prétends JAMAIS être Sidoine lui-même. Tu ES son assistant bienveillant.
- Si la question dépasse tes attributions : "Je transmets votre demande à _*Sidoine*_ qui vous répondra dès que possible 🙏"
- Si quelqu'un veut laisser un message : confirme chaleureusement que c'est noté.

FORMATAGE WHATSAPP (OBLIGATOIRE) :
- Prénom de l'interlocuteur : toujours _*Prénom*_ (gras + italique)
- Utilise des émojis expressifs et pertinents pour rendre le message vivant 😊✨🙏💡
- Structure : salutation courte → réponse → closing chaleureux
- Exemple : "Bonjour _*Marie*_ ! 😊 Bien sûr, voici ce que je peux vous dire... N'hésitez pas si vous avez d'autres questions 🙏"
- Évite les listes à puces longues dans les réponses conversationnelles.

PROFIL DE SIDOINE :
- Data Analyst, Développeur Fullstack & Expert MEAL (Monitoring, Évaluation, Redevabilité, Apprentissage)
- Poste : Conseiller Global Suivi, Évaluation & Apprentissage au CCR-Bénin (Bohicon)
- Compétences : Python, R, SQL, Power BI, Tableau, Django, React, IA/ML, RAG, LangChain, TradingView
- Domaines : Agroécologie, Filière riz, Suivi-Évaluation, Data Science, Développement web, Trading algorithmique
- Contact : syebadokpo@gmail.com | +229 01 96 91 13 46
- Portfolio : https://huggingface.co/spaces/Sidoineko/portfolio
- GitHub : https://github.com/Sidoineko

Si quelqu'un demande un service (site web, analyse de données, dashboard, bot, IA, rapport) : confirme que _*Sidoine*_ peut le faire et propose de planifier un échange 📅`;
}

// jid = remoteJid (clé stable pour la mémoire)
// contactName = msg.pushName (affiché dans la réponse)
async function getAIResponse(prompt, contactName = null, conversationHistory = [], jid = null) {
    console.log(`[AI Service] Prompt de "${contactName || 'inconnu'}": ${prompt.substring(0, 60)}`);

    const hasHistory = conversationHistory && conversationHistory.length > 0;

    try {
        const messages = [
            { role: 'system', content: buildSystemPrompt(contactName, hasHistory) }
        ];

        // Injecter l'historique (max 10 derniers messages = 5 échanges)
        if (hasHistory) {
            messages.push(...conversationHistory.slice(-10));
        }

        messages.push({ role: 'user', content: prompt });

        const payload = {
            model: MODEL,
            messages,
            temperature: 0.72,
            top_p: 0.9,
            max_tokens: 512
        };

        const response = await fetch(`${NVIDIA_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 20000
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NVIDIA API ${response.status}: ${errorText.substring(0, 120)}`);
        }

        const data = await response.json();
        const aiReply = data.choices[0].message.content.trim();

        // Mémoriser par JID (clé stable) — fallback sur contactName si pas de JID
        const memKey = jid || contactName;
        if (memKey) {
            if (!conversationMemory.has(memKey)) conversationMemory.set(memKey, []);
            const mem = conversationMemory.get(memKey);
            mem.push({ role: 'user', content: prompt });
            mem.push({ role: 'assistant', content: aiReply });
            // Conserver les 20 derniers messages (10 échanges)
            if (mem.length > 20) mem.splice(0, 2);
        }

        console.log(`[AI Service] ✅ Réponse NVIDIA: ${aiReply.substring(0, 60)}...`);
        return aiReply;

    } catch (error) {
        console.error('[AI Service] ❌ Erreur:', error.message);

        const name = contactName ? ` _*${contactName}*_` : '';
        return `Bonjour${name} ! 🙏 Je rencontre une petite difficulté technique. `
            + `Votre message est bien reçu et je le transmets à _*Sidoine*_ qui vous répondra dès que possible. 😊`;
    }
}

// Récupère l'historique par JID (à passer depuis index.js comme remoteJid)
function getConversationHistory(jid) {
    return conversationMemory.get(jid) || [];
}

function clearConversationMemory(jid) {
    if (jid) conversationMemory.delete(jid);
}

module.exports = {
    getAIResponse,
    getConversationHistory,
    clearConversationMemory,
    buildSystemPrompt,
};
