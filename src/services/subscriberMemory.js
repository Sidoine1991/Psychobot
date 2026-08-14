/**
 * Subscriber Memory — Mémoire long-terme par abonné pour PsychoBot
 *
 * Persiste un profil par contact (faits mémorisés, langue, statistiques)
 * dans data/subscribers/<jid>.json afin que les conversations restent
 * personnalisées et "conviviales" même après un redémarrage du bot.
 *
 * L'historique brut (chatHistory.js) est aussi rechargé pour reconstruire
 * le contexte de chaque abonné.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const chatHistory = require('./chatHistory');

const PROFILES_DIR = path.join(__dirname, '../../data/subscribers');
const MAX_FACTS = 40;

function profilePath(jid) {
    const safe = String(jid).replace(/[^a-zA-Z0-9@._-]/g, '_');
    return path.join(PROFILES_DIR, `${safe}.json`);
}

function defaultProfile(jid) {
    return {
        jid,
        name: null,
        firstContact: null,
        lastContact: null,
        messageCount: 0,
        preferredLanguage: 'fr',
        facts: [], // { type, value, count, firstSeen, lastSeen }
    };
}

function loadProfile(jid) {
    try {
        if (fs.existsSync(profilePath(jid))) {
            const data = JSON.parse(fs.readFileSync(profilePath(jid), 'utf8'));
            return { ...defaultProfile(jid), ...data };
        }
    } catch (e) {
        console.warn('[SubscriberMemory] Load error:', jid, e.message);
    }
    return defaultProfile(jid);
}

function saveProfile(profile) {
    try {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
        fs.writeFileSync(profilePath(profile.jid), JSON.stringify(profile, null, 2), 'utf8');
    } catch (e) {
        console.warn('[SubscriberMemory] Save error:', profile.jid, e.message);
    }
}

// ── Détection de langue ───────────────────────────────────────────────────────

const LANG_HINTS = {
    fr: /(bonjour|salut|merci|comment|pourquoi|je |tu |oui|non|s['’]il vous plaît|svp|bien|d'accord)/i,
    en: /\b(hello|hi|thanks|thank you|how|why|please|yes|no|okay|good|fine|what)\b/i,
    fon: /(kufò|alɔ|wɛ|a mi na|è wlí|nú e|àhô|gbe|ayihɔn)/i,
};

function detectLanguage(text) {
    if (!text) return 'fr';
    const scores = { fr: 0, en: 0, fon: 0 };
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        for (const [lang, re] of Object.entries(LANG_HINTS)) {
            if (re.test(word)) scores[lang] += 1;
        }
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'fr';
}

// ── Extraction de faits (patterns, sans appel LLM supplémentaire) ────────────

const FACT_PATTERNS = [
    // Lieu de vie / origine
    { type: 'lieu', re: /\b(?:je\s+|j['’]?\s*)(?:habite|vis|suis\s+(?:bas(?:é|ée)|install(?:é|ée)))\s+(?:à|au|en|aux)\s+([\p{L}'\-\s]{2,30})/iu, norm: 1 },
    { type: 'lieu', re: /\bje\s+suis\s+[àa]\s+([\p{L}'\-\s]{2,30})/iu, norm: 1 },
    { type: 'origine', re: /\bje\s+(?:viens|suis)\s+de\s+([\p{L}'\-\s]{2,30})/iu, norm: 1 },
    { type: 'lieu', re: /\bi\s+(?:live|stay|am\s+based)\s+in\s+([\p{L}'\-\s]{2,30})/iu, norm: 1 },
    { type: 'origine', re: /\bi['’]m\s+from\s+([\p{L}'\-\s]{2,30})/iu, norm: 1 },

    // Travail / études
    { type: 'travail', re: /\bje\s+travaille\s+(?:comme|en\s+tant\s+que)\s+([\p{L}'\-\s]{2,40})/iu, norm: 1 },
    { type: 'travail', re: /\bi\s+work\s+(?:as\s+)?([\p{L}'\-\s]{2,40})/iu, norm: 1 },
    { type: 'travail', re: /\bje\s+suis\s+(?:un|une\s+)?(?:développeur|développeuse|analyste|ingénieur|professeur|enseignant|médecin|commerçant|entrepreneur|étudiant|étudiante|coach|consultant|consultante|agent|comptable|data\s+scientist|designer|graphiste|photographe|videaste|youtubeur|vendeur|vendeuse|chauffeur|plombier|électricien|maçon|cuisinier|infirmier|infirmière)\b/iu, norm: 0 },

    // Âge
    { type: 'age', re: /\b(?:je\s+|j['’]?\s*)ai\s+(\d{1,2}(?:\s*ans)?)\b/iu, norm: 1 },
    { type: 'age', re: /\bi['’]?m\s+(\d{1,2})\b/iu, norm: 1 },

    // Intérêts / passions
    { type: 'interet', re: /\b(?:je\s+|j['’]?\s*)(?:aime|adore)\s+(?:bien\s+|beaucoup\s+)?(.{2,40})/iu, norm: 1 },
    { type: 'interet', re: /\bje\s+(?:kiffe|suis\s+passionn(?:é|ée)\s+de|suis\s+fan\s+de)\s+(.{2,40})/iu, norm: 1 },
    { type: 'interet', re: /\bi\s+(?:love|like|enjoy)\s+(.{2,40})/iu, norm: 1 },
    { type: 'interet', re: /\bi['’]m\s+(?:into|a\s+big\s+fan\s+of)\s+(.{2,40})/iu, norm: 1 },

    // Famille (juste détecter le sujet, valeur = membre de famille)
    { type: 'famille', re: /\bmon\s+(frère|petit[- ]frère|grand[- ]frère|père|mari|fils|oncle|neveu|grand-père|beau-frère)\b/iu, norm: 0 },
    { type: 'famille', re: /\bma\s+(sœur|petite[- ]sœur|grande[- ]sœur|mère|femme|fille|tante|nièce|grand-mère|belle-sœur)\b/iu, norm: 0 },
    { type: 'famille', re: /\bmes\s+(enfants|parents|garçons|filles)\b/iu, norm: 0 },

    // Objectifs / projets
    { type: 'objectif', re: /\b(?:mon\s+objectif\s+est|je\s+veux|je\s+voudrais|j['’]?\s*aimerais|je\s+rêve\s+de)\s+(?:de\s+)?(.{2,50})/iu, norm: 1 },
    { type: 'objectif', re: /\b(?:mon\s+rêve|mon\s+projet)\s+(?:c['’]?est\s+|est\s+)?(?:de\s+)?(.{2,50})/iu, norm: 1 },
];

const TRUNCATION_CUTS = [
    /[,.;:!?()»«]/i,
    /\s+et\s+/i,
    /\s+mais\s+/i,
    /\s+puis\s+/i,
    /\s+car\s+/i,
    /\s+avec\s+/i,
    /\s+quand\s+/i,
    /\s+parce\s+que\b/i,
    /\s+je\s+/i,
    /\s+j['’]\s*/i,
    /\s+i\s+/i,
    /\s+and\s+/i,
    /\s+with\s+/i,
    /\s+also\s+/i,
];

