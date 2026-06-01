/**
 * RDS Client - PostgreSQL connection for PsychoBot
 * Manages database operations for jobs, applications, and stories
 */

const { Pool } = require('pg');

class RDSClient {
    constructor() {
        this.pool = null;
        this.connected = false;
    }

    /**
     * Initialize connection pool
     */
    async connect() {
        if (this.connected) return;

        try {
            this.pool = new Pool({
                host: process.env.AWS_RDS_HOST,
                port: parseInt(process.env.AWS_RDS_PORT || 5432),
                database: process.env.AWS_RDS_DATABASE || 'psychobot',
                user: process.env.AWS_RDS_USER,
                password: process.env.AWS_RDS_PASSWORD,
                ssl: process.env.AWS_RDS_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test connection
            const result = await this.pool.query('SELECT NOW()');
            console.log('[RDS] Connected to PostgreSQL:', result.rows[0]);
            this.connected = true;
        } catch (err) {
            console.error('[RDS] Connection failed:', err.message);
            throw err;
        }
    }

    /**
     * Query jobs from database
     */
    async getJobs(limit = 10) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM psychobot.job_scores LIMIT $1',
                [limit]
            );
            return result.rows;
        } catch (err) {
            console.error('[RDS] getJobs error:', err.message);
            return [];
        }
    }

    /**
     * Search jobs by keyword
     */
    async searchJobs(keyword) {
        try {
            const result = await this.pool.query(
                `SELECT * FROM psychobot.job_scores
                 WHERE company ILIKE $1 OR role ILIKE $1`,
                [`%${keyword}%`]
            );
            return result.rows;
        } catch (err) {
            console.error('[RDS] searchJobs error:', err.message);
            return [];
        }
    }

    /**
     * Create job application
     */
    async createApplication(company, role, status = 'Applied') {
        try {
            const result = await this.pool.query(
                `INSERT INTO psychobot.applications (company, role, status, applied_date, next_followup)
                 VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days')
                 RETURNING *`,
                [company, role, status]
            );
            return result.rows[0];
        } catch (err) {
            console.error('[RDS] createApplication error:', err.message);
            return null;
        }
    }

    /**
     * Get all applications
     */
    async getApplications() {
        try {
            const result = await this.pool.query(
                'SELECT * FROM psychobot.applications ORDER BY applied_date DESC'
            );
            return result.rows;
        } catch (err) {
            console.error('[RDS] getApplications error:', err.message);
            return [];
        }
    }

    /**
     * Create interview story
     */
    async createStory(title, situation, task, action, result, reflection, roles = []) {
        try {
            const result = await this.pool.query(
                `INSERT INTO psychobot.stories (title, situation, task, action, result, reflection, roles)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [title, situation, task, action, result, reflection, roles]
            );
            return result.rows[0];
        } catch (err) {
            console.error('[RDS] createStory error:', err.message);
            return null;
        }
    }

    /**
     * Get all stories
     */
    async getStories() {
        try {
            const result = await this.pool.query(
                'SELECT * FROM psychobot.stories ORDER BY created_at DESC'
            );
            return result.rows;
        } catch (err) {
            console.error('[RDS] getStories error:', err.message);
            return [];
        }
    }

    /**
     * Get dashboard stats
     */
    async getDashboardStats() {
        try {
            const appsResult = await this.pool.query('SELECT COUNT(*) as count FROM psychobot.applications');
            const storiesResult = await this.pool.query('SELECT COUNT(*) as count FROM psychobot.stories');
            const scoreResult = await this.pool.query(
                'SELECT AVG(numeric_score) as avg FROM psychobot.job_scores WHERE numeric_score IS NOT NULL'
            );

            return {
                totalApplications: parseInt(appsResult.rows[0].count),
                totalStories: parseInt(storiesResult.rows[0].count),
                averageScore: Math.round(scoreResult.rows[0].avg || 0),
                upcomingFollowups: 0 // TODO: implement
            };
        } catch (err) {
            console.error('[RDS] getDashboardStats error:', err.message);
            return {
                totalApplications: 0,
                totalStories: 0,
                averageScore: 0,
                upcomingFollowups: 0
            };
        }
    }

    /**
     * Close connection
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.connected = false;
            console.log('[RDS] Connection closed');
        }
    }
}

module.exports = new RDSClient();
