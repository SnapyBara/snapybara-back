# 🔐 Configuration OAuth pour Google et Apple

## 📱 Configuration Google OAuth

### 1. **Google Cloud Console Setup**

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer l'API Google+ : **APIs & Services** > **Library** > Rechercher "Google+ API"
4. Aller dans **APIs & Services** > **Credentials**
5. Cliquer **Create Credentials** > **OAuth 2.0 Client IDs**

### 2. **Configuration OAuth Client**

**Type d'application :** Web application

**Authorized JavaScript origins :**
```
https://your-project.supabase.co
http://localhost:3000
```

**Authorized redirect URIs :**
```
https://your-project.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

### 3. **Configuration dans Supabase**

1. Aller dans ton dashboard Supabase
2. **Authentication** > **Providers** > **Google**
3. Activer Google Provider
4. Remplir :
   - **Client ID** : Celui obtenu depuis Google Cloud Console
   - **Client Secret** : Celui obtenu depuis Google Cloud Console

### 4. **Variables d'environnement**

Ajouter dans ton `.env` :
```env
GOOGLE_CLIENT_ID=ton_google_client_id
GOOGLE_CLIENT_SECRET=ton_google_client_secret
```

---

## 🍎 Configuration Apple OAuth

### 1. **Apple Developer Console Setup**

1. Aller sur [Apple Developer](https://developer.apple.com/)
2. **Certificates, Identifiers & Profiles** > **Identifiers**
3. Créer un nouvel **App ID** ou modifier un existant
4. Activer **Sign in with Apple** capability

### 2. **Créer Service ID**

1. **Identifiers** > **+** > **Services IDs**
2. Remplir les informations de base
3. Configurer **Sign in with Apple** :
   - **Primary App ID** : Sélectionner ton App ID créé précédemment
   - **Website URLs** > **+** :
     - **Domain** : `your-project.supabase.co`
     - **Return URL** : `https://your-project.supabase.co/auth/v1/callback`

### 3. **Créer Private Key**

1. **Keys** > **+**
2. Nom de la clé et activer **Sign in with Apple**
3. Sélectionner ton **Primary App ID**
4. Télécharger le fichier `.p8` (garde-le précieusement !)

### 4. **Configuration dans Supabase**

1. **Authentication** > **Providers** > **Apple**
2. Activer Apple Provider
3. Remplir :
   - **Client ID** : Ton Service ID
   - **Client Secret** : Généré avec la clé privée (voir section suivante)

### 5. **Générer Client Secret pour Apple**

Le client secret Apple doit être un JWT signé. Utilise cet outil en ligne ou ce script Node.js :

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('path/to/your/AuthKey_XXXXXXXXXX.p8');

const token = jwt.sign(
  {
    iss: 'YOUR_TEAM_ID', // Team ID depuis Apple Developer
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 6 mois
    aud: 'https://appleid.apple.com',
    sub: 'YOUR_SERVICE_ID', // Service ID créé précédemment
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      kid: 'YOUR_KEY_ID', // Key ID de la clé privée
      alg: 'ES256',
    },
  }
);

console.log(token);
```

---

## 🔧 Implémentation côté NestJS

### 1. **Endpoint OAuth Callback**

```typescript
// src/auth/auth.controller.ts
@Get('callback')
async handleOAuthCallback(@Query() query: any) {
  // Supabase gère automatiquement le callback
  // Redirection vers ton frontend avec les tokens
  return { success: true };
}
```

### 2. **Frontend Integration (Kotlin/Android)**

```kotlin
// Pour Google OAuth
val googleSignInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestIdToken(getString(R.string.google_web_client_id))
    .requestEmail()
    .build()

// Pour Apple OAuth (via WebView)
val appleSignInUrl = "https://your-project.supabase.co/auth/v1/authorize?provider=apple"
```

---

## 🧪 Test OAuth

### Test Google OAuth :
```
https://your-project.supabase.co/auth/v1/authorize?provider=google
```

### Test Apple OAuth :
```
https://your-project.supabase.co/auth/v1/authorize?provider=apple
```

### Vérification dans Supabase :
1. **Authentication** > **Users** : Vérifier que l'utilisateur OAuth apparaît
2. **Logs** > **Auth Logs** : Vérifier les connexions OAuth

---

## 🔒 Sécurité OAuth

1. **Redirect URLs** : Toujours utiliser HTTPS en production
2. **State Parameter** : Supabase gère automatiquement la protection CSRF
3. **Token Validation** : Valider côté serveur les tokens reçus
4. **Refresh Tokens** : Gérer le renouvellement automatique des tokens

---

## 📱 Configuration pour ton app Android

Dans ton `strings.xml` :
```xml
<string name="google_web_client_id">ton_google_client_id</string>
<string name="supabase_url">https://your-project.supabase.co</string>
<string name="supabase_anon_key">ta_supabase_anon_key</string>
```

Dans ton `AndroidManifest.xml` :
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="your-project.supabase.co" />
</intent-filter>
```
