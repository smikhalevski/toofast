import { describe, expect, test } from 'vitest';
import { Histogram } from '../main/Histogram.ts';

describe('Histogram', () => {
  test('creates a blank histogram', () => {
    const histogram = new Histogram();

    expect(histogram.size).toBe(0);
    expect(histogram.mean).toBe(0);
    expect(histogram.variance).toBe(0);
    expect(histogram.sd).toBe(0);
    expect(histogram.sem).toBe(0);
    expect(histogram.moe).toBe(0);
    expect(histogram.rme).toBe(0);
    expect(histogram.hz).toBe(0);
  });

  test('calculates stats for a single value', () => {
    const histogram = new Histogram();

    histogram.add(1);

    expect(histogram.size).toBe(1);
    expect(histogram.mean).toBe(1);
    expect(histogram.variance).toBe(0);
    expect(histogram.sd).toBe(0);
    expect(histogram.sem).toBe(0);
    expect(histogram.moe).toBe(0);
    expect(histogram.rme).toBe(0);
    expect(histogram.hz).toBe(1000);
  });

  test('calculates stats for multiple values', () => {
    const histogram = new Histogram();

    histogram.add(1);
    histogram.add(2);
    histogram.add(3);

    expect(histogram.size).toBe(3);
    expect(histogram.mean).toBe(2);
    expect(histogram.variance).toBe(1);
    expect(histogram.sd).toBe(1);
    expect(histogram.sem).toBeCloseTo(0.5773);
    expect(histogram.moe).toBeCloseTo(2.4843);
    expect(histogram.rme).toBeCloseTo(1.2421);
    expect(histogram.hz).toBe(500);
  });

  test('uses the last critical value if a sample is larger than the t-table', () => {
    const histogram = new Histogram();

    for (let i = 0; i < 1000; ++i) {
      histogram.add(i % 2);
    }

    expect(histogram.moe / histogram.sem).toBeCloseTo(1.98, 4);
  });

  test('variance is 0 if all values are equal', () => {
    const histogram = new Histogram();

    // Rounding errors are produced for this value
    for (let i = 0; i < 7; ++i) {
      histogram.add(0.0005);
    }

    expect(histogram.variance).toBe(0);
  });

  test('rme is 0 if all values are 0', () => {
    const histogram = new Histogram();

    histogram.add(0);
    histogram.add(0);

    expect(histogram.rme).toBe(0);
  });

  test('restores a histogram from its snapshot', () => {
    const histogram = new Histogram();

    histogram.add(1);
    histogram.add(2);
    histogram.add(4);

    // The margin of error depends on all parts of the snapshot
    expect(new Histogram(histogram.getSnapshot()).rme).toBe(histogram.rme);
  });

  test('merges values of another histogram', () => {
    const histogram = new Histogram();
    const otherHistogram = new Histogram();
    const expectedHistogram = new Histogram();

    for (const value of [1, 2]) {
      histogram.add(value);
      expectedHistogram.add(value);
    }
    for (const value of [3, 4, 5]) {
      otherHistogram.add(value);
      expectedHistogram.add(value);
    }

    histogram.merge(otherHistogram);

    expect(histogram.getSnapshot()).toEqual(expectedHistogram.getSnapshot());
  });

  test('merges empty histograms', () => {
    const histogram = new Histogram();

    histogram.merge(new Histogram());

    expect(histogram.getSnapshot()).toEqual(new Histogram().getSnapshot());
  });
});
