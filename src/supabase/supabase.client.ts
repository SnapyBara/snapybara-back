import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '../config/env.validation';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    const configService = new ConfigService();
    supabaseInstance = createClient(
      configService.supabaseUrl,
      configService.supabaseAnonKey,
    );
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
