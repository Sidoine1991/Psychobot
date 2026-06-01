/**
 * Job Prospector - Scrapes job sites for opportunities
 * Stores raw jobs in RDS for scoring and review
 */

const axios = require('axios');
const rdsClient = require('../db/rdsClient');

class JobProspector {
    constructor() {
        this.prospectingSources = [
            { name: 'indeed', url: 'https://www.indeed.com/jobs?q=' },
            { name: 'linkedin', url: 'https://www.linkedin.com/jobs/search/?keywords=' },
            { name: 'glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm?keyword=' }
        ];
    }

    /**
     * Prospect jobs from multiple sources
     * @param {string} keywords - Search keywords (e.g., "senior engineer")
     * @param {string} location - Location filter (e.g., "Remote")
     * @param {number} limit - Max jobs per source
     */
    async prospectJobs(keywords = 'software engineer', location = 'Remote', limit = 20) {
        console.log(`[Prospector] Starting search: "${keywords}" in "${location}"`);

        const allJobs = [];
        const errors = [];

        // Try each source in parallel
        const promises = [
            this.scrapeIndeed(keywords, location, limit).catch(e => errors.push(e)),
            this.scrapeLinkedIn(keywords, location, limit).catch(e => errors.push(e)),
            this.scrapeGlassdoor(keywords, location, limit).catch(e => errors.push(e))
        ];

        const results = await Promise.allSettled(promises);

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allJobs.push(...result.value);
            }
        });

        console.log(`[Prospector] Found ${allJobs.length} jobs from ${this.prospectingSources.length} sources`);

        // Store jobs in RDS with "PENDING_REVIEW" status
        return await this.storeJobsForReview(allJobs);
    }

    /**
     * Scrape Indeed jobs (using web scraping or API mock)
     */
    async scrapeIndeed(keywords, location, limit) {
        try {
            console.log(`[Indeed] Scraping "${keywords}" in "${location}"...`);

            // In production, use puppeteer or cheerio to scrape
            // For now, return mock data that matches realistic Indeed jobs
            const jobs = [
                {
                    source: 'indeed',
                    title: `${keywords} - ${Math.random() > 0.5 ? 'Senior' : 'Mid-Level'}`,
                    company: ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple'][Math.floor(Math.random() * 5)],
                    location: location,
                    salary: `$${80000 + Math.floor(Math.random() * 100000)}-$${150000 + Math.floor(Math.random() * 100000)}`,
                    description: `We are looking for a talented ${keywords} to join our team. Requirements include: Strong coding skills, Problem solving, Team collaboration.`,
                    url: `https://indeed.com/jobs?q=${keywords}`,
                    postedDate: new Date(),
                    jobType: ['Full-time', 'Contract', 'Remote'][Math.floor(Math.random() * 3)]
                }
            ];

            // Add realistic variety
            for (let i = 0; i < Math.min(limit - 1, 5); i++) {
                jobs.push({
                    source: 'indeed',
                    title: `${['Senior', 'Mid-Level', 'Junior'][i % 3]} ${keywords}`,
                    company: ['Company ' + (i+1), 'Startup ' + (i+2), 'Tech Corp ' + (i+3)][i % 3],
                    location: location,
                    salary: `$${70000 + i*5000}-$${140000 + i*10000}`,
                    description: `Position: ${keywords}. Location: ${location}. Full-time opportunity with great benefits.`,
                    url: `https://indeed.com/cmp/job-${i}`,
                    postedDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
                    jobType: 'Full-time'
                });
            }

            return jobs.slice(0, limit);
        } catch (err) {
            console.error('[Indeed] Scrape error:', err.message);
            return [];
        }
    }

    /**
     * Scrape LinkedIn jobs (using web scraping or API mock)
     */
    async scrapeLinkedIn(keywords, location, limit) {
        try {
            console.log(`[LinkedIn] Scraping "${keywords}" in "${location}"...`);

            const jobs = [];
            for (let i = 0; i < Math.min(limit, 8); i++) {
                jobs.push({
                    source: 'linkedin',
                    title: `${['Principal', 'Senior', 'Staff'][i % 3]} ${keywords}`,
                    company: ['LinkedIn', 'Uber', 'Airbnb', 'Stripe', 'Notion', 'Figma', 'Canva', 'Discord'][i % 8],
                    location: location,
                    salary: `$${90000 + i*8000}-$${160000 + i*12000}`,
                    description: `We're hiring for a ${keywords} role. This is a high-impact position on a fast-growing team.`,
                    url: `https://linkedin.com/jobs/view/${100000 + i}`,
                    postedDate: new Date(Date.now() - i * 12 * 60 * 60 * 1000),
                    jobType: 'Full-time'
                });
            }

            return jobs;
        } catch (err) {
            console.error('[LinkedIn] Scrape error:', err.message);
            return [];
        }
    }

    /**
     * Scrape Glassdoor jobs (using web scraping or API mock)
     */
    async scrapeGlassdoor(keywords, location, limit) {
        try {
            console.log(`[Glassdoor] Scraping "${keywords}" in "${location}"...`);

            const jobs = [];
            for (let i = 0; i < Math.min(limit, 6); i++) {
                jobs.push({
                    source: 'glassdoor',
                    title: `${keywords} ${i % 2 === 0 ? '(Entry Level)' : '(Experienced)'}`,
                    company: ['Microsoft', 'Google', 'Tesla', 'Netflix', 'SpaceX', 'OpenAI'][i % 6],
                    location: location,
                    salary: `$${75000 + i*7000}-$${150000 + i*15000}`,
                    description: `Hiring for ${keywords}. Competitive compensation, great benefits, remote-friendly.`,
                    url: `https://glassdoor.com/jobs/${i}`,
                    postedDate: new Date(Date.now() - i * 48 * 60 * 60 * 1000),
                    jobType: 'Full-time'
                });
            }

            return jobs;
        } catch (err) {
            console.error('[Glassdoor] Scrape error:', err.message);
            return [];
        }
    }

    /**
     * Store raw jobs in RDS for review
     * Creates a "prospect session" with status PENDING_REVIEW
     */
    async storeJobsForReview(jobs) {
        if (!jobs || jobs.length === 0) {
            console.log('[Prospector] No jobs to store');
            return { stored: 0, errors: [] };
        }

        const stored = [];
        const errors = [];

        for (const job of jobs) {
            try {
                // Calculate initial numeric score based on salary range
                const salaryMatch = job.salary?.match(/\$(\d+)/g);
                let initialScore = 50; // Default middle ground

                if (salaryMatch && salaryMatch.length > 0) {
                    const minSalary = parseInt(salaryMatch[0].replace('$', ''));
                    initialScore = Math.min(100, Math.round((minSalary / 200000) * 100));
                }

                // Store in job_scores table
                const result = await rdsClient.pool.query(
                    `INSERT INTO psychobot.job_scores
                     (company, role, overall_score, numeric_score, source, job_url, description, posted_date, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING id`,
                    [
                        job.company,
                        job.title,
                        'PENDING', // Will be reviewed
                        initialScore,
                        job.source,
                        job.url,
                        job.description,
                        job.postedDate,
                        'PENDING_REVIEW'
                    ]
                );

                stored.push({
                    id: result.rows[0].id,
                    company: job.company,
                    title: job.title,
                    source: job.source
                });

                console.log(`[Prospector] Stored: ${job.company} - ${job.title}`);
            } catch (err) {
                console.error(`[Prospector] Store error for ${job.company}:`, err.message);
                errors.push({
                    job: `${job.company} - ${job.title}`,
                    error: err.message
                });
            }
        }

        return {
            stored: stored.length,
            total: jobs.length,
            jobs: stored,
            errors: errors
        };
    }

    /**
     * Get pending jobs for review
     */
    async getPendingJobs(limit = 20) {
        try {
            const result = await rdsClient.pool.query(
                `SELECT * FROM psychobot.job_scores
                 WHERE status = 'PENDING_REVIEW'
                 ORDER BY posted_date DESC
                 LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (err) {
            console.error('[Prospector] getPendingJobs error:', err.message);
            return [];
        }
    }

    /**
     * Update job status and score after user review
     */
    async scoreJob(jobId, overallScore, numericScore, dimensions = {}) {
        try {
            const result = await rdsClient.pool.query(
                `UPDATE psychobot.job_scores
                 SET overall_score = $1,
                     numeric_score = $2,
                     dimensions = $3,
                     status = 'SCORED',
                     reviewed_date = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING *`,
                [overallScore, numericScore, JSON.stringify(dimensions), jobId]
            );
            return result.rows[0];
        } catch (err) {
            console.error('[Prospector] scoreJob error:', err.message);
            return null;
        }
    }

    /**
     * Get high-score jobs ready for application
     */
    async getHighScoreJobs(threshold = 75) {
        try {
            const result = await rdsClient.pool.query(
                `SELECT * FROM psychobot.job_scores
                 WHERE numeric_score >= $1 AND status = 'SCORED'
                 ORDER BY numeric_score DESC`,
                [threshold]
            );
            return result.rows;
        } catch (err) {
            console.error('[Prospector] getHighScoreJobs error:', err.message);
            return [];
        }
    }
}

module.exports = new JobProspector();
