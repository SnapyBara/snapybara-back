import { validate } from 'class-validator';
import { LoginDto, RefreshTokenDto } from './login.dto';
import { GoogleAuthDto } from './google-auth.dto';
import { SignupDto } from './signup.dto';

describe('Auth DTOs', () => {
  describe('LoginDto', () => {
    it('should validate a valid login DTO', async () => {
      const dto = new LoginDto();
      dto.email = 'test@example.com';
      dto.password = 'password123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid email', async () => {
      const dto = new LoginDto();
      dto.email = 'invalid-email';
      dto.password = 'password123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isEmail).toBeDefined();
    });

    it('should fail validation with empty password', async () => {
      const dto = new LoginDto();
      dto.email = 'test@example.com';
      dto.password = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('RefreshTokenDto', () => {
    it('should validate a valid refresh token DTO', async () => {
      const dto = new RefreshTokenDto();
      dto.refresh_token = 'valid-refresh-token';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty refresh token', async () => {
      const dto = new RefreshTokenDto();
      dto.refresh_token = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('GoogleAuthDto', () => {
    it('should validate a valid Google auth DTO', async () => {
      const dto = new GoogleAuthDto();
      dto.idToken = 'valid-google-id-token';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with empty id token', async () => {
      const dto = new GoogleAuthDto();
      dto.idToken = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('SignupDto', () => {
    it('should validate a valid signup DTO', async () => {
      const dto = new SignupDto();
      dto.email = 'newuser@example.com';
      dto.password = 'securePassword123!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with weak password', async () => {
      const dto = new SignupDto();
      dto.email = 'newuser@example.com';
      dto.password = '123'; // Too short

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with invalid email', async () => {
      const dto = new SignupDto();
      dto.email = 'invalid-email';
      dto.password = 'securePassword123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
