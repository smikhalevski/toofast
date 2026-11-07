import type { HistogramSummary } from '../Histogram.ts';

/**
 * The role of a piece of text in the report.
 *
 * The reporter decides how each role looks, for example, which color it has.
 */
export type TextRole =
  | 'column_name'
  | 'column_separator'
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
  | 'rme'
  | 'excessive_rme';

/**
 * A line of the report that shows the name of a describe block or a test in the test column.
 */
export interface TestColumnLine {
  kind: 'describe' | 'test';

  /**
   * The number of describe blocks that enclose the describe block or the test.
   */
  depth: number;

  name: string;
}

export interface FormatDescribeStartParams {
  /**
   * The number of describe blocks that enclose this one.
   */
  depth: number;
  name: string;

  /**
   * The width of the test column, see {@link Formatter.getTestColumnWidth}.
   */
  testColumnWidth: number;
}

export interface FormatTestStartParams {
  /**
   * The number of describe blocks that enclose the test.
   */
  depth: number;

  testName: string;

  /**
   * The width of the test column, see {@link Formatter.getTestColumnWidth}. It's the same for all tests, so their
   * results are aligned.
   */
  testColumnWidth: number;
}

export interface FormatWarmupStartParams extends FormatTestStartParams {
  /**
   * The index of the measure among measures of the test.
   */
  measureIndex: number;

  /**
   * The number of measures of the test.
   */
  measureCount: number;
}

export interface FormatProgressParams extends FormatWarmupStartParams {
  /**
   * The progress of the measure, between `0` and `1`.
   */
  percentage: number;
}

export interface FormatTestEndParams extends FormatTestStartParams {
  /**
   * `true` if the test has thrown an error.
   */
  isFailed: boolean;
  durationSummary: HistogramSummary;
  memorySummary: HistogramSummary;

  /**
   * Values of {@link FormatterOptions.percentiles} in milliseconds, in the same order. A value is `NaN` if it's unknown.
   */
  durationPercentiles: readonly number[];
}

/**
 * The unit of durations in results: `hertz` shows how many times per second a function runs (larger is better), and
 * `second` shows how long a call takes (smaller is better).
 */
export type DurationUnit = 'hertz' | 'second';

/**
 * Formats lines of the report. Lines don't end with a line break, so the reporter decides how lines follow each other.
 */
export interface Formatter {
  /**
   * Returns the width of the test column, which fits the name of the column, and names of describe blocks and tests in
   * lines with their indents and symbols.
   */
  getTestColumnWidth(lines: readonly TestColumnLine[]): number;

  /**
   * Formats names of columns.
   */
  formatHeader(testColumnWidth: number): string;

  /**
   * Formats a line that has only separators of columns, for example, to separate groups of tests.
   */
  formatEmptyLine(testColumnWidth: number): string;

  /**
   * Formats the name of a describe block.
   */
  formatDescribeStart(params: FormatDescribeStartParams): string;

  /**
   * Formats the pending status of a test.
   */
  formatTestStart(params: FormatTestStartParams): string;

  /**
   * Formats the status of a test while a measure warms up.
   */
  formatWarmupStart(params: FormatWarmupStartParams): string;

  /**
   * Formats the progress of a measure of a test.
   */
  formatProgress(params: FormatProgressParams): string;

  /**
   * Formats the result of a test.
   */
  formatTestEnd(params: FormatTestEndParams): string;

  /**
   * Formats an error message.
   */
  formatError(errorMessage: string): string;
}

/**
 * Options of a formatter. Symbols are padded to the widest one, so that names of tests are aligned. Columns are widened
 * to fit their names.
 */
export interface FormatterOptions {
  /**
   * The unit of durations in results.
   *
   * @default 'hertz'
   */
  durationUnit?: DurationUnit;

  /**
   * Percentiles of durations to show, between `0` and `100`. Each percentile has its own column, which shows the value
   * in {@link durationUnit}.
   *
   * @default []
   */
  percentiles?: readonly number[];

  /**
   * Styles a piece of text by its role, for example, colors it. By default, text isn't styled.
   */
  applyStyle?: (textRole: TextRole, text: string) => string;

  /**
   * The indent of each nesting level, and the gap at the end of a status line.
   *
   * @default '  '
   */
  padding?: string;

  /**
   * Separates columns of results and their names.
   *
   * @default ' │ '
   */
  columnSeparator?: string;

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

  /**
   * @default 'Test'
   */
  testColumnName?: string;

  /**
   * The name of the column that shows durations.
   *
   * @default 'Speed' if {@link durationUnit} is 'hertz', or 'Duration' otherwise
   */
  durationColumnName?: string;

