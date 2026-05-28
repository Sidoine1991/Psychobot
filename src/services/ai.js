const fetch = require('node-fetch');

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY || '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';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

// Mémoire de conversation par JID (clé = JID du contact)
const conversationMemory = new Map();

function buildSystemPrompt(contactName) {
    const nameClause = contactName
        ? `La personne avec qui tu parles s'appelle *${contactName}*. Utilise son prénom naturellement dans la conversation quand c'est approprié.`
        : `Tu ne connais pas encore le nom de l'interlocuteur.`;

    return `Tu es l'assistant virtuel personnel de Sidoine Kolaolé YEBADOKPO. Tu gères ses échanges WhatsApp en son absence.

${nameClause}

RÈGLES STRICTES :
- Réponds TOUJOURS en français sauf si l'interlocuteur écrit en anglais ou une autre langue.
- Tu es poli, chaleureux, professionnel et concis (maximum 3 phrases par réponse sauf si on te demande plus).
- Tu ne prétends JAMAIS être Sidoine lui-même. Tu ES son assistant.
- Utilise le prénom/nom de l'interlocuteur naturellement (ex: "Bonjour Jean !", "Bien sûr, Marie,...").
- Si tu ne connais pas le nom, commence par "Bonjour !" la première fois, puis adapte-toi.
- Si la question nécessite l'intervention de Sidoine : "Je transmets votre message à Sidoine, il vous reviendra dès que possible."
- Si quelqu'un veut laisser un message : confirme que c'est enregistré et sera transmis.

PROFIL DE SIDOINE :
- Data Analyst, Développeur Fullstack & Expert MEAL (Monitoring, Évaluation, Redevabilité, Apprentissage)
- Poste : Conseiller Global Suivi, Évaluation & Apprentissage au CCR-Bénin (Bohicon)
- Compétences : Python, R, SQL, Power BI, Tableau, Django, React, IA/ML, RAG, LangChain, TradingView
- Domaines : Agroécologie, Filière riz, Suivi-Évaluation, Data Science, Développement web, Trading algorithmique
- Contact : syebadokpo@gmail.com | +229 01 96 91 13 46
- Portfolio : https://huggingface.co/spaces/Sidoineko/portfolio
- GitHub : https://github.com/Sidoineko

Si quelqu'un demande un service (site web, analyse de données, dashboard, bot, IA, rapport) : confirme que Sidoine peut le faire et propose de planifier un échange.`;
}

async function getAIResponse(prompt, contactName = null, conversationHistory = []) {
    console.log(`[AI Service] Prompt de "${contactName || 'inconnu'}": ${prompt.substring(0, 60)}`);

    try {
        const messages = [
            { role: 'system', content: buildSystemPrompt(contactName) }
        ];

        // Injecter l'historique de conversation (contexte)
        if (conversationHistory && conversationHistory.length > 0) {
            messages.push(...conversationHistory.slice(-10)); // Max 5 échanges (10 messages)
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

        // Mémoriser l'échange pour ce contact
        if (contactName) {
            const key = contactName;
            if (!conversationMemory.has(key)) conversationMemory.set(key, []);
            const mem = conversationMemory.get(key);
            mem.push({ role: 'user', content: prompt });
            mem.push({ role: 'assistant', content: aiReply });
            // Conserver les 10 derniers échanges (20 messages)
            if (mem.length > 20) mem.splice(0, 2);
        }

        console.log(`[AI Service] ✅ Réponse NVIDIA: ${aiReply.substring(0, 60)}...`);
        return aiReply;

    } catch (error) {
        console.error('[AI Service] ❌ Erreur:', error.message);

        const name = contactName ? ` ${contactName}` : '';
        return `Bonjour${name} ! Je rencontre une difficulté technique momentanée. `
            + `Votre message est bien reçu et je le transmets à Sidoine qui vous répondra dès que possible. 🙏`;
    }
}

function getConversationHistory(contactKey) {
    return conversationMemory.get(contactKey) || [];
}

function clearConversationMemory(contactKey) {
    if (contactKey) conversationMemory.delete(contactKey);
}

module.exports = {
    getAIResponse,
    getConversationHistory,
    clearConversationMemory,
    buildSystemPrompt,
};
