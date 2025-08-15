import http from 'k6/http';
import { check, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const cacheHitRate = new Rate('cache_hits');
const cacheMissRate = new Rate('cache_misses');
const cacheResponseTime = new Trend('cache_response_time');
const noCacheResponseTime = new Trend('no_cache_response_time');
const requestsCounter = new Counter('total_requests');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    cache_warmup: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 50,
      startTime: '0s',
      maxDuration: '30s',
    },
    cache_performance: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      startTime: '30s',
    },
  },
  thresholds: {
    cache_response_time: ['p(95)<200', 'p(99)<300'],
    no_cache_response_time: ['p(95)<2000', 'p(99)<3000'],
    cache_hits: ['rate>0.8'],
    http_req_failed: ['rate<0.01'],
  },
};

const testLocations = [
  { lat: 48.8566, lon: 2.3522, radius: 1000 },
  { lat: 48.8584, lon: 2.2945, radius: 1500 },
  { lat: 48.8606, lon: 2.3376, radius: 2000 },
  { lat: 48.8529, lon: 2.3499, radius: 1000 },
  { lat: 48.8738, lon: 2.295, radius: 1500 },
];

export default function () {
  const location =
    testLocations[Math.floor(Math.random() * testLocations.length)];

  group('Cache Performance Test', () => {
    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const url = `${API_BASE_URL}/points/nearby?latitude=${location.lat}&longitude=${location.lon}&radius=${location.radius}`;

    const response = http.get(url, params);
    requestsCounter.add(1);

    const isSuccess = check(response, {
      'status is 200': (r) => r.status === 200,
      'response has data': (r) => {
        try {
          const body = JSON.parse(r.body || '[]');
          return Array.isArray(body) && body.length >= 0;
        } catch {
          return false;
        }
      },
    });

    if (isSuccess) {
      const cacheHeader = response.headers['X-Cache-Status'];
      const responseTime = response.timings.duration;

      if (cacheHeader === 'HIT') {
        cacheHitRate.add(1);
        cacheMissRate.add(0);
        cacheResponseTime.add(responseTime);

        check(response, {
          'cache hit response < 200ms': (r) => r.timings.duration < 200,
        });
      } else {
        cacheHitRate.add(0);
        cacheMissRate.add(1);
        noCacheResponseTime.add(responseTime);

        check(response, {
          'cache miss response < 2000ms': (r) => r.timings.duration < 2000,
        });
      }
    }
  });

  group('Cache Invalidation Test', () => {
    if (Math.random() < 0.05) {
      const authToken = 'test-token';

      const createResponse = http.post(
        `${API_BASE_URL}/points`,
        JSON.stringify({
          name: `Load Test Point ${Date.now()}`,
          category: 'urban',
          latitude: location.lat + (Math.random() * 0.001 - 0.0005),
          longitude: location.lon + (Math.random() * 0.001 - 0.0005),
          address: {
            formattedAddress: 'Load test address',
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (createResponse.status === 201) {
        const pointId = JSON.parse(createResponse.body)._id;

        http.del(`${API_BASE_URL}/points/${pointId}`, null, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    }
  });
}

export function handleSummary(data) {
  const { metrics } = data;
  const output = [];

  output.push('\nCache Performance Test Results:');
  output.push('==============================');

  if (metrics.cache_hits && metrics.total_requests) {
    const hitRate = (metrics.cache_hits.values.rate * 100).toFixed(2);
    output.push(`Cache Hit Rate: ${hitRate}%`);
  }

  if (metrics.cache_response_time) {
    output.push(`\nCache HIT Response Times:`);
    output.push(
      `  Average: ${metrics.cache_response_time.values.avg.toFixed(2)}ms`,
    );
    output.push(
      `  95th percentile: ${metrics.cache_response_time.values['p(95)'].toFixed(2)}ms`,
    );
    output.push(
      `  99th percentile: ${metrics.cache_response_time.values['p(99)'].toFixed(2)}ms`,
    );
  }

  if (metrics.no_cache_response_time) {
    output.push(`\nCache MISS Response Times:`);
    output.push(
      `  Average: ${metrics.no_cache_response_time.values.avg.toFixed(2)}ms`,
    );
    output.push(
      `  95th percentile: ${metrics.no_cache_response_time.values['p(95)'].toFixed(2)}ms`,
    );
    output.push(
      `  99th percentile: ${metrics.no_cache_response_time.values['p(99)'].toFixed(2)}ms`,
    );
  }

  if (metrics.total_requests) {
    output.push(`\nTotal Requests: ${metrics.total_requests.values.count}`);
  }

  if (metrics.http_req_failed) {
    output.push(
      `Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`,
    );
  }

  console.log(output.join('\n'));

  return {
    'cache-performance-summary.json': JSON.stringify(data),
  };
}
