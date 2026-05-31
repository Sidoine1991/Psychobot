# Phase 2 : Google Contacts + Gmail - Guide de Configuration

## 📋 Vue d'Ensemble

Phase 2 ajoute la gestion des contacts Google et l'accès à Gmail, permettant à KolaBoT de :
- 📇 Rechercher et gérer vos contacts
- 📧 Lire vos emails
- ✉️ Envoyer des emails
- 🔍 Rechercher dans votre boîte mail

---

## 🔧 Configuration Google Cloud

### Étape 1 : Activer les APIs

1. **Allez sur Google Cloud Console** : https://console.cloud.google.com
2. **Sélectionnez votre projet** : `kolabot-agent`
3. **Activez les APIs** :

   **a) People API (Contacts)**
   - API & Services → Library
   - Recherchez "People API"
   - Cliquez "ENABLE"

   **b) Gmail API**
   - API & Services → Library
   - Recherchez "Gmail API"
   - Cliquez "ENABLE"

### Étape 2 : Vérifier les Scopes

Les nouveaux scopes ont été ajoutés automatiquement :

```javascript
// Contacts
'https://www.googleapis.com/auth/contacts'
'https://www.googleapis.com/auth/contacts.readonly'

// Gmail
'https://www.googleapis.com/auth/gmail.readonly'
'https://www.googleapis.com/auth/gmail.send'
'https://www.googleapis.com/auth/gmail.modify'
'https://www.googleapis.com/auth/gmail.compose'
```

### Étape 3 : Permissions Service Account

⚠️ **IMPORTANT pour Gmail** : Les Service Accounts **NE PEUVENT PAS** accéder directement à Gmail personnel.

**Deux options :**

#### **Option A : Gmail via Domain-Wide Delegation (Google Workspace)**

Si vous avez Google Workspace (entreprise) :

1. **Admin Console** → Security → API Controls → Domain-wide Delegation
2. **Ajouter** le Service Account Client ID
3. **Scopes OAuth** :
   ```
   https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/contacts.readonly
   ```
4. **Autoriser**

#### **Option B : OAuth 2.0 User Consent (Gmail Personnel)**

Pour Gmail personnel (@gmail.com), il faut utiliser OAuth 2.0 avec consentement utilisateur.

📝 **Note** : Cette implémentation nécessite un flux OAuth plus complexe. Si vous utilisez Gmail personnel, nous devrons modifier l'authentification dans Phase 2.1.

---

## 📱 Commandes WhatsApp Disponibles

### **Contacts**

#### **!contacts [recherche]**
Liste ou recherche des contacts

**Exemples :**
```
!contacts
→ Liste les 20 premiers contacts

!contacts John
→ Recherche "John" dans les contacts

!contacts example@gmail.com
→ Recherche par email
```

#### **!addcontact <prénom> <nom> <email> <téléphone> [entreprise]**
Ajoute un nouveau contact

**Exemples :**
```
!addcontact John Doe john@example.com +33612345678

!addcontact Marie Martin marie@test.fr +33698765432 Acme Corp
```

---

### **Gmail**

#### **!inbox [nombre|unread]**
Affiche les derniers emails

**Exemples :**
```
!inbox
→ 5 derniers emails

!inbox 10
→ 10 derniers emails

!inbox unread
→ Uniquement les non-lus
```

#### **!send <email> | <sujet> | <message>**
Envoie un email

**Format** : Les 3 parties séparées par `|`

**Exemple :**
```
!send john@example.com | Réunion demain | Bonjour John, confirmes-tu pour demain 10h ?
```

#### **!search <query>**
Recherche dans Gmail

**Exemples :**
```
!search projet important
→ Recherche simple

!search from:john@example.com
→ Emails de John

!search subject:meeting
→ Sujet contient "meeting"

!search has:attachment after:2026/05/01
→ Query Gmail avancée
```

**Syntaxe Gmail complète supportée** :
- `from:` - Expéditeur
- `to:` - Destinataire
- `subject:` - Sujet
- `has:attachment` - Avec pièce jointe
- `is:unread` - Non lu
- `is:important` - Marqué important
- `after:YYYY/MM/DD` - Après date
- `before:YYYY/MM/DD` - Avant date

---

## 🧪 Tests de Validation

### Test 1 : Contacts
```
!contacts
```
✅ **Attendu** : Liste de vos contacts Google

### Test 2 : Ajouter Contact
```
!addcontact Test Bot test@kolabot.com +33600000000 KolaBoT Inc
```
✅ **Attendu** : Contact créé, visible dans Google Contacts

### Test 3 : Gmail Inbox (si configuré)
```
!inbox 5
```
✅ **Attendu** : 5 derniers emails affichés

### Test 4 : Recherche Gmail
```
!search subject:test
```
✅ **Attendu** : Emails avec "test" dans le sujet

### Test 5 : Envoyer Email
```
!send votre-email@gmail.com | Test KolaBoT | Ceci est un test d'envoi depuis WhatsApp
```
✅ **Attendu** : Email reçu dans votre boîte

---

## ⚠️ Limitations Connues

1. **Gmail Personnel** : Service Account ne peut pas accéder directement à Gmail @gmail.com
   - **Solution** : Utiliser Google Workspace OU implémenter OAuth 2.0

2. **Contacts** : Fonctionne avec Service Account uniquement si partagé

3. **Rate Limits** :
   - People API : 600 requêtes/minute
   - Gmail API : 1 milliard de requêtes/jour

---

## 🔒 Sécurité

- ✅ Service Account utilisé (pas de mot de passe stocké)
- ✅ Scopes minimaux nécessaires
- ✅ Connexion chiffrée TLS
- ✅ Pas de credentials dans le code

---

## 🚀 Prochaine Étape : Phase 3

Une fois Phase 2 validée :
- 🤖 Prospection autonome
- 🎯 Lead scoring
- 📊 Tracking interactions
- 📈 Rapports automatiques

---

## 📞 Support

En cas de problème :
1. Vérifiez les logs Render
2. Confirmez que les APIs sont activées
3. Vérifiez les permissions Service Account
4. Testez l'authentification avec le script de test

