/**
 * Attachment Manager - Download & Cache email attachments
 * Stores attachments temporarily and generates download links
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gmail = require('./gmail');

class AttachmentManager {
    constructor() {
        // Store: {token: {filePath, filename, mimeType, createdAt, expiresAt}}
        this.attachments = new Map();
        this.cacheDir = path.join(process.cwd(), 'tmp', 'attachments');

        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        // Cleanup expired attachments every 30 minutes
        setInterval(() => this.cleanup(), 30 * 60 * 1000);
    }

    /**
     * Download attachment from Gmail and cache it
     * @param {string} messageId - Gmail message ID
     * @param {string} partId - Gmail part ID (attachment)
     * @param {string} filename - Original filename
     * @param {string} mimeType - MIME type
     * @returns {Object} {token, url, filename, size}
     */
    async downloadAndCache(messageId, partId, filename, mimeType) {
        try {
            // Generate unique token
            const token = crypto.randomBytes(16).toString('hex');

            // Download from Gmail
            console.log(`[AttachmentManager] Downloading: ${filename}`);
            const attachmentData = await gmail.getAttachment(messageId, partId);

            if (!attachmentData) {
                throw new Error('Failed to download attachment');
            }

            // Save to cache
            const filepath = path.join(this.cacheDir, `${token}_${filename}`);
            fs.writeFileSync(filepath, attachmentData);

            // Calculate size
            const stats = fs.statSync(filepath);
            const sizeKB = Math.round(stats.size / 1024);

            // Store metadata
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            this.attachments.set(token, {
                filePath: filepath,
                filename: filename,
                mimeType: mimeType,
                size: stats.size,
                createdAt: Date.now(),
                expiresAt: expiresAt
            });

            console.log(`[AttachmentManager] Cached: ${token} (${sizeKB} KB)`);

            return {
                token: token,
                filename: filename,
                size: sizeKB,
                mimeType: mimeType,
                expiresAt: expiresAt
            };

        } catch (error) {
            console.error('[AttachmentManager] Download error:', error.message);
            return null;
        }
    }

    /**
     * Get attachment file for download
     * @param {string} token - Attachment token
     * @returns {Object} {filePath, filename, mimeType} or null
     */
    getAttachment(token) {
        const attachment = this.attachments.get(token);

        if (!attachment) {
            console.log('[AttachmentManager] Token not found:', token);
            return null;
        }

        // Check expiration
        if (Date.now() > attachment.expiresAt) {
            console.log('[AttachmentManager] Token expired:', token);
            this.deleteAttachment(token);
            return null;
        }

        return attachment;
    }

    /**
     * Delete attachment file
     * @param {string} token - Attachment token
     */
    deleteAttachment(token) {
        const attachment = this.attachments.get(token);

        if (attachment && fs.existsSync(attachment.filePath)) {
            try {
                fs.unlinkSync(attachment.filePath);
                this.attachments.delete(token);
                console.log('[AttachmentManager] Deleted:', token);
            } catch (error) {
                console.error('[AttachmentManager] Delete error:', error.message);
            }
        }
    }

    /**
     * Cleanup expired attachments
     */
    cleanup() {
        let deleted = 0;

        for (const [token, attachment] of this.attachments.entries()) {
            if (Date.now() > attachment.expiresAt) {
                this.deleteAttachment(token);
                deleted++;
            }
        }

        if (deleted > 0) {
            console.log(`[AttachmentManager] Cleanup: Deleted ${deleted} expired attachments`);
        }
    }

    /**
     * Get attachment stats (for debugging)
     * @returns {Object} Stats
     */
    getStats() {
        let totalSize = 0;
        let count = 0;

        for (const attachment of this.attachments.values()) {
            totalSize += attachment.size;
            count++;
        }

        return {
            count: count,
            totalSizeMB: Math.round(totalSize / (1024 * 1024)),
            cacheDir: this.cacheDir
        };
    }
}

// Singleton instance
const attachmentManagerInstance = new AttachmentManager();

module.exports = attachmentManagerInstance;
