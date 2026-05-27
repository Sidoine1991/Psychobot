const aiService = require('../services/ai');

// Store conversation dates to track if we've already chatted today
const conversationDates = new Map();

async function getContactName(sock, jid) {
    try {
        const contact = await sock.store?.contacts?.[jid];
        if (contact?.name) return contact.name;
        return jid.split('@')[0];
    } catch (e) {
        return jid.split('@')[0];
    }
}

function shouldReplyToContact(jid) {
    const today = new Date().toDateString();
    const lastDate = conversationDates.get(jid);

    // Si pas de conversation ce jour, on peut répondre
    if (lastDate !== today) {
        conversationDates.set(jid, today);
        return true;
    }

    // Si déjà en conversation aujourd'hui, continuer à répondre normalement
    return true;
}

function markConversationToday(jid) {
    conversationDates.set(jid, new Date().toDateString());
}

module.exports = async (msg, sock) => {
    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const isDM = remoteJid.endsWith('@s.whatsapp.net');
    const senderId = msg.key.participant || remoteJid;

    // Extract text
    let text = "";
    let isMentioned = false;

    if (msg.message.conversation) {
        text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage) {
        text = msg.message.extendedTextMessage.text;
        const mentions = msg.message.extendedTextMessage.contextInfo?.mentionedJid || [];
        if (mentions.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net') || mentions.includes(sock.user.id)) {
            isMentioned = true;
        }
    }

    if (!text) return;

    // Only respond to DM or mentions in groups
    if (!isDM && !isMentioned) return;

    console.log("Auto Response Triggered for:", text);

    try {
        // Get contact name (for personalized replies)
        const contactJid = isDM ? remoteJid : senderId;
        const contactName = await getContactName(sock, contactJid);

        // Get conversation history for context
        const conversationHistory = aiService.getConversationHistory(contactName);

        // For DM: check if we've already had conversation today
        // If yes, we should still respond but mark as ongoing conversation
        let shouldReply = true;
        if (isDM) {
            shouldReply = shouldReplyToContact(contactJid);
            if (shouldReply) {
                markConversationToday(contactJid);
            }
        }

        if (!shouldReply) {
            console.log(`Already chatted with ${contactName} today, skipping auto-reply`);
            return;
        }

        // Get AI response with context
        const aiResponse = await aiService.getAIResponse(text, contactName, conversationHistory);

        // Check if response should be sent (not empty, meaningful)
        if (aiResponse && aiResponse.trim().length > 0) {
            // Format response: 🤖 **Sidoine's Assistant** at the top, then response in bold
            const formattedResponse = `🤖 *Assistant Personnel*\n\n${aiResponse}`;

            await sock.sendMessage(remoteJid, { text: formattedResponse }, { quoted: msg });

            console.log(`[Auto-Reply] Sent to ${contactName}: ${aiResponse.substring(0, 50)}...`);
        } else {
            console.log("AI returned empty response, no reply sent");
        }

    } catch (error) {
        console.error("Error in auto-response:", error);
    }
};
