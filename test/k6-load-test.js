import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
  },
};

const locations = [
  { lat: 48.8566, lon: 2.3522 },
  { lat: 48.8584, lon: 2.2945 },
  { lat: 48.8606, lon: 2.3376 },
  { lat: 48.8529, lon: 2.3499 },
  { lat: 48.8738, lon: 2.295 },
];

const categories = ['architecture', 'nature', 'urban', 'historical', 'scenic'];

export default function () {
  const location = locations[Math.floor(Math.random() * locations.length)];
  const category = categories[Math.floor(Math.random() * categories.length)];

  const nearbyResponse = http.get(
    `${API_BASE_URL}/points/nearby?latitude=${location.lat}&longitude=${location.lon}&radius=1000`,
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'GetNearbyPoints' },
    },
  );

  check(nearbyResponse, {
    'nearby points status is 200': (r) => r.status === 200,
    'nearby points response time < 200ms': (r) => r.timings.duration < 200,
    'nearby points returns array': (r) =>
      Array.isArray(JSON.parse(r.body || '[]')),
  });

  errorRate.add(nearbyResponse.status !== 200);

  sleep(0.5);

  const categoryResponse = http.get(
    `${API_BASE_URL}/points?category=${category}&limit=20`,
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'GetPointsByCategory' },
    },
  );

  check(categoryResponse, {
    'category points status is 200': (r) => r.status === 200,
    'category points response time < 200ms': (r) => r.timings.duration < 200,
    'category points has data': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.data && Array.isArray(body.data);
    },
  });

  errorRate.add(categoryResponse.status !== 200);

  sleep(0.5);

  if (Math.random() < 0.2) {
    const searchResponse = http.get(
      `${API_BASE_URL}/points?search=Paris&limit=10`,
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'SearchPoints' },
      },
    );

    check(searchResponse, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(searchResponse.status !== 200);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  const output = [];

  output.push('Load Test Results:');
  output.push('==================');

  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    output.push(`Average response time: ${duration.avg.toFixed(2)}ms`);
    output.push(`95th percentile: ${duration['p(95)'].toFixed(2)}ms`);
    output.push(`99th percentile: ${duration['p(99)'].toFixed(2)}ms`);
  }

  if (metrics.errors) {
    output.push(
      `Error rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%`,
    );
  }

  if (metrics.http_reqs) {
    output.push(`Total requests: ${metrics.http_reqs.values.count}`);
    output.push(
      `Requests per second: ${metrics.http_reqs.values.rate.toFixed(2)}`,
    );
  }

  return output.join('\n');
}
