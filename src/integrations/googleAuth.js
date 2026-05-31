/**
 * Google Authentication Service for KolaBoT
 * Handles authentication with Google APIs using Service Account
 */

const { google } = require('googleapis');

class GoogleAuth {
    constructor() {
        this.auth = null;
        this.initialized = false;
    }

    /**
     * Initialize Google Auth with Service Account credentials
     * Uses environment variables for security
     */
    async initialize() {
        if (this.initialized) {
            return this.auth;
        }

        try {
            const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
            const privateKey = process.env.GOOGLE_PRIVATE_KEY;

            if (!clientEmail || !privateKey) {
                throw new Error('Google credentials not configured. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.');
            }

            // Replace escaped newlines with actual newlines
            const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

            // Create JWT client with Service Account
            this.auth = new google.auth.JWT({
                email: clientEmail,
                key: formattedPrivateKey,
                scopes: [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/calendar.events'
                ]
            });

            // Test authentication
            await this.auth.authorize();

            this.initialized = true;
            console.log('[GoogleAuth] ✅ Authentication successful');
            console.log(`[GoogleAuth] Service Account: ${clientEmail}`);

            return this.auth;

        } catch (error) {
            console.error('[GoogleAuth] ❌ Authentication failed:', error.message);
            throw error;
        }
    }

    /**
     * Get authenticated Google Auth client
     * Initializes if not already done
     */
    async getAuth() {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.auth;
    }

    /**
     * Check if Google Auth is configured and working
     */
    async healthCheck() {
        try {
            await this.getAuth();
            return { success: true, message: 'Google Auth OK' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Singleton instance
const googleAuthInstance = new GoogleAuth();

module.exports = googleAuthInstance;
