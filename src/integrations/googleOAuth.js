/**
 * Google OAuth 2.0 for Gmail Personal Access
 * Handles OAuth flow for user consent
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleOAuth {
    constructor() {
        this.oauth2Client = null;
        this.tokenPath = path.join(__dirname, '../../.oauth-tokens.json');
    }

    /**
     * Initialize OAuth2 client
     */
    initialize() {
        if (this.oauth2Client) {
            return this.oauth2Client;
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('OAuth credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI');
        }

        this.oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        // Load existing tokens if available
        this.loadTokens();

        console.log('[GoogleOAuth] ✅ OAuth2 client initialized');
        return this.oauth2Client;
    }

    /**
     * Generate authorization URL
     * @returns {string} Authorization URL for user consent
     */
    generateAuthUrl() {
        if (!this.oauth2Client) {
            this.initialize();
        }

        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline', // Get refresh token
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/contacts',
                'https://www.googleapis.com/auth/contacts.readonly'
            ],
            prompt: 'consent' // Force consent screen to get refresh token
        });

        console.log('[GoogleOAuth] Authorization URL generated');
        return authUrl;
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code from callback
     * @returns {Object} Token information
     */
    async getTokenFromCode(code) {
        if (!this.oauth2Client) {
            this.initialize();
        }

        try {
            const { tokens } = await this.oauth2Client.getToken(code);

            // Set credentials
            this.oauth2Client.setCredentials(tokens);

            // Save tokens
            this.saveTokens(tokens);

            console.log('[GoogleOAuth] ✅ Tokens obtained and saved');
            console.log('[GoogleOAuth] Access token expires:', new Date(tokens.expiry_date).toLocaleString());

            return tokens;

        } catch (error) {
            console.error('[GoogleOAuth] ❌ Token exchange failed:', error.message);
            throw error;
        }
    }

    /**
     * Get valid access token (refreshes if expired)
     * @returns {string} Valid access token
     */
    async getAccessToken() {
        if (!this.oauth2Client) {
            this.initialize();
        }

        if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.refresh_token) {
            throw new Error('No refresh token available. User must authorize first.');
        }

        try {
            // Check if token is expired
            const now = Date.now();
            const expiryDate = this.oauth2Client.credentials.expiry_date;

            if (expiryDate && now >= expiryDate - 60000) { // Refresh 1 min before expiry
                console.log('[GoogleOAuth] Access token expired, refreshing...');
                const { credentials } = await this.oauth2Client.refreshAccessToken();
                this.oauth2Client.setCredentials(credentials);
                this.saveTokens(credentials);
                console.log('[GoogleOAuth] ✅ Access token refreshed');
            }

            return this.oauth2Client.credentials.access_token;

        } catch (error) {
            console.error('[GoogleOAuth] ❌ Token refresh failed:', error.message);
            throw new Error('Failed to refresh access token. User may need to re-authorize.');
        }
    }

    /**
     * Get OAuth2 client with valid credentials
     * @returns {OAuth2Client} Authenticated OAuth2 client
     */
    async getClient() {
        if (!this.oauth2Client) {
            this.initialize();
        }

        // Ensure we have a valid access token
        await this.getAccessToken();

        return this.oauth2Client;
    }

    /**
     * Check if user is authorized
     * @returns {boolean} True if refresh token exists
     */
    isAuthorized() {
        if (!this.oauth2Client) {
            this.initialize();
        }

        return !!(this.oauth2Client.credentials && this.oauth2Client.credentials.refresh_token);
    }

    /**
     * Get authorization status and token info
     * @returns {Object} Status information
     */
    getStatus() {
        if (!this.oauth2Client || !this.oauth2Client.credentials) {
            return {
                authorized: false,
                message: 'Not authorized'
            };
        }

        const creds = this.oauth2Client.credentials;
        const now = Date.now();
        const expiryDate = creds.expiry_date;
        const isExpired = expiryDate && now >= expiryDate;

        return {
            authorized: !!creds.refresh_token,
            hasAccessToken: !!creds.access_token,
            isExpired: isExpired,
            expiryDate: expiryDate ? new Date(expiryDate).toLocaleString() : null,
            scopes: creds.scope ? creds.scope.split(' ') : []
        };
    }

    /**
     * Revoke access and delete tokens
     */
    async revokeAccess() {
        if (!this.oauth2Client || !this.oauth2Client.credentials.access_token) {
            return;
        }

        try {
            await this.oauth2Client.revokeCredentials();
            console.log('[GoogleOAuth] ✅ Access revoked');
        } catch (error) {
            console.error('[GoogleOAuth] ⚠️  Revoke failed:', error.message);
        }

        // Delete tokens file
        if (fs.existsSync(this.tokenPath)) {
            fs.unlinkSync(this.tokenPath);
            console.log('[GoogleOAuth] ✅ Tokens deleted');
        }

        this.oauth2Client.setCredentials({});
    }

    /**
     * Save tokens to file
     * @private
     */
    saveTokens(tokens) {
        try {
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
            console.log('[GoogleOAuth] Tokens saved to:', this.tokenPath);
        } catch (error) {
            console.error('[GoogleOAuth] ⚠️  Failed to save tokens:', error.message);
        }
    }

    /**
     * Load tokens from file
     * @private
     */
    loadTokens() {
        if (!fs.existsSync(this.tokenPath)) {
            return null;
        }

        try {
            const tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
            this.oauth2Client.setCredentials(tokens);
            console.log('[GoogleOAuth] ✅ Tokens loaded from file');
            return tokens;
        } catch (error) {
            console.error('[GoogleOAuth] ⚠️  Failed to load tokens:', error.message);
            return null;
        }
    }
}

// Singleton instance
const googleOAuthInstance = new GoogleOAuth();

module.exports = googleOAuthInstance;
