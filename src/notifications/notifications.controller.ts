import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async findByUser(
    @Request() req,
    @Query('isRead') isRead?: boolean,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    console.log('GET /notifications - req.user:', req.user);

    // Obtenir l'utilisateur MongoDB à partir du Supabase ID
    const supabaseId = req.user.sub || req.user.id;
    console.log('Searching for user with Supabase ID:', supabaseId);

    const user = await this.usersService.findBySupabaseId(supabaseId);
    console.log('Found MongoDB user:', user?._id?.toString());

    if (!user || !user._id) {
      console.log('User not found in MongoDB');
      return { data: [], total: 0, unreadCount: 0, page: 1, limit: 20 };
    }

    const result = await this.notificationsService.findByUser(
      user._id.toString(),
      {
        isRead,
        type,
        page,
        limit,
      },
    );

    console.log(
      `Found ${result.data.length} notifications for user ${user._id.toString()}`,
    );

    // Formater les notifications pour s'assurer que l'ID est bien une string
    const formattedData = result.data.map((notification) => ({
      id: notification._id?.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      userId: notification.userId?.toString(),
    }));

    return {
      ...result,
      data: formattedData,
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findBySupabaseId(req.user.sub);
    if (!user || !user._id) {
      throw new Error('User not found');
    }
    return this.notificationsService.markAsRead(id, user._id.toString());
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Request() req) {
    const user = await this.usersService.findBySupabaseId(req.user.sub);
    if (!user || !user._id) {
      throw new Error('User not found');
    }
    return this.notificationsService.markAllAsRead(user._id.toString());
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(@Param('id') id: string, @Request() req) {
    const user = await this.usersService.findBySupabaseId(req.user.sub);
    if (!user || !user._id) {
      throw new Error('User not found');
    }
    return this.notificationsService.deleteNotification(
      id,
      user._id.toString(),
    );
  }

  @Post('clear-old')
  @ApiOperation({ summary: 'Clear old notifications' })
  @ApiResponse({ status: 200, description: 'Old notifications cleared' })
  async clearOldNotifications(
    @Request() req,
    @Query('daysToKeep') daysToKeep?: number,
  ) {
    const user = await this.usersService.findBySupabaseId(req.user.sub);
    if (!user || !user._id) {
      throw new Error('User not found');
    }
    return this.notificationsService.clearOldNotifications(
      user._id.toString(),
      daysToKeep,
    );
  }
}
