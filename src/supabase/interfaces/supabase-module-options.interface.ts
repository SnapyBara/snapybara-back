import { ModuleMetadata, Type } from '@nestjs/common';

export interface SupabaseModuleOptions {
  supabaseUrl: string;
  supabaseKey: string;
  supabaseOptions?: Record<string, any>;
}

export interface SupabaseOptionsFactory {
  createSupabaseOptions():
    | Promise<SupabaseModuleOptions>
    | SupabaseModuleOptions;
}

export interface SupabaseModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<SupabaseOptionsFactory>;
  useClass?: Type<SupabaseOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<SupabaseModuleOptions> | SupabaseModuleOptions;
  inject?: any[];
}
