const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

if (!NVIDIA_API_KEY) {
    console.error('[AI Service] ❌ NVIDIA_NIM_API_KEY non configurée — l\'assistant ne pourra pas fonctionner.');
    console.error('[AI Service] Configurez-la dans Render Dashboard → Environment → NVIDIA_NIM_API_KEY');
}

// Mémoire de conversation par JID (clé = remoteJid)
const conversationMemory = new Map();

// Détection propriétaire actif : dernière activité de Sidoine par JID
const ownerActivity = new Map(); // { jid: lastMessageTimestamp }
const pauseExpiry = new Map();   // { jid: expiryTimestamp } — pauses manuelles via !pause
const OWNER_ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 heures
const OWNER_ACTIVITY_FILE = path.join(__dirname, '../../.owner-activity.json');

function loadOwnerActivity() {
    try {
        if (fs.existsSync(OWNER_ACTIVITY_FILE)) {
            const data = JSON.parse(fs.readFileSync(OWNER_ACTIVITY_FILE, 'utf8'));
            const cutoff = Date.now() - OWNER_ACTIVE_WINDOW_MS;
            (data.activity || []).forEach(([jid, ts]) => {
                if (ts > cutoff) ownerActivity.set(jid, ts);
            });
            (data.pauses || []).forEach(([jid, expiry]) => {
                if (expiry > Date.now()) pauseExpiry.set(jid, expiry);
            });
            console.log(`[AI] ✅ Owner activity chargée (${ownerActivity.size} actifs, ${pauseExpiry.size} pauses)`);
        }
    } catch (e) {
        console.warn('[AI] Warning chargement owner activity:', e.message);
    }
}

function saveOwnerActivity() {
    try {
        const obj = {
            activity: Array.from(ownerActivity.entries()),
            pauses: Array.from(pauseExpiry.entries()),
        };
        fs.writeFileSync(OWNER_ACTIVITY_FILE, JSON.stringify(obj), 'utf8');
    } catch (e) {
        console.warn('[AI] Warning sauvegarde owner activity:', e.message);
    }
}

function markOwnerActivity(jid) {
    if (jid) {
        ownerActivity.set(jid, Date.now());
        saveOwnerActivity();
    }
}

// Pause manuelle via !pause — stocke un timestamp d'expiration
function markOwnerActivityFor(jid, durationMs) {
    if (jid) {
        pauseExpiry.set(jid, Date.now() + durationMs);
        saveOwnerActivity();
    }
}

function clearOwnerActivity(jid) {
    if (jid) {
        ownerActivity.delete(jid);
        pauseExpiry.delete(jid);
        saveOwnerActivity();
    }
}

function isOwnerRecentlyActive(jid) {
    if (!jid) return false;
    // Vérifier pause manuelle en premier
    const expiry = pauseExpiry.get(jid);
    if (expiry && Date.now() < expiry) return true;
    // Vérifier activité naturelle (message envoyé)
    const lastActivity = ownerActivity.get(jid);
    if (!lastActivity) return false;
    return (Date.now() - lastActivity) < OWNER_ACTIVE_WINDOW_MS;
}

loadOwnerActivity();

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

    // Si la conversation a des messages récents (< 30 min), ce n'est pas un "premier contact"
    if (hasRecentConversation(jid)) {
        console.log(`[AI] Conversation active détectée avec ${jid} — skipping intro`);
        return false;
    }

    const entry = greetedContacts.get(jid);
    if (!entry) return true;
    return (Date.now() - entry.ts) > GREETING_TTL_MS;
}

function hasRecentConversation(jid, thresholdMinutes = 30) {
    if (!jid) return false;
    const history = conversationMemory.get(jid) || [];
    if (history.length === 0) return false;

    // S'il y a au moins un message dans l'historique, c'est une conversation active
    // (La mémoire contient user + assistant pairs, donc min 2 messages = 1 échange)
    return history.length >= 2;
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

    // Règles communes aux deux modes
    const COMMON_RULES = `
RÈGLES ABSOLUES — JAMAIS d'exception :
1. JAMAIS mentionner une "difficulté technique", "problème système" ou "service perturbé". Si tu ne sais pas : dis "Je ne sais pas 🤷" ou "Je ne suis pas sûr(e)". C'est tout.
2. JAMAIS répéter plusieurs fois que Sidoine est absent. C'est dit UNE SEULE FOIS au premier message, jamais après.
3. JAMAIS commencer une réponse par "Bonjour" si la conversation est déjà lancée.
4. Réponds dans la langue exacte de l'interlocuteur (français/anglais/fon/yoruba/etc.).
5. Longueur : courte si la question est simple, détaillée si technique ou émotionnelle.
6. Prénom toujours en _*Prénom*_ si utilisé.
7. Émojis avec parcimonie — seulement quand ils ajoutent quelque chose.

FORMATAGE WhatsApp autorisé (use-en intelligemment) :
- *texte* = gras
- _texte_ = italique
- ~texte~ = barré
- \`\`\`texte\`\`\` = monospace (pour du code ou des données)
- > texte = citation/bloc
- Listes : - item ou 1. item`;

    if (firstContact) {
        return `Tu es l'assistant virtuel personnel de Sidoine Kolaolé YEBADOKPO. Tu gères ses échanges WhatsApp quand il n'est pas disponible.

${nameClause}

C'est le PREMIER message. Mentionne UNE SEULE FOIS et brièvement que Sidoine n'est pas disponible, puis réponds directement au message reçu. Après ça, ne le répète plus jamais.

${COMMON_RULES}
- Ton : chaleureux, naturel, jamais robotique.
- Tu n'es PAS Sidoine. Tu ES son assistant bienveillant.

${SIDOINE_PROFILE}`;
    }

    return `Tu es l'assistant virtuel de Sidoine Kolaolé YEBADOKPO, en conversation avec ${name || 'un contact'}.

${nameClause}

CONTEXTE : Conversation déjà en cours. L'absence de Sidoine a déjà été mentionnée. NE la répète PAS, NE dis PAS "Bonjour" à nouveau.

${COMMON_RULES}
- Réponds DIRECTEMENT, comme dans un vrai échange humain naturel.
- Utilise l'historique : référence ce qui a été dit avant si utile.
- Adapte le ton : pro si sujet professionnel, décontracté si discussion amicale.
- Si tu ne connais pas la réponse : "Je ne sais pas 🤷" — c'est suffisant, pas d'excuse ni d'explication.
- Si la question dépasse ton périmètre : "_*Sidoine*_ pourra mieux répondre à ça 🙏"

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
            const history = conversationHistory.slice(-10);
            messages.push(...history);

            // Ajouter une instruction pour utiliser l'historique
            if (history.length >= 4) {
                messages.push({
                    role: 'system',
                    content: `Tu as accès à l'historique de conversation ci-dessus. UTILISE-LE pour contextualiser ta réponse. Référence des détails déjà mentionnés si pertinent.`
                });
            }
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

        // En cas d'erreur API : s'abstenir proprement sans mentionner "difficulté technique"
        const name = contactName ? ` _*${contactName}*_` : '';
        return `Bonjour${name} ! 🙏 `
            + `Votre message est bien reçu. Je le transmets à _*Sidoine*_ qui vous répondra personnellement dès que possible. 😊`;
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
    hasRecentConversation,
    markOwnerActivity,
    markOwnerActivityFor,
    clearOwnerActivity,
    isOwnerRecentlyActive,
};