function cleanFactValue(raw) {
    let v = String(raw).trim();
    // Couper au premier séparateur qui termine l'idée (ponctuation, locution, nouveau sujet)
    for (const re of TRUNCATION_CUTS) {
        const idx = v.search(re);
        if (idx > 0) v = v.slice(0, idx);
    }
    v = v.trim().replace(/\s+/g, ' ');
    // Retirer les articles et prépositions superflus
    v = v.replace(/^(d'|de\s+la\s+|le\s+|la\s+|les\s+|du\s+|des\s+|au\s+|aux\s+|a\s+|an\s+)/i, '');
    return v.slice(0, 60);
}

function extractFacts(text) {
    if (!text || text.length < 8) return [];
    const facts = [];
    for (const { type, re, norm } of FACT_PATTERNS) {
        const m = text.match(re);
        if (!m) continue;
        const raw = m[norm];
        if (!raw) continue;
        const value = cleanFactValue(raw);
        if (value.length < 2) continue;
        // Ignorer les faux positifs ("comment", "quoi", "que", "qui")
        if (/^(comment|quoi|que|qui|quand|où|ou|combien|pourquoi|ça|ca|sa|tout|rien|vraiment|beaucoup)$/i.test(value)) continue;
        facts.push({ type, value });
    }
    return facts;
}

// ── Gestion du profil ─────────────────────────────────────────────────────────

function addFacts(profile, facts) {
    const now = Date.now();
    for (const fact of facts) {
        const key = `${fact.type}:${fact.value.toLowerCase()}`;
        const existing = profile.facts.find(f => `${f.type}:${f.value.toLowerCase()}` === key);
        if (existing) {
            existing.count = (existing.count || 1) + 1;
            existing.lastSeen = now;
        } else {
            profile.facts.push({ ...fact, count: 1, firstSeen: now, lastSeen: now });
        }
    }
    // Garder les faits les plus cités (plafond)
    if (profile.facts.length > MAX_FACTS) {
        profile.facts.sort((a, b) => (b.count || 0) - (a.count || 0));
        profile.facts = profile.facts.slice(0, MAX_FACTS);
    }
}

/**
 * Enregistrer un échange : met à jour les stats et extrait les faits.
 * @param {string} jid
 * @param {string|null} contactName
 * @param {string} userText - message texte de l'abonné
 */
function recordExchange(jid, contactName, userText) {
    if (!jid) return;
    const profile = loadProfile(jid);
    const now = Date.now();

    if (contactName) profile.name = contactName;
    if (!profile.firstContact) profile.firstContact = now;
    profile.lastContact = now;
    profile.messageCount += 1;

    const lang = detectLanguage(userText || '');
    if (lang !== 'fr') profile.preferredLanguage = lang;

    if (userText) addFacts(profile, extractFacts(userText));

    saveProfile(profile);
}

/**
 * Résumé lisible du profil pour injection dans le system prompt.
 * @param {string} jid
 * @returns {string|null} bloc texte ou null si aucun élément
 */
function buildProfileBlock(jid) {
    if (!jid) return null;
    const profile = loadProfile(jid);
    const lines = [];

    if (profile.messageCount > 0) {
        const first = profile.firstContact ? new Date(profile.firstContact) : null;
        const sinceDays = first ? Math.max(1, Math.round((Date.now() - first.getTime()) / 86400000)) : null;
        if (sinceDays !== null) lines.push(`- Connu depuis ${sinceDays} jour(s)`);
        lines.push(`- ${profile.messageCount} message(s) échangé(s)`);
    }

    if (profile.preferredLanguage && profile.preferredLanguage !== 'fr') {
        lines.push(`- Langue : ${profile.preferredLanguage === 'en' ? 'anglais' : profile.preferredLanguage}`);
    }

    const facts = profile.facts.slice(0, 12);
    if (facts.length > 0) {
        lines.push('- Faits mémorisés :');
        for (const f of facts) {
            lines.push(`  • ${f.value}${f.count > 1 ? ` (mentionné ${f.count}×)` : ''}`);
        }
    }

    if (lines.length === 0) return null;

    return `PROFIL DE L'ABONNÉ :\n${lines.join('\n')}`;
}

/**
 * Historique long-terme (depuis chatHistory.js) converti pour le LLM.
 * @param {string} jid
 * @param {number} [limit=10]
 * @returns {Array<{role: string, content: string}>}
 */
function getPersistentHistory(jid, limit = 10) {
    if (!jid) return [];
    const data = chatHistory.getHistory(jid, limit);
    return data.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content.substring(0, 1000),
    }));
}

module.exports = {
    recordExchange,
    buildProfileBlock,
    getPersistentHistory,
    extractFacts,
    detectLanguage,
    loadProfile,
};
