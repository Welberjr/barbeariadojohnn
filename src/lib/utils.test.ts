import { describe, expect, it } from 'vitest';

import { formatDate } from './utils';

describe('formatDate', () => {
  it('uses the barbershop timezone for server and browser rendering', () => {
    const instant = '2026-07-29T01:30:00.000Z';

    expect(formatDate(instant)).toBe('28/07/2026');
    expect(formatDate(instant, 'datetime')).toContain('28/07/2026');
    expect(formatDate(instant, 'datetime')).toContain('22:30');
  });
});
