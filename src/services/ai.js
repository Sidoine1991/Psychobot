const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY || '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';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

// Mémoire de conversation par JID (clé = remoteJid)
const conversationMemory = new Map();

// Contacts déjà accueillis — persist dans un fichier JSON pour survire aux redémarrages Render
// Durée : 24h. Passé ce délai le prochain message reçoit à nouveau l'intro.
const GREETING_TTL_MS = 24 * 60 * 60 * 1000;
const GREETING_FILE = path.join(__dirname, '../../.greeted-contacts.json');
let greetedContacts = new Map();

// Charger les contacts accueillis au démarrage du service
function loadGreetedContacts() {
    try {
        if (fs.existsSync(GREETING_FILE)) {
            const data = fs.readFileSync(GREETING_FILE, 'utf8');
            const parsed = JSON.parse(data);
            greetedContacts = new Map(Object.entries(parsed));
            console.log(`[AI] ✅ Loaded ${greetedContacts.size} greeted contacts from file`);
        }
    } catch (err) {
        console.warn(`[AI] Warning loading greeted contacts: ${err.message}`);
        greetedContacts = new Map();
    }
}

// Sauvegarder les contacts accueillis (appelé après chaque nouveau premier contact)
function saveGreetedContacts() {
    try {
        const obj = Object.fromEntries(greetedContacts);
        fs.writeFileSync(GREETING_FILE, JSON.stringify(obj, null, 2), 'utf8');
        console.log(`[AI] ✅ Saved ${greetedContacts.size} greeted contacts`);
    } catch (err) {
        console.warn(`[AI] Warning saving greeted contacts: ${err.message}`);
    }
}

// Charger au démarrage du service
loadGreetedContacts();

function isFirstContact(jid) {
    if (!jid) return true;
    const entry = greetedContacts.get(jid);
    if (!entry) return true;
    return (Date.now() - entry.ts) > GREETING_TTL_MS;
}

function markContacted(jid) {
    if (jid) {
        greetedContacts.set(jid, { ts: Date.now() });
        saveGreetedContacts();
    }
}

// ── System prompts ────────────────────────────────────────────────────────────

const SIDOINE_PROFILE = `PROFIL DE SIDOINE :
- Data Analyst, Développeur Fullstack & Expert MEAL (Monitoring, Évaluation, Redevabilité, Apprentissage)
- Poste : Conseiller Global Suivi, Évaluation & Apprentissage au CCR-Bénin (Bohicon)
- Compétences : Python, R, SQL, Power BI, Tableau, Django, React, IA/ML, RAG, LangChain, TradingView
- Domaines : Agroécologie, Filière riz, Suivi-Évaluation, Data Science, Développement web, Trading algorithmique
- Contact : syebadokpo@gmail.com | +229 01 96 91 13 46
- Portfolio : https://huggingface.co/spaces/Sidoineko/portfolio
- GitHub : https://github.com/Sidoineko

Si quelqu'un demande un service (site web, analyse de données, dashboard, bot, IA, rapport) : confirme que _*Sidoine*_ peut le faire et propose de planifier un échange 📅`;

