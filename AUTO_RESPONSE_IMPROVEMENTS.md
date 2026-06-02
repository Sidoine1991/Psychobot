# Améliorations Auto-Response PsychoBot

## ✨ Changements Implémentés

### 1. **Détection Conversation Journée**
- ✅ Le bot détecte si vous avez déjà eu une conversation avec un contact aujourd'hui
- ✅ Si c'est le cas, il continue à répondre (pas de blocage, mais continue la conversation)
- ✅ Utilise un Map `conversationDates` pour tracer le dernier contact par jour

### 2. **Formatage Message Amélioré**
- ✅ Chaque réponse auto commence par `🤖 *Assistant Personnel*`
- ✅ Le message est envoyé en texte brut avec emoji robot visible
- ✅ Format clair et professionnel pour montrer que c'est Sidoine's bot

### 3. **Historique Conversation**
- ✅ Le bot mémorise la conversation (dernier 10 échanges par contact)
- ✅ Utilise `conversationHistory` pour donner du contexte à NVIDIA NIM
- ✅ Les réponses sont plus intelligentes et pertinentes

### 4. **Appel par Nom**
- ✅ Récupère le nom du contact depuis WhatsApp (`getContactName`)
- ✅ Passe `contactName` au service IA
- ✅ Le système prompt peut utiliser le nom pour personnaliser les réponses

---

## 🔧 Détails Techniques

### `src/services/ai.js` (Amélioré)
```javascript
// Maintenant utilise NVIDIA NIM API réelle
// - API Key: NVIDIA_NIM_API_KEY env var (fallback hardcodé pour Render)
// - Model: meta/llama-3.3-70b-instruct
// - System Prompt: Sidoine's profile + French response preference
// - Conversation Memory: Stockage des 10 derniers échanges par contact
```

### `src/handlers/autoResponse.js` (Complètement refondu)
```javascript
// Nouvelles fonctionnalités:
// 1. shouldReplyToContact() - vérifie date conversation
// 2. markConversationToday() - marque contact comme contacté
// 3. getContactName() - récupère nom du contact
// 4. Récupère historique avant appel IA
// 5. Formate réponse avec 🤖 emoji robot
```

---

## 🚀 Utilisation

### Dans les messages privés (DM)
```
User: Bonjour, ça va ?
Bot: 🤖 *Assistant Personnel*

Bonjour! Tout va bien, merci d'avoir demandé! Comment je peux t'aider?
```

### Dans les groupes (avec mention)
```
@Psycho Que fais-tu?
Bot: 🤖 *Assistant Personnel*

Je suis ici pour aider Sidoine! Comment je peux t'assister?
```

### Même jour = Conversation continue
```
User1: Salut (reçoit réponse auto)
User1: (plus tard) Tu fais quoi? (reçoit réponse - déjà en conv)
Jour suivant: Salut (reçoit réponse si offline)
```

---

## 🧪 Points de Test

1. **Conversation journée**
   - Message 1 à 10h → doit répondre
   - Message 2 à 11h du même contact → continue conversation
   - Lendemain message → nouveau jour, peut répondre

2. **Formatage**
   - Vérifier que 🤖 *Assistant Personnel* s'affiche
   - Vérifier que le message n'est pas vide

3. **Nom du contact**
   - Ajouter un contact WhatsApp avec nom "Alice"
   - Envoyer message → historique doit mémoriser sous "Alice"
   - 2e message → bot peut référencer "Alice" si IA le décide

4. **Historique**
   - Message 1: "Je suis Alice"
   - Message 2: "Tu te souviens de mon nom?" → IA doit répondre avec contexte

---

## 📝 Variables Environnement

```bash
NVIDIA_NIM_API_KEY=nvapi-... # Voir config existante
```

### Fallback (Render deploy)
- Clé hardcodée dans le code pour compatibilité Render
- À remplacer en production avec var d'env sécurisée

---

## ✅ État Complet

| Feature | Status | Notes |
|---------|--------|-------|
| Détection conversation journée | ✅ | Map conversationDates |
| Formatage 🤖 emoji | ✅ | *Assistant Personnel* |
| Historique avec contexte | ✅ | 10 échanges max par contact |
| Appel par nom | ✅ | getContactName() |
| NVIDIA NIM intégration | ✅ | API réelle, fallback key |
| System prompt Sidoine | ✅ | Profil complet inclus |

---

## 🐛 Dépannage

### "Error: NVIDIA API error: 401"
→ Vérifier `NVIDIA_NIM_API_KEY` dans `.env`

### "AI returned empty response"
→ NVIDIA API timeout ou rate limit → attendre & réessayer

### Bot ne répond pas après DM initial
→ Vérifier que date conversations n'a pas bloqué → logs pour debug

---

**Deploiement**: `git push` → Render auto-redeploy depuis main branch ✨
