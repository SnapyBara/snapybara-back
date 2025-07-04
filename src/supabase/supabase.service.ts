import { Injectable, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

  /**
   * Retourne le client Supabase
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Vérifie si un utilisateur existe par email
   */
  async getUserByEmail(email: string) {
    const { data, error } = await this.supabase
      .from('profiles') // ou 'users' selon votre structure
      .select('*')
      .eq('email', email)
      .single();

    return { data, error };
  }

  /**
   * Met à jour le profil utilisateur
   */
  async updateUserProfile(userId: string, updates: any) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    return { data, error };
  }

  /**
   * Crée un nouveau profil utilisateur
   */
  async createUserProfile(userData: any) {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert([userData]);

    return { data, error };
  }

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
