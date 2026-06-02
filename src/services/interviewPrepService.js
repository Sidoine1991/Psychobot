/**
 * Interview Prep Service - Manage STAR stories and interview preparation
 * Builds story bank from real experiences
 */

const fs = require('fs');
const path = require('path');

class InterviewPrepService {
    constructor() {
        this.storyBankPath = path.join(__dirname, '../../data/interview-prep/story-bank.md');
        this.ensureStoryBankExists();
        this.stories = this.loadStories();
    }

    /**
     * Ensure story bank file exists
     */
    ensureStoryBankExists() {
        const dir = path.dirname(this.storyBankPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(this.storyBankPath)) {
            const template = `# Interview Prep Story Bank

## Master STAR Stories

Built from real experiences. Use these during interviews to demonstrate skills and values.

---

`;
            fs.writeFileSync(this.storyBankPath, template, 'utf-8');
        }
    }

    /**
     * Load all stories from file
     * @returns {Array} Parsed stories
     */
    loadStories() {
        try {
            const content = fs.readFileSync(this.storyBankPath, 'utf-8');
            const stories = [];

            // Parse markdown sections
            const storyMatches = content.match(/### Story \d+:.*?(?=### Story|\Z)/gs) || [];

            storyMatches.forEach(block => {
                const titleMatch = block.match(/### Story \d+: (.+)/);
                const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

                const extractField = (field) => {
                    const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+?)(?=\\*\\*|$)`, 's');
                    const match = block.match(regex);
                    return match ? match[1].trim() : '';
                };

                stories.push({
                    title,
                    situation: extractField('Situation'),
                    task: extractField('Task'),
                    action: extractField('Action'),
                    result: extractField('Result'),
                    reflection: extractField('Reflection'),
                    roles: extractField('Used in roles').split(',').map(r => r.trim()).filter(r => r),
                    confidence: extractField('Confidence') || 'Medium',
                    keywords: extractField('Keywords').split(',').map(k => k.trim()).filter(k => k)
                });
            });

            return stories;
        } catch (error) {
            console.error('[InterviewPrepService] Error loading stories:', error.message);
            return [];
        }
    }

    /**
     * Add a new STAR story to the bank
     * @param {Object} story - Story object
     * @param {string} story.title - Story title
     * @param {string} story.situation - STAR situation
     * @param {string} story.task - STAR task
     * @param {string} story.action - STAR action
     * @param {string} story.result - STAR result
     * @param {string} story.reflection - Reflection/lesson learned
     * @param {Array} story.roles - Roles where this story is relevant
     * @param {string} story.confidence - Confidence level (High/Medium/Low)
     * @param {Array} story.keywords - Keywords for search
     */
    async addStory(story) {
        const {
            title = 'Untitled Story',
            situation = '',
            task = '',
            action = '',
            result = '',
            reflection = '',
            roles = [],
            confidence = 'Medium',
            keywords = []
        } = story;

        // Append to file
        const storyNum = this.stories.length + 1;
        const storyBlock = `
### Story ${storyNum}: ${title}

**Situation:** ${situation}

**Task:** ${task}

**Action:** ${action}

**Result:** ${result}

**Reflection:** ${reflection}

**Used in roles:** ${roles.join(', ')}

**Keywords:** ${keywords.join(', ')}

**Confidence:** ${confidence}

---

`;

        try {
            fs.appendFileSync(this.storyBankPath, storyBlock, 'utf-8');
            this.stories = this.loadStories(); // Reload
            console.log('[InterviewPrepService] Story added:', title);
            return true;
        } catch (error) {
            console.error('[InterviewPrepService] Error adding story:', error.message);
            return false;
        }
    }

    /**
     * Get relevant stories for a specific job
     * @param {Object} job - Job object
     * @returns {Array} Ranked relevant stories
     */
    getStoriesForRole(job) {
        const jobTitle = (job.title || '').toLowerCase();
        const jobDesc = (job.description || '').toLowerCase();

        // Score each story by relevance
        const scored = this.stories.map(story => {
            let score = 0;

            // Check if story roles match job title
            story.roles.forEach(role => {
                if (jobTitle.includes(role.toLowerCase())) {
                    score += 30;
                }
            });

            // Check keywords in job description
            story.keywords.forEach(keyword => {
                if (jobDesc.includes(keyword.toLowerCase())) {
                    score += 10;
                }
            });

            // Confidence bonus
            if (story.confidence === 'High') score += 5;
            if (story.confidence === 'Medium') score += 2;

            return { ...story, relevanceScore: score };
        });

        // Sort by relevance and return top 3
        return scored
            .filter(s => s.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 3);
    }

    /**
     * Get all stories
     * @returns {Array} All stories
     */
    listAllStories() {
        return this.stories;
    }

    /**
     * Format story for WhatsApp display
     * @param {Object} story - Story object
     * @returns {string} Formatted story
     */
    formatStoryForWhatsApp(story) {
        let text = `*${story.title}*\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `📍 *Situation:*\n${story.situation}\n\n`;
        text += `✅ *Task:*\n${story.task}\n\n`;
        text += `🎯 *Action:*\n${story.action}\n\n`;
        text += `🏆 *Result:*\n${story.result}\n\n`;
        text += `💡 *Reflection:*\n${story.reflection}\n\n`;
        text += `🎓 *Confidence:* ${story.confidence}\n`;
        if (story.roles.length > 0) {
            text += `💼 *Relevant for:* ${story.roles.join(', ')}\n`;
        }
        return text;
    }

    /**
     * Generate prompt to ask user for story after job letter
     * @param {Object} job - Job object
     * @returns {string} Prompt message
     */
    generateStoryPrompt(job) {
        let message = `📖 *INTERVIEW PREP - Add Your Story*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `Great! You generated a letter for:\n`;
        message += `*${job.title}* @ ${job.company}\n\n`;

        message += `Now let's build your interview prep. What STAR story would you tell for this role?\n\n`;

        message += `Reply in format:\n`;
        message += `!prep add | Story Title | Situation | Task | Action | Result | Reflection | High\n\n`;

        message += `Example:\n`;
        message += `!prep add | Scaling from 1 to 100 | Had 1 customer | Scale to 100 | Built automation | 10x growth in 3 months | Automation beats hiring | High\n\n`;

        message += `Or:\n`;
        message += `!prep list - See all stories\n`;
        message += `!prep roles - Stories for this role\n`;

        return message;
    }

    /**
     * Get stats
     * @returns {Object} Stats
     */
    getStats() {
        return {
            totalStories: this.stories.length,
            rolesCount: new Set(this.stories.flatMap(s => s.roles)).size,
            highConfidence: this.stories.filter(s => s.confidence === 'High').length
        };
    }
}

// Singleton instance
const interviewPrepInstance = new InterviewPrepService();

module.exports = interviewPrepInstance;
