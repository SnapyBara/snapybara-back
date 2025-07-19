import { Injectable, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseModuleOptions } from './interfaces/supabase-module-options.interface';

export const SUPABASE_MODULE_OPTIONS = 'SUPABASE_MODULE_OPTIONS';

@Injectable()
export class SupabaseService {
  private readonly supabase: SupabaseClient;
  private readonly supabase_admin: SupabaseClient;

  constructor(
    @Inject(SUPABASE_MODULE_OPTIONS)
    private readonly options: SupabaseModuleOptions,
  ) {
    this.supabase = createClient(
      this.options.supabaseUrl,
      this.options.supabaseKey,
      this.options.supabaseOptions ?? {},
    );
    this.supabase_admin = createClient(
      this.options.supabaseUrl,
      this.options.supabaseServiceKey,
      this.options.supabaseOptions ?? {},
    );
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  getAdminClient(): SupabaseClient {
    return this.supabase_admin;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async getUserByEmail(email: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    return { data, error };
  }

  async updateUserProfile(userId: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    return { data, error };
  }

  async createUserProfile(userData: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert([userData]);

    return { data, error };
  }

  async getUser(jwt?: string) {
    return this.supabase.auth.getUser(jwt);
  }

  get db() {
    return this.supabase;
  }

  get storage() {
    return this.supabase.storage;
  }

  get realtime() {
    return this.supabase.realtime;
  }

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
