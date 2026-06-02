/**
 * Google Contacts Service for KolaBoT
 * Manages contacts via Google People API
 */

const { google } = require('googleapis');
const googleAuth = require('../integrations/googleAuth');

class GoogleContacts {
    constructor() {
        this.people = null;
    }

    /**
     * Initialize People API client
     */
    async initialize() {
        if (this.people) {
            return this.people;
        }

        const auth = await googleAuth.getAuth();
        this.people = google.people({ version: 'v1', auth });

        console.log('[GoogleContacts] ✅ People API initialized');
        return this.people;
    }

    /**
     * Search contacts by name or email
     * @param {string} query - Search query
     * @param {number} maxResults - Maximum number of results (default: 10)
     * @returns {Array} Array of contact objects
     */
    async searchContacts(query, maxResults = 10) {
        await this.initialize();

        try {
            const response = await this.people.people.searchContacts({
                query: query,
                readMask: 'names,emailAddresses,phoneNumbers,organizations',
                pageSize: maxResults
            });

            const results = response.data.results || [];

            return results.map(result => {
                const person = result.person;
                return this._formatContact(person);
            });

        } catch (error) {
            console.error('[GoogleContacts] Search error:', error.message);
            throw new Error(`Erreur recherche contacts: ${error.message}`);
        }
    }

    /**
     * List all contacts (paginated)
     * @param {number} maxResults - Maximum number of results (default: 20)
     * @returns {Array} Array of contact objects
     */
    async listContacts(maxResults = 20) {
        await this.initialize();

        try {
            const response = await this.people.people.connections.list({
                resourceName: 'people/me',
                pageSize: maxResults,
                personFields: 'names,emailAddresses,phoneNumbers,organizations'
            });

            const connections = response.data.connections || [];

            return connections.map(person => this._formatContact(person));

        } catch (error) {
            console.error('[GoogleContacts] List error:', error.message);
            throw new Error(`Erreur liste contacts: ${error.message}`);
        }
    }

    /**
     * Get contact by resource name
     * @param {string} resourceName - Contact resource name (people/xxxxx)
     * @returns {Object} Contact object
     */
    async getContact(resourceName) {
        await this.initialize();

        try {
            const response = await this.people.people.get({
                resourceName: resourceName,
                personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses'
            });

            return this._formatContact(response.data);

        } catch (error) {
            console.error('[GoogleContacts] Get error:', error.message);
            throw new Error(`Erreur récupération contact: ${error.message}`);
        }
    }

    /**
     * Create a new contact
     * @param {Object} contactData - Contact information
     * @param {string} contactData.firstName - First name
     * @param {string} contactData.lastName - Last name
     * @param {string} contactData.email - Email address
     * @param {string} contactData.phone - Phone number
     * @param {string} contactData.company - Company name (optional)
     * @returns {Object} Created contact
     */
    async createContact(contactData) {
        await this.initialize();

        const { firstName, lastName, email, phone, company } = contactData;

        try {
            const personResource = {
                names: [{
                    givenName: firstName,
                    familyName: lastName || ''
                }]
            };

            if (email) {
                personResource.emailAddresses = [{
                    value: email,
                    type: 'work'
                }];
            }

            if (phone) {
                personResource.phoneNumbers = [{
                    value: phone,
                    type: 'mobile'
                }];
            }

            if (company) {
                personResource.organizations = [{
                    name: company,
                    type: 'work'
                }];
            }

            const response = await this.people.people.createContact({
                requestBody: personResource
            });

            console.log('[GoogleContacts] ✅ Contact created:', response.data.resourceName);
            return this._formatContact(response.data);

        } catch (error) {
            console.error('[GoogleContacts] Create error:', error.message);
            throw new Error(`Erreur création contact: ${error.message}`);
        }
    }

    /**
     * Update existing contact
     * @param {string} resourceName - Contact resource name
     * @param {Object} updates - Fields to update
     * @returns {Object} Updated contact
     */
    async updateContact(resourceName, updates) {
        await this.initialize();

        try {
            // First get current contact
            const currentContact = await this.people.people.get({
                resourceName: resourceName,
                personFields: 'names,emailAddresses,phoneNumbers,organizations'
            });

            const personResource = currentContact.data;

            // Apply updates
            if (updates.firstName || updates.lastName) {
                personResource.names[0].givenName = updates.firstName || personResource.names[0].givenName;
                personResource.names[0].familyName = updates.lastName || personResource.names[0].familyName;
            }

            if (updates.email) {
                personResource.emailAddresses = personResource.emailAddresses || [];
                personResource.emailAddresses[0] = { value: updates.email, type: 'work' };
            }

            if (updates.phone) {
                personResource.phoneNumbers = personResource.phoneNumbers || [];
                personResource.phoneNumbers[0] = { value: updates.phone, type: 'mobile' };
            }

            const response = await this.people.people.updateContact({
                resourceName: resourceName,
                updatePersonFields: 'names,emailAddresses,phoneNumbers',
                requestBody: personResource
            });

            console.log('[GoogleContacts] ✅ Contact updated:', resourceName);
            return this._formatContact(response.data);

        } catch (error) {
            console.error('[GoogleContacts] Update error:', error.message);
            throw new Error(`Erreur mise à jour contact: ${error.message}`);
        }
    }

    /**
     * Format contact object for consistent output
     * @private
     */
    _formatContact(person) {
        const name = person.names?.[0];
        const email = person.emailAddresses?.[0];
        const phone = person.phoneNumbers?.[0];
        const org = person.organizations?.[0];

        return {
            resourceName: person.resourceName,
            displayName: name?.displayName || 'Sans nom',
            firstName: name?.givenName || '',
            lastName: name?.familyName || '',
            email: email?.value || null,
            phone: phone?.value || null,
            company: org?.name || null,
            jobTitle: org?.title || null
        };
    }
}

// Singleton instance
const googleContactsInstance = new GoogleContacts();

module.exports = googleContactsInstance;
