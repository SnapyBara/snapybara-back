import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', '*'], // Ajuster selon vos besoins
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Extraire le token JWT de la requête
      const token = this.extractTokenFromClient(client);

      if (!token) {
        this.logger.error('No token provided');
        client.disconnect();
        return;
      }

      // Vérifier le token Supabase et récupérer l'utilisateur
      const user = await this.verifySupabaseToken(token);

      if (!user) {
        this.logger.error('Invalid token or user not found');
        client.disconnect();
        return;
      }

      // Utiliser mongoId au lieu de id
      const userId = user.mongoId;

      if (!userId) {
        this.logger.error('User ID not found in token validation');
        client.disconnect();
        return;
      }

      // Stocker la connexion
      client.data.userId = userId;

      if (!this.connectedClients.has(userId)) {
        this.connectedClients.set(userId, new Set());
      }
      const userSockets = this.connectedClients.get(userId);
      if (userSockets) {
        userSockets.add(client.id);
      }

      // Rejoindre une room spécifique à l'utilisateur
      client.join(`user:${userId}`);

      this.logger.log(
        `Client connected: ${client.id} for user ${user.email} (${userId})`,
      );

      // Envoyer les notifications non lues
      const { data: unreadNotifications, unreadCount } =
        await this.notificationsService.findByUser(userId, { isRead: false });

      // S'assurer que chaque notification a bien un ID string
      const notificationsToSend = unreadNotifications.map((notification) => ({
        id: notification._id?.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead || false,
        createdAt: notification.createdAt,
        userId: notification.userId?.toString(),
      }));

      this.logger.log(
        `Sending ${notificationsToSend.length} initial notifications with IDs: ${notificationsToSend.map((n) => n.id).join(', ')}`,
      );

      client.emit('initial_notifications', {
        notifications: notificationsToSend,
        unreadCount,
      });
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId && this.connectedClients.has(userId)) {
      const socketIds = this.connectedClients.get(userId);
      if (socketIds) {
        socketIds.delete(client.id);

        if (socketIds.size === 0) {
          this.connectedClients.delete(userId);
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Méthode pour envoyer une notification à un utilisateur spécifique
  async sendNotificationToUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: any;
    },
  ) {
    try {
      // Créer la notification dans la base de données
      const savedNotification = await this.notificationsService.create({
        userId,
        ...notification,
      });

      this.logger.log(
        `Created notification with ID: ${savedNotification._id} for user ${userId}`,
      );

      // S'assurer que l'objet envoyé contient bien l'ID et le convertir en string
      const notificationToSend = {
        id: savedNotification._id?.toString(),
        type: savedNotification.type,
        title: savedNotification.title,
        message: savedNotification.message,
        data: savedNotification.data,
        isRead: savedNotification.isRead || false,
        createdAt: savedNotification.createdAt,
        userId: savedNotification.userId?.toString(),
      };

      this.logger.log(
        `Sending notification via WebSocket: ${JSON.stringify(notificationToSend)}`,
      );

      // Envoyer la notification via WebSocket si l'utilisateur est connecté
      this.server
        .to(`user:${userId}`)
        .emit('new_notification', notificationToSend);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  // Méthode pour notifier un gain de points
  async notifyPointsEarned(
    userId: string,
    points: number,
    reason: string,
    newTotal?: number,
  ) {
    const notification = {
      type: 'achievement_earned', // Changé de 'points_earned' à 'achievement_earned'
      title: 'Points gagnés !',
      message: `Vous avez gagné ${points} points pour ${reason}`,
      data: {
        points,
        reason,
        newTotal,
        entityType: 'points',
      },
    };

    await this.sendNotificationToUser(userId, notification);
  }

  // Méthode pour notifier un nouveau niveau atteint
  async notifyLevelUp(
    userId: string,
    newLevel: number,
    achievements?: string[],
  ) {
    const notification = {
      type: 'achievement_earned', // Changé de 'level_up' à 'achievement_earned'
      title: `Niveau ${newLevel} atteint !`,
      message: `Félicitations ! Vous êtes maintenant niveau ${newLevel}`,
      data: {
        level: newLevel,
        achievements,
        entityType: 'level',
      },
    };

    await this.sendNotificationToUser(userId, notification);
  }

  // Méthode pour notifier un nouvel achievement
  async notifyAchievementUnlocked(
    userId: string,
    achievement: {
      id: string;
      name: string;
      description: string;
      points: number;
    },
  ) {
    const notification = {
      type: 'achievement_earned', // Changé de 'achievement_unlocked' à 'achievement_earned'
      title: 'Succès débloqué !',
      message: achievement.name,
      data: {
        ...achievement,
        entityType: 'achievement',
        achievementName: achievement.name,
      },
    };

    await this.sendNotificationToUser(userId, notification);
  }

  @SubscribeMessage('mark_read')
  async handleMarkAsRead(
    @MessageBody() notificationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Not authenticated' };
    }

    try {
      await this.notificationsService.markAsRead(notificationId, userId);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('mark_all_read')
  async handleMarkAllAsRead(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Not authenticated' };
    }

    try {
      const result = await this.notificationsService.markAllAsRead(userId);
      return { success: true, ...result };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return { error: 'Not authenticated' };
    }

    try {
      const { unreadCount } = await this.notificationsService.findByUser(
        userId,
        { isRead: false, limit: 1 },
      );
      return { unreadCount };
    } catch (error) {
      return { error: error.message };
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    // Essayer de récupérer le token depuis différentes sources
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Essayer depuis les query params
    const token = client.handshake.query.token as string;
    if (token) {
      return token;
    }

    // Essayer depuis les cookies
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const tokenCookie = cookies
        .split(';')
        .find((c) => c.trim().startsWith('access_token='));
      if (tokenCookie) {
        return tokenCookie.split('=')[1];
      }
    }

    return null;
  }

  private async verifySupabaseToken(token: string): Promise<any> {
    try {
      // Utiliser le AuthService pour vérifier le token Supabase
      // Le AuthService devrait avoir une méthode pour valider le token Supabase
      const user = await this.authService.validateSupabaseToken(token);

      if (user) {
        this.logger.log(`Token validated for user: ${user.email}`);
        return user;
      }

      this.logger.error('Token validation failed: user not found');
      return null;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }
}
