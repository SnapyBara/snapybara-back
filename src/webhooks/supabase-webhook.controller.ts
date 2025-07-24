import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('webhooks')
@Controller('webhooks')
export class SupabaseWebhookController {
  private readonly logger = new Logger(SupabaseWebhookController.name);

  constructor(private usersService: UsersService) {}

  @Post('supabase/auth')
  @Public() // ✅ Webhook public - appelé par Supabase
  @ApiOperation({ summary: 'Handle Supabase authentication events' })
  async handleSupabaseAuthEvent(
    @Body() payload: any,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      this.logger.log(
        `Processing webhook: ${payload.type} on table ${payload.table}`,
      );

      if (!authHeader?.includes('Bearer')) {
        throw new HttpException(
          'Unauthorized webhook',
          HttpStatus.UNAUTHORIZED,
        );
      }

      switch (payload.type) {
        case 'INSERT':
          if (payload.table === 'users' && payload.record) {
            await this.handleUserSignup(payload.record);
          }
          break;

        case 'UPDATE':
          if (payload.table === 'users' && payload.record) {
            await this.handleUserUpdate(payload.record);
          }
          break;

        default:
          this.logger.warn(`Unhandled webhook type: ${payload.type}`);
      }

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleUserSignup(supabaseUser: any) {
    try {
      this.logger.log(`New user signup: ${supabaseUser.email}`);

      const mongoUser = await this.usersService.syncWithSupabase(supabaseUser);

      this.logger.log(
        `User created in MongoDB: ${mongoUser.username} (ID: ${mongoUser._id?.toString()})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle user signup for ${supabaseUser.email}:`,
        error,
      );
    }
  }

  private async handleUserUpdate(supabaseUser: any) {
    try {
      this.logger.log(`User update detected: ${supabaseUser.email}`);

      const mongoUser = await this.usersService.syncWithSupabase(supabaseUser);

      this.logger.log(`User updated in MongoDB: ${mongoUser.username}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle user update for ${supabaseUser.email}:`,
        error,
      );
    }
  }
}
