import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('EmailService', () => {
  let service: EmailService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue({
      auth: {
        admin: {
          createUser: jest.fn(),
          inviteUserByEmail: jest.fn(),
          updateUserById: jest.fn(),
          deleteUser: jest.fn(),
        },
        signInWithOtp: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        verifyOtp: jest.fn(),
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn(),
          }),
        }),
        insert: jest.fn(),
        update: jest.fn().mockReturnValue({
          eq: jest.fn(),
        }),
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmailConfirmation', () => {
    it('should send email confirmation', async () => {
      const email = 'test@example.com';
      const mockResponse = {
        data: { user: { id: 'user-123' } },
        error: null,
      };

      mockSupabaseService
        .getClient()
        .auth.signInWithOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.sendEmailConfirmation(email);

      expect(result).toEqual({
        success: true,
        message: 'Email de confirmation envoyé avec succès',
      });
      expect(
        mockSupabaseService.getClient().auth.signInWithOtp,
      ).toHaveBeenCalledWith({
        email,
      });
    });

    it('should handle email confirmation error', async () => {
      const email = 'test@example.com';
      const mockResponse = {
        data: null,
        error: { message: 'Error sending OTP' },
      };

      mockSupabaseService
        .getClient()
        .auth.signInWithOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.sendEmailConfirmation(email);

      expect(result).toEqual({
        success: false,
        message: "Erreur lors de l'envoi: Error sending OTP",
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';
      const mockResponse = {
        data: { user: { id: 'user-123' } },
        error: null,
      };

      mockSupabaseService
        .getClient()
        .auth.resetPasswordForEmail.mockResolvedValueOnce(mockResponse);

      const result = await service.sendPasswordResetEmail(email);

      expect(result).toEqual({
        success: true,
        message: 'Email de réinitialisation envoyé avec succès',
      });
      expect(
        mockSupabaseService.getClient().auth.resetPasswordForEmail,
      ).toHaveBeenCalledWith(email, {
        redirectTo: expect.stringContaining('/reset-password'),
      });
    });

    it('should handle reset password error', async () => {
      const email = 'test@example.com';
      const mockResponse = {
        data: null,
        error: { message: 'User not found' },
      };

      mockSupabaseService
        .getClient()
        .auth.resetPasswordForEmail.mockResolvedValueOnce(mockResponse);

      const result = await service.sendPasswordResetEmail(email);

      expect(result).toEqual({
        success: false,
        message: "Erreur lors de l'envoi: User not found",
      });
    });
  });

  describe('confirmEmailWithSupabase', () => {
    it('should confirm email with token', async () => {
      const tokenHash = 'test-token-hash';
      const mockResponse = {
        data: { user: { id: 'user-123' } },
        error: null,
      };

      mockSupabaseService
        .getClient()
        .auth.verifyOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.confirmEmailWithSupabase(tokenHash);

      expect(result).toBe(true);
      expect(
        mockSupabaseService.getClient().auth.verifyOtp,
      ).toHaveBeenCalledWith({
        token_hash: tokenHash,
        type: 'email',
      });
    });

    it('should return false on confirmation error', async () => {
      const tokenHash = 'invalid-token';
      const mockResponse = {
        data: null,
        error: { message: 'Invalid token' },
      };

      mockSupabaseService
        .getClient()
        .auth.verifyOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.confirmEmailWithSupabase(tokenHash);

      expect(result).toBe(false);
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify password reset token', async () => {
      const tokenHash = 'reset-token-hash';
      const mockResponse = {
        data: { user: { email: 'test@example.com' } },
        error: null,
      };

      mockSupabaseService
        .getClient()
        .auth.verifyOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.verifyPasswordResetToken(tokenHash);

      expect(result).toEqual({
        success: true,
        message: 'Token de réinitialisation valide',
      });
      expect(
        mockSupabaseService.getClient().auth.verifyOtp,
      ).toHaveBeenCalledWith({
        token_hash: tokenHash,
        type: 'recovery',
      });
    });

    it('should handle invalid reset token', async () => {
      const tokenHash = 'invalid-token';
      const mockResponse = {
        data: null,
        error: { message: 'Invalid token' },
      };

      mockSupabaseService
        .getClient()
        .auth.verifyOtp.mockResolvedValueOnce(mockResponse);

      const result = await service.verifyPasswordResetToken(tokenHash);

      expect(result).toEqual({
        success: false,
        message: 'Token invalide: Invalid token',
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token', async () => {
      const accessToken = 'valid-access-token';
      const mockResponse = {
        data: { user: { email: 'test@example.com' } },
        error: null,
      };

      mockSupabaseService
        .getClient()
        .auth.getUser.mockResolvedValueOnce(mockResponse);

      const result = await service.verifyAccessToken(accessToken);

      expect(result).toBe(true);
      expect(mockSupabaseService.getClient().auth.getUser).toHaveBeenCalledWith(
        accessToken,
      );
    });

    it('should return false for invalid access token', async () => {
      const accessToken = 'invalid-token';
      const mockResponse = {
        data: null,
        error: { message: 'Invalid token' },
      };

      mockSupabaseService
        .getClient()
        .auth.getUser.mockResolvedValueOnce(mockResponse);

      const result = await service.verifyAccessToken(accessToken);

      expect(result).toBe(false);
    });
  });
});
