import { describe, expect, test } from 'vitest';
import { globToRegExp } from '../main/utils.ts';

describe('globToRegExp', () => {
  test('matches any characters with * case-insensitively', () => {
    const re = globToRegExp('aaa*');

    expect(re.test('AAA.bbb')).toBe(true);
    expect(re.test('bbb.aaa')).toBe(false);
  });

  test('matches RegExp characters literally', () => {
    expect(globToRegExp('aaa.bbb').test('aaa_bbb')).toBe(false);
  });
});
