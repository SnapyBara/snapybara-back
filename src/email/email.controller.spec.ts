import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { Response, Request } from 'express';

describe('EmailController', () => {
  let controller: EmailController;
  let emailService: EmailService;

  const mockEmailService = {
    sendEmailConfirmation: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    confirmEmailWithSupabase: jest.fn(),
  };

  const mockRequest = {
    url: '/test',
    headers: {
      'user-agent': 'test-agent',
    },
    protocol: 'http',
    get: jest.fn(() => 'localhost'),
  } as unknown as Request;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<EmailController>(EmailController);
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  describe('sendEmailConfirmation', () => {
    it('should send confirmation email', async () => {
      const emailData = { email: 'test@example.com' };
      const mockResult = { success: true };

      mockEmailService.sendEmailConfirmation.mockResolvedValue(mockResult);

      const result = await controller.sendEmailConfirmation(emailData);

      expect(emailService.sendEmailConfirmation).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const resetData = { email: 'test@example.com' };
      const mockResult = { success: true };

      mockEmailService.sendPasswordResetEmail.mockResolvedValue(mockResult);

      const result = await controller.sendPasswordResetEmail(resetData);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('confirmEmail', () => {
    it('should confirm email with confirmed=true param', async () => {
      const query = { confirmed: 'true' };

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Email confirmé !');
    });

    it('should handle mobile device with confirmed=true', async () => {
      const query = { confirmed: 'true' };
      const mobileRequest = {
        ...mockRequest,
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      } as unknown as Request;

      await controller.confirmEmail(query, mobileRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'snapybara://auth/email-confirmed'
      );
    });

    it('should verify token', async () => {
      const query = { token: 'valid-token' };

      mockEmailService.confirmEmailWithSupabase.mockResolvedValue(true);

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(emailService.confirmEmailWithSupabase).toHaveBeenCalledWith(
        'valid-token'
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle invalid token', async () => {
      const query = { token: 'invalid-token' };

      mockEmailService.confirmEmailWithSupabase.mockResolvedValue(false);

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle access token', async () => {
      const query = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Email confirmé !');
    });

    it('should handle error param', async () => {
      const query = { error: 'some_error' };

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should show fragment reader page when no params', async () => {
      const query = {};

      await controller.confirmEmail(query, mockRequest, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Vérification en cours');
    });
  });

  describe('resetPassword', () => {
    it('should handle reset password with token', async () => {
      const query = { token: 'reset-token' };

      await controller.resetPassword(query, mockRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalled();
    });

    it('should handle reset password with access token', async () => {
      const query = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      await controller.resetPassword(query, mockRequest, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Choisissez votre nouveau mot de passe');
    });

    it('should handle mobile device with tokens', async () => {
      const query = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };
      const mobileRequest = {
        ...mockRequest,
        headers: {
          'user-agent': 'Mozilla/5.0 (Android; Mobile)',
        },
      } as unknown as Request;

      await controller.resetPassword(query, mobileRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('snapybara://auth/password-reset')
      );
    });

    it('should handle error in reset password', async () => {
      const query = { error: 'invalid_token' };

      await controller.resetPassword(query, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalled();
    });
  });

  describe('resetPasswordForm', () => {
    it('should show form with valid tokens', async () => {
      const query = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: '3600',
      };

      await controller.resetPasswordForm(query, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Choisissez votre nouveau mot de passe');
    });

    it('should show expired page for expired token', async () => {
      const query = {
        error: 'access_denied',
        error_description: 'Token expired',
      };

      await controller.resetPasswordForm(query, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Lien de réinitialisation expiré');
    });

    it('should show error page for other errors', async () => {
      const query = {
        error: 'some_error',
      };

      await controller.resetPasswordForm(query, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should show fragment reader if no tokens', async () => {
      const query = {};

      await controller.resetPasswordForm(query, mockResponse);

      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Redirection en cours');
    });
  });

  describe('resetPasswordError', () => {
    it('should return error page', async () => {
      await controller.resetPasswordError(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalled();
      const sentContent = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentContent).toContain('Erreur de réinitialisation');
    });
  });
});
