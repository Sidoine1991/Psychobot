/**
 * API Server - Express API to expose PsychoBot services
 * Provides REST endpoints for React dashboard
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import services
const profileMatcher = require('./src/services/profileMatcher');
const jobOrchestrator = require('./src/services/jobOrchestrator');
const batchProcessorService = require('./src/services/batchProcessorService');
const followUpService = require('./src/services/followUpService');
const interviewPrepService = require('./src/services/interviewPrepService');
const jobScraper = require('./src/services/jobScraper');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

console.log('[API] Initializing PsychoBot API Server...');

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ============ JOBS ENDPOINTS ============

/**
 * GET /api/jobs/search
 * Search for jobs
 */
app.get('/api/jobs/search', async (req, res) => {
    try {
        const { keywords = 'Python Developer', location = 'remote', limit = 5 } = req.query;

        console.log(`[API] Searching jobs: ${keywords}`);

        const jobs = await jobScraper.searchAll({
            keywords: typeof keywords === 'string' ? [keywords] : keywords,
            location,
            limit: parseInt(limit) || 5
        });

        // Score all jobs
        const scored = jobs.map(job => ({
            ...job,
            match: profileMatcher.scoreJob(job)
        }));

        // Rank
        const ranked = scored.sort((a, b) => b.match.numeric_score - a.match.numeric_score);

        res.json({
            success: true,
            count: ranked.length,
            jobs: ranked
        });
    } catch (error) {
        console.error('[API] Search error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/jobs/:index
 * Get job details
 */
app.get('/api/jobs/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const job = jobOrchestrator.getJobDetails(index);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            job: job
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/jobs/score
 * Score a single job
 */
app.post('/api/jobs/score', (req, res) => {
    try {
        const { job } = req.body;

        if (!job) {
            return res.status(400).json({
                success: false,
                error: 'Job data required'
            });
        }

        const match = profileMatcher.scoreJob(job);

        res.json({
            success: true,
            match: match
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/jobs/daily
 * Get cached daily jobs
 */
app.get('/api/jobs/daily', (req, res) => {
    try {
        const jobs = jobOrchestrator.getDailyJobs();

        res.json({
            success: true,
            count: jobs.length,
            jobs: jobs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ BATCH ENDPOINTS ============

/**
 * POST /api/batch/process
 * Process batch of jobs
 */
app.post('/api/batch/process', async (req, res) => {
    try {
        const { jobs, options = {} } = req.body;

        if (!jobs || jobs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Jobs array required'
            });
        }

        console.log(`[API] Processing batch of ${jobs.length} jobs...`);

        const result = await batchProcessorService.processBatch(jobs, {
            generatePDFs: false, // Skip for API
            exportCSV: true,
            minScore: options.minScore || 'C',
            maxWorkers: 5
        });

        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        console.error('[API] Batch processing error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ TRACKING ENDPOINTS ============

/**
 * GET /api/track/suggestions
 * Get follow-up suggestions
 */
app.get('/api/track/suggestions', (req, res) => {
    try {
        const suggestions = followUpService.getFollowUpSuggestions();
        const stats = followUpService.getStats();

        res.json({
            success: true,
            stats: stats,
            suggestions: suggestions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/track/applications
 * Get all applications
 */
app.get('/api/track/applications', (req, res) => {
    try {
        const apps = followUpService.loadApplications();
        const byStatus = followUpService.getApplicationsByStatus();

        res.json({
            success: true,
            total: apps.length,
            applications: apps,
            byStatus: byStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/track/add
 * Add application
 */
app.post('/api/track/add', (req, res) => {
    try {
        const { company, role, score, notes } = req.body;

        if (!company || !role) {
            return res.status(400).json({
                success: false,
                error: 'Company and role required'
            });
        }

        const success = followUpService.addApplication({
            company,
            role,
            score: score || 'B',
            notes: notes || ''
        });

        res.json({
            success: success,
            message: success ? 'Application added' : 'Failed to add application'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/track/status
 * Update application status
 */
app.post('/api/track/status', (req, res) => {
    try {
        const { company, status } = req.body;

        if (!company || !status) {
            return res.status(400).json({
                success: false,
                error: 'Company and status required'
            });
        }

        const success = followUpService.updateStatus(company, status);

        res.json({
            success: success,
            message: success ? 'Status updated' : 'Company not found'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ INTERVIEW PREP ENDPOINTS ============

/**
 * GET /api/prep/stories
 * Get all interview stories
 */
app.get('/api/prep/stories', (req, res) => {
    try {
        const stories = interviewPrepService.listAllStories();
        const stats = interviewPrepService.getStats();

        res.json({
            success: true,
            stats: stats,
            stories: stories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/prep/add
 * Add new story
 */
app.post('/api/prep/add', (req, res) => {
    try {
        const { title, situation, task, action, result, reflection, roles, confidence, keywords } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title required'
            });
        }

        const success = interviewPrepService.addStory({
            title,
            situation: situation || '',
            task: task || '',
            action: action || '',
            result: result || '',
            reflection: reflection || '',
            roles: roles || [],
            confidence: confidence || 'Medium',
            keywords: keywords || []
        });

        res.json({
            success: success,
            message: success ? 'Story added' : 'Failed to add story'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/prep/stories/role/:jobIndex
 * Get stories relevant to a job
 */
app.get('/api/prep/stories/role/:jobIndex', (req, res) => {
    try {
        const index = parseInt(req.params.jobIndex);
        const job = jobOrchestrator.getJobDetails(index);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        const relevantStories = interviewPrepService.getStoriesForRole(job.job);

        res.json({
            success: true,
            stories: relevantStories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ PROFILE & STATS ============

/**
 * GET /api/profile
 * Get candidate profile
 */
app.get('/api/profile', (req, res) => {
    try {
        const profile = profileMatcher.getProfile();

        res.json({
            success: true,
            profile: profile
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/stats
 * Get overall stats
 */
app.get('/api/stats', (req, res) => {
    try {
        const jobStats = jobOrchestrator.getStats();
        const trackStats = followUpService.getStats();
        const prepStats = interviewPrepService.getStats();

        res.json({
            success: true,
            jobs: jobStats,
            track: trackStats,
            prep: prepStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ FALLBACK ============

// Serve React app for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
    console.error('[API] Error:', err.message);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`[API] ✅ Server running on http://localhost:${PORT}`);
    console.log(`[API] API endpoints available at http://localhost:${PORT}/api`);
    console.log(`[API] React dashboard at http://localhost:${PORT}`);
});
