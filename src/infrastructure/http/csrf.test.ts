import { describe, expect, it } from 'vitest';
import { readCsrfToken } from './csrf';

describe('readCsrfToken', () => {
  it('lee la cookie y valida su formato', () => {
    expect(readCsrfToken('a=1; XSRF-TOKEN=abcdefghijklmnop1234; b=2')).toBe('abcdefghijklmnop1234');
    expect(readCsrfToken('XSRF-TOKEN=short')).toBeNull();
    expect(readCsrfToken('XSRF-TOKEN=abc%0D%0AInjected%3A%20header1234')).toBeNull();
    expect(readCsrfToken('other=1')).toBeNull();
  });
});
