/**
 * Command Executor - Execute commands from natural language intents
 * Bridges intent analysis to actual command execution
 */

const intentAnalyzer = require('./intentAnalyzer');
const contextManager = require('./contextManager');

class CommandExecutor {
    constructor() {
        this.commands = new Map();
    }

    /**
     * Register a command handler
     * @param {string} commandName - Command name
     * @param {Object} commandModule - Command module with run() function
     */
    registerCommand(commandName, commandModule) {
        this.commands.set(commandName, commandModule);
    }

    /**
     * Register multiple commands
     * @param {Object} commandsObj - Object with command modules
     */
    registerCommands(commandsObj) {
        for (const [name, module] of Object.entries(commandsObj)) {
            this.registerCommand(name, module);
        }
    }

    /**
     * Process natural language message and execute command if detected
     * @param {string} userMessage - User's message
     * @param {Object} messageContext - Message context {sock, msg}
     * @param {string} userId - User ID
     * @returns {Object} {executed: boolean, intent: string, response: string}
     */
    async processMessage(userMessage, messageContext, userId) {
        // Get user context
        const context = contextManager.getSummaryForAI(userId);
        const hasEmailContext = (context.emailCount > 0) || !!context.lastEmailId;

        // Quick filter: does it look like a Gmail command?
        // Les mots génériques ("ça", "page suivante", "voir"...") ne sont reconnus
        // que si une session email est déjà ouverte.
        if (!intentAnalyzer.looksLikeGmailCommand(userMessage, hasEmailContext)) {
            return {
                executed: false,
                intent: 'none',
                reason: 'No Gmail keywords detected'
            };
        }

        // Analyze intent with AI
        console.log('[CommandExecutor] Analyzing intent for:', userMessage);
        const intentResult = await intentAnalyzer.analyzeIntent(userMessage, context);

        // Log analysis
        console.log('[CommandExecutor] Intent:', intentResult.intent, `(confidence: ${intentResult.confidence})`);

        // If not a Gmail command or low confidence, skip
        if (intentResult.intent === 'none' || intentResult.confidence < 0.7) {
            return {
                executed: false,
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                reason: intentResult.reasoning
            };
        }

        // Map intent to command
        const commandName = intentAnalyzer.intentToCommand(intentResult.intent);

        if (!commandName) {
            console.log('[CommandExecutor] No command mapping for intent:', intentResult.intent);
            return {
                executed: false,
                intent: intentResult.intent,
                reason: 'No command mapping'
            };
        }

        // Check if command is registered
        if (!this.commands.has(commandName)) {
            console.log('[CommandExecutor] Command not registered:', commandName);
            return {
                executed: false,
                intent: intentResult.intent,
                reason: `Command ${commandName} not found`
            };
        }

        // Resolve contextual references (ça, cet email, etc.)
        if (intentResult.parameters.target === 'CONTEXT_REQUIRED') {
            const resolvedId = contextManager.resolveEmailReference(userId, userMessage);
            if (resolvedId) {
                intentResult.parameters.target = resolvedId;
            } else {
                // No context available
                await messageContext.sock.sendMessage(messageContext.msg.key.remoteJid, {
                    text: '❌ Aucun email en contexte.\n\nAffichez d\'abord vos emails avec "Montre mes emails"'
                }, { quoted: messageContext.msg });

                return {
                    executed: true, // We handled it
                    intent: intentResult.intent,
                    reason: 'Missing context'
                };
            }
        }

        // Build command arguments
        const args = intentAnalyzer.buildCommandArgs(intentResult.intent, intentResult.parameters);

        console.log('[CommandExecutor] Executing command:', commandName, 'with args:', args);

        try {
            // Execute the command
            const command = this.commands.get(commandName);

            await command.run({
                sock: messageContext.sock,
                msg: messageContext.msg,
                args: args
            });

            // Update conversation history
            contextManager.addToHistory(userId, 'user', userMessage);
            contextManager.addToHistory(userId, 'assistant', `Executed: ${commandName}`);

            return {
                executed: true,
                intent: intentResult.intent,
                command: commandName,
                confidence: intentResult.confidence,
                args: args
            };

        } catch (error) {
            console.error('[CommandExecutor] Execution error:', error.message);

            await messageContext.sock.sendMessage(messageContext.msg.key.remoteJid, {
                text: `❌ Erreur lors de l'exécution: ${error.message}`
            }, { quoted: messageContext.msg });

            return {
                executed: true, // We handled it
                intent: intentResult.intent,
                error: error.message
            };
        }
    }

    /**
     * Get list of registered commands
     * @returns {Array} Command names
     */
    getRegisteredCommands() {
        return Array.from(this.commands.keys());
    }
}

// Singleton instance
const commandExecutorInstance = new CommandExecutor();

module.exports = commandExecutorInstance;
