import {
  Controller,
  Get,
  Res,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(@Res() res: Response) {
    const healthInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      version: '1.0.0',
    };

    return res.status(HttpStatus.OK).json(healthInfo);
  }

  @Get('info')
  getApiInfo(@Res() res: Response) {
    const apiInfo = {
      name: 'SnapyBara API',
      version: '1.0.0',
      description: "API REST/GraphQL pour l'application SnapyBara",
      endpoints: {
        auth: '/auth/*',
        users: '/users/*',
        points: '/points/*',
        health: '/health',
      },
      documentation: '/api/docs',
    };

    return res.status(HttpStatus.OK).json(apiInfo);
  }

  @Get('docs')
  getDocs(@Res() res: Response) {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SnapyBara API - Documentation</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 25px; }
            .endpoint { 
                background-color: #f8f9fa; 
                padding: 15px; 
                margin: 10px 0; 
                border-left: 4px solid #007bff;
                border-radius: 4px;
            }
            .method { 
                font-weight: bold; 
                color: white; 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-size: 12px;
                margin-right: 10px;
            }
            .get { background-color: #28a745; }
            .post { background-color: #007bff; }
            .put { background-color: #ffc107; color: #000; }
            .delete { background-color: #dc3545; }
            code { 
                background-color: #e9ecef; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-family: 'Courier New', monospace;
            }
            .status { color: #28a745; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐹 SnapyBara API</h1>
            <p><span class="status">✅ API en ligne</span> - Version 1.0.0</p>
            
            <h2>📋 Endpoints disponibles</h2>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/health</code> - Statut de santé de l'API
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/info</code> - Informations sur l'API
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/login</code> - Connexion utilisateur
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/register</code> - Inscription utilisateur
            </div>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <code>/auth/google</code> - Authentification Google
            </div>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <code>/users/profile</code> - Profil utilisateur connecté
            </div>
            
            <h2>🔧 Configuration</h2>
            <p>
                <strong>Base URL:</strong> <code>${process.env.API_BASE_URL ?? 'http://localhost:3000'}</code><br>
                <strong>Environment:</strong> <code>${process.env.NODE_ENV ?? 'development'}</code><br>
                <strong>Database:</strong> MongoDB + Supabase Auth<br>
                <strong>Services:</strong> Google Auth, Firebase Messaging, Google Maps API
            </p>
            
            <h2>📚 Ressources</h2>
            <ul>
                <li><a href="/health">Vérifier la santé de l'API</a></li>
                <li><a href="/info">Informations détaillées</a></li>
                <li><a href="https://supabase.com/docs">Documentation Supabase</a></li>
                <li><a href="https://docs.nestjs.com">Documentation NestJS</a></li>
            </ul>
            
            <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
                <p>SnapyBara API © 2025 - Développé avec ❤️ et NestJS</p>
            </footer>
        </div>
    </body>
    </html>
    `;

    return res.status(HttpStatus.OK).send(htmlContent);
  }

  @Get('auth/reset-v2')
  legacyPasswordResetRedirect(@Query() query: Record<string, string>, @Res() res: Response) {
    console.log(
      '🔄 Redirection depuis legacy /auth/reset-v2 vers /email/reset-password-form',
    );
    console.log('📋 Query params reçus:', query);

    const queryString = new URLSearchParams(query).toString();
    const redirectUrl = `/email/reset-password-form?${queryString}`;

    console.log('➡️ Redirection vers:', redirectUrl);
    return res.redirect(redirectUrl);
  }
}
