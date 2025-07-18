import { Controller, Get, Query, Res, Req, Post, Body } from '@nestjs/common';
import { Response, Request } from 'express';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-confirmation')
  async sendEmailConfirmation(@Body() body: { email: string }) {
    return await this.emailService.sendEmailConfirmation(body.email);
  }

  @Post('send-reset-password')
  async sendPasswordResetEmail(@Body() body: { email: string }) {
    return await this.emailService.sendPasswordResetEmail(body.email);
  }

  @Get('confirm')
  async confirmEmail(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      console.log('=== DÉBUT CONFIRMATION EMAIL ===');
      console.log('🔍 URL complète:', req.url);
      console.log('🔍 Query params reçus:', query);

      const userAgent = req.headers['user-agent'] ?? '';
      const _isMobile =
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent,
        );

      const {
        access_token,
        refresh_token,
        _expires_in,
        _token_type,
        type,
        confirmed,
        token,
        token_hash,
        error: supabaseError,
        _error_description,
      } = query;

      if (supabaseError) {
        console.log('❌ Erreur de confirmation Supabase:', supabaseError);
        console.log('   Description:', _error_description);
        return res.status(400).send(this.getErrorPage());
      }

      if (confirmed === 'true') {
        console.log('✅ Confirmation réussie via paramètre confirmed');
        return res.send(this.getSuccessPage(_isMobile));
      }

      if (token || token_hash) {
        const tokenToVerify = token || token_hash;
        console.log(
          '🔍 Tentative de vérification du token depuis template email:',
          tokenToVerify.substring(0, 10) + '...',
        );

        try {
          const isValid =
            await this.emailService.confirmEmailWithSupabase(tokenToVerify);
          if (isValid) {
            console.log('✅ Token vérifié avec succès depuis template email');
            return res.send(this.getSuccessPage(_isMobile));
          } else {
            console.log('❌ Token invalide ou expiré');
            return res.status(400).send(this.getErrorPage());
          }
        } catch (error) {
          console.error('💥 Erreur lors de la vérification du token:', error);
          return res.status(400).send(this.getErrorPage());
        }
      }
      if (access_token && refresh_token) {
        console.log("✅ Confirmation réussie - Tokens d'accès reçus");
        return res.send(this.getSuccessPage(_isMobile));
      }

      if (access_token) {
        console.log('✅ Confirmation réussie - Access token seul');
        return res.send(this.getSuccessPage(_isMobile));
      }

      if (type === 'signup' || type === 'email') {
        console.log('✅ Redirection de confirmation basique, type:', type);
        return res.send(this.getSuccessPage(_isMobile));
      }

      console.log(
        '⚠️ Pas de paramètres directs - utilisation du fragment reader',
      );
      return res.send(this.getFragmentReaderPage(_isMobile));
    } catch (error) {
      console.error('💥 Erreur lors du traitement de la confirmation:', error);
      return res.status(500).send(this.getErrorPage());
    } finally {
      console.log('=== FIN CONFIRMATION EMAIL ===');
    }
  }

  @Get('reset-password')
  resetPassword(
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      console.log('🔍 Reset password - Query params reçus:', query);

      const userAgent = req.headers['user-agent'] || '';
      const isMobile =
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent,
        );

      const {
        access_token,
        refresh_token,
        expires_in,
        token_type,
        type,
        token,
        token_hash,
        error: supabaseError,
        error_description,
      } = query;

      // Gestion des erreurs
      if (supabaseError) {
        console.log('❌ Erreur de reset password Supabase:', supabaseError);
        return res.status(400).send(this.getResetPasswordErrorPage());
      }

      if (token || token_hash) {
        console.log('✅ Token de reset password détecté');

        const supabaseUrl = process.env.SUPABASE_URL;
        const baseUrl = req.protocol + '://' + req.get('host');
        const redirectUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token || token_hash)}&type=recovery&redirect_to=${encodeURIComponent(baseUrl + '/email/reset-password-form')}`;

        console.log('🔄 Redirection vers Supabase:', redirectUrl);
        return res.redirect(redirectUrl);
      }

      if (access_token && refresh_token) {
        console.log('✅ Tokens reçus, affichage du formulaire');
        return res.send(
          this.getResetPasswordForm(access_token, refresh_token, expires_in),
        );
      }

      console.log('⚠️ Aucun token détecté');
      return res.status(400).send(this.getResetPasswordErrorPage());
    } catch (error) {
      console.error('💥 Erreur lors du traitement du reset password:', error);
      return res.status(500).send(this.getResetPasswordErrorPage());
    }
  }

  @Get('reset-password-form')
  resetPasswordForm(@Query() query: any, @Res() res: Response) {
    console.log('🔍 Reset password form - Query params reçus:', query);

    const {
      access_token,
      refresh_token,
      expires_in,
      error,
      error_description,
    } = query;

    if (error) {
      console.log(
        '❌ Erreur dans reset-password-form:',
        error,
        error_description,
      );

      if (error === 'access_denied' && error_description?.includes('expired')) {
        return res.send(this.getTokenExpiredPage());
      }

      return res.status(400).send(this.getResetPasswordErrorPage());
    }

    if (!access_token) {
      console.log(
        '⚠️ Pas de tokens dans query, utilisation du fragment reader',
      );
      return res.send(this.getResetPasswordFragmentReader());
    }

    console.log('✅ Tokens trouvés dans query, affichage du formulaire');
    return res.send(
      this.getResetPasswordForm(access_token, refresh_token, expires_in),
    );
  }

  @Get('reset-password-error')
  resetPasswordError(@Res() res: Response) {
    return res.status(400).send(this.getResetPasswordErrorPage());
  }

  private getErrorPage(): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erreur de confirmation - Snapybara</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ff7b7b 0%, #d63384 100%);
          }
          .container {
            background: white;
            padding: 3rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 450px;
            width: 90%;
          }
          .error-icon {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin: 0 auto 2rem;
          }
          h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.8rem;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .btn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
            cursor: pointer;
            font-weight: 600;
          }
          .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #dc3545;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Snapybara</div>
          <div class="error-icon">✗</div>
          <h1>Erreur de confirmation</h1>
          <p>Le lien de confirmation est invalide, a expiré ou a déjà été utilisé.</p>
          <p>Veuillez demander un nouveau lien de confirmation depuis l'application.</p>
          <a href="https://play.google.com/store/apps/details?id=com.example.snapybara" class="btn">
            📱 Ouvrir l'application
          </a>
        </div>
      </body>
      </html>
    `;
  }

  private getSuccessPage(isMobile: boolean): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email confirmé - Snapybara</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
          }
          .container {
            background: white;
            padding: 3rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 450px;
            width: 90%;
          }
          .success-icon {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin: 0 auto 2rem;
          }
          h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.8rem;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .btn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            margin: 1rem 0.5rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,123,255,0.3);
          }
          .btn-secondary {
            background: linear-gradient(135deg, #6c757d, #5a6268);
          }
          .btn-secondary:hover {
            box-shadow: 0 8px 20px rgba(108,117,125,0.3);
          }
          .info-text {
            font-size: 0.9em;
            color: #888;
            margin-top: 1.5rem;
          }
          .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎯 Snapybara</div>
          <div class="success-icon">✓</div>
          <h1>Email confirmé !</h1>
          <p>Félicitations ! Votre adresse email a été confirmée avec succès. Votre compte Snapybara est maintenant actif.</p>
          
          ${
            isMobile
              ? `
            <a href="snapybara://email-confirmed" class="btn">
              🚀 Ouvrir l'application
            </a>
            <br>
            <a href="https://play.google.com/store/apps/details?id=com.example.snapybara" class="btn btn-secondary">
              📱 Télécharger l'app
            </a>
            <p class="info-text">
              L'application va s'ouvrir automatiquement dans quelques secondes...
            </p>
          `
              : `
            <p>Vous pouvez maintenant utiliser votre application mobile Snapybara.</p>
            <a href="https://play.google.com/store/apps/details?id=com.example.snapybara" class="btn">
              📱 Télécharger l'application
            </a>
          `
          }
        </div>
        
        ${
          isMobile
            ? `
          <script>
            setTimeout(() => {
              window.location.href = 'snapybara://email-confirmed';
            }, 3000);
            
            setTimeout(() => {
              if (document.visibilityState === 'visible') {
                window.location.href = 'https://play.google.com/store/apps/details?id=com.example.snapybara';
              }
            }, 6000);
          </script>
        `
            : ''
        }
      </body>
      </html>
    `;
  }

  private getFragmentReaderPage(isMobile: boolean): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation en cours - Snapybara</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
          }
          .container {
            background: white;
            padding: 3rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 450px;
            width: 90%;
          }
          .loading {
            font-size: 2rem;
            margin-bottom: 1rem;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎯 Snapybara</div>
          <div class="loading">⏳</div>
          <h1>Vérification en cours...</h1>
          <p>Nous vérifions votre confirmation d'email.</p>
        </div>
        
        <script>
          function parseFragment() {
            const fragment = window.location.hash.substring(1);
            const params = new URLSearchParams(fragment);
            
            console.log('Fragment détecté:', fragment);
            
            const accessToken = params.get('access_token');
            const error = params.get('error');
            const type = params.get('type');
            
            if (error) {
              console.error('Erreur dans le fragment:', error);
              showError();
              return;
            }
            
            if (accessToken || type === 'signup') {
              console.log('Confirmation réussie détectée');
              showSuccess();
              return;
            }
            
            console.log('Aucun paramètre de confirmation trouvé');
            showError();
          }
          
          function showSuccess() {
            window.location.href = '/email/confirm?confirmed=true';
          }
          
          function showError() {
            window.location.href = '/email/confirm?error=invalid_token';
          }
          
          parseFragment();
        </script>
      </body>
      </html>
    `;
  }

  private getTokenExpiredPage(): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lien expiré - SnapyBara</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 450px;
            text-align: center;
          }
          
          .logo {
            margin-bottom: 30px;
          }
          
          .logo h1 {
            color: #ff8c00;
            font-size: 28px;
            margin-bottom: 8px;
          }
          
          .icon {
            font-size: 64px;
            margin: 20px 0;
          }
          
          h2 {
            color: #333;
            margin-bottom: 16px;
            font-size: 24px;
          }
          
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 16px;
          }
          
          .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 8px;
            transition: background 0.3s;
          }
          
          .btn:hover {
            background: #5a6fd8;
          }
          
          .btn-secondary {
            background: #6c757d;
          }
          
          .btn-secondary:hover {
            background: #5a6268;
          }
          
          .steps {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
          }
          
          .step {
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
          }
          
          .step:last-child {
            border-bottom: none;
          }
          
          .step-number {
            background: #667eea;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            margin-right: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>🦌 SnapyBara</h1>
          </div>
          
          <div class="icon">⏰</div>
          
          <h2>Lien de réinitialisation expiré</h2>
          
          <p>Ce lien de réinitialisation de mot de passe a expiré. Les liens de sécurité expirent après 1 heure pour protéger votre compte.</p>
          
          <div class="steps">
            <div class="step">
              <span class="step-number">1</span>
              Ouvrez l'application SnapyBara
            </div>
            <div class="step">
              <span class="step-number">2</span>
              Cliquez sur "Mot de passe oublié ?"
            </div>
            <div class="step">
              <span class="step-number">3</span>
              Entrez votre email
            </div>
            <div class="step">
              <span class="step-number">4</span>
              Vérifiez votre boîte mail pour le nouveau lien
            </div>
          </div>
          
          <p><strong>Astuce :</strong> Utilisez le lien de réinitialisation dès que vous le recevez pour éviter qu'il expire.</p>
          
          <a href="snapybara://reset-password" class="btn">
            📱 Ouvrir l'application
          </a>
          
          <br>
          
          <a href="https://play.google.com/store/apps/details?id=com.example.snapybara" class="btn btn-secondary">
            📲 Télécharger l'app
          </a>
        </div>
        
        <script>
          // Tentative d'ouverture automatique de l'app
          setTimeout(() => {
            window.location.href = 'snapybara://reset-password';
          }, 2000);
        </script>
      </body>
      </html>
    `;
  }

  private getResetPasswordErrorPage(): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erreur de réinitialisation - Snapybara</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          }
          .container {
            background: white;
            padding: 3rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 450px;
            width: 90%;
          }
          .error-icon {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin: 0 auto 2rem;
          }
          h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.8rem;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .btn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
            cursor: pointer;
            font-weight: 600;
          }
          .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #dc3545;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">Snapybara</div>
          <div class="error-icon">🔒</div>
          <h1>Erreur de réinitialisation</h1>
          <p>Le lien de réinitialisation de mot de passe est invalide, a expiré ou a déjà été utilisé.</p>
          <p>Veuillez demander un nouveau lien de réinitialisation depuis l'application.</p>
          <a href="https://play.google.com/store/apps/details?id=com.example.snapybara" class="btn">
            📱 Ouvrir l'application
          </a>
        </div>
      </body>
      </html>
    `;
  }

  private getResetPasswordForm(
    accessToken: string,
    refreshToken: string = '',
    expiresIn: string = '3600',
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Changer le mot de passe - SnapyBara</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 400px;
          }
          
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .logo h1 {
            color: #667eea;
            font-size: 28px;
            margin-bottom: 8px;
          }
          
          .logo p {
            color: #666;
            font-size: 14px;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
          }
          
          input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
          }
          
          input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
          }
          
          .btn {
            width: 100%;
            padding: 14px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
          }
          
          .btn:hover {
            background: #5a6fd8;
          }
          
          .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          
          .error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c00;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
          }
          
          .success {
            background: #efe;
            border: 1px solid #cfc;
            color: #060;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
          }
          
          .loading {
            display: none;
            text-align: center;
            margin-top: 10px;
          }
          
          .password-requirements {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          
          .requirement {
            margin: 2px 0;
          }
          
          .requirement.valid {
            color: #060;
          }
          
          .requirement.invalid {
            color: #c00;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>🦌 SnapyBara</h1>
            <p>Choisissez votre nouveau mot de passe</p>
          </div>
          
          <div id="error-message" class="error" style="display: none;"></div>
          <div id="success-message" class="success" style="display: none;"></div>
          
          <form id="reset-form">
            <div class="form-group">
              <label for="password">Nouveau mot de passe</label>
              <input type="password" id="password" name="password" required>
              <div class="password-requirements">
                <div class="requirement" id="req-length">• Au moins 6 caractères</div>
              </div>
            </div>
            
            <div class="form-group">
              <label for="confirm-password">Confirmer le mot de passe</label>
              <input type="password" id="confirm-password" name="confirm-password" required>
            </div>
            
            <button type="submit" class="btn" id="submit-btn" disabled>Changer le mot de passe</button>
            
            <div class="loading" id="loading">
              <p>Changement en cours...</p>
            </div>
          </form>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <script>
          // Configuration Supabase
          const supabaseUrl = '${process.env.SUPABASE_URL}';
          const supabaseKey = '${process.env.SUPABASE_ANON_KEY}';
          const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

          // Tokens de session
          const accessToken = '${accessToken}';
          const refreshToken = '${refreshToken}';
          const expiresIn = parseInt('${expiresIn}');

          // Éléments DOM
          const form = document.getElementById('reset-form');
          const passwordInput = document.getElementById('password');
          const confirmPasswordInput = document.getElementById('confirm-password');
          const submitBtn = document.getElementById('submit-btn');
          const loading = document.getElementById('loading');
          const errorMessage = document.getElementById('error-message');
          const successMessage = document.getElementById('success-message');

          // Établir la session automatiquement
          window.addEventListener('load', async () => {
            try {
              console.log('Établissement de la session...');
              
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) {
                throw error;
              }
              
              console.log('Session établie avec succès');
              showSuccess('✅ Session établie. Vous pouvez changer votre mot de passe.');
              
            } catch (error) {
              console.error('Erreur session:', error);
              showError('Erreur lors de l\\'établissement de la session: ' + error.message);
            }
          });

          // Validation en temps réel
          passwordInput.addEventListener('input', validateForm);
          confirmPasswordInput.addEventListener('input', validateForm);

          function validateForm() {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Validation longueur
            const lengthReq = document.getElementById('req-length');
            if (password.length >= 6) {
              lengthReq.classList.add('valid');
              lengthReq.classList.remove('invalid');
            } else {
              lengthReq.classList.add('invalid');
              lengthReq.classList.remove('valid');
            }
            
            // Validation correspondance
            const isValid = password.length >= 6 && 
                           password === confirmPassword &&
                           confirmPassword.length > 0;
            
            submitBtn.disabled = !isValid;
          }

          // Gestion du formulaire
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Cacher messages précédents
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
            
            // Validation
            if (password !== confirmPassword) {
              showError('Les mots de passe ne correspondent pas');
              return;
            }
            
            if (password.length < 6) {
              showError('Le mot de passe doit contenir au moins 6 caractères');
              return;
            }
            
            // Afficher loading
            submitBtn.style.display = 'none';
            loading.style.display = 'block';
            
            try {
              // Changer le mot de passe avec Supabase
              const { data, error } = await supabase.auth.updateUser({
                password: password
              });
              
              if (error) {
                throw error;
              }
              
              // Succès !
              form.style.display = 'none';
              successMessage.innerHTML = \`
                <div style="text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                  <h3 style="margin-bottom: 12px;">Mot de passe changé !</h3>
                  <p style="margin-bottom: 20px;">Votre mot de passe a été mis à jour avec succès.</p>
                  <p style="font-size: 12px; color: #666;">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                  <div style="margin-top: 20px;">
                    <a href="snapybara://password-changed" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                      📱 Retour à l'app
                    </a>
                  </div>
                </div>
              \`;
              successMessage.style.display = 'block';
              
              // Tentative de redirection vers l'app
              setTimeout(() => {
                window.location.href = 'snapybara://password-changed';
              }, 2000);
              
            } catch (error) {
              console.error('Erreur:', error);
              showError('Erreur lors du changement de mot de passe: ' + error.message);
              
              // Réafficher le bouton
              submitBtn.style.display = 'block';
              loading.style.display = 'none';
            }
          });

          function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
          }

          function showSuccess(message) {
            successMessage.innerHTML = message;
            successMessage.style.display = 'block';
          }
        </script>
      </body>
      </html>
    `;
  }

  private getResetPasswordFragmentReader(): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redirection - SnapyBara</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 400px;
            text-align: center;
          }
          
          .loading {
            font-size: 2rem;
            margin-bottom: 1rem;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .logo h1 {
            color: #667eea;
            font-size: 28px;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>🦌 SnapyBara</h1>
          </div>
          <div class="loading">⏳</div>
          <h2>Redirection en cours...</h2>
          <p>Nous préparons votre formulaire de réinitialisation...</p>
        </div>
        
        <script>
          function parseFragmentAndRedirect() {
            console.log('🔍 Lecture du fragment URL...');
            const fragment = window.location.hash.substring(1);
            console.log('Fragment détecté:', fragment);
            
            if (!fragment) {
              console.log('❌ Aucun fragment trouvé');
              window.location.href = '/email/reset-password-error';
              return;
            }
            
            const params = new URLSearchParams(fragment);
            
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresIn = params.get('expires_in');
            const tokenType = params.get('token_type');
            const type = params.get('type');
            const error = params.get('error');
            
            console.log('Tokens trouvés:', {
              access_token: !!accessToken,
              refresh_token: !!refreshToken,
              type: type,
              error: error
            });
            
            if (error) {
              console.log('❌ Erreur dans le fragment:', error);
              window.location.href = '/email/reset-password-error';
              return;
            }
            
            if (accessToken && type === 'recovery') {
              console.log('✅ Token de recovery trouvé, redirection vers formulaire...');
              
              // Construire l'URL avec les paramètres en query string
              const queryParams = new URLSearchParams({
                access_token: accessToken,
                refresh_token: refreshToken || '',
                expires_in: expiresIn || '3600',
                token_type: tokenType || 'bearer'
              });
              
              const redirectUrl = '/email/reset-password-form?' + queryParams.toString();
              console.log('🔄 Redirection vers:', redirectUrl);
              
              window.location.href = redirectUrl;
            } else {
              console.log('❌ Tokens manquants ou type incorrect');
              window.location.href = '/email/reset-password-error';
            }
          }
          
          // Lancer la redirection au chargement
          window.addEventListener('load', parseFragmentAndRedirect);
          
          // Fallback au cas où load ne se déclenche pas
          setTimeout(parseFragmentAndRedirect, 1000);
        </script>
      </body>
      </html>
    `;
  }
}
