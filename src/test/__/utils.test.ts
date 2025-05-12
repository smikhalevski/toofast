import { beforeEach, describe, expect, test, vi } from 'vitest';
import { combineHooks } from '../../main/___/utils.js';

describe('combineHooks', () => {
  const aMock = vi.fn();
  const bMock = vi.fn();

  beforeEach(() => {
    aMock.mockReset();
    bMock.mockReset();
  });

  test('returns undefined', () => {
    expect(combineHooks(undefined, undefined)).toBeUndefined();
  });

  test('returns a hook', async () => {
    expect(combineHooks(aMock, undefined)).toBe(aMock);
    expect(combineHooks(undefined, bMock)).toBe(bMock);

    const hook = combineHooks(aMock, bMock);
    expect(hook).toBeTypeOf('function');
    expect(hook).not.toBe(aMock);
    expect(hook).not.toBe(bMock);

    await hook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });
});
