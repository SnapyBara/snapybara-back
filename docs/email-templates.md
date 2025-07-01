# 📧 Configuration des Templates d'Email Supabase

## 🎨 Templates d'Email Personnalisés

### 1. **Accès aux Templates**

Dans ton dashboard Supabase :
1. **Authentication** > **Email Templates**
2. Tu verras 4 types de templates :
   - **Confirm signup** (Confirmation d'inscription)
   - **Invite user** (Invitation d'utilisateur)
   - **Magic link** (Lien magique de connexion)
   - **Reset password** (Réinitialisation de mot de passe)

### 2. **Template de Confirmation d'Inscription**

```html
<!-- Subject: Confirmez votre inscription à SnapyBara -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation d'inscription</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏞️ Bienvenue sur SnapyBara !</h1>
        </div>
        <div class="content">
            <h2>Confirmez votre inscription</h2>
            <p>Bonjour,</p>
            <p>Merci de vous être inscrit(e) à SnapyBara, l'application qui vous fait découvrir les plus beaux lieux à photographier !</p>
            <p>Pour activer votre compte, cliquez sur le bouton ci-dessous :</p>
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Confirmer mon inscription</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :<br>
            <code>{{ .ConfirmationURL }}</code></p>
            <p>Ce lien expire dans 24 heures.</p>
            <p>Si vous n'avez pas créé de compte SnapyBara, ignorez simplement cet email.</p>
            <p>À bientôt sur SnapyBara ! 📸</p>
        </div>
        <div class="footer">
            <p>© 2024 SnapyBara - Découvrez, Photographiez, Partagez</p>
        </div>
    </div>
</body>
</html>
```

### 3. **Template de Réinitialisation de Mot de Passe**

```html
<!-- Subject: Réinitialisation de votre mot de passe SnapyBara -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation de mot de passe</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #ff6b6b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Réinitialisation de mot de passe</h1>
        </div>
        <div class="content">
            <h2>Réinitialisez votre mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte SnapyBara.</p>
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Réinitialiser mon mot de passe</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :<br>
            <code>{{ .ConfirmationURL }}</code></p>
            
            <div class="warning">
                <strong>⚠️ Important :</strong>
                <ul>
                    <li>Ce lien expire dans 1 heure</li>
                    <li>Il ne peut être utilisé qu'une seule fois</li>
                    <li>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email</li>
                </ul>
            </div>
            
            <p>Pour votre sécurité, choisissez un mot de passe :</p>
            <ul>
                <li>D'au moins 8 caractères</li>
                <li>Avec des majuscules et minuscules</li>
                <li>Avec au moins un chiffre</li>
                <li>Avec au moins un caractère spécial</li>
            </ul>
        </div>
        <div class="footer">
            <p>© 2024 SnapyBara - Découvrez, Photographiez, Partagez</p>
        </div>
    </div>
</body>
</html>
```

### 4. **Template Magic Link (Connexion sans mot de passe)**

```html
<!-- Subject: Votre lien de connexion SnapyBara -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion rapide</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10ac84 0%, #00d2d3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #10ac84; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✨ Connexion rapide à SnapyBara</h1>
        </div>
        <div class="content">
            <h2>Connectez-vous en un clic</h2>
            <p>Bonjour,</p>
            <p>Voici votre lien de connexion magique pour accéder à votre compte SnapyBara :</p>
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Se connecter maintenant</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :<br>
            <code>{{ .ConfirmationURL }}</code></p>
            <p><strong>Ce lien expire dans 30 minutes</strong> et ne peut être utilisé qu'une seule fois.</p>
            <p>Si vous n'avez pas demandé cette connexion, ignorez simplement cet email.</p>
            <p>Bonne exploration ! 🌍📸</p>
        </div>
        <div class="footer">
            <p>© 2024 SnapyBara - Découvrez, Photographiez, Partagez</p>
        </div>
    </div>
</body>
</html>
```

### 5. **Template d'Invitation**

```html
<!-- Subject: Vous êtes invité(e) à rejoindre SnapyBara ! -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation SnapyBara</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #f5576c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Vous êtes invité(e) !</h1>
        </div>
        <div class="content">
            <h2>Rejoignez SnapyBara</h2>
            <p>Bonjour,</p>
            <p>Vous avez été invité(e) à rejoindre <strong>SnapyBara</strong>, l'application qui vous fait découvrir les plus beaux spots photo !</p>
            <p>Avec SnapyBara, vous pourrez :</p>
            <ul>
                <li>🗺️ Découvrir des lieux exceptionnels près de chez vous</li>
                <li>📸 Partager vos plus belles photos</li>
                <li>⭐ Noter et commenter les spots</li>
                <li>🏆 Participer à des défis photo</li>
            </ul>
            <div style="text-align: center;">
                <a href="{{ .ConfirmationURL }}" class="button">Accepter l'invitation</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :<br>
            <code>{{ .ConfirmationURL }}</code></p>
            <p>Cette invitation expire dans 7 jours.</p>
            <p>Hâte de voir vos créations ! 📷✨</p>
        </div>
        <div class="footer">
            <p>© 2024 SnapyBara - Découvrez, Photographiez, Partagez</p>
        </div>
    </div>
</body>
</html>
```

## ⚙️ Configuration dans Supabase

### 1. **Paramètres généraux**

Dans **Authentication** > **Settings** :

- **Site URL** : `https://snapybara.com` (ton domaine)
- **Redirect URLs** : 
  ```
  https://snapybara.com/auth/callback
  http://localhost:3000/auth/callback
  myapp://auth/callback
  ```

### 2. **Paramètres Email**

- **Enable email confirmations** : ✅ Activé
- **Enable email change confirmations** : ✅ Activé
- **Secure email change** : ✅ Activé

### 3. **SMTP Custom (Optionnel)**

Pour utiliser ton propre serveur email :

```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: noreply@snapybara.com
SMTP Pass: ton_mot_de_passe_app
```

## 📱 Variables d'environnement pour les emails

```env
# Email settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@snapybara.com
SMTP_PASS=ton_mot_de_passe_app
EMAIL_FROM=noreply@snapybara.com
EMAIL_FROM_NAME=SnapyBara Team
```

## 🧪 Test des emails

1. **Test Signup** : Créer un nouveau compte
2. **Test Reset** : Utiliser "Mot de passe oublié"
3. **Test Magic Link** : Se connecter avec juste l'email
4. **Test Invitation** : Inviter un utilisateur depuis le dashboard

Les emails apparaîtront dans **Authentication** > **Logs** pour le debug.
