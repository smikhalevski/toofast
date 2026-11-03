import { describe, expect, test } from 'vitest';
import { Histogram, summarizeHistograms } from '../main/Histogram.ts';

function makeTestHistogram(values: number[]): Histogram {
  const histogram = new Histogram();

  for (const value of values) {
    histogram.add(value);
  }
  return histogram;
}

describe('Histogram', () => {
  test('creates a blank histogram', () => {
    const histogram = new Histogram();

    expect(histogram.size).toBe(0);
    expect(histogram.mean).toBe(0);
    expect(histogram.variance).toBeNaN();
    expect(histogram.sd).toBeNaN();
    expect(histogram.sem).toBeNaN();
    expect(histogram.moe).toBeNaN();
    expect(histogram.rme).toBeNaN();
  });

  test('calculates stats for a single value', () => {
    const histogram = new Histogram();

    histogram.add(1);

    expect(histogram.size).toBe(1);
    expect(histogram.mean).toBe(1);
    expect(histogram.variance).toBeNaN();
    expect(histogram.sd).toBeNaN();
    expect(histogram.sem).toBeNaN();
    expect(histogram.moe).toBeNaN();
    expect(histogram.rme).toBeNaN();
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
});

describe('summarizeHistograms', () => {
  test('returns an empty summary if there are no values', () => {
    expect(summarizeHistograms([new Histogram()])).toEqual({ size: 0, mean: 0, rme: NaN });
  });

  test('weights histograms equally', () => {
    // The histogram with more values doesn't outweigh the other one
    expect(summarizeHistograms([makeTestHistogram([1, 2]), makeTestHistogram([3, 4, 5, 6, 7, 8])]).mean).toBe(3.5);
  });

  test('does not count the gap between means of histograms as an error', () => {
    expect(summarizeHistograms([makeTestHistogram([1, 1]), makeTestHistogram([3, 3])])).toEqual({
      size: 4,
      mean: 2,
      rme: 0,
    });
  });

  test('takes degrees of freedom from the Welch–Satterthwaite equation', () => {
    // The second histogram varies more, so degrees of freedom are 5.88 ≈ 6: between 4 of each histogram and 8 of both
    const summary = summarizeHistograms([makeTestHistogram([1, 2, 3, 4, 5]), makeTestHistogram([2, 4, 6, 8, 10])]);

    expect(summary.rme).toBeCloseTo(0.4299, 4);
  });

  test('keeps the margin of error of a single histogram', () => {
    // Rounding errors make degrees of freedom of these values slightly less than 7
    const histogram = makeTestHistogram([0, 11, 22, 33, 44, 55, 66, 77]);

    expect(summarizeHistograms([histogram]).rme).toBeCloseTo(histogram.rme, 10);
  });

  test('margin of error is unknown if a histogram has a single value', () => {
    expect(summarizeHistograms([makeTestHistogram([1, 2]), makeTestHistogram([3])]).rme).toBeNaN();
  });

  test('skips histograms without values', () => {
    const histogram = makeTestHistogram([1, 2, 3]);

    expect(summarizeHistograms([histogram, new Histogram()])).toEqual(summarizeHistograms([histogram]));
  });
});
