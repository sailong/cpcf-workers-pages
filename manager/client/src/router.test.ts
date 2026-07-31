import { describe, expect, it } from 'vitest';
import { routePathname } from './router-path';

describe('routePathname', () => {
  it('matches application routes independently of query strings and fragments', () => {
    expect(routePathname('/deployments?status=failed')).toBe('/deployments');
    expect(routePathname('/resources#r2')).toBe('/resources');
    expect(routePathname('/trash?kind=kv#expiring')).toBe('/trash');
  });
});
