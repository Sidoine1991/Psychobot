/**
 * Job Scraper - Fetch job offers from multiple sources
 * LinkedIn, Indeed, AngelList, RemoteOK, etc.
 */

const axios = require('axios');

class JobScraper {
    constructor() {
        this.jobs = [];
        this.lastScraped = null;
    }

    /**
     * Search jobs via RapidAPI Indeed
     * @param {Array} keywords - Search keywords
     * @param {string} location - Location filter
     * @returns {Array} Job listings
     */
    async searchIndeed(keywords, location = 'remote') {
        try {
            console.log('[JobScraper] Searching Indeed for:', keywords.join(', '));

            const jobsPerKeyword = [];

            for (const keyword of keywords) {
                try {
                    const response = await axios.get('https://indeed-api.fly.dev/job/search', {
                        params: {
                            q: keyword,
                            l: location,
                            pp: 25
                        },
                        timeout: 10000
                    });

                    if (response.data?.jobs) {
                        const jobs = response.data.jobs.map(job => ({
                            source: 'Indeed',
                            id: job.jobKey || `indeed-${Math.random()}`,
                            title: job.jobTitle,
                            company: job.company,
                            location: job.jobLocationCity || location,
                            description: job.snippet,
                            url: job.url,
                            salary: job.salary || null,
                            postedDate: job.postedDate,
                            type: job.jobType || 'Full-time',
                            remote: job.jobLocationCity?.toLowerCase().includes('remote') || location === 'remote',
                            keywords: keyword
                        }));

                        jobsPerKeyword.push(...jobs);
                    }
                } catch (error) {
                    console.error(`[JobScraper] Indeed search error for "${keyword}":`, error.message);
                }
            }

            return jobsPerKeyword;

        } catch (error) {
            console.error('[JobScraper] Indeed error:', error.message);
            return [];
        }
    }

    /**
     * Search jobs via RemoteOK API (free, no auth)
     * @param {Array} keywords - Search keywords
     * @returns {Array} Job listings
     */
    async searchRemoteOK(keywords) {
        try {
            console.log('[JobScraper] Searching RemoteOK for:', keywords.join(', '));

            const response = await axios.get('https://remoteok.io/api', {
                timeout: 10000
            });

            if (!response.data || !Array.isArray(response.data)) {
                return [];
            }

            // Filter by keywords and remote
            const filtered = response.data.filter(job => {
                if (!job.title || !job.slug) return false;

                const title = job.title.toLowerCase();
                const tags = (job.tags || []).map(t => t.toLowerCase()).join(' ');
                const description = (job.description || '').toLowerCase();

                return keywords.some(kw => {
                    const keyword = kw.toLowerCase();
                    return title.includes(keyword) || tags.includes(keyword) || description.includes(keyword);
                });
            });

            return filtered.map(job => ({
                source: 'RemoteOK',
                id: job.slug,
                title: job.title,
                company: job.company,
                location: 'Remote',
                description: job.description?.substring(0, 500) || '',
                url: `https://remoteok.io/${job.slug}`,
                salary: job.salary ? `$${job.salary}` : null,
                postedDate: new Date(job.date * 1000),
                type: 'Remote',
                remote: true,
                keywords: job.tags?.join(', ') || ''
            }));

        } catch (error) {
            console.error('[JobScraper] RemoteOK error:', error.message);
            return [];
        }
    }

    /**
     * Search LinkedIn via public sources (limited, no official API access)
     * @param {Array} keywords - Search keywords
     * @returns {Array} Job listings (limited results)
     */
    async searchLinkedInPublic(keywords) {
        try {
            console.log('[JobScraper] LinkedIn search (public data only)');

            // Note: LinkedIn doesn't allow official scraping
            // This is a placeholder for manual data or third-party services
            // In production, use: https://api.linkedin.com/v2/jobs/search (requires OAuth)

            return [];

        } catch (error) {
            console.error('[JobScraper] LinkedIn error:', error.message);
            return [];
        }
    }

    /**
     * Search multiple sources and aggregate
     * @param {Object} options - {keywords, location, types}
     * @returns {Array} All jobs found
     */
    async searchAll(options = {}) {
        const {
            keywords = ['Data Analyst', 'Python Developer', 'IA Engineer', 'Full Stack'],
            location = 'remote',
            types = ['full-time', 'contract']
        } = options;

        console.log('[JobScraper] Starting multi-source search...');

        const results = [];

        // Search Indeed
        const indeedJobs = await this.searchIndeed(keywords, location);
        results.push(...indeedJobs);

        // Search RemoteOK
        const remoteOKJobs = await this.searchRemoteOK(keywords);
        results.push(...remoteOKJobs);

        // Deduplicate by title + company
        const deduped = Array.from(
            new Map(results.map(job => [
                `${job.title}|${job.company}`.toLowerCase(),
                job
            ])).values()
        );

        console.log(`[JobScraper] ✅ Found ${deduped.length} unique jobs`);

        this.jobs = deduped;
        this.lastScraped = Date.now();

        return deduped;
    }

    /**
     * Get jobs matching specific criteria
     * @param {Object} filters - {keywords, minSalary, types}
     * @returns {Array} Filtered jobs
     */
    filterJobs(filters = {}) {
        const {
            keywords = [],
            minSalary = 0,
            types = [],
            remote = true
        } = filters;

        return this.jobs.filter(job => {
            // Remote filter
            if (remote && !job.remote) return false;

            // Type filter
            if (types.length > 0 && !types.some(t => job.type?.toLowerCase().includes(t))) {
                return false;
            }

            // Keywords filter
            if (keywords.length > 0) {
                const jobText = `${job.title} ${job.description} ${job.keywords}`.toLowerCase();
                const hasKeyword = keywords.some(kw => jobText.includes(kw.toLowerCase()));
                if (!hasKeyword) return false;
            }

            // Salary filter (if salary is extractable)
            if (minSalary > 0 && job.salary) {
                const salaryNum = parseInt(job.salary.replace(/\D/g, ''));
                if (salaryNum < minSalary) return false;
            }

            return true;
        });
    }

    /**
     * Get job details
     * @param {string} jobId - Job ID
     * @returns {Object} Job details
     */
    getJobById(jobId) {
        return this.jobs.find(job => job.id === jobId);
    }

    /**
     * Get latest jobs
     * @param {number} limit - Max jobs to return
     * @returns {Array} Latest jobs
     */
    getLatestJobs(limit = 10) {
        return this.jobs
            .sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate))
            .slice(0, limit);
    }

    /**
     * Get job stats
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            totalJobs: this.jobs.length,
            bySources: this.jobs.reduce((acc, job) => {
                acc[job.source] = (acc[job.source] || 0) + 1;
                return acc;
            }, {}),
            remoteCount: this.jobs.filter(j => j.remote).length,
            lastScraped: this.lastScraped
        };
    }
}

// Singleton instance
const jobScraperInstance = new JobScraper();

module.exports = jobScraperInstance;
