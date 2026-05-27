const fetch = require('node-fetch');

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY || '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';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'meta/llama-3.3-70b-instruct';

const SIDOINE_SYSTEM_PROMPT = `You are Sidoine Kolaolé YEBADOKPO's personal AI assistant. You know his profile:
- Data Analyst & Fullstack Developer
- Expert in MEAL (Monitoring, Evaluation, Accountability & Learning)
- Working at CCR-Bénin
- Trader & AI enthusiast
- Based in Bénin

Always respond in French unless asked otherwise. Be friendly, professional, and concise. If you're in a private message, you represent Sidoine personally. If the contact is someone from a group, be warm and genuine.`;

// Memory storage (in-memory, consider DB for production)
const conversationMemory = new Map();

async function getAIResponse(prompt, contactName = null, conversationHistory = []) {
    console.log(`[AI Service] Received prompt from ${contactName}: ${prompt}`);

    try {
        // Build conversation context
        const messages = [
            { role: 'system', content: SIDOINE_SYSTEM_PROMPT }
        ];

        // Add conversation history if available
        if (conversationHistory && conversationHistory.length > 0) {
            messages.push(...conversationHistory);
        }

        // Add current message
        messages.push({ role: 'user', content: prompt });

        const payload = {
            model: MODEL,
            messages: messages,
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1024
        };

        const response = await fetch(`${NVIDIA_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        // Store in memory for this contact
        if (contactName) {
            if (!conversationMemory.has(contactName)) {
                conversationMemory.set(contactName, []);
            }
            const memory = conversationMemory.get(contactName);
            memory.push({ role: 'user', content: prompt });
            memory.push({ role: 'assistant', content: aiResponse });
            // Keep last 10 exchanges
            if (memory.length > 20) {
                memory.splice(0, 2);
            }
        }

        return aiResponse;

    } catch (error) {
        console.error('[AI Service] Error:', error.message);
        return `Désolé, je n'ai pas pu traiter votre message. Erreur: ${error.message}`;
    }
}

function getConversationHistory(contactName) {
    if (contactName && conversationMemory.has(contactName)) {
        return conversationMemory.get(contactName);
    }
    return [];
}

function clearConversationMemory(contactName) {
    if (contactName) {
        conversationMemory.delete(contactName);
    }
}

module.exports = {
    getAIResponse,
    getConversationHistory,
    clearConversationMemory
};
