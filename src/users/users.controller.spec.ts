import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto, UserRole } from './dto/update-role.dto';
import { SimpleJwtAuthGuard } from '../auth/guards/simple-jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    supabaseId: 'test-supabase-id',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    level: 1,
    points: 100,
    profilePicture: null,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    toObject: jest.fn().mockReturnThis(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySupabaseId: jest.fn(),
    findByUsername: jest.fn(),
    findByRole: jest.fn(),
    getLeaderboard: jest.fn(),
    update: jest.fn(),
    updateRole: jest.fn(),
    remove: jest.fn(),
    deactivate: jest.fn(),
    addPoints: jest.fn(),
    addAchievement: jest.fn(),
    syncWithSupabase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(SimpleJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        supabaseId: 'supabase-new-id',
        username: 'newuser',
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });

  describe('findAll', () => {
    it('should return array of users', async () => {
      const users = [
        mockUser,
        { ...mockUser, _id: '507f1f77bcf86cd799439012' },
      ];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll(50, 0);

      expect(usersService.findAll).toHaveBeenCalledWith(50, 0);
      expect(result).toHaveLength(2);
    });

    it('should use default values for limit and skip', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      await controller.findAll(undefined, undefined);

      expect(usersService.findAll).toHaveBeenCalledWith(50, 0);
    });
  });

  describe('getModerators', () => {
    it('should return moderators and admins', async () => {
      const moderators = [
        { ...mockUser, role: 'moderator' },
        { ...mockUser, role: 'admin' },
      ];
      mockUsersService.findByRole.mockResolvedValue(moderators);

      const result = await controller.getModerators();

      expect(usersService.findByRole).toHaveBeenCalledWith([
        'moderator',
        'admin',
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard users', async () => {
      const topUsers = Array(10).fill(mockUser);
      mockUsersService.getLeaderboard.mockResolvedValue(topUsers);

      const result = await controller.getLeaderboard(10);

      expect(usersService.getLeaderboard).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(10);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user profile', async () => {
      const currentUser = { mongoId: mockUser._id };
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getCurrentUser(currentUser);

      expect(usersService.findOne).toHaveBeenCalledWith(currentUser.mongoId);
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });

  describe('getProfileBySupabaseId', () => {
    it('should return user profile by supabase ID', async () => {
      mockUsersService.findBySupabaseId.mockResolvedValue(mockUser);

      const result =
        await controller.getProfileBySupabaseId('test-supabase-id');

      expect(usersService.findBySupabaseId).toHaveBeenCalledWith(
        'test-supabase-id',
      );
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });

    it('should throw not found exception if user not found', async () => {
      mockUsersService.findBySupabaseId.mockResolvedValue(null);

      await expect(
        controller.getProfileBySupabaseId('non-existent-id'),
      ).rejects.toThrow(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(mockUser._id);

      expect(usersService.findOne).toHaveBeenCalledWith(mockUser._id);
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });

  describe('updateMyProfile', () => {
    it('should update current user profile', async () => {
      const currentUser = { mongoId: mockUser._id };
      const updateProfileDto: UpdateProfileDto = {
        username: 'newusername',
        bio: 'New bio',
      };

      mockUsersService.findByUsername.mockResolvedValue(null);
      mockUsersService.update.mockResolvedValue({
        ...mockUser,
        ...updateProfileDto,
      });

      const result = await controller.updateMyProfile(
        currentUser,
        updateProfileDto,
      );

      expect(usersService.findByUsername).toHaveBeenCalledWith('newusername');
      expect(usersService.update).toHaveBeenCalledWith(
        currentUser.mongoId,
        updateProfileDto,
      );
      expect(result.username).toBe('newusername');
    });

    it('should throw conflict exception if username is taken', async () => {
      const currentUser = { mongoId: mockUser._id };
      const updateProfileDto: UpdateProfileDto = {
        username: 'existinguser',
      };

      const existingUser = { ...mockUser, _id: 'different-id' };
      mockUsersService.findByUsername.mockResolvedValue(existingUser);

      await expect(
        controller.updateMyProfile(currentUser, updateProfileDto),
      ).rejects.toThrow(
        new HttpException('Username already taken', HttpStatus.CONFLICT),
      );
    });

    it('should allow user to keep their own username', async () => {
      const currentUser = { mongoId: mockUser._id };
      const updateProfileDto: UpdateProfileDto = {
        username: 'testuser',
      };

      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      mockUsersService.update.mockResolvedValue(mockUser);

      const result = await controller.updateMyProfile(
        currentUser,
        updateProfileDto,
      );

      expect(usersService.update).toHaveBeenCalled();
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile by ID', async () => {
      const updateProfileDto: UpdateProfileDto = {
        bio: 'Updated bio',
        language: 'en',
      };

      mockUsersService.update.mockResolvedValue({
        ...mockUser,
        ...updateProfileDto,
        username: 'updateduser',
      });

      const result = await controller.updateProfile(
        mockUser._id,
        updateProfileDto,
      );

      expect(usersService.update).toHaveBeenCalledWith(
        mockUser._id,
        updateProfileDto,
      );
      expect(result.username).toBe('updateduser');
    });
  });

  describe('deleteMyAccount', () => {
    it('should delete current user account', async () => {
      const currentUser = { mongoId: mockUser._id };
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.deleteMyAccount(currentUser);

      expect(usersService.remove).toHaveBeenCalledWith(currentUser.mongoId);
      expect(result).toEqual({
        success: true,
        message: 'User account successfully deleted',
      });
    });

    it('should handle deletion errors', async () => {
      const currentUser = { mongoId: mockUser._id };
      mockUsersService.remove.mockRejectedValue(new Error('Deletion failed'));

      await expect(controller.deleteMyAccount(currentUser)).rejects.toThrow(
        new HttpException('Failed to delete account', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account by ID', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.deleteAccount(mockUser._id);

      expect(usersService.remove).toHaveBeenCalledWith(mockUser._id);
      expect(result).toEqual({
        success: true,
        message: 'User account successfully deleted',
      });
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate user account', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      mockUsersService.deactivate.mockResolvedValue(deactivatedUser);

      const result = await controller.deactivateAccount(mockUser._id);

      expect(usersService.deactivate).toHaveBeenCalledWith(mockUser._id);
      expect(result.isActive).toBe(false);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const currentUser = { mongoId: 'admin-id' };
      const updateRoleDto: UpdateRoleDto = { role: UserRole.MODERATOR };
      const updatedUser = { ...mockUser, role: 'moderator' };

      mockUsersService.updateRole.mockResolvedValue(updatedUser);

      const result = await controller.updateUserRole(
        mockUser._id,
        updateRoleDto,
        currentUser,
      );

      expect(usersService.updateRole).toHaveBeenCalledWith(
        mockUser._id,
        UserRole.MODERATOR,
      );
      expect(result.role).toBe('moderator');
    });

    it('should prevent admin from changing their own role', async () => {
      const currentUser = { mongoId: mockUser._id };
      const updateRoleDto: UpdateRoleDto = { role: UserRole.USER };

      await expect(
        controller.updateUserRole(mockUser._id, updateRoleDto, currentUser),
      ).rejects.toThrow(
        new HttpException(
          'You cannot change your own role',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw not found if user does not exist', async () => {
      const currentUser = { mongoId: 'admin-id' };
      const updateRoleDto: UpdateRoleDto = { role: UserRole.MODERATOR };

      mockUsersService.updateRole.mockResolvedValue(null);

      await expect(
        controller.updateUserRole(
          'non-existent-id',
          updateRoleDto,
          currentUser,
        ),
      ).rejects.toThrow(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('addPoints', () => {
    it('should add points to user', async () => {
      const updatedUser = { ...mockUser, points: 150 };
      mockUsersService.addPoints.mockResolvedValue(updatedUser);

      const result = await controller.addPoints(mockUser._id, 50);

      expect(usersService.addPoints).toHaveBeenCalledWith(mockUser._id, 50);
      expect(result.points).toBe(150);
    });
  });

  describe('addAchievement', () => {
    it('should add achievement to user', async () => {
      const achievementId = 'achievement-123';
      mockUsersService.addAchievement.mockResolvedValue(mockUser);

      const result = await controller.addAchievement(
        mockUser._id,
        achievementId,
      );

      expect(usersService.addAchievement).toHaveBeenCalledWith(
        mockUser._id,
        achievementId,
      );
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });

  describe('syncWithSupabase', () => {
    it('should sync user with supabase', async () => {
      const supabaseUser = {
        id: 'supabase-id',
        email: 'sync@example.com',
      };

      mockUsersService.syncWithSupabase.mockResolvedValue(mockUser);

      const result = await controller.syncWithSupabase({ supabaseUser });

      expect(usersService.syncWithSupabase).toHaveBeenCalledWith(supabaseUser);
      expect(result).toMatchObject({
        _id: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
        role: mockUser.role,
        level: mockUser.level,
        points: mockUser.points,
        profilePicture: mockUser.profilePicture,
        isActive: mockUser.isActive,
      });
    });
  });
});
