# Phase 2.1 : OAuth 2.0 pour Gmail Personnel - Guide Complet

## 🎯 Vue d'Ensemble

Cette phase implémente OAuth 2.0 pour permettre à KolaBoT d'accéder à votre Gmail personnel (@gmail.com).

**Différence avec Phase 2 :**
- **Phase 2** : Service Account (Google Workspace uniquement)
- **Phase 2.1** : OAuth 2.0 (Gmail personnel compatible) ✅

---

## 🔧 ÉTAPE 1 : Créer OAuth 2.0 Client ID

### 1.1 Google Cloud Console

1. **Allez sur** : https://console.cloud.google.com
2. **Projet** : `kolabot-agent`
3. **API & Services** → **Credentials**
4. **Create Credentials** → **OAuth 2.0 Client ID**

### 1.2 Configuration OAuth Consent Screen (si première fois)

**Avant** de créer le Client ID, configurez l'écran de consentement :

1. **OAuth consent screen** (menu gauche)
2. **User Type** : `External` (pour Gmail personnel)
3. **Cliquez** : **CREATE**

**App information:**
- **App name** : `KolaBoT`
- **User support email** : Votre email
- **Developer contact information** : Votre email

**Scopes** : Laisser par défaut (on les configure dans le code)

**Test users** (IMPORTANT) :
- **Add Users** → Ajoutez votre email Gmail
- ⚠️ En mode External + Testing, seuls les test users peuvent autoriser l'app

**Save and Continue** → **Save and Continue** → **Back to Dashboard**

### 1.3 Créer OAuth Client ID

1. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

**Configuration :**
- **Application type** : `Web application`
- **Name** : `KolaBoT Gmail OAuth`

**Authorized redirect URIs** :
```
https://VOTRE-APP-NAME.onrender.com/oauth/callback
```

⚠️ **Remplacez** `VOTRE-APP-NAME` par le nom réel de votre app Render !

**Exemple** :
```
https://psychobot-v2-abc123.onrender.com/oauth/callback
```

**Cliquez** : **CREATE**

### 1.4 Récupérer les Credentials

Après création, une popup affiche :
- **Client ID** : `xxxxx.apps.googleusercontent.com`
- **Client Secret** : `GOCSPX-xxxxx`

📝 **Copiez ces 2 valeurs** (on les ajoutera dans Render)

---

## 🔐 ÉTAPE 2 : Configuration Render

### 2.1 Variables d'Environnement

Allez sur **Render Dashboard** → Votre Service → **Environment**

**Ajoutez 3 nouvelles variables** :

#### **GOOGLE_OAUTH_CLIENT_ID**
```
xxxxx.apps.googleusercontent.com
```
(Copiez depuis Google Cloud Console)

#### **GOOGLE_OAUTH_CLIENT_SECRET**
```
GOCSPX-xxxxx
```
(Copiez depuis Google Cloud Console)

