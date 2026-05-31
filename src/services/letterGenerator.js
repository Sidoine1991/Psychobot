/**
 * Letter Generator - Generate personalized motivation letters
 * Uses AI to customize for each job
 */

const axios = require('axios');

class LetterGenerator {
    constructor() {
        this.nimApiKey = process.env.NVIDIA_NIM_API_KEY;
        this.nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
        this.model = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';
    }

    /**
     * Generate personalized motivation letter
     * @param {Object} job - Job object
     * @param {Object} profile - Candidate profile
     * @param {Object} match - Match analysis
     * @returns {string} Generated letter
     */
    async generateLetter(job, profile, match) {
        const systemPrompt = `Tu es un expert en rédaction de lettres de motivation professionnelles en français.

Génère une lettre de motivation personnalisée et convaincante basée sur:
- Le profil du candidat
- Le poste offert
- Les compétences matching

**Critères:**
- Ton: Professionnel mais personnalisé
- Longueur: 300-400 mots
- Structure: Accroche, corps (2-3 paragraphes), fermeture
- Souligne les compétences matching
- Montre enthousiastem et pertinence
- Format: Prêt pour Word document

**Ne pas mentionner:**
- Le score de matching
- L'algorithme d'analyse
- Des informations non pertinentes

Sois persuasif et authentique.`;

        const userPrompt = `
**PROFIL CANDIDAT:**
Nom: ${profile.name}
Titre: ${profile.title}
Expérience: ${profile.experience} ans
Localisation: ${profile.location}
Langues: ${Object.entries(profile.languages).map(([l, v]) => `${l} (${v})`).join(', ')}

**COMPÉTENCES CLÉS:**
${match.matchedSkills.slice(0, 8).map(s => `- ${s.skill} (${s.level}/5)`).join('\n')}

**OFFRE:**
Titre: ${job.title}
Entreprise: ${job.company}
Localisation: ${job.location}
Type: ${job.type}
Description: ${job.description.substring(0, 500)}...

**RÉSUMÉ DU MATCHING:**
- Score: ${match.fitPercentage}%
- Points forts: ${match.analysis.strengths.join(', ')}
- À développer: ${match.analysis.gaps.join(', ')}

Génère une lettre de motivation personnalisée qui:
1. S'adresse directement à l'entreprise/poste
2. Explique pourquoi Sidoine est le candidat idéal
3. Souligne l'alignement compétences-besoin
4. Montre de l'enthousiasme pour ce rôle
5. Se termine par un appel à l'action
`;

        try {
            console.log('[LetterGenerator] Generating letter for:', job.title);

            const response = await axios.post(
                `${this.nimBaseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.nimApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const letter = response.data.choices[0].message.content.trim();
            console.log('[LetterGenerator] ✅ Letter generated');

            return letter;

        } catch (error) {
            console.error('[LetterGenerator] Error:', error.message);
            return this.getTemplateLetter(job, profile, match);
        }
    }

    /**
     * Fallback template letter (if AI fails)
     * @param {Object} job - Job object
     * @param {Object} profile - Candidate profile
     * @param {Object} match - Match analysis
     * @returns {string} Template letter
     */
    getTemplateLetter(job, profile, match) {
        const date = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const letter = `${date}

À l'attention de ${job.company},

Je suis vivement intéressé par le poste de ${job.title} proposé au sein de votre entreprise. Avec plus de ${profile.experience} années d'expérience en analyse de données, développement web et intelligence artificielle, je suis convaincu que mes compétences correspondent parfaitement à vos besoins.

Votre offre requiert une maîtrise de ${match.analysis.strengths.slice(0, 3).join(', ')} — des domaines dans lesquels j'ai développé une expertise reconnue. Dans mes rôles précédents, j'ai eu l'occasion de mettre en place des pipelines de données complexes, de développer des applications IA déployées en production, et de collaborer avec des équipes multidisciplinaires pour transformer les données en insights actionnables.

Ce qui me fascine dans ce poste, c'est la possibilité de conjuguer l'analyse de données sophistiquée avec le développement de solutions innovantes. Basé à ${profile.location}, je suis particulièrement intéressé par ce rôle qui offre la flexibilité du télétravail — un élément crucial pour ma mobilité professionnelle.

Je serais ravi de discuter comment mes compétences et mon expérience peuvent contribuer au succès de vos projets. Je reste à votre entière disposition pour un entretien à votre convenance.

Veuillez agréer, Monsieur/Madame, l'expression de mes meilleurs sentiments.

Cordialement,

${profile.name}
${profile.location}, Bénin
✉ syebadokpo@gmail.com
☎ +229 01 96 91 13 46`;

        return letter;
    }

    /**
     * Get letter metadata
     * @param {Object} job - Job object
     * @param {Object} match - Match analysis
     * @returns {Object} Metadata
     */
    getLetterMetadata(job, match) {
        return {
            jobTitle: job.title,
            company: job.company,
            matchScore: match.fitPercentage,
            strengths: match.analysis.strengths,
            gaps: match.analysis.gaps,
            generated: new Date().toISOString()
        };
    }
}

// Singleton instance
const letterGeneratorInstance = new LetterGenerator();

module.exports = letterGeneratorInstance;
