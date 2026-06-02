/**
 * Context Manager - Conversation & Email Context
 * Tracks last viewed emails, pages, and conversation state
 */

class ContextManager {
    constructor() {
        // Store context per user (key: phone number)
        this.contexts = new Map();
    }

    /**
     * Get or create context for user
     * @param {string} userId - User ID (phone number)
     * @returns {Object} User context
     */
    getContext(userId) {
        if (!this.contexts.has(userId)) {
            this.contexts.set(userId, {
                // Last emails displayed
                lastEmails: [], // Array of {id, subject, from, date}
                lastEmailId: null,

                // Current navigation state
                currentPage: 1,
                category: 'INBOX',

                // Conversation history (last 5 messages)
                conversationHistory: [],

                // Last activity
                lastActivity: Date.now()
            });
        }

        const context = this.contexts.get(userId);
        context.lastActivity = Date.now();

        return context;
    }

    /**
     * Update last viewed emails
     * @param {string} userId - User ID
     * @param {Array} emails - Array of email objects
     */
    updateLastEmails(userId, emails) {
        const context = this.getContext(userId);

        context.lastEmails = emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date
        }));

        // Set last email ID to the first one
        if (emails.length > 0) {
            context.lastEmailId = emails[0].id;
        }
    }

    /**
     * Set specific email as context
     * @param {string} userId - User ID
     * @param {string} emailId - Email ID
     */
    setLastEmail(userId, emailId) {
        const context = this.getContext(userId);
        context.lastEmailId = emailId;
    }

    /**
     * Update navigation state
     * @param {string} userId - User ID
     * @param {Object} navState - {currentPage, category}
     */
    updateNavigation(userId, navState) {
        const context = this.getContext(userId);

        if (navState.currentPage !== undefined) {
            context.currentPage = navState.currentPage;
        }

        if (navState.category !== undefined) {
            context.category = navState.category;
        }
    }

    /**
     * Add message to conversation history
     * @param {string} userId - User ID
     * @param {string} role - 'user' or 'assistant'
     * @param {string} message - Message content
     */
    addToHistory(userId, role, message) {
        const context = this.getContext(userId);

        context.conversationHistory.push({
            role,
            content: message,
            timestamp: Date.now()
        });

        // Keep only last 5 messages
        if (context.conversationHistory.length > 5) {
            context.conversationHistory.shift();
        }
    }

    /**
     * Get conversation history for AI context
     * @param {string} userId - User ID
     * @returns {Array} Conversation history
     */
    getHistory(userId) {
        const context = this.getContext(userId);
        return context.conversationHistory;
    }

    /**
     * Find email by natural reference
     * @param {string} userId - User ID
     * @param {string} reference - "ça", "cet email", "le dernier", "le premier", "9", "email 9"
     * @returns {string|null} Email ID
     */
    resolveEmailReference(userId, reference) {
        const context = this.getContext(userId);
        const lowerRef = reference.toLowerCase();

        if (!context.lastEmails || context.lastEmails.length === 0) {
            return null;
        }

        // Check for numeric reference: "9", "email 9", "le 9", "numero 9"
        const numberMatch = lowerRef.match(/(\d+)/);
        if (numberMatch) {
            const emailNumber = parseInt(numberMatch[1]) - 1; // Convert to 0-based index
            if (emailNumber >= 0 && emailNumber < context.lastEmails.length) {
                return context.lastEmails[emailNumber].id;
            }
        }

        // "ça", "cet email", "ce message", "celui-là"
        if (['ça', 'cet email', 'ce message', 'celui-là', 'celui', 'celui-ci'].some(r => lowerRef.includes(r))) {
            return context.lastEmailId;
        }

        // "le dernier", "dernier email"
        if (lowerRef.includes('dernier')) {
            return context.lastEmails[context.lastEmails.length - 1].id;
        }

        // "le premier", "premier email"
        if (lowerRef.includes('premier')) {
            return context.lastEmails[0].id;
        }

        // Default to last email ID
        return context.lastEmailId;
    }

    /**
     * Clear context for user
     * @param {string} userId - User ID
     */
    clear(userId) {
        this.contexts.delete(userId);
    }

    /**
     * Cleanup old contexts (older than 1 hour)
     */
    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        for (const [userId, context] of this.contexts.entries()) {
            if (context.lastActivity < oneHourAgo) {
                this.contexts.delete(userId);
            }
        }
    }

    /**
     * Get summary of current context for AI
     * @param {string} userId - User ID
     * @returns {Object} Context summary
     */
    getSummaryForAI(userId) {
        const context = this.getContext(userId);

        return {
            lastEmailId: context.lastEmailId,
            currentPage: context.currentPage,
            category: context.category,
            emailCount: context.lastEmails.length,
            hasHistory: context.conversationHistory.length > 0
        };
    }
}

// Singleton instance
const contextManagerInstance = new ContextManager();

// Cleanup every 30 minutes
setInterval(() => {
    contextManagerInstance.cleanup();
}, 30 * 60 * 1000);

module.exports = contextManagerInstance;