function buildSystemPrompt(contactName, firstContact) {
    const name = contactName ? `_*${contactName}*_` : null;
    const nameClause = name
        ? `La personne s'appelle ${name}. Utilise son prénom dans tes réponses — toujours en format WhatsApp gras+italique : _*${contactName}*_.`
        : `Tu ne connais pas encore le nom de l'interlocuteur.`;

    if (firstContact) {
        // Premier message de la conversation : présenter l'absence de Sidoine UNE SEULE FOIS
        return `Tu es l'assistant virtuel personnel de Sidoine Kolaolé YEBADOKPO. Tu gères ses échanges WhatsApp en son absence.

${nameClause}

C'est le PREMIER message de cette conversation. Commence par informer poliment que Sidoine n'est pas disponible pour le moment, puis réponds à la question ou au message reçu.

RÈGLES :
- Réponds TOUJOURS dans la langue de l'interlocuteur (français/anglais/etc.).
- Ton : chaleureux, convivial, professionnel. Jamais froid ni robotique.
- Longueur : concis (2-4 phrases) sauf si une explication longue est explicitement demandée.
- Tu n'es PAS Sidoine. Tu ES son assistant bienveillant.
- Si la demande dépasse tes attributions : "Je transmets à _*Sidoine*_ qui vous répondra dès que possible 🙏"
- Émojis expressifs et pertinents 😊✨🙏💡
- Prénom toujours en _*Prénom*_ (gras + italique WhatsApp)

${SIDOINE_PROFILE}`;
    }

    // Messages suivants (conversation en cours) : PAS de répétition de l'intro absence
    return `Tu es l'assistant virtuel de Sidoine Kolaolé YEBADOKPO, en conversation active avec ${name || 'un contact'}.

${nameClause}

CONTEXTE : Tu es déjà en échange avec cette personne. L'absence de Sidoine a déjà été mentionnée au début. NE la répète PAS.

RÈGLES POUR CETTE RÉPONSE :
- Réponds DIRECTEMENT à la question ou au message, sans répéter la présentation initiale.
- Engage la conversation de façon naturelle, comme dans un vrai échange humain.
- Tiens compte de l'historique de la conversation (messages précédents inclus).
- Réponds dans la langue de l'interlocuteur.
- Ton : naturel, chaleureux, direct. Comme si tu connaissais déjà la personne.
- Longueur : adaptée à la question. Court si simple, développé si technique.
- Si nouveau sujet important : tu peux mentionner que _*Sidoine*_ sera informé, mais pas systématiquement.
- Émojis avec parcimonie — seulement quand pertinent.
- Prénom toujours en _*Prénom*_ si utilisé.

${SIDOINE_PROFILE}`;
}

// ── LLM caller ────────────────────────────────────────────────────────────────

async function callNVIDIA(messages) {
    const response = await fetch(`${NVIDIA_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.72,
            top_p: 0.9,
            max_tokens: 512
        }),
        timeout: 20000
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA API ${response.status}: ${errorText.substring(0, 120)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// ── Main entry point ──────────────────────────────────────────────────────────

// jid          = remoteJid (clé stable pour la mémoire et le cooldown 24h)
// contactName  = msg.pushName
async function getAIResponse(prompt, contactName = null, conversationHistory = [], jid = null) {
    console.log(`[AI Service] Prompt de "${contactName || 'inconnu'}": ${prompt.substring(0, 60)}`);

    const memKey = jid || contactName;
    const firstContact = isFirstContact(memKey);
    const hasHistory = conversationHistory && conversationHistory.length > 0;

    try {
        const messages = [
            { role: 'system', content: buildSystemPrompt(contactName, firstContact) }
        ];

        // Injecter l'historique (max 10 derniers messages = 5 échanges)
        if (hasHistory) {
            messages.push(...conversationHistory.slice(-10));
        }

        messages.push({ role: 'user', content: prompt });

        const aiReply = await callNVIDIA(messages);

        // Marquer ce contact comme "déjà accueilli" après la première réponse réussie
        if (firstContact && memKey) markContacted(memKey);

        // Mémoriser l'échange
        if (memKey) {
            if (!conversationMemory.has(memKey)) conversationMemory.set(memKey, []);
            const mem = conversationMemory.get(memKey);
            mem.push({ role: 'user', content: prompt });
            mem.push({ role: 'assistant', content: aiReply });
            // Conserver les 20 derniers messages (10 échanges)
            if (mem.length > 20) mem.splice(0, 2);
        }

        console.log(`[AI Service] ✅ Réponse (${firstContact ? 'premier contact' : 'suite conversation'}): ${aiReply.substring(0, 80)}...`);
        return aiReply;

    } catch (error) {
        console.error('[AI Service] ❌ Erreur:', error.message);

        const name = contactName ? ` _*${contactName}*_` : '';
        return `Bonjour${name} ! 🙏 Je rencontre une petite difficulté technique. `
            + `Votre message est bien reçu et je le transmets à _*Sidoine*_ qui vous répondra dès que possible. 😊`;
    }
}

// ── Exports helpers ───────────────────────────────────────────────────────────

function getConversationHistory(jid) {
    return conversationMemory.get(jid) || [];
}

function clearConversationMemory(jid) {
    if (jid) {
        conversationMemory.delete(jid);
        greetedContacts.delete(jid); // reset le cooldown aussi
        saveGreetedContacts(); // persister le changement
    }
}

module.exports = {
    getAIResponse,
    getConversationHistory,
    clearConversationMemory,
    buildSystemPrompt,
};
