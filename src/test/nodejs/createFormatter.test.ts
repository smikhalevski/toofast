import { describe, expect, test } from 'vitest';
import { emptyHistogramSummary } from '../../main/Histogram.ts';
import { createFormatter } from '../../main/nodejs/createFormatter.ts';

describe('createFormatter', () => {
  // By default, text isn't styled, so lines can be compared as is
  const formatter = createFormatter();

  // Wraps text in tags named by its role, so roles can be checked
  const styledFormatter = createFormatter({
    applyStyle: (textRole, text) => '<' + textRole + '>' + text + '</' + textRole + '>',
  });

  const secondsFormatter = createFormatter({ durationUnit: 'second' });

  const summaries = {
    durationSummary: { size: 5, mean: 0.25, rme: 0.0229 },
    memorySummary: { size: 10, mean: 222, rme: 0 },
  };

  test('styles text by its role', () => {
    expect(styledFormatter.formatError('aaa')).toBe('<error_message>aaa</error_message>');
  });

  test('uses custom padding, separators, symbols and names of columns', () => {
    const customFormatter = createFormatter({
      padding: '_',
      columnSeparator: 'jjj',
      warmupSymbol: 'bbb',
      successSymbol: 'ccc',
      errorSymbol: 'ddd',
      progressSymbols: ['eee', 'fff'],
      testColumnName: 'ggg',
      durationColumnName: 'hhh',
      memoryColumnName: 'iii',
    });

    const testEndedParams = {
      depth: 0,
      testName: 'aaa',
      testColumnWidth: 8,
      durationSummary: emptyHistogramSummary,
      memorySummary: emptyHistogramSummary,
    };

    expect(customFormatter.formatHeader(8)).toBe('ggg     jjjhhh                jjjiii');
    expect(customFormatter.formatTestStart({ depth: 1, testName: 'aaa', testColumnWidth: 8 })).toBe('_eee aaa_');
    expect(
      customFormatter.formatWarmupStart({
        depth: 0,
        testName: 'aaa',
        testColumnWidth: 8,
        measureIndex: 0,
        measureCount: 1,
      })
    ).toBe('bbb aaa    _');
    expect(customFormatter.formatTestEnd({ ...testEndedParams, isFailed: false })).toMatch(/^ccc aaa /);
    expect(customFormatter.formatTestEnd({ ...testEndedParams, isFailed: true })).toMatch(/^ddd aaa /);
  });

  test('pads symbols to the widest one, so names of tests are aligned', () => {
    const customFormatter = createFormatter({ warmupSymbol: 'bbb' });

    expect(
      customFormatter.formatWarmupStart({
        depth: 0,
        testName: 'aaa',
        testColumnWidth: 7,
        measureIndex: 0,
        measureCount: 1,
      })
    ).toMatch(/^bbb aaa/);
    expect(
      customFormatter.formatTestEnd({ depth: 0, testName: 'aaa', testColumnWidth: 7, isFailed: false, ...summaries })
    ).toMatch(/^✓   aaa │/);
  });

  test('fits names of tests at all depths in the test column', () => {
    // The nested test has an indent, a symbol and a space before its name
    expect(
      formatter.getTestColumnWidth([
        { kind: 'test', depth: 0, name: 'aaa' },
        { kind: 'test', depth: 1, name: 'cccc' },
      ])
    ).toBe(8);
  });

  test('fits names of describe blocks in the test column', () => {
    // The nested describe block has an indent before its name
    expect(formatter.getTestColumnWidth([{ kind: 'describe', depth: 1, name: 'aaa'.repeat(4) }])).toBe(14);
  });

  test('fits the name of the column in the test column', () => {
    expect(formatter.getTestColumnWidth([])).toBe('Test'.length);
  });

  test('formats names of columns', () => {
    expect(formatter.formatHeader(8)).toBe('Test     │ Speed               │ Memory');
  });

  test('widens columns of values to fit their names', () => {
    const wideFormatter = createFormatter({ durationColumnName: 'aaa'.repeat(7) });

    expect(wideFormatter.formatHeader(5)).toBe('Test  │ aaaaaaaaaaaaaaaaaaaaa │ Memory');
    expect(wideFormatter.formatEmptyLine(5)).toBe('      │                       │ ');
    expect(
      wideFormatter.formatTestEnd({ depth: 0, testName: 'bbb', testColumnWidth: 5, isFailed: false, ...summaries })
    ).toBe('✓ bbb │   4.00 kHz ±  2.29%   │ 222.00 B  ±  0.00%');
  });

  test('keeps separators of columns in lines without results', () => {
    expect(formatter.formatDescribeStart({ depth: 1, name: 'bbb', testColumnWidth: 8 })).toBe(
      '  bbb    │                     │ '
    );
    expect(formatter.formatEmptyLine(8)).toBe('         │                     │ ');
  });

  test('formats the result of a test', () => {
    expect(
      formatter.formatTestEnd({ depth: 1, testName: 'aaa', testColumnWidth: 7, isFailed: false, ...summaries })
    ).toBe('  ✓ aaa │   4.00 kHz ±  2.29% │ 222.00 B  ±  0.00%');
  });

  test('aligns results of tests at different depths', () => {
    expect(
      formatter.formatTestEnd({ depth: 0, testName: 'aaa', testColumnWidth: 8, isFailed: false, ...summaries })
    ).toBe('✓ aaa    │   4.00 kHz ±  2.29% │ 222.00 B  ±  0.00%');
    expect(
      formatter.formatTestEnd({ depth: 1, testName: 'cccc', testColumnWidth: 8, isFailed: false, ...summaries })
    ).toBe('  ✓ cccc │   4.00 kHz ±  2.29% │ 222.00 B  ±  0.00%');
  });

  test('aligns values and margins of error at the decimal point', () => {
    const params = { depth: 0, testName: 'aaa', testColumnWidth: 5, isFailed: false };

    expect(formatter.formatTestEnd({ ...params, ...summaries })).toBe(
      '✓ aaa │   4.00 kHz ±  2.29% │ 222.00 B  ±  0.00%'
    );
    expect(
      formatter.formatTestEnd({
        ...params,
        durationSummary: { size: 2, mean: 0.25, rme: 0.99994 },
        memorySummary: { size: 2, mean: 999.99, rme: 0.1629 },
      })
    ).toBe('✓ aaa │   4.00 kHz ± 99.99% │ 999.99 B  ± 16.29%');
  });

  test('styles the integer and the fraction of a value separately', () => {
    expect(
      styledFormatter.formatTestEnd({ depth: 0, testName: 'aaa', testColumnWidth: 5, isFailed: false, ...summaries })
    ).toContain('<number_integer>  4</number_integer><number_fraction>.00</number_fraction> kHz');
  });

  test('caps margins of error that round to 100% or more', () => {
    const params = {
      depth: 0,
      testName: 'aaa',
      testColumnWidth: 5,
      isFailed: false,
      durationSummary: { size: 2, mean: 0.25, rme: 0.99995 },
      memorySummary: { size: 2, mean: 222, rme: 111 },
    };

    expect(formatter.formatTestEnd(params)).toBe('✓ aaa │   4.00 kHz ±  ≥100% │ 222.00 B  ±  ≥100%');
    expect(styledFormatter.formatTestEnd(params)).toContain('<excessive_rme> ≥100%</excessive_rme>');
  });

  test('scales values that would round to 1000.00', () => {
    expect(
      formatter.formatTestEnd({
        depth: 0,
        testName: 'aaa',
        testColumnWidth: 5,
        isFailed: false,
        durationSummary: { size: 2, mean: 0.25, rme: 0 },
        memorySummary: { size: 2, mean: 999.996, rme: 0 },
      })
    ).toBe('✓ aaa │   4.00 kHz ±  0.00% │   1.00 kB ±  0.00%');
  });

  test('formats durations in seconds', () => {
    expect(secondsFormatter.formatHeader(5)).toBe('Test  │ Duration           │ Memory');
    expect(
      secondsFormatter.formatTestEnd({ depth: 0, testName: 'aaa', testColumnWidth: 5, isFailed: false, ...summaries })
    ).toBe('✓ aaa │ 250.00 µs ±  2.29% │ 222.00 B  ±  0.00%');
  });

  test('scales durations in seconds that would round to 1000.00', () => {
    expect(
      secondsFormatter.formatTestEnd({
        depth: 0,
        testName: 'aaa',
        testColumnWidth: 5,
        isFailed: false,
        durationSummary: { size: 2, mean: 999.9996, rme: 0 },
        memorySummary: { size: 2, mean: 222, rme: 0 },
      })
    ).toBe('✓ aaa │   1.00 s  ±  0.00% │ 222.00 B  ±  0.00%');
  });

  test('formats unknown values and margins of error as n/a', () => {
    expect(
      formatter.formatTestEnd({
        depth: 0,
        testName: 'aaa',
        testColumnWidth: 5,
        isFailed: true,
        durationSummary: { size: 1, mean: 0.25, rme: NaN },
        memorySummary: emptyHistogramSummary,
      })
    ).toBe('✗ aaa │   4.00 kHz ±    n/a │    n/a            ');
  });

  test('shows the index of a measure only if a test has several measures', () => {
    const params = { depth: 0, testName: 'aaa', testColumnWidth: 5, measureIndex: 0, percentage: 0.5 };

    expect(formatter.formatProgress({ ...params, measureCount: 2 })).toBe('◑ aaa   1/2  50%');
    expect(formatter.formatProgress({ ...params, measureCount: 1 })).toBe('◑ aaa     50%');
  });
});
