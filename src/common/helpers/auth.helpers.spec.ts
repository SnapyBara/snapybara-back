import * as authHelpers from './auth.helpers';

describe('Auth Helpers', () => {
  describe('generateUsername', () => {
    it('should generate username from email', () => {
      const email = 'john.doe@example.com';
      const username = authHelpers.generateUsername(email);

      expect(username).toMatch(/^johndoe\d+$/);
    });

    it('should handle email with special characters', () => {
      const email = 'user+tag@example.com';
      const username = authHelpers.generateUsername(email);

      expect(username).toMatch(/^usertag\d+$/);
    });

    it('should handle very short email', () => {
      const email = 'a@b.c';
      const username = authHelpers.generateUsername(email);

      expect(username).toMatch(/^a\d+$/);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        '123@example.com',
      ];

      validEmails.forEach(email => {
        expect(authHelpers.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
      ];

      invalidEmails.forEach(email => {
        expect(authHelpers.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'SecurePass123!',
        'MyP@ssw0rd',
        'Test123$%^',
        'ValidP@ss1',
      ];

      strongPasswords.forEach(password => {
        const result = authHelpers.validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const result1 = authHelpers.validatePassword('123456');
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Le mot de passe doit contenir au moins 8 caractères');

      const result2 = authHelpers.validatePassword('password');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Le mot de passe doit contenir au moins une majuscule');

      const result3 = authHelpers.validatePassword('Pass123');
      expect(result3.isValid).toBe(false);
      expect(result3.errors).toContain('Le mot de passe doit contenir au moins un caractère spécial');
    });
  });

  describe('maskEmail', () => {
    it('should mask email correctly', () => {
      expect(authHelpers.maskEmail('test@example.com')).toBe('t**t@example.com');
      expect(authHelpers.maskEmail('ab@example.com')).toBe('a*@example.com');
      expect(authHelpers.maskEmail('longusername@example.com')).toBe('l**********e@example.com');
    });
  });

  describe('calculateUserLevel', () => {
    it('should calculate user level based on points', () => {
      expect(authHelpers.calculateUserLevel(0)).toBe(1);
      expect(authHelpers.calculateUserLevel(50)).toBe(1);
      expect(authHelpers.calculateUserLevel(100)).toBe(2);
      expect(authHelpers.calculateUserLevel(300)).toBe(3);
      expect(authHelpers.calculateUserLevel(1000)).toBe(5);
      expect(authHelpers.calculateUserLevel(5500)).toBe(10);
      expect(authHelpers.calculateUserLevel(6500)).toBe(11);
      expect(authHelpers.calculateUserLevel(7500)).toBe(12);
    });
  });

  describe('getPointsForNextLevel', () => {
    it('should calculate points needed for next level', () => {
      expect(authHelpers.getPointsForNextLevel(0)).toBe(100);
      expect(authHelpers.getPointsForNextLevel(50)).toBe(50);
      expect(authHelpers.getPointsForNextLevel(100)).toBe(200);
      expect(authHelpers.getPointsForNextLevel(250)).toBe(50);
      expect(authHelpers.getPointsForNextLevel(5500)).toBe(1000);
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(authHelpers.formatDuration(30)).toBe('30s');
      expect(authHelpers.formatDuration(90)).toBe('1min');
      expect(authHelpers.formatDuration(3600)).toBe('1h');
      expect(authHelpers.formatDuration(7200)).toBe('2h');
      expect(authHelpers.formatDuration(86400)).toBe('1j');
      expect(authHelpers.formatDuration(172800)).toBe('2j');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time correctly', () => {
      const now = new Date();
      
      // Test "À l'instant"
      const justNow = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      expect(authHelpers.formatRelativeTime(justNow)).toBe('À l\'instant');

      // Test minutes
      const minutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      expect(authHelpers.formatRelativeTime(minutesAgo)).toBe('Il y a 5min');

      // Test hours
      const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(authHelpers.formatRelativeTime(hoursAgo)).toBe('Il y a 2h');

      // Test days
      const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      expect(authHelpers.formatRelativeTime(daysAgo)).toBe('Il y a 3j');
    });
  });

  describe('getDefaultUserPreferences', () => {
    it('should return default user preferences', () => {
      const prefs = authHelpers.getDefaultUserPreferences();

      expect(prefs).toHaveProperty('language', 'fr');
      expect(prefs).toHaveProperty('units', 'metric');
      expect(prefs).toHaveProperty('map_style', 'standard');
      expect(prefs).toHaveProperty('default_radius', 10);
      expect(prefs.notifications).toHaveProperty('email_notifications', true);
      expect(prefs.privacy).toHaveProperty('profile_visibility', 'public');
    });
  });

  describe('generateDisplayName', () => {
    it('should generate display name from user profile', () => {
      const user1 = {
        id: 'test-id',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: '',
        phone: '',
        preferences: {} as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(authHelpers.generateDisplayName(user1)).toBe('John Doe');

      const user2 = {
        id: 'test-id',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {
          first_name: 'Jane',
          last_name: 'Smith',
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as any;
      expect(authHelpers.generateDisplayName(user2)).toBe('Jane Smith');

      const user3 = {
        id: 'test-id',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as any;
      expect(authHelpers.generateDisplayName(user3)).toBe('test');
    });
  });

  describe('isProfileComplete', () => {
    it('should check if profile is complete', () => {
      const completeProfile = {
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: '',
        phone: '',
        preferences: {} as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(authHelpers.isProfileComplete(completeProfile)).toBe(true);

      const incompleteProfile = {
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: '',
        avatar_url: '',
        phone: '',
        preferences: {} as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(authHelpers.isProfileComplete(incompleteProfile)).toBe(false);
    });
  });

  describe('extractUserInfo', () => {
    it('should extract user info from Supabase user', () => {
      const supabaseUser = {
        id: '123',
        email: 'test@example.com',
        phone: '+1234567890',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };

      const userInfo = authHelpers.extractUserInfo(supabaseUser as any);

      expect(userInfo).toEqual({
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        phone: '+1234567890',
      });
    });
  });

  describe('isAdmin', () => {
    it('should check if user is admin', () => {
      const adminUser1 = {
        app_metadata: { role: 'admin' },
      };
      expect(authHelpers.isAdmin(adminUser1 as any)).toBe(true);

      const adminUser2 = {
        app_metadata: { claims_admin: true },
      };
      expect(authHelpers.isAdmin(adminUser2 as any)).toBe(true);

      const regularUser = {
        app_metadata: { role: 'user' },
      };
      expect(authHelpers.isAdmin(regularUser as any)).toBe(false);
    });
  });

  describe('isModerator', () => {
    it('should check if user is moderator', () => {
      const adminUser = {
        app_metadata: { role: 'admin' },
      };
      expect(authHelpers.isModerator(adminUser as any)).toBe(true);

      const moderatorUser = {
        app_metadata: { role: 'moderator' },
      };
      expect(authHelpers.isModerator(moderatorUser as any)).toBe(true);

      const regularUser = {
        app_metadata: { role: 'user' },
      };
      expect(authHelpers.isModerator(regularUser as any)).toBe(false);
    });
  });
});
