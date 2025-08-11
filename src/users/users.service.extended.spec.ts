import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService Extended Tests', () => {
  let service: UsersService;
  let mockModel: jest.Mock & {
    findOne: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    countDocuments: jest.Mock;
    create: jest.Mock;
  };

  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    supabaseId: 'supabase-123',
    points: 100,
    level: 1,
    achievements: [],
    isActive: true,
    dateJoined: new Date(),
    lastLoginAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    mockModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ ...dto, _id: 'generated-id' }),
    })) as any;

    mockModel.findOne = jest.fn();
    mockModel.find = jest.fn();
    mockModel.findById = jest.fn();
    mockModel.findByIdAndUpdate = jest.fn();
    mockModel.findByIdAndDelete = jest.fn();
    mockModel.countDocuments = jest.fn();
    mockModel.create = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByRole', () => {
    it('should find users by role', async () => {
      const roles = ['admin', 'moderator'];
      const mockUsers = [
        { ...mockUser, role: 'admin' },
        { ...mockUser, _id: 'user-2', role: 'moderator' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await service.findByRole(roles);

      expect(result).toEqual(mockUsers);
      expect(mockModel.find).toHaveBeenCalledWith({
        role: { $in: roles },
        isActive: true,
      });
    });
  });

  describe('findById', () => {
    it('should find user by valid ID', async () => {
      const validId = '507f1f77bcf86cd799439011';
      mockModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findById(validId);

      expect(result).toEqual(mockUser);
      expect(mockModel.findById).toHaveBeenCalledWith(validId);
    });

    it('should return null for invalid ID', async () => {
      const invalidId = 'invalid-id';
      const result = await service.findById(invalidId);
      expect(result).toBeNull();
      expect(mockModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users by points', async () => {
      const topUsers = [
        { ...mockUser, points: 1000 },
        { ...mockUser, points: 900, _id: 'user-2' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(topUsers),
      });

      const result = await service.getLeaderboard(10);

      expect(result).toEqual(topUsers);
      expect(mockModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      jest.spyOn(service, 'update').mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      const result = await service.deactivate('user-123');

      expect(service.update).toHaveBeenCalledWith('user-123', {
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('calculateLevel', () => {
    it('should calculate correct level based on points', () => {
      expect((service as any).calculateLevel(0)).toBe(1);
      expect((service as any).calculateLevel(100)).toBe(2);
      expect((service as any).calculateLevel(300)).toBe(3);
      expect((service as any).calculateLevel(600)).toBe(4);
      expect((service as any).calculateLevel(1000)).toBe(5);
      expect((service as any).calculateLevel(1500)).toBe(6);
    });
  });

  describe('generateUniqueUsername', () => {
    it('should generate unique username from full name', async () => {
      const supabaseUser = {
        email: 'john.doe@example.com',
        user_metadata: {
          full_name: 'John Doe',
        },
      };

      mockModel.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValueOnce({ username: 'johndoe' })
          .mockResolvedValueOnce({ username: 'johndoe1' })
          .mockResolvedValueOnce(null),
      });

      const result = await (service as any).generateUniqueUsername(
        supabaseUser,
      );
      expect(result).toBe('johndoe2');
    });
  });

  describe('create - error handling', () => {
    it('should handle MongoDB duplicate key error', async () => {
      const createDto = {
        email: 'duplicate@example.com',
        username: 'duplicate',
        supabaseId: 'supabase-dup',
      };

      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockModel.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValue({ code: 11000 }),
      }));

      await expect(service.create(createDto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
