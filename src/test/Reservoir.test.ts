import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { Reservoir, summarizeReservoirs } from '../main/Reservoir.ts';

function makeTestReservoir(values: number[]): Reservoir {
  const reservoir = new Reservoir(10);

  for (const value of values) {
    reservoir.add(value);
  }
  return reservoir;
}

describe('Reservoir', () => {
  test('returns percentiles interpolated between the nearest values', () => {
    const reservoir = makeTestReservoir([333, 111, 222]);

    expect(reservoir.getPercentile(0)).toBe(111);
    expect(reservoir.getPercentile(25)).toBe(166.5);
    expect(reservoir.getPercentile(100)).toBe(333);
  });

  test('returns NaN if there are no values', () => {
    expect(makeTestReservoir([]).getPercentile(50)).toBeNaN();
  });

  test('keeps new values at random once it is full', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0);

    onTestFinished(() => {
      randomSpy.mockRestore();
    });

    const reservoir = new Reservoir(2);

    reservoir.add(111);
    reservoir.add(222);

    // Kept with the chance of 2/3
    reservoir.add(333);

    // Kept with the chance of 2/4, and replaces the first value
    reservoir.add(444);

    expect(reservoir.count).toBe(4);
    expect(reservoir.getPercentile(0)).toBe(222);
    expect(reservoir.getPercentile(100)).toBe(444);
  });
});

describe('summarizeReservoirs', () => {
  test('returns means of percentiles of reservoirs that have values', () => {
    const reservoirs = [makeTestReservoir([111]), makeTestReservoir([333]), makeTestReservoir([])];

    expect(summarizeReservoirs(reservoirs, [50])).toEqual([222]);
  });

  test('returns NaN if no reservoir has values', () => {
    expect(summarizeReservoirs([makeTestReservoir([])], [50])).toEqual([NaN]);
  });
});
