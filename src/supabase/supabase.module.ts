import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SupabaseService, SUPABASE_MODULE_OPTIONS } from './supabase.service';
import {
  SupabaseModuleOptions,
  SupabaseModuleAsyncOptions,
  SupabaseOptionsFactory,
} from './interfaces/supabase-module-options.interface';

@Module({})
export class SupabaseModule {
  static forRoot(options: SupabaseModuleOptions): DynamicModule {
    return {
      module: SupabaseModule,
      global: true,
      providers: [
        {
          provide: SUPABASE_MODULE_OPTIONS,
          useValue: options,
        },
        SupabaseService,
      ],
      exports: [SupabaseService],
    };
  }

  static forRootAsync(options: SupabaseModuleAsyncOptions): DynamicModule {
    return {
      module: SupabaseModule,
      global: true,
      imports: options.imports || [],
      providers: [...this.createAsyncProviders(options), SupabaseService],
      exports: [SupabaseService],
    };
  }

  private static createAsyncProviders(
    options: SupabaseModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: SupabaseModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: SUPABASE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: SUPABASE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: SupabaseOptionsFactory) =>
        optionsFactory.createSupabaseOptions(),
      inject: [options.useExisting! || options.useClass!],
    };
  }
}
