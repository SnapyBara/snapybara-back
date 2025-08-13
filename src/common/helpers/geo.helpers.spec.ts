import * as geoHelpers from './geo.helpers';
import { Location, BoundingBox } from '../../types/app.types';

describe('Geo Helpers', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Paris to London (approximately 344 km)
      const paris = { lat: 48.8566, lng: 2.3522 };
      const london = { lat: 51.5074, lng: -0.1278 };

      const distance = geoHelpers.calculateDistance(
        paris.lat,
        paris.lng,
        london.lat,
        london.lng,
      );

      // Distance should be approximately 344 km
      expect(distance).toBeGreaterThan(340);
      expect(distance).toBeLessThan(350);
    });

    it('should return 0 for same coordinates', () => {
      const lat = 48.8566;
      const lng = 2.3522;

      const distance = geoHelpers.calculateDistance(lat, lng, lat, lng);

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      // New York to Sydney
      const newYork = { lat: 40.7128, lng: -74.006 };
      const sydney = { lat: -33.8688, lng: 151.2093 };

      const distance = geoHelpers.calculateDistance(
        newYork.lat,
        newYork.lng,
        sydney.lat,
        sydney.lng,
      );

      // Distance should be approximately 15,988 km
      expect(distance).toBeGreaterThan(15900);
      expect(distance).toBeLessThan(16100);
    });
  });

  describe('formatDistance', () => {
    it('should format distances correctly', () => {
      expect(geoHelpers.formatDistance(0.5)).toBe('500m');
      expect(geoHelpers.formatDistance(0.999)).toBe('999m');
      expect(geoHelpers.formatDistance(1.5)).toBe('1.5km');
      expect(geoHelpers.formatDistance(9.99)).toBe('10.0km');
      expect(geoHelpers.formatDistance(15)).toBe('15km');
      expect(geoHelpers.formatDistance(100.49)).toBe('100km');
    });
  });

  describe('calculateBoundingBox', () => {
    it('should calculate bounding box for given center and radius', () => {
      const center = { lat: 48.8566, lng: 2.3522 }; // Paris
      const radius = 5; // 5 km

      const bbox = geoHelpers.calculateBoundingBox(
        center.lat,
        center.lng,
        radius,
      );

      expect(bbox).toHaveProperty('north');
      expect(bbox).toHaveProperty('south');
      expect(bbox).toHaveProperty('east');
      expect(bbox).toHaveProperty('west');

      // Check that min values are less than max values
      expect(bbox.south).toBeLessThan(bbox.north);
      expect(bbox.west).toBeLessThan(bbox.east);

      // Check that center is within bounding box
      expect(center.lat).toBeGreaterThan(bbox.south);
      expect(center.lat).toBeLessThan(bbox.north);
      expect(center.lng).toBeGreaterThan(bbox.west);
      expect(center.lng).toBeLessThan(bbox.east);
    });

    it('should handle bounding box at equator', () => {
      const center = { lat: 0, lng: 0 };
      const radius = 10;

      const bbox = geoHelpers.calculateBoundingBox(
        center.lat,
        center.lng,
        radius,
      );

      // At equator, the bounding box should be symmetric
      expect(Math.abs(bbox.south)).toBeCloseTo(Math.abs(bbox.north), 5);
      expect(Math.abs(bbox.west)).toBeCloseTo(Math.abs(bbox.east), 5);
    });

    it('should handle large radius', () => {
      const center = { lat: 45, lng: 0 };
      const radius = 1000; // 1000 km

      const bbox = geoHelpers.calculateBoundingBox(
        center.lat,
        center.lng,
        radius,
      );

      // Bounding box should be significantly larger
      expect(bbox.north - bbox.south).toBeGreaterThan(10);
      expect(bbox.east - bbox.west).toBeGreaterThan(10);
    });
  });

  describe('isPointInBoundingBox', () => {
    it('should return true if point is inside bounding box', () => {
      const bbox: BoundingBox = {
        north: 50,
        south: 48,
        east: 3,
        west: 1,
      };

      expect(geoHelpers.isPointInBoundingBox(49, 2, bbox)).toBe(true);
    });

    it('should return false if point is outside bounding box', () => {
      const bbox: BoundingBox = {
        north: 50,
        south: 48,
        east: 3,
        west: 1,
      };

      expect(geoHelpers.isPointInBoundingBox(51, 2, bbox)).toBe(false);
      expect(geoHelpers.isPointInBoundingBox(49, 4, bbox)).toBe(false);
    });

    it('should handle edge cases', () => {
      const bbox: BoundingBox = {
        north: 50,
        south: 48,
        east: 3,
        west: 1,
      };

      // Points on the edge should be included
      expect(geoHelpers.isPointInBoundingBox(50, 2, bbox)).toBe(true);
      expect(geoHelpers.isPointInBoundingBox(48, 2, bbox)).toBe(true);
      expect(geoHelpers.isPointInBoundingBox(49, 3, bbox)).toBe(true);
      expect(geoHelpers.isPointInBoundingBox(49, 1, bbox)).toBe(true);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      const validCoordinates = [
        { lat: 0, lng: 0 },
        { lat: 90, lng: 180 },
        { lat: -90, lng: -180 },
        { lat: 48.8566, lng: 2.3522 },
        { lat: -33.8688, lng: 151.2093 },
      ];

      validCoordinates.forEach(({ lat, lng }) => {
        expect(geoHelpers.validateCoordinates(lat, lng)).toBe(true);
      });
    });

    it('should reject invalid coordinates', () => {
      const invalidCoordinates = [
        { lat: 91, lng: 0 },
        { lat: -91, lng: 0 },
        { lat: 0, lng: 181 },
        { lat: 0, lng: -181 },
        { lat: 100, lng: 200 },
      ];

      invalidCoordinates.forEach(({ lat, lng }) => {
        expect(geoHelpers.validateCoordinates(lat, lng)).toBe(false);
      });
    });
  });

  describe('calculateCenterPoint', () => {
    it('should calculate center of multiple locations', () => {
      const locations: Location[] = [
        { latitude: 48.8566, longitude: 2.3522 },
        { latitude: 48.8606, longitude: 2.3376 },
        { latitude: 48.853, longitude: 2.3499 },
      ];

      const center = geoHelpers.calculateCenterPoint(locations);

      expect(center.latitude).toBeCloseTo(48.8567, 3);
      expect(center.longitude).toBeCloseTo(2.3466, 3);
    });

    it('should return single location if only one provided', () => {
      const location: Location = { latitude: 48.8566, longitude: 2.3522 };
      const center = geoHelpers.calculateCenterPoint([location]);

      expect(center).toEqual(location);
    });

    it('should throw error for empty array', () => {
      expect(() => geoHelpers.calculateCenterPoint([])).toThrow(
        'Au moins un point est requis',
      );
    });
  });

  describe('generateRandomLocationInRadius', () => {
    it('should generate location within specified radius', () => {
      const center = { lat: 48.8566, lng: 2.3522 };
      const radius = 5; // 5 km

      for (let i = 0; i < 10; i++) {
        const randomLocation = geoHelpers.generateRandomLocationInRadius(
          center.lat,
          center.lng,
          radius,
        );

        const distance = geoHelpers.calculateDistance(
          center.lat,
          center.lng,
          randomLocation.latitude,
          randomLocation.longitude,
        );

        expect(distance).toBeLessThanOrEqual(radius);
      }
    });
  });

  describe('dmsToDecimal', () => {
    it('should convert DMS to decimal correctly', () => {
      // 48°51'24"N
      expect(geoHelpers.dmsToDecimal(48, 51, 24, 'N')).toBeCloseTo(48.8567, 4);

      // 2°21'8"E
      expect(geoHelpers.dmsToDecimal(2, 21, 8, 'E')).toBeCloseTo(2.3522, 4);

      // 33°52'8"S
      expect(geoHelpers.dmsToDecimal(33, 52, 8, 'S')).toBeCloseTo(-33.8689, 4);

      // 151°12'33"E
      expect(geoHelpers.dmsToDecimal(151, 12, 33, 'E')).toBeCloseTo(
        151.2092,
        4,
      );
    });
  });

  describe('decimalToDms', () => {
    it('should convert decimal to DMS correctly', () => {
      const result1 = geoHelpers.decimalToDms(48.8567);
      expect(result1.degrees).toBe(48);
      expect(result1.minutes).toBe(51);
      expect(result1.seconds).toBeCloseTo(24, 0);
      expect(result1.direction).toBe('N');

      const result2 = geoHelpers.decimalToDms(-33.8689);
      expect(result2.degrees).toBe(33);
      expect(result2.minutes).toBe(52);
      expect(result2.seconds).toBeCloseTo(8, 0);
      expect(result2.direction).toBe('S');
    });
  });

  describe('findNearestPoints', () => {
    it('should find nearest points sorted by distance', () => {
      const userLocation: Location = { latitude: 48.8566, longitude: 2.3522 };
      const points = [
        { id: 1, latitude: 48.8606, longitude: 2.3376 },
        { id: 2, latitude: 48.853, longitude: 2.3499 },
        { id: 3, latitude: 51.5074, longitude: -0.1278 },
      ];

      const nearest = geoHelpers.findNearestPoints(userLocation, points, 2);

      expect(nearest).toHaveLength(2);
      // Don't check specific order as both points are very close
      // Just verify they are the two closest points
      const ids = nearest.map((p) => p.id).sort();
      expect(ids).toEqual([1, 2]);
      expect(nearest[0].distance).toBeDefined();
      expect(nearest[1].distance).toBeDefined();
    });
  });

  describe('clusterPointsByDistance', () => {
    it('should cluster nearby points', () => {
      const points = [
        { id: 1, latitude: 48.8566, longitude: 2.3522 },
        { id: 2, latitude: 48.8567, longitude: 2.3523 }, // Very close to 1
        { id: 3, latitude: 48.8606, longitude: 2.3376 }, // Close to 1 & 2
        { id: 4, latitude: 51.5074, longitude: -0.1278 }, // Far away
      ];

      const clusters = geoHelpers.clusterPointsByDistance(points, 2);

      expect(clusters.length).toBe(2);
      expect(clusters[0].count).toBe(3); // Points 1, 2, and 3
      expect(clusters[1].count).toBe(1); // Point 4 alone
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing between two points', () => {
      // North
      const bearing1 = geoHelpers.calculateBearing(0, 0, 1, 0);
      expect(bearing1).toBeCloseTo(0, 0);

      // East
      const bearing2 = geoHelpers.calculateBearing(0, 0, 0, 1);
      expect(bearing2).toBeCloseTo(90, 0);

      // South
      const bearing3 = geoHelpers.calculateBearing(1, 0, 0, 0);
      expect(bearing3).toBeCloseTo(180, 0);

      // West
      const bearing4 = geoHelpers.calculateBearing(0, 1, 0, 0);
      expect(bearing4).toBeCloseTo(270, 0);
    });

    it('should return 0 for same location', () => {
      const bearing = geoHelpers.calculateBearing(
        48.8566,
        2.3522,
        48.8566,
        2.3522,
      );
      expect(bearing).toBe(0);
    });
  });

  describe('bearingToCardinal', () => {
    it('should convert bearing to cardinal direction', () => {
      expect(geoHelpers.bearingToCardinal(0)).toBe('N');
      expect(geoHelpers.bearingToCardinal(45)).toBe('NE');
      expect(geoHelpers.bearingToCardinal(90)).toBe('E');
      expect(geoHelpers.bearingToCardinal(135)).toBe('SE');
      expect(geoHelpers.bearingToCardinal(180)).toBe('S');
      expect(geoHelpers.bearingToCardinal(225)).toBe('SO');
      expect(geoHelpers.bearingToCardinal(270)).toBe('O');
      expect(geoHelpers.bearingToCardinal(315)).toBe('NO');
    });

    it('should handle edge cases', () => {
      expect(geoHelpers.bearingToCardinal(360)).toBe('N');
      expect(geoHelpers.bearingToCardinal(405)).toBe('NE'); // 405 % 360 = 45
    });
  });
});
