/**
 * Intent Analyzer - Natural Language to Command
 * Uses NVIDIA NIM (Llama 3.3 70B) to understand user intentions
 */

const axios = require('axios');

class IntentAnalyzer {
    constructor() {
        this.nimApiKey = process.env.NVIDIA_NIM_API_KEY;
        this.nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
        this.model = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';
    }

    /**
     * Analyze user message to detect Gmail command intent
     * @param {string} userMessage - User's natural language message
     * @param {Object} context - Conversation context
     * @returns {Object} Intent analysis result
     */
    async analyzeIntent(userMessage, context = {}) {
        const systemPrompt = `Tu es un analyseur d'intentions pour un assistant Gmail via WhatsApp.

Analyse le message de l'utilisateur et détermine s'il veut exécuter une action Gmail.

**Commandes disponibles:**

NAVIGATION:
- inbox (voir inbox)
- inbox_next (page suivante)
- inbox_prev (page précédente)
- inbox_page (aller à page N)

CATÉGORIES:
- primary (onglet principal)
- social (réseaux sociaux)
- promotions (promotions)
- updates (mises à jour)

ACTIONS EMAIL:
- delete (supprimer email)
- archive (archiver email)
- spam (marquer spam)
- star (ajouter étoile)
- unstar (retirer étoile)

COMPOSITION:
- compose (composer email)
- send_simple (envoi rapide: destinataire | sujet | message)

LECTURE:
- thread (voir conversation)
- search (rechercher emails)

AUTRE:
- none (pas une commande Gmail, conversation normale)

**Contexte actuel:**
${context.lastEmailId ? `- Dernier email vu: ${context.lastEmailId}` : '- Aucun email en contexte'}
${context.currentPage ? `- Page actuelle: ${context.currentPage}` : ''}
${context.category ? `- Catégorie: ${context.category}` : ''}

**Format de réponse (JSON uniquement):**
{
  "intent": "nom_de_la_commande",
  "confidence": 0.95,
  "parameters": {
    "target": "email_id ou null",
    "page": 2,
    "query": "texte recherche",
    "to": "email@example.com",
    "subject": "sujet",
    "body": "message"
  },
  "reasoning": "Pourquoi cette intention"
}

**Exemples:**

Message: "Montre mes emails"
→ {"intent": "inbox", "confidence": 0.98, "parameters": {}, "reasoning": "Demande de voir l'inbox"}

Message: "Page suivante"
→ {"intent": "inbox_next", "confidence": 0.95, "parameters": {}, "reasoning": "Navigation vers page suivante"}

Message: "Supprime ça"
→ {"intent": "delete", "confidence": 0.90, "parameters": {"target": "${context.lastEmailId || 'CONTEXT_REQUIRED'}"}, "reasoning": "Suppression de l'email en contexte"}

Message: "Envoie un email à john@example.com pour dire bonjour"
→ {"intent": "send_simple", "confidence": 0.92, "parameters": {"to": "john@example.com", "subject": "Bonjour", "body": "Bonjour"}, "reasoning": "Envoi rapide d'email"}

Message: "Quel temps fait-il?"
→ {"intent": "none", "confidence": 0.99, "parameters": {}, "reasoning": "Question hors Gmail"}

Message: "Rentre dans l'email 9"
→ {"intent": "thread", "confidence": 0.92, "parameters": {"target": "9"}, "reasoning": "Lire l'email numéro 9"}

Message: "Ouvre le 3ème"
→ {"intent": "thread", "confidence": 0.90, "parameters": {"target": "3"}, "reasoning": "Ouvrir le 3ème email de la liste"}

**Important:**
- Si le message référence "ça", "cet email", "le dernier", utilise lastEmailId du contexte
- Si le message référence un NUMÉRO (9, le 3, email 5), passe le numéro dans target
- Si confiance < 0.7, retourne intent: "none"
- Réponds UNIQUEMENT en JSON valide`;

        try {
            const response = await axios.post(
                `${this.nimBaseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.3, // Basse température pour cohérence
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.nimApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiResponse = response.data.choices[0].message.content.trim();

            // Parse JSON response
            let intentData;
            try {
                // Extract JSON if wrapped in markdown
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    intentData = JSON.parse(jsonMatch[0]);
                } else {
                    intentData = JSON.parse(aiResponse);
                }
            } catch (parseError) {
                console.error('[IntentAnalyzer] JSON parse error:', aiResponse);
                return {
                    intent: 'none',
                    confidence: 0,
                    parameters: {},
                    reasoning: 'Failed to parse AI response'
                };
            }

            console.log('[IntentAnalyzer] Intent detected:', intentData.intent, `(${intentData.confidence})`);

            return intentData;

        } catch (error) {
            console.error('[IntentAnalyzer] Error:', error.message);
            return {
                intent: 'none',
                confidence: 0,
                parameters: {},
                reasoning: `Error: ${error.message}`
            };
        }
    }

    /**
     * Quick check if message looks like a Gmail command
     * @param {string} message - User message
     * @param {boolean} hasEmailContext - True if an inbox/email session is already open (lastEmails présent)
     * @returns {boolean} True if likely a Gmail command
     */
    looksLikeGmailCommand(message, hasEmailContext = false) {
        const lowerMessage = message.toLowerCase();

        // Mots-clés FORTS : exclusivement liés à la gestion d'emails.
        // Aucun mot générique ("ça", "voir", "page", "message"...) — sinon le bot
        // déclencherait une commande email sur "arrete moi ça" ou "RDV à 10h".
        const strongKeywords = [
            'email', 'mail', 'inbox', 'gmail',
            'supprime', 'supprimer', 'archive', 'archiver', 'spam', 'corbeille',
            'étoile', 'etoile', 'star',
            'envoie', 'envoi', 'envoyer', 'compose',
            'répondre', 'repondre', 'réponse', 'reponse',
            'principal', 'promotion', 'promotions', 'social',
            'cet email', 'ce message',
            'offre d\'emploi', 'offres d\'emploi'
        ];

        if (strongKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }

        // Mots-clés FAIBLES (navigation/action génériques) : valides UNIQUEMENT si
        // une session email est déjà ouverte (ex: "Page suivante" après "Montre mes emails").
        // Sans contexte email, ils ne déclenchent jamais de commande.
        if (hasEmailContext) {
            const weakKeywords = [
                'ça', 'page', 'suivant', 'précédent', 'prochain',
                'montre', 'affiche', 'voir', 'lire', 'ouvre', 'ouvrir',
                'rentre', 'entre', 'clique', 'recherche', 'cherche', 'message',
                'dernier', 'premier'
            ];

            if (weakKeywords.some(keyword => lowerMessage.includes(keyword))) {
                return true;
            }

            // Références numériques : "email 9", "le 9", "la 3", "numéro 5", "le 3ème", "n° 2"
            // Un chiffre isolé ("RDV à 10h") ne déclenche JAMAIS une commande email.
            if (/\b(le|la|num[eé]ro|n°)\s*[0-9]+\b|\bemail\s*[0-9]+\b/.test(lowerMessage)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Map intent to command name
     * @param {string} intent - Detected intent
     * @returns {string} Command name or null
     */
    intentToCommand(intent) {
        const mapping = {
            'inbox': 'inbox',
            'inbox_next': 'inbox',
            'inbox_prev': 'inbox',
            'inbox_page': 'inbox',
            'primary': 'primary',
            'social': 'social',
            'promotions': 'promotions',
            'updates': 'updates',
            'delete': 'delete',
            'archive': 'archive',
            'spam': 'spam',
            'star': 'star',
            'unstar': 'unstar',
            'compose': 'compose',
            'send_simple': 'send',
            'thread': 'thread',
            'search': 'search'
        };

        return mapping[intent] || null;
    }

    /**
     * Build command arguments from intent parameters
     * @param {string} intent - Detected intent
     * @param {Object} parameters - Intent parameters
     * @returns {Array} Command arguments
     */
    buildCommandArgs(intent, parameters) {
        const args = [];

        switch (intent) {
            case 'inbox_next':
                args.push('next');
                break;

            case 'inbox_prev':
                args.push('prev');
                break;

            case 'inbox_page':
                if (parameters.page) {
                    args.push('page', parameters.page.toString());
                }
                break;

            case 'delete':
            case 'archive':
            case 'spam':
            case 'star':
            case 'unstar':
            case 'thread':
                if (parameters.target) {
                    args.push(parameters.target);
                }
                break;

            case 'send_simple':
                // Format: to | subject | body
                if (parameters.to && parameters.subject && parameters.body) {
                    args.push(parameters.to, '|', parameters.subject, '|', parameters.body);
                }
                break;

            case 'search':
                if (parameters.query) {
                    args.push(parameters.query);
                }
                break;
        }

        return args;
    }
}

// Singleton instance
const intentAnalyzerInstance = new IntentAnalyzer();

module.exports = intentAnalyzerInstance;
