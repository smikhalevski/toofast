import type { HistogramSummary } from '../Histogram.ts';

/**
 * The role of a piece of text in the report. The reporter decides how each role looks, for example, which color it
 * has.
 */
export type Style =
  | 'describe_name'
  | 'warmup_symbol'
  | 'progress_symbol'
  | 'progress_percentage'
  | 'measure_index'
  | 'success_symbol'
  | 'error_symbol'
  | 'error_message'
  | 'number_integer'
  | 'number_fraction'
  | 'not_available'
  | 'rme';

export interface FormatDescribeStartParams {
  /**
   * The number of describe blocks that enclose this one.
   */
  depth: number;
  name: string;
}

export interface FormatTestStartParams {
  /**
   * The number of describe blocks that enclose the test.
   */
  depth: number;

  /**
   * The name of the test, padded to align results of sibling tests.
   */
  testName: string;
}

export interface FormatWarmupStartedParams extends FormatTestStartParams {
  measureIndex: number;
  measureCount: number;
}

export interface FormatProgressUpdatedParams extends FormatWarmupStartedParams {
  /**
   * The progress of the measure, between `0` and `1`.
   */
  percentage: number;
}

export interface FormatTestEndedParams extends FormatTestStartParams {
  /**
   * `true` if the test has thrown an error.
   */
  isFailed: boolean;
  durationSummary: HistogramSummary;
  memorySummary: HistogramSummary;
}

/**
 * Formats lines of the report. Lines don't end with a line break, so the reporter decides how lines follow each other.
 */
export interface Formatter {
  formatDescribeStart(params: FormatDescribeStartParams): string;

  /**
   * Formats the pending status of a test.
   */
  formatTestStart(params: FormatTestStartParams): string;

  formatWarmupStarted(params: FormatWarmupStartedParams): string;

  formatProgressUpdated(params: FormatProgressUpdatedParams): string;

  /**
   * Formats the result of a test.
   */
  formatTestEnded(params: FormatTestEndedParams): string;

  formatError(errorMessage: string): string;
}

export interface FormatterOptions {
  /**
   * Styles a piece of text by its role, for example, colors it. By default, text isn't styled.
   */
  applyStyle?: (style: Style, text: string) => string;

  /**
   * The indent of each nesting level, and the gap between columns.
   *
   * @default '  '
   */
  padding?: string;

  /**
   * @default '●'
   */
  warmupSymbol?: string;

  /**
   * @default '✓'
   */
  successSymbol?: string;

  /**
   * @default '✗'
   */
  errorSymbol?: string;

  /**
   * Symbols that show the progress of a measure, from 0% to 100%.
   *
   * @default ['○', '◔', '◑', '◕', '●']
   */
  progressSymbols?: readonly string[];
}

/**
 * Creates a formatter of report lines. It only produces text, so it doesn't depend on the stream the report is
 * printed to.
 */
export function createFormatter(options: FormatterOptions = {}): Formatter {
  const {
    applyStyle = (style, text) => text,
    padding = '  ',
    warmupSymbol = '●',
    successSymbol = '✓',
    errorSymbol = '✗',
    progressSymbols = ['○', '◔', '◑', '◕', '●'],
  } = options;

  function formatProgressSymbol(percentage: number): string {
    const symbol = progressSymbols[Math.trunc(percentage * (progressSymbols.length - 1))];

    return applyStyle('progress_symbol', symbol + ' ');
  }

  function formatMeasureIndex(measureIndex: number, measureCount: number): string {
    if (measureCount === 1) {
      return '';
    }
    const measureIndexLabel = integerFormat.format(measureIndex + 1) + '/' + integerFormat.format(measureCount);

    return applyStyle('measure_index', measureIndexLabel);
  }

  function formatMeasurement(value: number, unit: string): string {
    let unitLabel = ' ' + unit + ' ';

    if (value > 1000) {
      value /= 1000;
      unitLabel = ' k' + unit;
    }
    if (value > 1000) {
      value /= 1000;
      unitLabel = ' M' + unit;
    }
    if (value > 1000) {
      value /= 1000;
      unitLabel = ' G' + unit;
    }

    const valueLabel = decimalFormat
      .format(value)
      .padStart(5)
      .replace(/\.\d+$/, fraction => applyStyle('number_fraction', fraction));

    return applyStyle('number_integer', valueLabel) + unitLabel;
  }

  /**
   * Formats a value and its margin of error, or `n/a` if nothing was measured.
   */
  function formatSummary(summary: HistogramSummary, value: number, unit: string): string {
    if (summary.size === 0) {
      // A value that wasn't measured isn't shown as zero, and the column keeps its width
      return applyStyle('not_available', 'n/a'.padStart(5)) + ' '.repeat(unit.length + 11);
    }

    // For example, the margin of error is unknown if a measure has run a single batch
    const rmeLabel = Number.isNaN(summary.rme) ? 'n/a' : rmeFormat.format(summary.rme);

    return formatMeasurement(value, unit) + applyStyle('rme', ' ± ' + rmeLabel.padEnd(6));
  }

  return {
    formatDescribeStart(params) {
      const { depth, name } = params;

      return padding.repeat(depth) + applyStyle('describe_name', name);
    },

    formatTestStart(params) {
      const { depth, testName } = params;

      return padding.repeat(depth) + formatProgressSymbol(0) + testName + padding;
    },

    formatWarmupStarted(params) {
      const { depth, testName, measureIndex, measureCount } = params;

      return (
        padding.repeat(depth) +
        applyStyle('warmup_symbol', warmupSymbol + ' ') +
        testName +
        padding +
        formatMeasureIndex(measureIndex, measureCount) +
        padding
      );
    },

    formatProgressUpdated(params) {
      const { depth, testName, measureIndex, measureCount, percentage } = params;

      return (
        padding.repeat(depth) +
        formatProgressSymbol(percentage) +
        testName +
        padding +
        formatMeasureIndex(measureIndex, measureCount) +
        applyStyle('progress_percentage', percentFormat.format(percentage).padStart(5))
      );
    },

    formatTestEnded(params) {
      const { depth, testName, isFailed, durationSummary, memorySummary } = params;

      // Durations are in milliseconds
      const hz = 1_000 / durationSummary.mean;

      return (
        padding.repeat(depth) +
        (isFailed ? applyStyle('error_symbol', errorSymbol + ' ') : applyStyle('success_symbol', successSymbol + ' ')) +
        testName +
        padding +
        formatSummary(durationSummary, hz, 'Hz') +
        padding +
        formatSummary(memorySummary, memorySummary.mean, 'B')
      );
    },

    formatError(errorMessage) {
      return applyStyle('error_message', errorMessage);
    },
  };
}

const decimalFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: true,
});

const integerFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

const percentFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  style: 'percent',
});

const rmeFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  style: 'percent',
});
