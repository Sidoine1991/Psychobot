/**
 * Profile Matcher - Match candidate profile with job requirements
 * Score jobs based on skill alignment
 */

class ProfileMatcher {
    constructor() {
        // Sidoine's profile
        this.profile = {
            name: 'Sidoine Kolaolé YEBADOKPO',
            title: 'Data Analyst and Web Developer',
            experience: 4,
            location: 'Cotonou, Bénin',

            // Core skills
            skills: {
                languages: {
                    'Python': 5,
                    'R': 4,
                    'SQL': 5,
                    'JavaScript': 4,
                    'Bash': 3
                },
                frameworks: {
                    'Pandas': 5,
                    'NumPy': 4,
                    'Scikit-learn': 4,
                    'React': 4,
                    'Node.js': 4,
                    'Streamlit': 5,
                    'LangChain': 4,
                    'Django': 3,
                    'FastAPI': 3
                },
                databases: {
                    'PostgreSQL': 5,
                    'MySQL': 4,
                    'MongoDB': 3,
                    'SQLAlchemy': 4
                },
                tools: {
                    'Power BI': 4,
                    'Tableau': 3,
                    'GitHub': 5,
                    'GitLab': 4,
                    'Docker': 3,
                    'AWS': 2,
                    'GCP': 2,
                    'Jupyter': 5
                },
                domains: {
                    'Data Analysis': 5,
                    'Data Visualization': 4,
                    'Machine Learning': 4,
                    'IA/LLM': 4,
                    'Web Development': 4,
                    'API Development': 4,
                    'Automation': 4,
                    'ETL Pipelines': 5,
                    'Agricultural Data': 4
                }
            },

            // Experience details
            experience_details: [
                {
                    title: 'Conseiller MEAL',
                    company: 'CCR-Bénin',
                    duration: '2022-present',
                    highlights: 'Python, R, SQL, Power BI, Data pipelines, APIs'
                },
                {
                    title: 'Data Consultant',
                    company: 'Groupe Afriturible International',
                    duration: '2024',
                    highlights: 'Data management, ODK, SQL'
                }
            ],

            // Education
            education: [
                { degree: 'MBA Data Science Management', year: '2024-2026' },
                { degree: 'Master Foresterie', year: '2022-2024' },
                { degree: 'Licence Agronomie', year: '2009-2013' }
            ],

            // Certifications
            certifications: [
                'Data Scientist Associate (DataCamp)',
                'PCAP Python (Cisco)',
                'Data Analytics Job Simulation (Deloitte)'
            ],

            // Preferences
            preferences: {
                remote: true,
                sectors: ['FinTech', 'HealthTech', 'AgriTech', 'IA/ML', 'SaaS'],
                jobTypes: ['full-time', 'contract'],
                minSalary: null // Open
            },

            // Languages
            languages: {
                'Français': 'Native',
                'Anglais': 'Technical (B1)',
                'Español': 'Beginner'
            }
        };
    }

    /**
     * Extract skills from job description
     * @param {string} jobTitle - Job title
     * @param {string} jobDescription - Job description
     * @returns {Object} Extracted skills {required: [], nice_to_have: []}
     */
    extractJobRequirements(jobTitle, jobDescription) {
        const text = `${jobTitle} ${jobDescription}`.toLowerCase();

        const requiredSkills = [];
        const niceToHave = [];

        // Language requirements
        const languages = ['python', 'r ', 'sql', 'javascript', 'typescript', 'java', 'c++', 'go', 'rust', 'php'];
        languages.forEach(lang => {
            if (text.includes(lang)) {
                if (text.includes(`require${lang}`) || text.includes(`proficiency ${lang}`)) {
                    requiredSkills.push(lang);
                } else {
                    niceToHave.push(lang);
                }
            }
        });

        // Framework requirements
        const frameworks = ['react', 'node.js', 'django', 'fastapi', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'streamlit'];
        frameworks.forEach(fw => {
            if (text.includes(fw.toLowerCase())) {
                if (text.includes(`require${fw}`) || text.includes(`proficiency ${fw}`)) {
                    requiredSkills.push(fw);
                } else {
                    niceToHave.push(fw);
                }
            }
        });

        // Database requirements
        const databases = ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb'];
        databases.forEach(db => {
            if (text.includes(db.toLowerCase())) {
                requiredSkills.push(db);
            }
        });

        // Tools
        const tools = ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'github', 'gitlab', 'power bi', 'tableau'];
        tools.forEach(tool => {
            if (text.includes(tool.toLowerCase())) {
                niceToHave.push(tool);
            }
        });

