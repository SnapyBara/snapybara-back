import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files for uploads
  app.useStaticAssets(path.join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3005', // Port de l'admin React
      'http://localhost:5173', // Vite dev server par défaut
      'http://localhost:5174', // Port alternatif si 5173 est pris
      'http://10.37.0.14:3000',
      'http://10.37.0.15:3000',
    ],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('SnapyBara API')
    .setDescription(
      `## 📱 SnapyBara Backend API
      
      API pour l'application SnapyBara - Découverte photo et géolocalisation.
      
      ### 🔐 Authentification
      
      L'API utilise **Supabase JWT** pour l'authentification. Les endpoints protégés nécessitent un token Bearer.
      
      **Flux d'authentification :**
      1. L'app Android s'authentifie avec Google via Supabase
      2. Supabase retourne un JWT token
      3. L'app utilise ce token pour appeler les endpoints protégés
      
      ### 🚀 Utilisation
      
      1. Obtenez un token JWT depuis Supabase
      2. Cliquez sur "Authorize" ci-dessous
      3. Entrez votre token au format: \`Bearer your_jwt_token\`
      4. Testez les endpoints !
      
      ### 📊 Endpoints disponibles
      
      - **Public** : Status, Health checks
      - **Protégé** : Profile, Dashboard, Favorites, Settings
      `,
    )
    .setVersion('1.0.0')
    .addTag('auth', 'Authentication and user management')
    .addTag('protected', 'Protected user endpoints')
    .addTag('public', 'Public endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Supabase JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.snapybara.com', 'Production server')
    .setContact(
      'SnapyBara Team',
      'https://snapybara.com',
      'contact@snapybara.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'SnapyBara API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .topbar-wrapper img { content: url('/logo.png'); width: 40px; height: auto; }
      .swagger-ui .topbar { background-color: #2c3e50; }
      .swagger-ui .topbar-wrapper .link { color: #ecf0f1; }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .info .description { color: #34495e; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  });

  SwaggerModule.setup('api-docs-json', app, document);

  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(`📚 Swagger documentation: ${await app.getUrl()}/api-docs`);
  console.log(`📄 API JSON: ${await app.getUrl()}/api-docs-json`);
}

void bootstrap();
