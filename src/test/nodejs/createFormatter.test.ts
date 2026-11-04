import { describe, expect, test } from 'vitest';
import { emptyHistogramSummary } from '../../main/Histogram.ts';
import { createFormatter } from '../../main/nodejs/createFormatter.ts';

describe('createFormatter', () => {
  // By default, text isn't styled, so lines can be compared as is
  const formatter = createFormatter();

  test('styles text by its role', () => {
    const styledFormatter = createFormatter({
      applyStyle: (style, text) => '<' + style + '>' + text + '</' + style + '>',
    });

    expect(styledFormatter.formatDescribeStart({ depth: 1, name: 'aaa' })).toBe('  <describe_name>aaa</describe_name>');
  });

  test('uses custom padding and symbols', () => {
    const customFormatter = createFormatter({
      padding: '_',
      warmupSymbol: 'bbb',
      successSymbol: 'ccc',
      errorSymbol: 'ddd',
      progressSymbols: ['eee', 'fff'],
    });

    const testEndedParams = {
      depth: 0,
      testName: 'aaa',
      durationSummary: emptyHistogramSummary,
      memorySummary: emptyHistogramSummary,
    };

    expect(customFormatter.formatTestStart({ depth: 1, testName: 'aaa' })).toBe('_eee aaa_');
    expect(customFormatter.formatWarmupStarted({ depth: 0, testName: 'aaa', measureIndex: 0, measureCount: 1 })).toBe(
      'bbb aaa__'
    );
    expect(customFormatter.formatTestEnded({ ...testEndedParams, isFailed: false })).toMatch(/^ccc aaa_/);
    expect(customFormatter.formatTestEnded({ ...testEndedParams, isFailed: true })).toMatch(/^ddd aaa_/);
  });

  test('formats the result of a test', () => {
    expect(
      formatter.formatTestEnded({
        depth: 1,
        testName: 'aaa',
        isFailed: false,
        durationSummary: { size: 5, mean: 0.25, rme: 0.0229 },
        memorySummary: { size: 10, mean: 222, rme: 0 },
      })
    ).toBe('  ✓ aaa    4.0 kHz ± 2.29%   222.0 B  ± 0%    ');
  });

  test('formats unknown values and margins of error as n/a', () => {
    expect(
      formatter.formatTestEnded({
        depth: 0,
        testName: 'aaa',
        isFailed: true,
        durationSummary: { size: 1, mean: 0.25, rme: NaN },
        memorySummary: emptyHistogramSummary,
      })
    ).toBe('✗ aaa    4.0 kHz ± n/a       n/a            ');
  });

  test('shows the index of a measure only if a test has several measures', () => {
    const params = { depth: 0, testName: 'aaa', measureIndex: 0, percentage: 0.5 };

    expect(formatter.formatProgressUpdated({ ...params, measureCount: 2 })).toBe('◑ aaa  1/2  50%');
    expect(formatter.formatProgressUpdated({ ...params, measureCount: 1 })).toBe('◑ aaa    50%');
  });
});
