import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const res = mockResponse();

      appController.getHealth(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'OK',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        version: '1.0.0',
      });
    });
  });

  describe('getApiInfo', () => {
    it('should return API information', () => {
      const res = mockResponse();

      appController.getApiInfo(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        name: 'SnapyBara API',
        version: '1.0.0',
        description: "API REST/GraphQL pour l'application SnapyBara",
        endpoints: {
          auth: '/auth/*',
          users: '/users/*',
          points: '/points/*',
          health: '/health',
        },
        documentation: '/api/docs',
      });
    });
  });

  describe('getDocs', () => {
    it('should return HTML documentation', () => {
      const res = mockResponse();

      appController.getDocs(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('<!DOCTYPE html>'),
      );
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('SnapyBara API'),
      );
    });
  });

  describe('legacyPasswordResetRedirect', () => {
    it('should redirect from legacy reset endpoint', () => {
      const res = mockResponse();
      const query = {
        token: 'test-token',
        type: 'recovery',
      };

      appController.legacyPasswordResetRedirect(query, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/email/reset-password-form?token=test-token&type=recovery',
      );
    });

    it('should handle empty query params', () => {
      const res = mockResponse();
      const query = {};

      appController.legacyPasswordResetRedirect(query, res);

      expect(res.redirect).toHaveBeenCalledWith('/email/reset-password-form?');
    });
  });
});
