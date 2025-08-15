import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    try {
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: createUserDto.email },
          { username: createUserDto.username },
          { supabaseId: createUserDto.supabaseId },
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          'Utilisateur déjà existant (email, username ou supabaseId)',
        );
      }

      const createdUser = new this.userModel(createUserDto);
      const savedUser = await createdUser.save();

      this.logger.log(
        `User created: ${savedUser.username} (${savedUser.email})`,
      );
      return savedUser;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Utilisateur déjà existant');
      }
      throw error;
    }
  }

  async findAll(limit = 50, skip = 0): Promise<UserDocument[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ points: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    return user;
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username, isActive: true }).exec();
  }

  async findBySupabaseId(supabaseId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ supabaseId }).exec();
  }

  async findByRole(roles: string[]): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: { $in: roles }, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { ...updateUserDto, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return updatedUser;
  }

  async findById(id: string): Promise<User | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    // TODO: Add cascade deletion for related data
    // - Delete user's photos
    // - Delete user's points of interest
    // - Delete user's comments
    // - Remove user from notifications
    // This should be implemented when photo/POI/comment services are created

    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User deleted: ${result.username} (${result.email})`);
  }

  async addPoints(id: string, points: number): Promise<UserDocument> {
    const user = await this.findOne(id);
    const newPoints = user.points + points;
    const newLevel = this.calculateLevel(newPoints);

    const updatedUser = await this.update(id, {
      points: newPoints,
      level: newLevel,
    });

    this.logger.log(
      `Points added to ${user.username}: +${points} (total: ${newPoints}, level: ${newLevel})`,
    );
    return updatedUser;
  }

  async addAchievement(
    id: string,
    achievementId: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);
    if (!user.achievements.includes(achievementId)) {
      const updatedAchievements = [...user.achievements, achievementId];
      const updatedUser = await this.update(id, {
        achievements: updatedAchievements,
      });

      this.logger.log(
        `Achievement added to ${user.username}: ${achievementId}`,
      );
      return updatedUser;
    }
    return user;
  }

  // async incrementPhotoCount(id: string): Promise<UserDocument> {
  //   const user = await this.findOne(id);
  //   return this.update(id, { photosUploaded: user.photosUploaded + 1 });
  // }
  //
  // async incrementPOICount(id: string): Promise<UserDocument> {
  //   const user = await this.findOne(id);
  //   return this.update(id, {
  //     pointsOfInterestCreated: user.pointsOfInterestCreated + 1,
  //   });
  // }
  //
  // async incrementCommentCount(id: string): Promise<UserDocument> {
  //   const user = await this.findOne(id);
  //   return this.update(id, { commentsWritten: user.commentsWritten + 1 });
  // }
  //
  // async incrementLikesReceived(id: string): Promise<UserDocument> {
  //   const user = await this.findOne(id);
  //   return this.update(id, { likesReceived: user.likesReceived + 1 });
  // }

  async getLeaderboard(limit = 10): Promise<UserDocument[]> {
    return this.userModel
      .find({ isActive: true })
      .sort({ points: -1, level: -1 })
      .limit(limit)
      .exec();
  }

  // async getUserRank(id: string): Promise<{ rank: number; total: number }> {
  //   const user = await this.findOne(id);
  //   const rank =
  //     (await this.userModel.countDocuments({
  //       isActive: true,
  //       $or: [
  //         { points: { $gt: user.points } },
  //         { points: user.points, level: { $gt: user.level } },
  //         { points: user.points, level: user.level, _id: { $lt: user._id } },
  //       ],
  //     })) + 1;
  //
  //   const total = await this.userModel.countDocuments({ isActive: true });
  //   return { rank, total };
  // }

  async updateLastLogin(id: string): Promise<UserDocument> {
    return this.update(id, { lastLoginAt: new Date() });
  }

  async deactivate(id: string): Promise<UserDocument> {
    return this.update(id, { isActive: false } as UpdateUserDto);
  }

  async updateRole(id: string, role: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { role, updatedAt: new Date() }, { new: true })
      .exec();

    if (user) {
      this.logger.log(`User role updated: ${user.username} is now ${role}`);
    }

    return user;
  }

  async syncWithSupabase(supabaseUser: any): Promise<UserDocument> {
    const supabaseId: string = supabaseUser?.id;
    if (!supabaseId) throw new ConflictException('Supabase id manquant');

    const email: string | undefined = supabaseUser?.email;
    const username: string | undefined = this.extractUsername(supabaseUser);
    const isEmailVerified: boolean = this.extractIsEmailVerified(supabaseUser);
    const metadata: Record<string, any> = this.buildMetadata(supabaseUser);

    const profilePicture: string | undefined =
      supabaseUser?.user_metadata?.avatar_url ||
      supabaseUser?.raw_user_meta_data?.avatar_url ||
      supabaseUser?.raw_user_meta_data?.picture;

    const language: string | undefined =
      supabaseUser?.user_metadata?.language ||
      supabaseUser?.raw_user_meta_data?.language;

    const update: any = {
      $setOnInsert: {
        supabaseId,
        role: 'user',
        isActive: true,
        notificationsEnabled: true,
        darkModeEnabled: false,
        privacySettings: 'public',
        language: language ?? 'fr',
        level: 1,
        points: 0,
        photosUploaded: 0,
        pointsOfInterestCreated: 0,
        commentsWritten: 0,
        likesReceived: 0,
      },
      $set: {
        ...(email ? { email } : {}),
        ...(username ? { username } : {}),
        ...(typeof isEmailVerified === 'boolean' ? { isEmailVerified } : {}),
        ...(profilePicture ? { profilePicture } : {}),
        ...(language ? { language } : {}), // met à jour si fourni
        ...(metadata ? { metadata } : {}),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    };

    try {
      const doc = await this.userModel.findOneAndUpdate(
        { supabaseId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      this.logger.log(`User synced: ${doc.username}`);
      return doc;
    } catch (error: any) {
      if (error?.code === 11000) {
        const base =
          username ||
          (email
            ? email
                .split('@')[0]
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
            : 'user');
        const unique = await this.generateUniqueUsername({
          email,
          user_metadata: { full_name: base },
        });
        const retryUpdate = {
          ...update,
          $set: { ...update.$set, username: unique }, // uniquement dans $set
        };
        const doc = await this.userModel.findOneAndUpdate(
          { supabaseId },
          retryUpdate,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        return doc;
      }
      throw error;
    }
  }

  // ===== UTILS =====

  private extractUsername(record: any): string | undefined {
    const meta = record?.raw_user_meta_data || record?.user_metadata || {};
    const candidate: string | undefined =
      meta.username ||
      meta.full_name ||
      meta.name ||
      (typeof record?.email === 'string'
        ? record.email.split('@')[0]
        : undefined);

    if (!candidate || typeof candidate !== 'string') return undefined;
    return candidate.trim().replace(/\s+/g, '').toLowerCase();
  }

  private extractIsEmailVerified(record: any): boolean {
    if (record?.email_confirmed_at) return true;
    const meta = record?.raw_user_meta_data || record?.user_metadata || {};
    if (typeof meta.email_verified === 'boolean') return meta.email_verified;
    return false;
  }

  private buildMetadata(record: any): Record<string, any> {
    const rawUser = record?.raw_user_meta_data || record?.user_metadata || {};
    const rawApp = record?.raw_app_meta_data || record?.app_metadata || {};
    return { ...rawUser, ...rawApp };
  }

  private calculateLevel(points: number): number {
    // Niveau 1: 0-99 points, Niveau 2: 100-299, Niveau 3: 300-599, etc.
    if (points < 100) return 1;
    if (points < 300) return 2;
    if (points < 600) return 3;
    if (points < 1000) return 4;
    if (points < 1500) return 5;

    return Math.floor((points - 1500) / 500) + 6;
  }

  private async generateUniqueUsername(supabaseUser: any): Promise<string> {
    let baseUsername = supabaseUser.user_metadata?.full_name
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, '')
      ?.substring(0, 15);

    if (!baseUsername) {
      baseUsername = supabaseUser.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    let username = baseUsername;
    let counter = 1;

    while (await this.findByUsername(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  private async giveWelcomeRewards(userId: string): Promise<void> {
    try {
      await this.addPoints(userId, 50);
      await this.addAchievement(userId, 'first_login');
      this.logger.log(`Welcome rewards given to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to give welcome rewards: ${error.message}`);
    }
  }
}
