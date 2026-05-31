/**
 * Google Calendar Service for KolaBoT
 * Create, read, update Calendar events autonomously
 */

const { google } = require('googleapis');
const googleAuth = require('../integrations/googleAuth');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

class GoogleCalendarService {
    constructor() {
        this.calendar = null;
        this.initialized = false;
    }

    /**
     * Initialize Calendar API client
     */
    async initialize() {
        if (this.initialized) {
            return this.calendar;
        }

        try {
            const auth = await googleAuth.getAuth();
            this.calendar = google.calendar({ version: 'v3', auth });
            this.initialized = true;

            console.log('[GoogleCalendar] ✅ Service initialized');
            console.log(`[GoogleCalendar] Calendar ID: ${CALENDAR_ID}`);

            return this.calendar;

        } catch (error) {
            console.error('[GoogleCalendar] ❌ Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Get events for today
     * @returns {Promise<Array>} List of today's events
     */
    async getTodayEvents() {
        try {
            await this.initialize();

            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));

            const response = await this.calendar.events.list({
                calendarId: CALENDAR_ID,
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = response.data.items || [];
            console.log(`[GoogleCalendar] Found ${events.length} events today`);

            return events.map(event => this.formatEvent(event));

        } catch (error) {
            console.error('[GoogleCalendar] Error fetching today events:', error.message);
            throw error;
        }
    }

    /**
     * Get events for a specific date
     * @param {Date} date - Target date
     * @returns {Promise<Array>} List of events
     */
    async getEventsForDate(date) {
        try {
            await this.initialize();

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const response = await this.calendar.events.list({
                calendarId: CALENDAR_ID,
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = response.data.items || [];
            return events.map(event => this.formatEvent(event));

        } catch (error) {
            console.error('[GoogleCalendar] Error fetching events:', error.message);
            throw error;
        }
    }

    /**
     * Create a new calendar event
     * @param {Object} eventData - Event details
     * @returns {Promise<Object>} Created event
     */
    async createEvent(eventData) {
        try {
            await this.initialize();

            const {
                summary,
                description = '',
                startDateTime,
                endDateTime = null,
                location = '',
                attendees = []
            } = eventData;

            // Calculate end time if not provided (default: 1 hour)
            const startTime = new Date(startDateTime);
            const endTime = endDateTime ? new Date(endDateTime) : new Date(startTime.getTime() + 60 * 60 * 1000);

            const event = {
                summary,
                description,
                location,
                start: {
                    dateTime: startTime.toISOString(),
                    timeZone: 'Africa/Porto-Novo' // Benin timezone
                },
                end: {
                    dateTime: endTime.toISOString(),
                    timeZone: 'Africa/Porto-Novo'
                },
                attendees: attendees.map(email => ({ email })),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 60 },  // 1h avant
                        { method: 'popup', minutes: 15 }   // 15 min avant
                    ]
                }
            };

            const response = await this.calendar.events.insert({
                calendarId: CALENDAR_ID,
                resource: event,
                sendUpdates: 'all' // Send notifications to attendees
            });

            const createdEvent = response.data;
            console.log(`[GoogleCalendar] ✅ Event created: ${summary} at ${startTime.toLocaleString('fr-FR')}`);

            return this.formatEvent(createdEvent);

        } catch (error) {
            console.error('[GoogleCalendar] Error creating event:', error.message);
            throw error;
        }
    }

    /**
     * Delete an event
     * @param {string} eventId - Google Calendar event ID
     */
    async deleteEvent(eventId) {
        try {
            await this.initialize();

            await this.calendar.events.delete({
                calendarId: CALENDAR_ID,
                eventId: eventId
            });

            console.log(`[GoogleCalendar] ✅ Event deleted: ${eventId}`);
            return { success: true, eventId };

        } catch (error) {
            console.error('[GoogleCalendar] Error deleting event:', error.message);
            throw error;
        }
    }

    /**
     * Format event for display
     * @param {Object} event - Raw Google Calendar event
     * @returns {Object} Formatted event
     */
    formatEvent(event) {
        const startTime = event.start.dateTime || event.start.date;
        const endTime = event.end.dateTime || event.end.date;

        return {
            id: event.id,
            summary: event.summary || '(Sans titre)',
            description: event.description || '',
            location: event.location || '',
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            attendees: (event.attendees || []).map(a => a.email),
            htmlLink: event.htmlLink
        };
    }

    /**
     * Format events list for WhatsApp display
     * @param {Array} events - List of formatted events
     * @returns {string} WhatsApp formatted message
     */
    formatEventsForWhatsApp(events, date = new Date()) {
        if (events.length === 0) {
            return `📅 *Agenda du ${date.toLocaleDateString('fr-FR')}*\n\n(Aucun événement prévu)`;
        }

        const dateStr = date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let message = `📅 *Agenda du ${dateStr}*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

        events.forEach((event, index) => {
            const timeStr = event.startTime.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            message += `${index + 1}. *${timeStr}* - ${event.summary}\n`;

            if (event.location) {
                message += `   📍 ${event.location}\n`;
            }

            if (event.description) {
                const shortDesc = event.description.length > 100
                    ? event.description.substring(0, 97) + '...'
                    : event.description;
                message += `   📝 ${shortDesc}\n`;
            }

            message += '\n';
        });

        return message.trim();
    }

    /**
     * Parse natural language date/time from user message
     * Examples: "aujourd'hui 16h", "demain 10h", "01/06 14h30"
     * @param {string} text - User input
     * @returns {Date|null} Parsed date
     */
    parseDateTime(text) {
        const now = new Date();

        // Aujourd'hui + heure
        const todayMatch = text.match(/aujourd'?hui\s+(?:à\s+)?(\d{1,2})h?(\d{2})?/i);
        if (todayMatch) {
            const hours = parseInt(todayMatch[1]);
            const minutes = parseInt(todayMatch[2] || '0');
            const date = new Date(now);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }

        // Demain + heure
        const tomorrowMatch = text.match(/demain\s+(?:à\s+)?(\d{1,2})h?(\d{2})?/i);
        if (tomorrowMatch) {
            const hours = parseInt(tomorrowMatch[1]);
            const minutes = parseInt(tomorrowMatch[2] || '0');
            const date = new Date(now);
            date.setDate(date.getDate() + 1);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }

        // Format JJ/MM + heure
        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\s+(?:à\s+)?(\d{1,2})h?(\d{2})?/i);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1;
            const hours = parseInt(dateMatch[3]);
            const minutes = parseInt(dateMatch[4] || '0');
            const date = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);
            return date;
        }

        return null;
    }

    /**
     * Extract meeting subject from user message
     * @param {string} text - User message
     * @returns {string} Meeting subject
     */
    extractMeetingSubject(text) {
        // Remove common phrases to extract subject
        let subject = text
            .replace(/rdv|rendez-vous|réunion|appel|rencontre/gi, '')
            .replace(/aujourd'?hui|demain/gi, '')
            .replace(/à|pour|sur|concernant/gi, '')
            .replace(/\d{1,2}h\d{0,2}/gi, '')
            .replace(/\d{1,2}\/\d{1,2}/gi, '')
            .trim();

        // If nothing left, use generic subject
        if (subject.length < 3) {
            subject = 'Rendez-vous';
        }

        // Capitalize first letter
        subject = subject.charAt(0).toUpperCase() + subject.slice(1);

        return subject;
    }
}

// Singleton instance
const googleCalendarService = new GoogleCalendarService();

module.exports = googleCalendarService;
