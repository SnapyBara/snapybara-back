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
import { JwtService } from '@nestjs/jwt';

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
    private readonly jwtService: JwtService,
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

      // Vérifier le token et récupérer l'utilisateur
      const payload = await this.verifyToken(token);
      const userId = payload?.sub;

      if (!userId) {
        this.logger.error('Invalid token');
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

      this.logger.log(`Client connected: ${client.id} for user ${userId}`);

      // Envoyer les notifications non lues
      const { data: unreadNotifications, unreadCount } = 
        await this.notificationsService.findByUser(userId, { isRead: false });

      client.emit('initial_notifications', {
        notifications: unreadNotifications,
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
    // Créer la notification dans la base de données
    const savedNotification = await this.notificationsService.create({
      userId,
      ...notification,
    });

    // Envoyer la notification via WebSocket si l'utilisateur est connecté
    this.server.to(`user:${userId}`).emit('new_notification', savedNotification);
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
        .find(c => c.trim().startsWith('access_token='));
      if (tokenCookie) {
        return tokenCookie.split('=')[1];
      }
    }

    return null;
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }
}
