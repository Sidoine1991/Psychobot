const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../../data/chat-history');
const INDEX_FILE = path.join(HISTORY_DIR, '_index.json');
const MAX_MESSAGES = 500;

function ensureDir() {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
}

function historyPath(jid) {
    const safe = jid.replace(/[^a-zA-Z0-9@._-]/g, '_');
    return path.join(HISTORY_DIR, `${safe}.json`);
}

function loadIndex() {
    try {
        if (fs.existsSync(INDEX_FILE)) {
            return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
        }
    } catch (e) {
        console.warn('[ChatHistory] Index load error:', e.message);
    }
    return {};
}

function saveIndex(index) {
    try {
        ensureDir();
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
    } catch (e) {
        console.warn('[ChatHistory] Index save error:', e.message);
    }
}

function loadHistory(jid) {
    try {
        const file = historyPath(jid);
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.warn('[ChatHistory] Load error:', jid, e.message);
    }
    return { jid, name: null, messages: [], lastActivity: null };
}

function saveHistoryFile(data) {
    try {
        ensureDir();
        fs.writeFileSync(historyPath(data.jid), JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[ChatHistory] Save error:', data.jid, e.message);
    }
}

/**
 * Record a message in the persistent history of a conversation.
 * @param {string} jid - WhatsApp JID of the contact (e.g. "2290196911346@s.whatsapp.net")
 * @param {string|null} name - Display name of the contact (pushName)
 * @param {'user'|'owner'|'bot'} role - Who sent this message
 * @param {string} content - Message text (or description for media)
 * @param {string} [type='text'] - Message type: text, audio, image, video, sticker, document
 */
function recordMessage(jid, name, role, content, type = 'text') {
    if (!jid || !content) return;

    ensureDir();
    const data = loadHistory(jid);

    if (name && name !== data.name) data.name = name;

    data.messages.push({
        role,
        content: content.substring(0, 2000),
        type,
        timestamp: new Date().toISOString()
    });

    if (data.messages.length > MAX_MESSAGES) {
        data.messages = data.messages.slice(-MAX_MESSAGES);
    }

    data.lastActivity = new Date().toISOString();
    saveHistoryFile(data);

    const index = loadIndex();
    index[jid] = {
        name: data.name || jid.split('@')[0],
        lastActivity: data.lastActivity,
        messageCount: data.messages.length
    };
    saveIndex(index);
}

/**
 * Get conversation history for a JID.
 * @param {string} jid
 * @param {number} [limit=30]
 */
function getHistory(jid, limit = 30) {
    const data = loadHistory(jid);
    return {
        jid,
        name: data.name,
        messages: data.messages.slice(-limit),
        total: data.messages.length,
        lastActivity: data.lastActivity
    };
}

/**
 * Find a contact by name (exact then partial match).
 * @param {string} name
 * @returns {{ jid, name, lastActivity, messageCount }|null}
 */
function findContactByName(name) {
    const index = loadIndex();
    const lower = name.toLowerCase();

    for (const [jid, info] of Object.entries(index)) {
        if (info.name && info.name.toLowerCase() === lower) return { jid, ...info };
    }

    for (const [jid, info] of Object.entries(index)) {
        if (info.name && info.name.toLowerCase().includes(lower)) return { jid, ...info };
    }

    // Fallback: match on phone number
    for (const [jid, info] of Object.entries(index)) {
        if (jid.includes(lower)) return { jid, ...info };
    }

    return null;
}

/**
 * List all contacts sorted by most recent activity.
 * @param {number} [limit=25]
 */
function listContacts(limit = 25) {
    const index = loadIndex();
    return Object.entries(index)
        .map(([jid, info]) => ({ jid, ...info }))
        .filter(c => c.lastActivity)
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, limit);
}

module.exports = { recordMessage, getHistory, findContactByName, listContacts };
