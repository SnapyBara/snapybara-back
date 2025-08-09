import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SimpleJwtAuthGuard } from './guards/simple-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OwnerGuard } from './guards/owner.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SUPABASE_JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    JwtStrategy,
    JwtAuthGuard,
    SimpleJwtAuthGuard,
    RolesGuard,
    OwnerGuard
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    SimpleJwtAuthGuard,
    RolesGuard,
    OwnerGuard
  ],
})
export class AuthModule {}
