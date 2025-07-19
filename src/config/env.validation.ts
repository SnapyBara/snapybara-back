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

// Validation simplifiée - seulement les variables essentielles
export function validateEnvironment(config: Record<string, unknown>) {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const varName of requiredVars) {
    if (!config[varName]) {
      throw new Error(`Configuration validation error: ${varName} is required`);
    }
  }

  return config;
}