  /**
   * @default 'Memory'
   */
  memoryColumnName?: string;
}

const decimalFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const integerFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

const progressFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  style: 'percent',
});

const rmeFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
  style: 'percent',
});

const MAX_VALUE = 999.99;
const MAX_RME = 0.9999;

/**
 * Units from the smallest to the largest, each is 1000 times larger than the previous one. Units are padded to the same
 * width, so margins of error are aligned.
 */
const hertzDurationUnits = ['Hz ', 'kHz', 'MHz', 'GHz'];
const secondDurationUnits = ['ns', 'µs', 'ms', 's '];
const byteUnits = ['B ', 'kB', 'MB', 'GB'];

const maxDecimalWidth = decimalFormat.format(MAX_VALUE).length;
const maxRmeWidth = rmeFormat.format(MAX_RME).length;

/**
 * Creates a formatter of report lines. It only produces text, so it doesn't depend on the stream the report is
 * printed to.
 */
export function createFormatter(options: FormatterOptions = {}): Formatter {
  const {
    durationUnit = 'hertz',
    percentiles = [],
    applyStyle = (_textRole, text) => text,
    padding = '  ',
    columnSeparator = ' │ ',
    warmupSymbol = '●',
    successSymbol = '✓',
    errorSymbol = '✗',
    progressSymbols = ['○', '◔', '◑', '◕', '●'],
    testColumnName = 'Test',
    durationColumnName = durationUnit === 'hertz' ? 'Speed' : 'Duration',
    memoryColumnName = 'Memory',
  } = options;

  const durationUnits = durationUnit === 'hertz' ? hertzDurationUnits : secondDurationUnits;

  const symbolWidth = [successSymbol, errorSymbol, warmupSymbol, ...progressSymbols].reduce(
    (width, symbol) => Math.max(width, symbol.length),
    0
  );

  const styledColumnSeparator = applyStyle('column_separator', columnSeparator);

  // Status lines have no separators, but their parts are aligned with columns of results
  const blankColumnSeparator = ' '.repeat(columnSeparator.length);

  const durationColumnWidth = Math.max(durationColumnName.length, getSummaryWidth(durationUnits));

  const durationColumnPadding = ' '.repeat(durationColumnWidth - getSummaryWidth(durationUnits));

  // A percentile has no margin of error, so it's narrower than the mean
  const percentileValueWidth = maxDecimalWidth + ' '.length + durationUnits[0].length;

  let percentileHeader = '';
  let percentileEmptyColumns = '';

  const percentileColumnPaddings: string[] = [];

  for (const percentile of percentiles) {
    const columnName = 'p' + percentile;
    const columnWidth = Math.max(columnName.length, percentileValueWidth);

    percentileHeader += styledColumnSeparator + applyStyle('column_name', columnName.padEnd(columnWidth));
    percentileEmptyColumns += styledColumnSeparator + ' '.repeat(columnWidth);
    percentileColumnPaddings.push(' '.repeat(columnWidth - percentileValueWidth));
  }

  const emptyColumns =
    styledColumnSeparator + ' '.repeat(durationColumnWidth) + percentileEmptyColumns + styledColumnSeparator;

  function getTestNameStart(depth: number): number {
    return padding.length * depth + symbolWidth + 1;
  }

  /**
   * @param value The value in the smallest unit.
   * @param units Units from the smallest to the largest.
   */
  function formatMeasurement(value: number, units: readonly string[]): string {
    let unitIndex = 0;

    // A value that would round to 1000.00 is shown in the next unit
    while (value > MAX_VALUE && unitIndex < units.length - 1) {
      value /= 1_000;
      unitIndex++;
    }

    const valueLabel = decimalFormat.format(value).padStart(maxDecimalWidth);

    return (
      applyStyle('number_integer', valueLabel.slice(0, -3)) +
      applyStyle('number_fraction', valueLabel.slice(-3)) +
      ' ' +
      units[unitIndex]
    );
  }

  function formatRme(rme: number): string {
    const rmeLabel = Number.isNaN(rme) ? 'n/a' : rmeFormat.format(rme);

    // The margin of error rounds to more than MAX_RME, so the value is unreliable
    if (rmeLabel.length > maxRmeWidth) {
      return applyStyle('rme', ' ± ') + applyStyle('excessive_rme', '≥100%'.padStart(maxRmeWidth));
    }

    return applyStyle('rme', ' ± ' + rmeLabel.padStart(maxRmeWidth));
  }

  function formatSummary(summary: HistogramSummary, value: number, units: readonly string[]): string {
    if (summary.size !== 0) {
      return formatMeasurement(value, units) + formatRme(summary.rme);
    }

    return formatNotAvailable(getSummaryWidth(units));
  }

  /**
   * @param duration The percentile of durations in milliseconds, or `NaN` if it's unknown.
   */
  function formatPercentile(duration: number): string {
    if (Number.isNaN(duration)) {
      return formatNotAvailable(percentileValueWidth);
    }

    return formatMeasurement(toDurationValue(duration), durationUnits);
  }

  function formatNotAvailable(width: number): string {
    return applyStyle('not_available', 'n/a'.padStart(maxDecimalWidth).padEnd(width));
  }

  /**
   * Converts a duration in milliseconds to hertz, or to nanoseconds, which are scaled to larger units when formatted.
   */
  function toDurationValue(duration: number): number {
    return durationUnit === 'hertz' ? 1_000 / duration : duration * 1_000_000;
  }

  function formatMeasureIndex(measureIndex: number, measureCount: number): string {
    if (measureCount === 1) {
      return '';
    }

    const measureIndexLabel = integerFormat.format(measureIndex + 1) + '/' + integerFormat.format(measureCount);

    return applyStyle('measure_index', measureIndexLabel);
  }

  function formatTestColumn(params: FormatTestStartParams, textRole: TextRole, symbol: string): string {
    const { depth, testName, testColumnWidth } = params;

    return (
      padding.repeat(depth) +
      applyStyle(textRole, symbol.padEnd(symbolWidth)) +
      ' ' +
      testName.padEnd(testColumnWidth - getTestNameStart(depth))
    );
  }

  return {
    getTestColumnWidth(lines) {
      let testColumnWidth = testColumnName.length;

      for (const line of lines) {
        const nameStart = line.kind === 'test' ? getTestNameStart(line.depth) : padding.length * line.depth;

        testColumnWidth = Math.max(testColumnWidth, nameStart + line.name.length);
      }

      return testColumnWidth;
    },

    formatHeader(testColumnWidth) {
      return (
        applyStyle('column_name', testColumnName.padEnd(testColumnWidth)) +
        styledColumnSeparator +
        applyStyle('column_name', durationColumnName.padEnd(durationColumnWidth)) +
        percentileHeader +
        styledColumnSeparator +
        applyStyle('column_name', memoryColumnName)
      );
    },

    formatEmptyLine(testColumnWidth) {
      return ' '.repeat(testColumnWidth) + emptyColumns;
    },

    formatDescribeStart(params) {
      const { depth, name, testColumnWidth } = params;

      return (
        padding.repeat(depth) +
        applyStyle('describe_name', name.padEnd(testColumnWidth - padding.length * depth)) +
        emptyColumns
      );
    },

    formatTestStart(params) {
      return formatTestColumn(params, 'progress_symbol', progressSymbols[0]) + padding;
    },

    formatWarmupStart(params) {
      const { measureIndex, measureCount } = params;

      return (
        formatTestColumn(params, 'warmup_symbol', warmupSymbol) +
        blankColumnSeparator +
        formatMeasureIndex(measureIndex, measureCount) +
        padding
      );
    },

    formatProgress(params) {
      const { measureIndex, measureCount, percentage } = params;

      const progressSymbol = progressSymbols[Math.trunc(percentage * (progressSymbols.length - 1))];

      return (
        formatTestColumn(params, 'progress_symbol', progressSymbol) +
        blankColumnSeparator +
        formatMeasureIndex(measureIndex, measureCount) +
        applyStyle('progress_percentage', progressFormat.format(percentage).padStart(5))
      );
    },

    formatTestEnd(params) {
      const { isFailed, durationSummary, memorySummary, durationPercentiles } = params;

      let line =
        (isFailed
          ? formatTestColumn(params, 'error_symbol', errorSymbol)
          : formatTestColumn(params, 'success_symbol', successSymbol)) +
        styledColumnSeparator +
        formatSummary(durationSummary, toDurationValue(durationSummary.mean), durationUnits) +
        durationColumnPadding;

      for (let i = 0; i < percentiles.length; ++i) {
        line += styledColumnSeparator + formatPercentile(durationPercentiles[i]) + percentileColumnPaddings[i];
      }

      return line + styledColumnSeparator + formatSummary(memorySummary, memorySummary.mean, byteUnits);
    },

    formatError(errorMessage) {
      return applyStyle('error_message', errorMessage);
    },
  };
}

/**
 * Returns the width of a value with its unit and margin of error.
 *
 * @param units Units that are padded to the same width.
 */
function getSummaryWidth(units: readonly string[]): number {
  return maxDecimalWidth + ' '.length + units[0].length + ' ± '.length + maxRmeWidth;
}