        // Domains
        const domains = ['machine learning', 'data analysis', 'api development', 'web development', 'full stack', 'backend', 'frontend'];
        domains.forEach(domain => {
            if (text.includes(domain.toLowerCase())) {
                if (text.includes(`${domain} expert`) || text.includes(`senior ${domain}`)) {
                    requiredSkills.push(domain);
                } else {
                    niceToHave.push(domain);
                }
            }
        });

        return {
            required: [...new Set(requiredSkills)],
            niceToHave: [...new Set(niceToHave)]
        };
    }

    /**
     * Calculate match score between profile and job
     * @param {Object} job - Job object
     * @returns {Object} {score, matches, gaps, analysis}
     */
    scoreJob(job) {
        const requirements = this.extractJobRequirements(job.title, job.description);

        let matches = 0;
        let matchedSkills = [];
        let gaps = [];

        // Check required skills
        requirements.required.forEach(req => {
            const req_lower = req.toLowerCase();

            // Check languages
            if (this.profile.skills.languages[req] !== undefined) {
                matches += 20;
                matchedSkills.push({ skill: req, level: this.profile.skills.languages[req], type: 'language' });
            }
            // Check frameworks
            else if (this.profile.skills.frameworks[req] !== undefined) {
                matches += 15;
                matchedSkills.push({ skill: req, level: this.profile.skills.frameworks[req], type: 'framework' });
            }
            // Check databases
            else if (this.profile.skills.databases[req] !== undefined) {
                matches += 15;
                matchedSkills.push({ skill: req, level: this.profile.skills.databases[req], type: 'database' });
            }
            // Check domains
            else if (this.profile.skills.domains[req] !== undefined) {
                matches += 15;
                matchedSkills.push({ skill: req, level: this.profile.skills.domains[req], type: 'domain' });
            }
            // Close match
            else if (Object.values(this.profile.skills.languages).some(s => s && s.toString().includes(req_lower))) {
                matches += 5;
                gaps.push(req);
            } else {
                gaps.push(req);
            }
        });

        // Check nice-to-have skills
        requirements.niceToHave.forEach(nice => {
            const nice_lower = nice.toLowerCase();

            if (this.profile.skills.languages[nice] !== undefined) {
                matches += 5;
                matchedSkills.push({ skill: nice, level: this.profile.skills.languages[nice], type: 'language' });
            } else if (this.profile.skills.frameworks[nice] !== undefined) {
                matches += 5;
                matchedSkills.push({ skill: nice, level: this.profile.skills.frameworks[nice], type: 'framework' });
            } else if (this.profile.skills.databases[nice] !== undefined) {
                matches += 5;
                matchedSkills.push({ skill: nice, level: this.profile.skills.databases[nice], type: 'database' });
            }
        });

        // Location match
        if (job.remote && this.profile.preferences.remote) {
            matches += 10;
        }

        // Sector match
        const jobSector = job.title.toLowerCase();
        if (this.profile.preferences.sectors.some(s => jobSector.includes(s.toLowerCase()))) {
            matches += 10;
        }

        // Experience match
        if (job.description && job.description.toLowerCase().includes('years')) {
            const exp_req = parseInt(job.description.match(/(\d+)\+?\s*years/i)?.[1] || 0);
            if (exp_req <= this.profile.experience) {
                matches += 10;
            } else if (exp_req - this.profile.experience <= 2) {
                matches += 5;
            }
        }

        // Cap score at 100
        const score = Math.min(matches, 100);

        // Generate analysis
        const analysis = {
            strengths: matchedSkills.slice(0, 5).map(m => `${m.skill} (${m.level}/5)`),
            gaps: gaps.slice(0, 3),
            fitPercentage: Math.round(score)
        };

        return {
            score: score,
            matchedSkills: matchedSkills,
            gaps: gaps,
            analysis: analysis
        };
    }

    /**
     * Rank jobs by fit
     * @param {Array} jobs - Jobs to rank
     * @returns {Array} Ranked jobs
     */
    rankJobs(jobs) {
        return jobs
            .map(job => ({
                ...job,
                match: this.scoreJob(job)
            }))
            .sort((a, b) => b.match.score - a.match.score);
    }

    /**
     * Get profile summary
     * @returns {Object} Profile data
     */
    getProfile() {
        return this.profile;
    }

    /**
     * Get top jobs
     * @param {Array} jobs - Jobs to filter
     * @param {number} limit - Max jobs
     * @returns {Array} Top matching jobs
     */
    getTopJobs(jobs, limit = 5) {
        const ranked = this.rankJobs(jobs);
        return ranked.filter(j => j.match.score >= 50).slice(0, limit);
    }
}

// Singleton instance
const profileMatcherInstance = new ProfileMatcher();

module.exports = profileMatcherInstance;
