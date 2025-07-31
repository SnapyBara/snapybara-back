import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get supabaseUrl(): string {
    const url = process.env.SUPABASE_URL;
    if (!url) {
      throw new Error('SUPABASE_URL is not defined in environment variables');
    }
    return url;
  }

  get supabaseAnonKey(): string {
    const key = process.env.SUPABASE_ANON_KEY;
    if (!key) {
      throw new Error(
        'SUPABASE_ANON_KEY is not defined in environment variables',
      );
    }
    return key;
  }

  get supabaseServiceKey(): string {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables',
      );
    }
    return key;
  }

  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }
}

// Validation des variables d'environnement - essentielles et sécurité
export function validateEnvironment(config: Record<string, unknown>) {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MONGODB_URI',
  ];

  const optionalVars = [
    'SUPABASE_JWT_SECRET',
    'SUPABASE_PROJECT_REF',
    'THROTTLE_TTL',
    'THROTTLE_LIMIT',
    'PORT',
    'NODE_ENV',
    'GOOGLE_PLACES_API_KEY', // Optionnel car l'app fonctionne sans
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
  ];

  // Vérifier les variables obligatoires
  for (const varName of requiredVars) {
    if (!config[varName]) {
      throw new Error(`Configuration validation error: ${varName} is required`);
    }
  }

  // Avertissement si Google Places API key n'est pas configurée
  if (!config.GOOGLE_PLACES_API_KEY) {
    console.warn('Warning: GOOGLE_PLACES_API_KEY is not configured. Google Places features will be disabled.');
  }
  
  // Avertissement si Redis n'est pas configuré
  if (!config.REDIS_HOST) {
    console.warn('Warning: Redis is not configured. Cache will be disabled.');
  }

  // Ajouter des valeurs par défaut pour les variables optionnelles
  const validatedConfig = { ...config };
  
  if (!validatedConfig.THROTTLE_TTL) {
    validatedConfig.THROTTLE_TTL = '60';
  }
  
  if (!validatedConfig.THROTTLE_LIMIT) {
    validatedConfig.THROTTLE_LIMIT = '100';
  }
  
  if (!validatedConfig.PORT) {
    validatedConfig.PORT = '3000';
  }
  
  if (!validatedConfig.NODE_ENV) {
    validatedConfig.NODE_ENV = 'development';
  }

  return validatedConfig;
}
