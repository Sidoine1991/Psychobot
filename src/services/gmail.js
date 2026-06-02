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
     * Get messages by category with pagination
     * @param {string} category - Gmail category (INBOX, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, etc.)
     * @param {number} maxResults - Maximum results per page
     * @param {string} pageToken - Page token for pagination
     * @returns {Object} Messages and pagination info
     */
    async getMessagesByCategory(category = 'INBOX', maxResults = 10, pageToken = null) {
        await this.initialize();

        try {
            const params = {
                userId: 'me',
                labelIds: [category],
                maxResults: maxResults
            };

            if (pageToken) {
                params.pageToken = pageToken;
            }

            const response = await this.gmail.users.messages.list(params);

            const messages = response.data.messages || [];
            const nextPageToken = response.data.nextPageToken;
            const resultSizeEstimate = response.data.resultSizeEstimate || 0;

            // Fetch full message details
            const fullMessages = await Promise.all(
                messages.map(msg => this.getMessage(msg.id))
            );

            return {
                messages: fullMessages,
                nextPageToken,
                totalEstimate: resultSizeEstimate,
                hasMore: !!nextPageToken
            };

        } catch (error) {
            console.error('[Gmail] Category messages error:', error.message);
            throw new Error(`Erreur catégorie ${category}: ${error.message}`);
        }
    }

    /**
     * Delete a message
     * @param {string} messageId - Message ID to delete
     */
    async deleteMessage(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.delete({
                userId: 'me',
                id: messageId
            });

            console.log('[Gmail] ✅ Message deleted:', messageId);

        } catch (error) {
            console.error('[Gmail] Delete error:', error.message);
            throw new Error(`Erreur suppression message: ${error.message}`);
        }
    }

    /**
     * Archive a message (remove INBOX label)
     * @param {string} messageId - Message ID to archive
     */
    async archiveMessage(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['INBOX']
                }
            });

            console.log('[Gmail] ✅ Message archived:', messageId);

        } catch (error) {
            console.error('[Gmail] Archive error:', error.message);
            throw new Error(`Erreur archivage message: ${error.message}`);
        }
    }

    /**
     * Mark message as spam
     * @param {string} messageId - Message ID
     */
    async markAsSpam(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    addLabelIds: ['SPAM'],
                    removeLabelIds: ['INBOX']
                }
            });

            console.log('[Gmail] ✅ Message marked as spam:', messageId);

        } catch (error) {
            console.error('[Gmail] Spam error:', error.message);
            throw new Error(`Erreur marquage spam: ${error.message}`);
        }
    }

    /**
     * Star a message
     * @param {string} messageId - Message ID
     */
    async starMessage(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    addLabelIds: ['STARRED']
                }
            });

            console.log('[Gmail] ✅ Message starred:', messageId);

        } catch (error) {
            console.error('[Gmail] Star error:', error.message);
            throw new Error(`Erreur étoile: ${error.message}`);
        }
    }

    /**
     * Unstar a message
     * @param {string} messageId - Message ID
     */
    async unstarMessage(messageId) {
        await this.initialize();

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['STARRED']
                }
            });

            console.log('[Gmail] ✅ Message unstarred:', messageId);

        } catch (error) {
            console.error('[Gmail] Unstar error:', error.message);
            throw new Error(`Erreur retrait étoile: ${error.message}`);
        }
    }

    /**
     * Send email with CC, BCC, and attachments
     * @param {Object} emailData - Email data
     * @returns {Object} Sent message info
     */
    async sendAdvancedEmail(emailData) {
        await this.initialize();

        const { to, cc, bcc, subject, body, attachments = [] } = emailData;

        try {
            const messageParts = [
                `To: ${Array.isArray(to) ? to.join(', ') : to}`,
                cc ? `Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}` : '',
                bcc ? `Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}` : '',
                subject ? `Subject: ${subject}` : '',
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

            console.log('[Gmail] ✅ Advanced email sent:', response.data.id);

            return {
                id: response.data.id,
                threadId: response.data.threadId,
                to: to,
                cc: cc,
                bcc: bcc,
                subject: subject
            };

        } catch (error) {
            console.error('[Gmail] Send advanced error:', error.message);
            throw new Error(`Erreur envoi email: ${error.message}`);
        }
    }

    /**
     * Get thread (conversation)
     * @param {string} threadId - Thread ID
     * @returns {Object} Thread with all messages
     */
    async getThread(threadId) {
        await this.initialize();

        try {
            const response = await this.gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
            });

            const messages = response.data.messages || [];

            const formattedMessages = messages.map(msg => this._formatMessage(msg));

            return {
                id: threadId,
                messageCount: messages.length,
                messages: formattedMessages
            };

        } catch (error) {
            console.error('[Gmail] Thread error:', error.message);
            throw new Error(`Erreur conversation: ${error.message}`);
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

    /**
     * Get attachment from email
     * @param {string} messageId - Message ID
     * @param {string} partId - Part ID (attachment)
     * @returns {Buffer} File content
     */
    async getAttachment(messageId, partId) {
        await this.initialize();

        try {
            const response = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: messageId,
                id: partId
            });

            const data = response.data.data;

            if (!data) {
                return null;
            }

            // Decode base64url to buffer
            const buffer = Buffer.from(data, 'base64');
            return buffer;

        } catch (error) {
            console.error('[Gmail] Attachment fetch error:', error.message);
            return null;
        }
    }

    /**
     * Get all attachments from a message
     * @param {string} messageId - Message ID
     * @returns {Array} [{filename, mimeType, partId, size}]
     */
    async getAttachmentsList(messageId) {
        await this.initialize();

        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            const message = response.data;
            const attachments = [];

            if (message.payload.parts) {
                for (const part of message.payload.parts) {
                    if (part.filename && part.filename.length > 0) {
                        attachments.push({
                            filename: part.filename,
                            mimeType: part.mimeType,
                            partId: part.partId,
                            size: part.size || 0
                        });
                    }
                }
            }

            return attachments;

        } catch (error) {
            console.error('[Gmail] Attachments list error:', error.message);
            return [];
        }
    }
}

// Singleton instance
const gmailInstance = new Gmail();

module.exports = gmailInstance;
