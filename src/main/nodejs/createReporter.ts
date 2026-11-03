import rl from 'readline';
import { type InspectColor, styleText } from 'util';
import { Histogram } from '../Histogram.ts';
import type { WorkerEvent } from '../runner.ts';

type Style = InspectColor | InspectColor[];

const PADDING = '  ';

const SYMBOL_WARMUP = '●';
const SYMBOL_SUCCESS = '✓';
const SYMBOL_ERROR = '✗';
const SYMBOLS_PROGRESS = '○◔◑◕●';

const STYLE_DESCRIBE: Style = 'bold';
const STYLE_WARMUP_SYMBOL: Style = 'yellow';
const STYLE_PROGRESS_SYMBOL: Style = 'dim';
const STYLE_PROGRESS_PERCENTAGE: Style = 'dim';
const STYLE_MEASURE_INDEX: Style = 'gray'; // 2/5
const STYLE_SUCCESS_SYMBOL: Style = 'green';
const STYLE_ERROR_SYMBOL: Style = 'red';
const STYLE_ERROR_MESSAGE: Style = 'red';
const STYLE_NUMBER_INTEGER: Style = 'yellow';
const STYLE_NUMBER_FRACTION: Style = ['dim', 'yellow'];
const STYLE_NOT_AVAILABLE: Style = 'dim';
const STYLE_RME: Style = 'dim';

export interface Reporter {
  /**
   * Prints the name of a describe block and indents the output that follows.
   */
  printDescribeStart(name: string): void;

  /**
   * Removes the indent of the describe block that was started last.
   */
  printDescribeEnd(): void;

  /**
   * Prints the pending status of a test.
   *
   * @param name The name of the test, padded to align results of sibling tests.
   */
  printTestStart(name: string): void;

  /**
   * Prints the progress or the result of the test that was started last.
   */
  printTestEvent(event: WorkerEvent): void;

  /**
   * Prints an error that doesn't belong to a test, for example, an error thrown by a describe block or a test file.
   */
  printError(errorMessage: string): void;
}

/**
 * Creates a reporter that prints test results.
 *
 * @param stream The stream to print to. Progress is redrawn in place, so it's printed only if the stream is a TTY.
 * Colors are used if the stream supports them.
 */
export function createReporter(stream: NodeJS.WritableStream & { isTTY?: boolean } = process.stdout): Reporter {
  const isTTY = stream.isTTY === true;

  let depth = 0;
  let hasMargin = false;
  let testName = '';
  let testErrorMessages: string[] = [];

  function applyStyle(style: Style, text: string): string {
    return styleText(style, text, { stream });
  }

  function print(text: string): void {
    stream.write(text);
  }

  function clearLine(): void {
    if (isTTY) {
      rl.clearLine(stream, 0);
      rl.cursorTo(stream, 0);
    }
  }

  function printStatus(text: string): void {
    if (isTTY) {
      clearLine();
      print(text);
    }
  }

  function formatProgressSymbol(percentage: number): string {
    const symbol = SYMBOLS_PROGRESS[Math.trunc(percentage * (SYMBOLS_PROGRESS.length - 1))];

    return applyStyle(STYLE_PROGRESS_SYMBOL, symbol + ' ');
  }

  function formatMeasureIndex(measureIndex: number, measureCount: number): string {
    if (measureCount === 1) {
      return '';
    }
    const measureIndexLabel = integerFormat.format(measureIndex + 1) + '/' + integerFormat.format(measureCount);

    return applyStyle(STYLE_MEASURE_INDEX, measureIndexLabel);
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
      .replace(/\.\d+$/, fraction => applyStyle(STYLE_NUMBER_FRACTION, fraction));

    return applyStyle(STYLE_NUMBER_INTEGER, valueLabel) + unitLabel;
  }

  function formatRme(histogram: Histogram): string {
    // The margin of error is unknown for a single sample
    const rmeLabel = histogram.size < 2 ? 'n/a' : rmeFormat.format(histogram.rme);

    return applyStyle(STYLE_RME, ' ± ' + rmeLabel.padEnd(6));
  }

  /**
   * Formats a value and its margin of error, or n/a if nothing was measured.
   */
  function formatStats(histogram: Histogram, value: number, unit: string): string {
    if (histogram.size === 0) {
      // A value that wasn't measured isn't shown as zero, and the column keeps its width
      return applyStyle(STYLE_NOT_AVAILABLE, 'n/a'.padStart(5)) + ' '.repeat(unit.length + 11);
    }

    return formatMeasurement(value, unit) + formatRme(histogram);
  }

  return {
    printDescribeStart(name) {
      print('\n' + PADDING.repeat(depth) + applyStyle(STYLE_DESCRIBE, name) + '\n');

      hasMargin = false;
      ++depth;
    },

    printDescribeEnd() {
      hasMargin = true;
      --depth;
    },

    printTestStart(name) {
      testName = name;
      testErrorMessages = [];

      if (hasMargin) {
        print('\n');
      }
      printStatus(PADDING.repeat(depth) + formatProgressSymbol(0) + testName + PADDING);

      hasMargin = false;
    },

    printTestEvent(event) {
      switch (event.type) {
        case 'warmup_started':
          printStatus(
            PADDING.repeat(depth) +
              applyStyle(STYLE_WARMUP_SYMBOL, SYMBOL_WARMUP + ' ') +
              testName +
              PADDING +
              formatMeasureIndex(event.measureIndex, event.measureCount) +
              PADDING
          );
          break;

        case 'progress_updated':
          printStatus(
            PADDING.repeat(depth) +
              formatProgressSymbol(event.percentage) +
              testName +
              PADDING +
              formatMeasureIndex(event.measureIndex, event.measureCount) +
              applyStyle(STYLE_PROGRESS_PERCENTAGE, percentFormat.format(event.percentage).padStart(5))
          );
          break;

        case 'error_caught':
          testErrorMessages.push(event.errorMessage);
          break;

        case 'test_ended': {
          const durationHistogram = new Histogram(event.durationSnapshot);
          const memoryHistogram = new Histogram(event.memorySnapshot);

          clearLine();
          print(
            PADDING.repeat(depth) +
              (testErrorMessages.length !== 0
                ? applyStyle(STYLE_ERROR_SYMBOL, SYMBOL_ERROR + ' ')
                : applyStyle(STYLE_SUCCESS_SYMBOL, SYMBOL_SUCCESS + ' ')) +
              testName +
              PADDING +
              formatStats(durationHistogram, durationHistogram.hz, 'Hz') +
              PADDING +
              formatStats(memoryHistogram, memoryHistogram.mean, 'B') +
              '\n'
          );

          for (const errorMessage of testErrorMessages) {
            print(applyStyle(STYLE_ERROR_MESSAGE, errorMessage) + '\n');
          }

          hasMargin = testErrorMessages.length !== 0;
          break;
        }
      }
    },

    printError(errorMessage) {
      clearLine();
      print(applyStyle(STYLE_ERROR_MESSAGE, errorMessage) + '\n');

      hasMargin = true;
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
