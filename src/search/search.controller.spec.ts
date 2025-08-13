import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  const mockSearchService = {
    globalSearch: jest.fn(),
    searchPointsInArea: jest.fn(),
    searchSuggestions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('globalSearch', () => {
    it('should perform global search with all parameters', async () => {
      const query = 'restaurant';
      const types = 'point,photo,review';
      const limit = 20;
      const expectedResult = {
        points: [{ _id: '1', name: 'Restaurant 1', type: 'point' }],
        photos: [{ _id: 'p1', caption: 'Restaurant photo', type: 'photo' }],
        reviews: [{ _id: 'r1', comment: 'Great restaurant', type: 'review' }],
      };

      mockSearchService.globalSearch.mockResolvedValue(expectedResult);

      const result = await controller.globalSearch(query, types, limit);

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.globalSearch).toHaveBeenCalledWith(query, {
        types: ['point', 'photo', 'review'],
        limit,
      });
    });

    it('should perform global search with minimal parameters', async () => {
      const query = 'cafe';
      const expectedResult = {
        results: [
          { _id: '1', name: 'Cafe 1' },
          { _id: '2', name: 'Cafe 2' },
        ],
      };

      mockSearchService.globalSearch.mockResolvedValue(expectedResult);

      const result = await controller.globalSearch(query);

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.globalSearch).toHaveBeenCalledWith(query, {
        types: undefined,
        limit: undefined,
      });
    });
  });

  describe('searchInArea', () => {
    it('should search points in geographic area with filters', async () => {
      const bounds = {
        north: 48.9,
        south: 48.8,
        east: 2.4,
        west: 2.3,
      };
      const categories = 'restaurant,cafe';
      const minRating = 4;
      const expectedResult = [
        {
          _id: '1',
          name: 'Restaurant in Area',
          location: { lat: 48.85, lng: 2.35 },
          category: 'restaurant',
          rating: 4.5,
        },
      ];

      mockSearchService.searchPointsInArea.mockResolvedValue(expectedResult);

      const result = await controller.searchInArea(
        bounds.north,
        bounds.south,
        bounds.east,
        bounds.west,
        categories,
        minRating,
      );

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.searchPointsInArea).toHaveBeenCalledWith(
        bounds,
        {
          categories: ['restaurant', 'cafe'],
          minRating,
        },
      );
    });

    it('should search points in area without filters', async () => {
      const bounds = {
        north: 48.9,
        south: 48.8,
        east: 2.4,
        west: 2.3,
      };
      const expectedResult = [];

      mockSearchService.searchPointsInArea.mockResolvedValue(expectedResult);

      const result = await controller.searchInArea(
        bounds.north,
        bounds.south,
        bounds.east,
        bounds.west,
      );

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.searchPointsInArea).toHaveBeenCalledWith(
        bounds,
        {},
      );
    });
  });

  describe('getSuggestions', () => {
    it('should return search suggestions', async () => {
      const query = 'rest';
      const expectedResult = ['restaurant', 'rest area', 'restoration site'];

      mockSearchService.searchSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.getSuggestions(query);

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.searchSuggestions).toHaveBeenCalledWith(query);
    });

    it('should handle empty query', async () => {
      const query = '';
      const expectedResult = [];

      mockSearchService.searchSuggestions.mockResolvedValue(expectedResult);

      const result = await controller.getSuggestions(query);

      expect(result).toEqual(expectedResult);
      expect(mockSearchService.searchSuggestions).toHaveBeenCalledWith(query);
    });
  });
});
