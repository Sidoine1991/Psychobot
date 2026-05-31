/**
 * Gmail Service for KolaBoT
 * Manages emails via Gmail API
 */

const { google } = require('googleapis');
const googleOAuth = require('../integrations/googleOAuth');

class Gmail {
    constructor() {
        this.gmail = null;
    }

    /**
     * Initialize Gmail API client
     */
    async initialize() {
        if (this.gmail) {
            return this.gmail;
        }

        // Use OAuth2 client instead of Service Account
        const auth = await googleOAuth.getClient();
        this.gmail = google.gmail({ version: 'v1', auth });

        console.log('[Gmail] ✅ Gmail API initialized with OAuth');
        return this.gmail;
    }

    /**
     * Get inbox messages
     * @param {number} maxResults - Maximum number of messages (default: 10)
     * @param {boolean} unreadOnly - Only unread messages (default: false)
     * @returns {Array} Array of message objects
     */
    async getInbox(maxResults = 10, unreadOnly = false) {
        await this.initialize();

        try {
            const query = unreadOnly ? 'is:unread' : 'in:inbox';

            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: maxResults
            });

            const messages = response.data.messages || [];

            // Fetch full message details
            const fullMessages = await Promise.all(
                messages.map(msg => this.getMessage(msg.id))
            );

            return fullMessages;

        } catch (error) {
            console.error('[Gmail] Inbox error:', error.message);
            throw new Error(`Erreur lecture inbox: ${error.message}`);
        }
    }

    /**
     * Get a single message by ID
     * @param {string} messageId - Message ID
     * @returns {Object} Message object
     */
    async getMessage(messageId) {
        await this.initialize();

        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            return this._formatMessage(response.data);

        } catch (error) {
            console.error('[Gmail] Get message error:', error.message);
            throw new Error(`Erreur lecture message: ${error.message}`);
        }
    }

    /**
     * Search messages by query
     * @param {string} query - Gmail search query (e.g., "from:example@gmail.com subject:important")
     * @param {number} maxResults - Maximum results (default: 10)
     * @returns {Array} Array of message objects
     */
    async searchMessages(query, maxResults = 10) {
        await this.initialize();

        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: maxResults
            });

            const messages = response.data.messages || [];

            const fullMessages = await Promise.all(
                messages.map(msg => this.getMessage(msg.id))
            );

            return fullMessages;

        } catch (error) {
            console.error('[Gmail] Search error:', error.message);
            throw new Error(`Erreur recherche messages: ${error.message}`);
        }
    }

    /**
     * Send an email
     * @param {Object} emailData - Email information
     * @param {string} emailData.to - Recipient email
     * @param {string} emailData.subject - Email subject
     * @param {string} emailData.body - Email body (plain text)
     * @param {string} emailData.cc - CC recipients (optional)
     * @returns {Object} Sent message info
     */
    async sendEmail(emailData) {
        await this.initialize();

        const { to, subject, body, cc } = emailData;

        try {
            // Create RFC 2822 formatted message
            const messageParts = [
                `To: ${to}`,
                subject ? `Subject: ${subject}` : '',
                cc ? `Cc: ${cc}` : '',
                'Content-Type: text/plain; charset=utf-8',
                '',
                body
            ];

            const message = messageParts.filter(p => p).join('\n');

            // Encode message in base64url format
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });

            console.log('[Gmail] ✅ Email sent:', response.data.id);

            return {
                id: response.data.id,
                threadId: response.data.threadId,
                to: to,
                subject: subject
            };

        } catch (error) {
            console.error('[Gmail] Send error:', error.message);
            throw new Error(`Erreur envoi email: ${error.message}`);
        }
    }

    /**
     * Mark message as read
     * @param {string} messageId - Message ID
     */
    async markAsRead(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });

            console.log('[Gmail] ✅ Message marked as read:', messageId);

        } catch (error) {
            console.error('[Gmail] Mark read error:', error.message);
            throw new Error(`Erreur marquage lu: ${error.message}`);
        }
    }

    /**
     * Mark message as unread
     * @param {string} messageId - Message ID
     */
    async markAsUnread(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    addLabelIds: ['UNREAD']
                }
            });

            console.log('[Gmail] ✅ Message marked as unread:', messageId);

        } catch (error) {
            console.error('[Gmail] Mark unread error:', error.message);
            throw new Error(`Erreur marquage non-lu: ${error.message}`);
        }
    }

    /**
     * Get important messages (starred or important label)
     * @param {number} maxResults - Maximum results (default: 10)
     * @returns {Array} Array of important messages
     */
    async getImportantMessages(maxResults = 10) {
        await this.initialize();

        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: 'is:important OR is:starred',
                maxResults: maxResults
            });

            const messages = response.data.messages || [];

            const fullMessages = await Promise.all(
                messages.map(msg => this.getMessage(msg.id))
            );

            return fullMessages;

        } catch (error) {
            console.error('[Gmail] Important messages error:', error.message);
            throw new Error(`Erreur messages importants: ${error.message}`);
        }
    }

    /**
     * Format message object for consistent output
     * @private
     */
    _formatMessage(message) {
        const headers = message.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        // Extract body
        let body = '';
        if (message.payload.body.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        } else if (message.payload.parts) {
            const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart && textPart.body.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
        }

        // Truncate long body
        if (body.length > 500) {
            body = body.substring(0, 497) + '...';
        }

        return {
            id: message.id,
            threadId: message.threadId,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: new Date(parseInt(message.internalDate)),
            snippet: message.snippet,
            body: body,
            labels: message.labelIds || [],
            isUnread: message.labelIds?.includes('UNREAD') || false,
            isImportant: message.labelIds?.includes('IMPORTANT') || false,
            isStarred: message.labelIds?.includes('STARRED') || false
        };
    }
}

// Singleton instance
const gmailInstance = new Gmail();

module.exports = gmailInstance;
