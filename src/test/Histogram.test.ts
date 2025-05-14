import { expect, test } from 'vitest';
import { Histogram } from '../main/Histogram.js';

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

test('calculates stats for a single item', () => {
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

test('calculates stats for multiple items', () => {
  const histogram = new Histogram();

  histogram.add(1);
  histogram.add(2);
  histogram.add(3);

  expect(histogram.size).toBe(3);
  expect(histogram.mean).toBe(2);
  expect(histogram.variance).toBeCloseTo(0.6666);
  expect(histogram.sd).toBeCloseTo(0.8164);
  expect(histogram.sem).toBeCloseTo(0.4714);
  expect(histogram.moe).toBeCloseTo(1.5);
  expect(histogram.rme).toBeCloseTo(0.75);
  expect(histogram.hz).toBe(500);
});
