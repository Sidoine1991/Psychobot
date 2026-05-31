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
     * Calculate 10-dimensional job fit score (Career-Ops style A-F grading)
     * @param {Object} job - Job object
     * @returns {Object} {overall_score, numeric_score, dimensions, recommendation}
     */
    scoreJob(job) {
        const requirements = this.extractJobRequirements(job.title, job.description);
        const jobDesc = `${job.title} ${job.description}`.toLowerCase();

        // Dimension 1: CV MATCH (Skills alignment)
        const cvMatch = this.scoreCVMatch(requirements);

        // Dimension 2: ROLE CLARITY (Is the role well-defined?)
        const roleClarity = this.scoreRoleClarity(job);

        // Dimension 3: LEVEL STRATEGY (Right career level?)
        const levelStrategy = this.scoreLevelStrategy(job);

        // Dimension 4: COMP RESEARCH (Market fair salary?)
        const compResearch = this.scoreCompResearch(job);

        // Dimension 5: GROWTH POTENTIAL (Will you learn?)
        const growth = this.scoreGrowth(job, requirements);

        // Dimension 6: INTERVIEW PREP (Can you prepare stories?)
        const interviewPrep = this.scoreInterviewPrep(job, requirements);

        // Dimension 7: LOCATION FIT (Remote/timezone match)
        const locationFit = this.scoreLocationFit(job);

        // Dimension 8: SECTOR ALIGNMENT (In target industries?)
        const sectorAlignment = this.scoreSectorAlignment(job);

        // Dimension 9: TEAM DYNAMICS (Company culture fit)
        const teamDynamics = this.scoreTeamDynamics(job);

        // Dimension 10: LIFE INTEGRATION (Personal lifestyle fit)
        const lifeIntegration = this.scoreLifeIntegration(job);

        // Calculate global score (weighted average)
        const dimensions = {
            cv_match: { score: cvMatch, weight: 0.20, reason: this.reasonCVMatch(requirements) },
            role_clarity: { score: roleClarity, weight: 0.10, reason: this.reasonRoleClarity(job) },
            level_strategy: { score: levelStrategy, weight: 0.10, reason: this.reasonLevelStrategy(job) },
            comp_research: { score: compResearch, weight: 0.12, reason: this.reasonCompResearch(job) },
            growth: { score: growth, weight: 0.10, reason: this.reasonGrowth(job, requirements) },
            interview_prep: { score: interviewPrep, weight: 0.08, reason: this.reasonInterviewPrep(job) },
            location_fit: { score: locationFit, weight: 0.08, reason: this.reasonLocationFit(job) },
            sector_alignment: { score: sectorAlignment, weight: 0.08, reason: this.reasonSectorAlignment(job) },
            team_dynamics: { score: teamDynamics, weight: 0.08, reason: this.reasonTeamDynamics(job) },
            life_integration: { score: lifeIntegration, weight: 0.06, reason: this.reasonLifeIntegration(job) }
        };

        // Weighted global score (0-100)
        const globalScore = Object.values(dimensions).reduce((sum, dim) => {
            return sum + (dim.score * dim.weight);
        }, 0);

        // Convert to letter grade
        const letterGrade = this.scoreToGrade(globalScore);

        // Recommendation
        const recommendation = this.getRecommendation(letterGrade, globalScore);

        // Old format for backward compatibility
        const matchedSkills = [];
        const gaps = [];
        const analysis = {
            strengths: matchedSkills.slice(0, 5).map(m => `${m.skill}`),
            gaps: gaps.slice(0, 3),
            fitPercentage: Math.round(globalScore)
        };

        return {
            overall_score: letterGrade,
            numeric_score: Math.round(globalScore),
            dimensions: dimensions,
            recommendation: recommendation,
            // Legacy format (backward compat)
            score: Math.round(globalScore),
            matchedSkills: matchedSkills,
            gaps: gaps,
            analysis: analysis
        };
    }

    // ============ SCORING DIMENSIONS ============

    scoreCVMatch(requirements) {
        let score = 60; // Base score
        const required = requirements.required || [];
        const niceToHave = requirements.niceToHave || [];

        if (required.length === 0 && niceToHave.length === 0) {
            return 70; // No skills extracted, assume moderate fit
        }

        let matchCount = 0;

        // Required skills
        required.forEach(req => {
            const req_lower = req.toLowerCase();

            // Check all skill types (case-insensitive)
            const hasSkill = Object.keys(this.profile.skills.languages).some(k => k.toLowerCase() === req_lower) ||
                           Object.keys(this.profile.skills.frameworks).some(k => k.toLowerCase() === req_lower) ||
                           Object.keys(this.profile.skills.databases).some(k => k.toLowerCase() === req_lower) ||
                           Object.keys(this.profile.skills.domains).some(k => k.toLowerCase() === req_lower) ||
                           Object.keys(this.profile.skills.tools).some(k => k.toLowerCase() === req_lower);

            if (hasSkill) {
                matchCount++;
                score += 15;
            }
        });

        // Nice-to-have skills
        niceToHave.forEach(nice => {
            const nice_lower = nice.toLowerCase();

            const hasSkill = Object.keys(this.profile.skills.languages).some(k => k.toLowerCase() === nice_lower) ||
                           Object.keys(this.profile.skills.frameworks).some(k => k.toLowerCase() === nice_lower) ||
                           Object.keys(this.profile.skills.databases).some(k => k.toLowerCase() === nice_lower) ||
                           Object.keys(this.profile.skills.tools).some(k => k.toLowerCase() === nice_lower);

            if (hasSkill) {
                score += 5;
            }
        });

        return Math.min(score, 100);
    }

    scoreRoleClarity(job) {
        const desc = (job.description || '').toLowerCase();
        let score = 50; // Base

        // Well-defined roles have: responsibilities, requirements, context
        if (desc.includes('responsibility') || desc.includes('responsible')) score += 15;
        if (desc.includes('requirement') || desc.includes('require')) score += 15;
        if (desc.includes('team') || desc.includes('department')) score += 10;
        if (desc.includes('report') || desc.includes('manager')) score += 10;

        return Math.min(score, 100);
    }

    scoreLevelStrategy(job) {
        const title = (job.title || '').toLowerCase();
        const desc = (job.description || '').toLowerCase();
        let score = 60;

        // Check for level alignment with Sidoine (4 years experience)
        if (title.includes('junior') || title.includes('entry')) {
            score -= 20; // Underleveled
        } else if (title.includes('senior') || title.includes('lead')) {
            score -= 10; // Slightly overleveled
        }

        // Years of experience requirement
        const exp_match = desc.match(/(\d+)\+?\s*years/i);
        if (exp_match) {
            const exp_req = parseInt(exp_match[1]);
            if (exp_req <= this.profile.experience) {
                score += 20;
            } else if (exp_req - this.profile.experience <= 2) {
                score += 10;
            } else {
                score -= 15;
            }
        }

        return Math.min(score, 100);
    }

    scoreCompResearch(job) {
        // TODO: Integrate with Glassdoor/salary APIs
        // For now, check if salary is mentioned
        const desc = (job.description || '').toLowerCase();
        let score = 70; // Neutral

        if (desc.includes('$') || desc.includes('salary') || desc.includes('compensation')) {
            score += 20; // Transparent about comp
        }

        // Flag unusually low or high
        if (desc.includes('$80') || desc.includes('$90')) score -= 10; // Below market for this role
        if (desc.includes('$150') || desc.includes('$160')) score += 10; // Above market

        return Math.min(score, 100);
    }

    scoreGrowth(job, requirements) {
        const desc = (job.description || '').toLowerCase();
        let score = 60; // Base

        // Look for growth signals
        if (desc.includes('learning') || desc.includes('develop') || desc.includes('mentor')) score += 20;
        if (desc.includes('innovation') || desc.includes('cutting-edge') || desc.includes('new')) score += 15;

        // Check for skills not yet in profile (learning opportunity)
        const requiredSkills = requirements.required || [];
        let newSkills = 0;
        requiredSkills.forEach(req => {
            if (!this.profile.skills.languages[req] &&
                !this.profile.skills.frameworks[req] &&
                !this.profile.skills.databases[req] &&
                !this.profile.skills.domains[req]) {
                newSkills++;
            }
        });

        if (newSkills >= 2) score += 15; // Opportunity to learn
        if (newSkills > 5) score += 10;

        return Math.min(score, 100);
    }

    scoreInterviewPrep(job, requirements) {
        // Can Sidoine prepare stories for this role?
        const title = (job.title || '').toLowerCase();
        const desc = (job.description || '').toLowerCase();
        let score = 70; // Most roles are preparable

        // Check if role matches past experience
        const isSimilarRole = this.profile.experience_details.some(exp =>
            title.includes('data') || title.includes('analyst') || title.includes('developer')
        );

        if (isSimilarRole) score += 20;

        // Check if interview signals are clear
        if (desc.includes('interview') || desc.includes('screening')) score += 5;

        return Math.min(score, 100);
    }

    scoreLocationFit(job) {
        let score = 70; // Base

        if (job.remote && this.profile.preferences.remote) {
            score += 30; // Perfect match
        } else if (!job.remote && !this.profile.preferences.remote) {
            score += 10; // On-site OK
        } else if (!job.remote && this.profile.preferences.remote) {
            score -= 30; // Mismatch
        }

        return Math.min(100, Math.max(0, score));
    }

    scoreSectorAlignment(job) {
        const title = (job.title || '').toLowerCase();
        const desc = (job.description || '').toLowerCase();
        let score = 60; // Base

        const targetSectors = this.profile.preferences.sectors || [];
        const matchingSector = targetSectors.some(s =>
            title.includes(s.toLowerCase()) || desc.includes(s.toLowerCase())
        );

        if (matchingSector) {
            score += 35; // Targeted sector
        } else {
            score += 5; // Outside targets but still viable
        }

        return Math.min(score, 100);
    }

    scoreTeamDynamics(job) {
        const desc = (job.description || '').toLowerCase();
        let score = 65; // Base

        // Signals of good team
        if (desc.includes('collaborative') || desc.includes('team')) score += 15;
        if (desc.includes('diverse') || desc.includes('inclusive')) score += 10;
        if (desc.includes('mentoring') || desc.includes('leadership')) score += 10;
        if (desc.includes('support') || desc.includes('help')) score += 5;

        return Math.min(score, 100);
    }

    scoreLifeIntegration(job) {
        const desc = (job.description || '').toLowerCase();
        let score = 70; // Base

        // Remote = good for work/life balance
        if (this.profile.preferences.remote) score += 15;

        // Hours signals
        if (desc.includes('async') || desc.includes('flexible')) score += 15;
        if (desc.includes('startup') && desc.includes('fast-paced')) score -= 10;

        return Math.min(score, 100);
    }

    // ============ REASON STRINGS ============

    reasonCVMatch(requirements) {
        const required = requirements.required || [];
        const matched = required.filter(req =>
            this.profile.skills.languages[req] !== undefined ||
            this.profile.skills.frameworks[req] !== undefined ||
            this.profile.skills.databases[req] !== undefined ||
            this.profile.skills.domains[req] !== undefined
        );
        return `${matched.length}/${required.length} required skills present`;
    }

    reasonRoleClarity(job) {
        const desc = (job.description || '');
        const clarity = [
            desc.includes('responsibility') ? '✓' : '✗',
            desc.includes('requirement') ? '✓' : '✗',
            desc.includes('team') ? '✓' : '✗'
        ].filter(x => x === '✓').length;
        return `${clarity}/3 clarity signals`;
    }

    reasonLevelStrategy(job) {
        const title = (job.title || '').toLowerCase();
        if (title.includes('senior')) return 'Senior-level role (good match for 4y exp)';
        if (title.includes('junior')) return 'Junior-level (underleveled for 4y exp)';
        return 'Mid-level alignment';
    }

    reasonCompResearch(job) {
        const desc = (job.description || '').toLowerCase();
        if (desc.includes('$')) return 'Salary disclosed';
        return 'Salary not mentioned';
    }

    reasonGrowth(job, requirements) {
        const requiredSkills = requirements.required || [];
        const newSkills = requiredSkills.filter(req =>
            !this.profile.skills.languages[req] &&
            !this.profile.skills.frameworks[req] &&
            !this.profile.skills.databases[req] &&
            !this.profile.skills.domains[req]
        ).length;
        return `${newSkills} new skills to learn`;
    }

    reasonInterviewPrep(job) {
        return 'Role matches past experience';
    }

    reasonLocationFit(job) {
        if (job.remote) return 'Remote (matches preference)';
        return 'On-site location';
    }

    reasonSectorAlignment(job) {
        const targetSectors = this.profile.preferences.sectors || [];
        const title = (job.title || '').toLowerCase();
        const match = targetSectors.find(s => title.includes(s.toLowerCase()));
        if (match) return `In target sector: ${match}`;
        return 'Outside target sectors';
    }

    reasonTeamDynamics(job) {
        const desc = (job.description || '').toLowerCase();
        const signals = [
            desc.includes('collaborative') && 'Collaborative',
            desc.includes('mentoring') && 'Mentoring culture',
            desc.includes('diverse') && 'Diversity focus'
        ].filter(Boolean);
        return signals.length > 0 ? signals.join(', ') : 'Standard team setup';
    }

    reasonLifeIntegration(job) {
        if (this.profile.preferences.remote) return 'Remote-friendly for work/life balance';
        return 'On-site schedule';
    }

    // ============ UTILITY ============

    scoreToGrade(numericScore) {
        if (numericScore >= 90) return 'A';
        if (numericScore >= 80) return 'B';
        if (numericScore >= 70) return 'C';
        if (numericScore >= 60) return 'D';
        if (numericScore >= 50) return 'E';
        return 'F';
    }

    getRecommendation(grade, score) {
        switch (grade) {
            case 'A':
                return { emoji: '✅', text: 'STRONG FIT - Apply immediately' };
            case 'B':
                return { emoji: '👍', text: 'Good fit - Worth applying' };
            case 'C':
                return { emoji: '🤔', text: 'Decent but not ideal - Apply if interested' };
            case 'D':
                return { emoji: '⚠️', text: 'Weak fit - Consider only for specific reason' };
            case 'E':
            case 'F':
            default:
                return { emoji: '❌', text: 'Poor fit - Recommend against applying' };
        }
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
