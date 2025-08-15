import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import helmet from 'helmet';
import * as session from 'express-session';
import rateLimit from 'express-rate-limit';

export function setupTestApp(app: INestApplication): void {
  // Cast to NestExpressApplication for static assets
  const nestApp = app as unknown as NestExpressApplication;

  // Configuration de session
  nestApp.use(
    session({
      secret: 'test-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
      },
    }),
  );

  // Configuration Helmet pour les tests
  nestApp.use(
    helmet({
      contentSecurityPolicy: false, // Désactivé pour les tests
      hsts: false, // Désactivé pour les tests
    }),
  );

  // Rate limiting désactivé pour les tests en CI
  if (process.env.CI !== 'true') {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000, // Plus élevé pour les tests
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });
    nestApp.use(limiter);
  }

  // Configuration des fichiers statiques
  nestApp.useStaticAssets(path.join(__dirname, '..', '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Pipes de validation
  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS pour les tests
  nestApp.enableCors({
    origin: '*',
    credentials: true,
  });
}
