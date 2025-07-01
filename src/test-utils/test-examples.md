# Exemples d'utilisation des utilitaires de test Supabase

## Import des utilitaires

```typescript
import {
  createMockUser,
  createMockSession,
  createAuthErrors,
  createSuccessResponse,
  createErrorResponse,
  createMockSupabaseService,
  SupabaseErrorCodes,
} from './supabase-test.helpers';
```

## Exemples pratiques

### 1. Test d'authentification réussie

```typescript
it('should authenticate user successfully', async () => {
  const mockUser = createMockUser({ 
    email: 'john@example.com',
    user_metadata: { first_name: 'John', last_name: 'Doe' }
  });
  const mockSession = createMockSession(mockUser);
  const mockSignIn = supabaseService.signIn;

  mockSignIn.mockResolvedValue(
    createSuccessResponse({ user: mockUser, session: mockSession })
  );

  const result = await authService.signIn('john@example.com', 'password');

  expect(mockSignIn).toHaveBeenCalledWith('john@example.com', 'password');
  expect(result.user.email).toBe('john@example.com');
});
```

### 2. Test d'erreur d'authentification

```typescript
it('should handle invalid credentials', async () => {
  const mockSignIn = supabaseService.signIn;

  mockSignIn.mockResolvedValue(
    createErrorResponse(createAuthErrors.invalidCredentials())
  );

  await expect(
    authService.signIn('wrong@email.com', 'wrongpassword')
  ).rejects.toThrow('Invalid credentials');
});
```

### 3. Test avec différents types d'erreurs

```typescript
describe('error handling', () => {
  it('should handle email not confirmed', async () => {
    const mockSignIn = supabaseService.signIn;
    
    mockSignIn.mockResolvedValue(
      createErrorResponse(createAuthErrors.emailNotConfirmed())
    );

    await expect(authService.signIn('user@test.com', 'password'))
      .rejects.toThrow('Email not confirmed');
  });

  it('should handle too many requests', async () => {
    const mockSignIn = supabaseService.signIn;
    
    mockSignIn.mockResolvedValue(
      createErrorResponse(createAuthErrors.tooManyRequests())
    );

    await expect(authService.signIn('user@test.com', 'password'))
      .rejects.toThrow('Too many requests');
  });
});
```

### 4. Test de profil utilisateur

```typescript
it('should create user profile', async () => {
  const mockUser = createMockUser({
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {
      first_name: 'Test',
      last_name: 'User',
      avatar_url: 'https://example.com/avatar.jpg'
    }
  });

  const mockSupabaseClient = createMockSupabaseService();
  const mockFrom = mockSupabaseClient.client.from();
  
  mockFrom.single.mockResolvedValue({
    data: {
      id: mockUser.id,
      email: mockUser.email,
      first_name: 'Test',
      last_name: 'User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    error: null
  });

  const profile = await profileService.getProfile(mockUser);
  
  expect(profile.first_name).toBe('Test');
  expect(profile.last_name).toBe('User');
});
```

### 5. Test complet avec setup/teardown

```typescript
describe('UserService', () => {
  let userService: UserService;
  let supabaseService: jest.Mocked<SupabaseService>;
  
  const defaultUser = createMockUser();
  const defaultSession = createMockSession(defaultUser);

  beforeEach(async () => {
    const mockSupabaseService = createMockSupabaseService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    supabaseService = module.get(SupabaseService);
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUpdate = supabaseService.client.from().update;
      const updatedData = { first_name: 'Updated' };
      
      mockUpdate.mockResolvedValue({
        data: { ...defaultUser, ...updatedData },
        error: null
      });

      const result = await userService.updateProfile(defaultUser.id, updatedData);

      expect(result.first_name).toBe('Updated');
    });

    it('should handle update errors', async () => {
      const mockUpdate = supabaseService.client.from().update;
      
      mockUpdate.mockResolvedValue({
        data: null,
        error: createAuthErrors.unauthorized()
      });

      await expect(
        userService.updateProfile(defaultUser.id, { first_name: 'Test' })
      ).rejects.toThrow();
    });
  });
});
```

### 6. Test de requêtes de base de données

```typescript
it('should fetch user points of interest', async () => {
  const mockUser = createMockUser({ id: 'user-123' });
  const mockPoints = [
    { id: 'point-1', name: 'Beautiful Lake', user_id: 'user-123' },
    { id: 'point-2', name: 'Mountain View', user_id: 'user-123' }
  ];

  const mockFrom = supabaseService.client.from();
  mockFrom.single.mockResolvedValue({
    data: mockPoints,
    error: null
  });

  const points = await pointsService.getUserPoints(mockUser.id);

  expect(points).toHaveLength(2);
  expect(points[0].name).toBe('Beautiful Lake');
});
```

## Codes d'erreur disponibles

```typescript
// Utilisation des codes d'erreur prédéfinis
const error = createMockAuthError('Custom message', SupabaseErrorCodes.TOKEN_EXPIRED);

// Ou utilisation des factories
const errors = {
  invalidCredentials: createAuthErrors.invalidCredentials(),
  userNotFound: createAuthErrors.userNotFound(),
  tokenExpired: createAuthErrors.tokenExpired(),
  unauthorized: createAuthErrors.unauthorized(),
  tooManyRequests: createAuthErrors.tooManyRequests(),
};
```

## Conseils pour vos tests

1. **Réutilisez les utilitaires** : Évitez de créer des mocks à la main
2. **Nommage clair** : `mockSignIn`, `mockGetUser`, etc.
3. **Données réalistes** : Utilisez des données qui ressemblent à la réalité
4. **Testez les erreurs** : N'oubliez pas les cas d'erreur
5. **Assertions précises** : Vérifiez les paramètres et les résultats

Ces utilitaires vous permettront d'écrire des tests Supabase propres et maintenables ! 🧪✨
