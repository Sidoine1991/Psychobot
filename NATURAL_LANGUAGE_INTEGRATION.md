# 🤖 Natural Language Command Router - Guide d'Intégration

## 📦 Fichiers Créés

✅ **3 nouveaux services** :
- `src/services/intentAnalyzer.js` - Analyse intentions avec NVIDIA NIM
- `src/services/contextManager.js` - Gère contexte conversation
- `src/services/commandExecutor.js` - Exécute commandes depuis intentions

---

## 🔧 Intégration dans index.js

### **Étape 1 : Imports (ligne ~30)**

Ajouter après les imports existants :

```javascript
// Natural Language Command Router
const intentAnalyzer = require('./src/services/intentAnalyzer');
const contextManager = require('./src/services/contextManager');
const commandExecutor = require('./src/services/commandExecutor');
```

### **Étape 2 : Enregistrer les commandes (ligne ~515, après chargement commands)**

Trouver la section où les commandes sont chargées dans `commands` Map, puis ajouter :

```javascript
// Register Gmail commands for natural language processing
const gmailCommands = {
    'inbox': commands.get('inbox'),
    'delete': commands.get('delete'),
    'archive': commands.get('archive'),
    'spam': commands.get('spam'),
    'star': commands.get('star'),
    'unstar': commands.get('unstar'),
    'primary': commands.get('primary'),
    'social': commands.get('social'),
    'promotions': commands.get('promotions'),
    'updates': commands.get('updates'),
    'thread': commands.get('thread'),
    'search': commands.get('search'),
    'send': commands.get('send'),
    'compose': commands.get('compose')
};

// Register with command executor
commandExecutor.registerCommands(gmailCommands);

console.log(chalk.cyan('[Natural Language] Command executor initialized with Gmail commands'));
```

### **Étape 3 : Natural Language Handler (ligne ~1318, AVANT `if (text.startsWith(PREFIX))`)**

Ajouter ce bloc JUSTE AVANT la ligne `// Command Handling` :

```javascript
        // ============================================================================
        // NATURAL LANGUAGE COMMAND PROCESSING
        // ============================================================================

        // If not a command (!), try natural language processing
        if (!text.startsWith(PREFIX) && text.length > 3) {
            const userId = remoteJid;

            try {
                const result = await commandExecutor.processMessage(
                    text,
                    { sock, msg },
                    userId
                );

                // If a command was executed, skip normal AI processing
                if (result.executed) {
                    console.log('[Natural Language] Command executed:', result.intent);

                    // Update context if it was an inbox command
                    if (result.command === 'inbox') {
                        const session = userSession.getSession(userId);
                        if (session.gmail.emails.length > 0) {
                            contextManager.updateLastEmails(userId, session.gmail.emails);
                            contextManager.updateNavigation(userId, {
                                currentPage: session.gmail.currentPage,
                                category: session.gmail.category
                            });
                        }
                    }

                    return; // Skip normal message processing
                }

                // If not executed but analyzed, log for debugging
                if (result.intent !== 'none') {
                    console.log('[Natural Language] Intent detected but not executed:', result.intent, result.reason);
                }

            } catch (error) {
                console.error('[Natural Language] Processing error:', error.message);
                // Continue to normal processing if NL fails
            }
        }

        // ============================================================================

```

### **Étape 4 : Update Context après commandes manuelles (ligne ~1354, dans command.run callback)**

Remplacer :

```javascript
await command.run({ sock, msg, commands, replyWithTag, args, antilinkGroups, antideleteGroups });
```

Par :

```javascript
await command.run({ sock, msg, commands, replyWithTag, args, antilinkGroups, antideleteGroups });

// Update context for Gmail commands
const userId = remoteJid;
if (['inbox', 'primary', 'social', 'promotions', 'updates'].includes(commandName)) {
    const session = userSession.getSession(userId);
    if (session.gmail.emails.length > 0) {
        contextManager.updateLastEmails(userId, session.gmail.emails);
        contextManager.updateNavigation(userId, {
            currentPage: session.gmail.currentPage,
            category: session.gmail.category
        });
    }
}
```

---

## 🧪 Tests à Effectuer

### **Test 1 : Navigation Simple**
```
Vous: "Montre mes emails"
→ Devrait afficher !inbox

Vous: "Page suivante"
→ Devrait exécuter !inbox next
```

### **Test 2 : Actions avec Contexte**
```
Vous: "Montre mes emails"
→ Liste affichée avec IDs

Vous: "Supprime le dernier"
→ Devrait supprimer le dernier email affiché
```

### **Test 3 : Catégories**
```
Vous: "Montre les promotions"
→ Devrait exécuter !promotions

Vous: "Affiche les réseaux sociaux"
→ Devrait exécuter !social
```

### **Test 4 : Références Contextuelles**
```
Vous: "Montre mes emails"
→ Liste affichée

Vous: "Mets une étoile sur ça"
→ Devrait étoiler le dernier email vu

Vous: "Archive cet email"
→ Devrait archiver le dernier email
```

### **Test 5 : Non-Gmail**
```
Vous: "Quel temps fait-il?"
→ Devrait passer à l'IA normale (pas de commande Gmail)
```

---

## 🐛 Debug

### **Logs à surveiller**

```
[Natural Language] Command executor initialized with Gmail commands
[CommandExecutor] Analyzing intent for: <message>
[CommandExecutor] Intent: <intent> (confidence: 0.95)
[CommandExecutor] Executing command: <command> with args: [...]
[Natural Language] Command executed: <intent>
```

### **Si ça ne marche pas**

1. **Vérifier NVIDIA_NIM_API_KEY** dans Render Environment
2. **Vérifier les logs** pour voir si l'intent est détecté
3. **Tester avec `!inbox` d'abord** pour s'assurer que les commandes normales fonctionnent
4. **Logs Intent Analyzer** : Si confidence < 0.7, l'intent est ignoré

---

## ⚡ Performance

- **Latence** : +1-2 secondes (appel NVIDIA NIM)
- **Coût** : ~$0.0001 par message analysé
- **Cache** : Pas de cache actuellement, chaque message = 1 appel API

### **Optimisation Future**

- Ajouter cache local pour patterns fréquents
- Pre-filter plus agressif avant appel NIM
- Utiliser modèle plus petit pour intent simple

---

## 📊 Métriques Utiles

Ajouter des logs de métriques :

```javascript
// Dans commandExecutor.js, après analyse
console.log({
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    latency: Date.now() - startTime,
    userId: userId.substring(0, 8)
});
```

---

## 🚀 Prochaines Améliorations

1. **Multi-step Conversations**
   - "Envoie un email" → IA demande destinataire, sujet, message

2. **Context Enrichment**
   - Se souvenir des 10 derniers emails, pas juste le dernier

3. **Voice Commands**
   - Intégrer avec audio transcription existante

4. **Predictive Suggestions**
   - "Vous voulez probablement archiver ce message"

---

## ✅ Checklist d'Intégration

- [ ] Imports ajoutés (étape 1)
- [ ] Commands enregistrées (étape 2)
- [ ] Handler NL ajouté (étape 3)
- [ ] Context update ajouté (étape 4)
- [ ] Commit et push
- [ ] Deploy sur Render
- [ ] Test "Montre mes emails"
- [ ] Test "Page suivante"
- [ ] Test "Supprime ça"
- [ ] Test "Quel temps fait-il?"

