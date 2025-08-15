import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { Public } from '../auth/decorators/public.decorator';
import * as crypto from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks')
export class SupabaseWebhookController {
  private readonly logger = new Logger(SupabaseWebhookController.name);

  constructor(private usersService: UsersService) {}

  @Post('supabase')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Supabase authentication events' })
  async handleSupabaseAuthEvent(
    @Body() payload: any,
    @Headers('x-supabase-signature') signature?: string,
  ) {
    try {
      this.logger.log(
        `Processing webhook: ${payload?.type} on table ${payload?.table}`,
      );

      if (!signature) {
        throw new HttpException(
          'Missing webhook signature',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const expectedSignature = crypto
        .createHmac('sha256', process.env.SUPABASE_WEBHOOK_SECRET || '')
        .update(JSON.stringify(payload ?? {}))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new HttpException(
          'Invalid webhook signature',
          HttpStatus.UNAUTHORIZED,
        );
      }

      switch (payload?.type) {
        case 'INSERT':
          if (
            (payload.table === 'users' || payload.table === 'auth.users') &&
            payload.record
          ) {
            await this.handleUserSignup(payload.record);
          }
          break;

        case 'UPDATE':
          if (
            (payload.table === 'users' || payload.table === 'auth.users') &&
            payload.record
          ) {
            await this.handleUserUpdate(payload.record);
          }
          break;

        case 'DELETE':
          if (
            (payload.table === 'users' || payload.table === 'auth.users') &&
            payload.old_record
          ) {
            await this.handleUserDelete(payload.old_record);
          }
          break;

        default:
          this.logger.warn(`Unhandled webhook type: ${payload?.type}`);
      }

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error('Webhook processing failed:', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleUserSignup(supabaseUser: any) {
    try {
      await this.usersService.syncWithSupabase(supabaseUser);
    } catch (error) {
      this.logger.error(
        `Failed to handle user signup for ${supabaseUser?.email}:`,
        error,
      );
    }
  }

  private async handleUserUpdate(supabaseUser: any) {
    try {
      this.logger.log(`User update detected: ${supabaseUser?.email}`);
      const mongoUser = await this.usersService.syncWithSupabase(supabaseUser);
      this.logger.log(`User updated in MongoDB: ${mongoUser?.username}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle user update for ${supabaseUser?.email}:`,
        error,
      );
    }
  }

  private async handleUserDelete(supabaseUser: any) {
    try {
      this.logger.log(`User deletion detected: ${supabaseUser?.email}`);
      const mongoUser = await this.usersService.findBySupabaseId(
        supabaseUser.id,
      );
      if (mongoUser) {
        mongoUser.isActive = false;
        await mongoUser.save();
        this.logger.log(`User soft deleted in MongoDB: ${mongoUser.username}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle user deletion for ${supabaseUser?.email}:`,
        error,
      );
    }
  }
}
