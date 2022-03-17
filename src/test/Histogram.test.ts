import {Histogram} from '../main';

describe('Histogram', () => {

  test('creates a blank histogram', () => {
    const histogram = new Histogram();

    expect(histogram.size).toBe(0);
    expect(histogram.getMean()).toBe(0);
    expect(histogram.getVariance()).toBe(0);
    expect(histogram.getSd()).toBe(0);
    expect(histogram.getSem()).toBe(0);
    expect(histogram.getMoe()).toBe(0);
    expect(histogram.getRme()).toBe(0);
    expect(histogram.getHz()).toBe(0);
  });

  test('calculates stats for a single item', () => {
    const histogram = new Histogram();

    histogram.add(1);

    expect(histogram.size).toBe(1);
    expect(histogram.getMean()).toBe(1);
    expect(histogram.getVariance()).toBe(0);
    expect(histogram.getSd()).toBe(0);
    expect(histogram.getSem()).toBe(0);
    expect(histogram.getMoe()).toBe(0);
    expect(histogram.getRme()).toBe(0);
    expect(histogram.getHz()).toBe(1000);
  });

  test('calculates stats for multiple items', () => {
    const histogram = new Histogram();

    histogram.add(1);
    histogram.add(2);
    histogram.add(3);

    expect(histogram.size).toBe(3);
    expect(histogram.getMean()).toBe(2);
    expect(histogram.getVariance()).toBeCloseTo(0.6666);
    expect(histogram.getSd()).toBeCloseTo(0.8164);
    expect(histogram.getSem()).toBeCloseTo(0.4714);
    expect(histogram.getMoe()).toBeCloseTo(1.5);
    expect(histogram.getRme()).toBeCloseTo(0.75);
    expect(histogram.getHz()).toBe(500);
  });
});
