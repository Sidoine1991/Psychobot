/**
 * User Session Manager
 * Tracks pagination, context, and state for each WhatsApp user
 */

class UserSession {
    constructor() {
        // Store sessions per user (key: phone number)
        this.sessions = new Map();
    }

    /**
     * Get or create session for user
     */
    getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                // Gmail pagination
                gmail: {
                    currentPage: 1,
                    pageSize: 5,
                    totalEmails: 0,
                    category: 'INBOX', // INBOX, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, etc.
                    lastQuery: null,
                    emails: [] // Current page emails
                },

                // Compose state
                compose: {
                    active: false,
                    to: [],
                    cc: [],
                    bcc: [],
                    subject: '',
                    body: '',
                    attachments: [],
                    scheduledTime: null
                },

                // Last activity
                lastActivity: Date.now()
            });
        }

        // Update last activity
        const session = this.sessions.get(userId);
        session.lastActivity = Date.now();

        return session;
    }

    /**
     * Update Gmail pagination
     */
    updateGmailState(userId, updates) {
        const session = this.getSession(userId);
        Object.assign(session.gmail, updates);
    }

    /**
     * Get current page info
     */
    getPageInfo(userId) {
        const session = this.getSession(userId);
        const { currentPage, pageSize, totalEmails } = session.gmail;
        const totalPages = Math.ceil(totalEmails / pageSize);

        return {
            currentPage,
            pageSize,
            totalEmails,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
        };
    }

    /**
     * Navigate to next page
     */
    nextPage(userId) {
        const session = this.getSession(userId);
        const info = this.getPageInfo(userId);

        if (info.hasNext) {
            session.gmail.currentPage++;
            return session.gmail.currentPage;
        }

        return null; // No next page
    }

    /**
     * Navigate to previous page
     */
    prevPage(userId) {
        const session = this.getSession(userId);

        if (session.gmail.currentPage > 1) {
            session.gmail.currentPage--;
            return session.gmail.currentPage;
        }

        return null; // No previous page
    }

    /**
     * Go to specific page
     */
    goToPage(userId, pageNumber) {
        const session = this.getSession(userId);
        const info = this.getPageInfo(userId);

        if (pageNumber >= 1 && pageNumber <= info.totalPages) {
            session.gmail.currentPage = pageNumber;
            return pageNumber;
        }

        return null; // Invalid page
    }

    /**
     * Start compose session
     */
    startCompose(userId, initialData = {}) {
        const session = this.getSession(userId);
        session.compose = {
            active: true,
            to: initialData.to || [],
            cc: initialData.cc || [],
            bcc: initialData.bcc || [],
            subject: initialData.subject || '',
            body: initialData.body || '',
            attachments: initialData.attachments || [],
            scheduledTime: initialData.scheduledTime || null
        };

        return session.compose;
    }

    /**
     * Update compose data
     */
    updateCompose(userId, updates) {
        const session = this.getSession(userId);
        if (!session.compose.active) {
            return null;
        }

        Object.assign(session.compose, updates);
        return session.compose;
    }

    /**
     * End compose session
     */
    endCompose(userId) {
        const session = this.getSession(userId);
        const composeData = { ...session.compose };

        session.compose = {
            active: false,
            to: [],
            cc: [],
            bcc: [],
            subject: '',
            body: '',
            attachments: [],
            scheduledTime: null
        };

        return composeData;
    }

    /**
     * Clear old sessions (older than 1 hour)
     */
    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        for (const [userId, session] of this.sessions.entries()) {
            if (session.lastActivity < oneHourAgo) {
                this.sessions.delete(userId);
            }
        }
    }

    /**
     * Reset user session
     */
    reset(userId) {
        this.sessions.delete(userId);
    }
}

// Singleton instance
const userSessionInstance = new UserSession();

// Cleanup every 30 minutes
setInterval(() => {
    userSessionInstance.cleanup();
}, 30 * 60 * 1000);

module.exports = userSessionInstance;
