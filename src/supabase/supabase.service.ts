import { Injectable, Inject } from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseModuleOptions } from './interfaces/supabase-module-options.interface';

export const SUPABASE_MODULE_OPTIONS = 'SUPABASE_MODULE_OPTIONS';

@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor(
    @Inject(SUPABASE_MODULE_OPTIONS)
    private readonly options: SupabaseModuleOptions,
  ) {
    this.supabase = createClient(
      this.options.supabaseUrl,
      this.options.supabaseKey,
      this.options.supabaseOptions || {},
    );
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // Auth methods
  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  async getUser(jwt?: string) {
    return this.supabase.auth.getUser(jwt);
  }

  async refreshSession(refreshToken: string) {
    return this.supabase.auth.refreshSession({ refresh_token: refreshToken });
  }

  async resetPasswordForEmail(email: string) {
    return this.supabase.auth.resetPasswordForEmail(email);
  }

  // Database methods
  get db() {
    return this.supabase;
  }

  // Storage methods
  get storage() {
    return this.supabase.storage;
  }

  // Realtime methods
  get realtime() {
    return this.supabase.realtime;
  }

  // Helper method to set auth for server-side operations
  setAuth(token: string): SupabaseClient {
    return createClient(this.options.supabaseUrl, this.options.supabaseKey, {
      ...this.options.supabaseOptions,
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
}
