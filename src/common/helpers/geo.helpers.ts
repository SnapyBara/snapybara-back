import { Location, BoundingBox } from '../../types/app.types';

/**
 * Helpers pour la géolocalisation et les calculs de distance
 */

/**
 * Calcule la distance entre deux points en utilisant la formule Haversine
 * @param lat1 Latitude du premier point
 * @param lon1 Longitude du premier point
 * @param lat2 Latitude du second point
 * @param lon2 Longitude du second point
 * @returns Distance en kilomètres
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Arrondi à 2 décimales
}

/**
 * Convertit des degrés en radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formate une distance pour l'affichage
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  }

  return `${Math.round(distanceKm)}km`;
}

/**
 * Calcule un bounding box autour d'un point
 * @param lat Latitude du centre
 * @param lon Longitude du centre
 * @param radiusKm Rayon en kilomètres
 * @returns BoundingBox
 */
export function calculateBoundingBox(
  lat: number,
  lon: number,
  radiusKm: number,
): BoundingBox {
  const latDelta = radiusKm / 111.32; // 1 degré de latitude ≈ 111.32 km
  const lonDelta = radiusKm / (111.32 * Math.cos(toRadians(lat)));

  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    west: lon - lonDelta,
  };
}

/**
 * Vérifie si un point est dans un bounding box
 */
export function isPointInBoundingBox(
  lat: number,
  lon: number,
  bbox: BoundingBox,
): boolean {
  return (
    lat >= bbox.south &&
    lat <= bbox.north &&
    lon >= bbox.west &&
    lon <= bbox.east
  );
}

/**
 * Calcule le point central d'un groupe de coordonnées
 */
export function calculateCenterPoint(locations: Location[]): Location {
  if (locations.length === 0) {
    throw new Error('Au moins un point est requis');
  }

  if (locations.length === 1) {
    return locations[0];
  }

  let totalLat = 0;
  let totalLon = 0;

  locations.forEach((location) => {
    totalLat += location.latitude;
    totalLon += location.longitude;
  });

  return {
    latitude: totalLat / locations.length,
    longitude: totalLon / locations.length,
  };
}

/**
 * Génère des coordonnées aléatoires dans un rayon donné
 * Utile pour les tests et la génération de données fictives
 */
export function generateRandomLocationInRadius(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): Location {
  const radiusInDegrees = radiusKm / 111.32;

  // Génère un angle aléatoire
  const angle = Math.random() * 2 * Math.PI;

  // Génère une distance aléatoire dans le rayon
  const distance = Math.random() * radiusInDegrees;

  // Calcule les nouvelles coordonnées
  const deltaLat = distance * Math.cos(angle);
  const deltaLon =
    (distance * Math.sin(angle)) / Math.cos(toRadians(centerLat));

  return {
    latitude: centerLat + deltaLat,
    longitude: centerLon + deltaLon,
  };
}

/**
 * Valide des coordonnées GPS
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Convertit des coordonnées DMS (Degrees Minutes Seconds) en décimal
 */
export function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: 'N' | 'S' | 'E' | 'W',
): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Convertit des coordonnées décimales en DMS
 */
export function decimalToDms(decimal: number): {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: 'N' | 'S' | 'E' | 'W';
} {
  const isNegative = decimal < 0;
  const absolute = Math.abs(decimal);

  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60 * 100) / 100;

  // Détermine la direction (simplifié - assume latitude si < 90)
  let direction: 'N' | 'S' | 'E' | 'W';
  if (Math.abs(decimal) <= 90) {
    direction = isNegative ? 'S' : 'N';
  } else {
    direction = isNegative ? 'W' : 'E';
  }

  return { degrees, minutes, seconds, direction };
}

/**
 * Trouve les points les plus proches d'une position donnée
 */
export function findNearestPoints<
  T extends { latitude: number; longitude: number },
>(
  userLocation: Location,
  points: T[],
  limit: number = 10,
): Array<T & { distance: number }> {
  const pointsWithDistance = points.map((point) => ({
    ...point,
    distance: calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      point.latitude,
      point.longitude,
    ),
  }));

  return pointsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Groupe des points par proximité (clustering)
 */
export function clusterPointsByDistance<
  T extends { latitude: number; longitude: number },
>(
  points: T[],
  maxDistanceKm: number = 1,
): Array<{ center: Location; points: T[]; count: number }> {
  const clusters: Array<{ center: Location; points: T[]; count: number }> = [];
  const processed = new Set<number>();

  points.forEach((point, index) => {
    if (processed.has(index)) return;

    const cluster = {
      center: { latitude: point.latitude, longitude: point.longitude },
      points: [point],
      count: 1,
    };

    processed.add(index);

    // Trouve tous les points proches
    points.forEach((otherPoint, otherIndex) => {
      if (processed.has(otherIndex)) return;

      const distance = calculateDistance(
        point.latitude,
        point.longitude,
        otherPoint.latitude,
        otherPoint.longitude,
      );

      if (distance <= maxDistanceKm) {
        cluster.points.push(otherPoint);
        cluster.count++;
        processed.add(otherIndex);
      }
    });

    // Recalcule le centre du cluster
    if (cluster.points.length > 1) {
      cluster.center = calculateCenterPoint(cluster.points);
    }

    clusters.push(cluster);
  });

  return clusters;
}

/**
 * Calcule la bearing (direction) entre deux points
 * @returns Bearing en degrés (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Convertit un bearing en direction cardinale
 */
export function bearingToCardinal(bearing: number): string {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSO',
    'SO',
    'OSO',
    'O',
    'ONO',
    'NO',
    'NNO',
  ];

  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}