#### **GOOGLE_OAUTH_REDIRECT_URI**
```
https://VOTRE-APP-NAME.onrender.com/oauth/callback
```
(Doit correspondre EXACTEMENT à l'URI configurée dans Google Cloud)

#### **RENDER_EXTERNAL_URL**
```
https://VOTRE-APP-NAME.onrender.com
```
(URL complète de votre app Render, sans `/` à la fin)

**Save Changes** → Render redéploiera automatiquement

---

## 📱 ÉTAPE 3 : Autoriser l'Accès Gmail

### 3.1 Sur WhatsApp

Envoyez la commande :
```
!authorize
```

### 3.2 Réponse du Bot

KolaBoT vous envoie un lien :
```
🔗 https://votre-app.onrender.com/oauth/authorize
```

### 3.3 Cliquez sur le Lien

1. **Ouvrez le lien** dans votre navigateur
2. Vous verrez une page **"KolaBoT Gmail Authorization"**
3. **Cliquez** : **🔐 Autoriser l'accès Gmail**

### 3.4 Page Google

1. **Connectez-vous** avec votre compte Gmail
2. **Sélectionnez votre compte** si plusieurs
3. **Lisez les permissions** demandées :
   - Lire vos emails
   - Envoyer des emails
   - Rechercher dans Gmail
   - Accéder à vos contacts
4. **Cliquez** : **Continuer** ou **Autoriser**

### 3.5 Confirmation

Si succès, vous verrez :
```
✅ Autorisation Réussie!
🎉 KolaBoT a maintenant accès à votre Gmail!
```

**Vous pouvez fermer la page.**

---

## 🧪 ÉTAPE 4 : Tester

### Test 1 : Vérifier le Statut
```
!gmailstatus
```

**Résultat attendu** :
```
📊 Statut Gmail OAuth

✅ Autorisé
🔑 Access Token: Présent
⏰ Expire le: ...
📝 Statut: ✅ Valide
```

### Test 2 : Voir l'Inbox
```
!inbox
```

**Résultat attendu** : Liste de vos 5 derniers emails

### Test 3 : Rechercher
```
!search subject:test
```

**Résultat attendu** : Emails avec "test" dans le sujet

### Test 4 : Envoyer un Email
```
!send votre-email@gmail.com | Test KolaBoT | Ceci est un test depuis WhatsApp
```

**Résultat attendu** : Email envoyé et reçu dans votre boîte

---

## 🔄 Renouvellement Automatique

**Pas d'action nécessaire !**

- Le **Refresh Token** est stocké dans `.oauth-tokens.json`
- L'**Access Token** expire après 1h
- KolaBoT le **renouvelle automatiquement** avant expiration
- Vous **n'avez jamais à vous reconnecter**

---

## 🔒 Sécurité

### Fichier Tokens

Le fichier `.oauth-tokens.json` contient :
- **Access Token** (temporaire, 1h)
- **Refresh Token** (permanent, jusqu'à révocation)

**Protection** :
- ✅ `.oauth-tokens.json` est dans `.gitignore`
- ✅ Jamais committé dans Git
- ✅ Stocké uniquement sur Render (éphémère)

### Révoquer l'Accès

**Option 1 : Via URL**
```
https://votre-app.onrender.com/oauth/revoke
```

**Option 2 : Directement sur Google**
1. https://myaccount.google.com/permissions
2. **KolaBoT** → **Remove Access**

**Option 3 : Via WhatsApp** (futur)
```
!revoke
```

---

## ⚠️ Limitations et Notes

### Mode Testing (External App)

- **Statut** : App en mode "Testing"
- **Test Users** : Seuls les emails ajoutés peuvent autoriser
- **Limite** : 100 users max en testing
- **Solution** : Publier l'app (Verification Google) pour accès illimité

### Tokens et Render

**Problème** : Render redémarre périodiquement, le fichier `.oauth-tokens.json` est perdu

**Solutions** :

**A. Redis (Recommandé pour production)**
- Stocker tokens dans Redis persistant
- Survit aux redémarrages

**B. Supabase Storage**
- Stocker tokens dans table Supabase
- Chiffré avec clé secrète

**C. Re-autoriser après redémarrage**
- Simple mais nécessite de refaire !authorize
- Acceptable pour usage personnel

**Implémentation actuelle** : Option C (fichier local)  
**Pour production** : Implémenter A ou B dans Phase 3

---

## 🆘 Dépannage

### Erreur : "redirect_uri_mismatch"

**Cause** : L'URI de callback ne correspond pas

**Solution** :
1. Vérifiez l'URL dans Google Cloud Console
2. Vérifiez `GOOGLE_OAUTH_REDIRECT_URI` dans Render
3. Les deux doivent être **IDENTIQUES**

### Erreur : "invalid_grant"

**Cause** : Refresh token invalide ou révoqué

**Solution** :
1. Supprimez `.oauth-tokens.json`
2. Réautorisez avec `!authorize`

### Erreur : "Access blocked: KolaBoT has not completed verification"

**Cause** : Email pas dans test users

**Solution** :
1. Google Cloud Console → OAuth consent screen
2. **Test users** → **Add Users**
3. Ajoutez votre email Gmail

### Bot ne répond pas après autorisation

**Vérifiez** :
1. Render logs → Erreurs ?
2. Variables d'environnement bien configurées ?
3. `!gmailstatus` → Autorisé ?

---

## 📊 Endpoints OAuth Disponibles

| Endpoint | Description |
|----------|-------------|
| `/oauth/authorize` | Page d'autorisation (lien cliquable) |
| `/oauth/callback` | Callback Google (traite le code) |
| `/oauth/status` | Statut JSON de l'autorisation |
| `/oauth/revoke` | Révoquer l'accès Gmail |

---

## 🚀 Prochaine Étape : Phase 3

Une fois Gmail fonctionnel :
- 🤖 **Prospection autonome**
- 📊 **Lead scoring**
- 📈 **Analytics et rapports**
- 🎯 **Follow-up intelligent**

