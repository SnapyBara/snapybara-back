import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('EmailService', () => {
  let service: EmailService;

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue({
      auth: {
        admin: {
          createUser: jest.fn(),
        },
      },
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
