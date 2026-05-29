// Conversation State Manager
// Tracks owner activity, message types, and conversation context
// Used to avoid duplicate "absent owner" auto-replies in active conversations

const fs = require('fs');
const path = require('path');

const conversationStates = new Map();
const STATE_FILE = path.join(__dirname, '../../.conversation-states.json');
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const SIXTY_MIN_MS = 60 * 60 * 1000;

// Load persisted state on startup (survives Render restarts)
function loadConversationStates() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            // Restore timestamps (JSON stringified them)
            Object.entries(parsed).forEach(([jid, state]) => {
                conversationStates.set(jid, {
                    jid,
                    lastOwnerMessageTime: state.lastOwnerMessageTime || 0,
                    lastBotReplyTime: state.lastBotReplyTime || 0,
                    lastUserMessageType: state.lastUserMessageType || 'text',
                    conversationActive: false, // Always reset to false on startup
                    messageCount: 0,
                });
            });
            console.log(`[ConvState] ✅ Loaded ${conversationStates.size} conversation states`);
        }
    } catch (err) {
        console.warn(`[ConvState] Warning loading states: ${err.message}`);
        conversationStates.clear();
    }
}

function saveConversationStates() {
    try {
        const obj = {};
        conversationStates.forEach((state, jid) => {
            obj[jid] = {
                lastOwnerMessageTime: state.lastOwnerMessageTime,
                lastBotReplyTime: state.lastBotReplyTime,
                lastUserMessageType: state.lastUserMessageType,
                messageCount: state.messageCount,
            };
        });
        fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
        console.warn(`[ConvState] Warning saving states: ${err.message}`);
    }
}

function getConversationState(jid) {
    if (!conversationStates.has(jid)) {
        conversationStates.set(jid, {
            jid,
            lastOwnerMessageTime: 0,
            lastBotReplyTime: 0,
            lastUserMessageType: 'text',
            conversationActive: false,
            messageCount: 0,
        });
    }
    return conversationStates.get(jid);
}

function setOwnerActive(jid) {
    const state = getConversationState(jid);
    state.lastOwnerMessageTime = Date.now();
    state.conversationActive = true;
    state.messageCount = 0; // Reset counter
    conversationStates.set(jid, state);
    saveConversationStates();

    // Auto-expire activity window after 15 min
    setTimeout(() => {
        const current = getConversationState(jid);
        if (current.lastOwnerMessageTime === state.lastOwnerMessageTime) {
            current.conversationActive = false;
        }
    }, FIFTEEN_MIN_MS);
}

function isConversationActive(jid) {
    const state = getConversationState(jid);
    const timeSinceOwnerMsg = Date.now() - state.lastOwnerMessageTime;
    return timeSinceOwnerMsg < FIFTEEN_MIN_MS && state.conversationActive;
}

function getOwnerInactivitySeconds(jid) {
    const state = getConversationState(jid);
    return Math.floor((Date.now() - state.lastOwnerMessageTime) / 1000);
}

function updateUserMessageType(jid, messageType) {
    const state = getConversationState(jid);
    state.lastUserMessageType = messageType;
    state.messageCount = (state.messageCount || 0) + 1;
    state.lastBotReplyTime = Date.now();
    conversationStates.set(jid, state);
    saveConversationStates();
}

function shouldAutoReplyBasedOnActivity(jid) {
    const state = getConversationState(jid);
    const inactivityMs = Date.now() - state.lastOwnerMessageTime;

    // [Layer 1] Owner active (< 15 min)
    if (inactivityMs < FIFTEEN_MIN_MS && state.conversationActive) {
        return 'skip'; // No auto-reply
    }

    // [Layer 2] Owner 15-60 min absent
    if (inactivityMs < SIXTY_MIN_MS) {
        if (state.messageCount > 2) {
            return 'context_aware'; // Short response only
        }
        return 'skip'; // Queue for review
    }

    // [Layer 3] Owner > 60 min absent
    return 'generic_absent'; // Send full auto-reply
}

function clearState(jid) {
    conversationStates.delete(jid);
    saveConversationStates();
}

// Load states on module require
loadConversationStates();

module.exports = {
    getConversationState,
    setOwnerActive,
    isConversationActive,
    getOwnerInactivitySeconds,
    updateUserMessageType,
    shouldAutoReplyBasedOnActivity,
    clearState,
};
