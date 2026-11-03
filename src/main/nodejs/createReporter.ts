import rl from 'readline';
import { type InspectColor, styleText } from 'util';
import { Histogram } from '../Histogram.ts';
import type { WorkerEvent } from '../runner.ts';

type Style = InspectColor | InspectColor[];

const PADDING = '  ';

const SYMBOL_WARMUP = '●';
const SYMBOL_SUCCESS = '●';
const SYMBOL_ERROR = '●';
const SYMBOL_PROGRESS = '○◔◑◕●';

const STYLE_DESCRIBE: Style = 'bold';
const STYLE_WARMUP_SYMBOL: Style = 'yellow';
const STYLE_PROGRESS_SYMBOL: Style = 'dim';
const STYLE_PROGRESS_PERCENTAGE: Style = 'dim';
const STYLE_MEASURE_INDEX: Style = 'gray'; // 2/5
const STYLE_SUCCESS_SYMBOL: Style = 'green';
const STYLE_ERROR_SYMBOL: Style = 'red';
const STYLE_ERROR_MESSAGE: Style = 'red';
const STYLE_NUMBER_INTEGER: Style = 'yellow';
const STYLE_NUMBER_DECIMAL: Style = ['dim', 'yellow'];
const STYLE_RME: Style = 'dim';

export interface Reporter {
  /**
   * Prints the name of a describe block and indents the output that follows.
   */
  printDescribeStart(name: string): void;

  /**
   * Ends the describe block that was started last.
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
   * Prints an error that isn't caused by a test, for example, an error thrown by a describe block.
   */
  printError(errorMessage: string): void;
}

/**
 * Creates a reporter that prints test results.
 *
 * @param stream The stream to print to. Status lines are redrawn in place, so they are printed only if the stream is a
 * TTY. Colors are used if the stream supports them.
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
    const symbol =
      SYMBOL_PROGRESS[Math.min(Math.trunc(percentage * SYMBOL_PROGRESS.length), SYMBOL_PROGRESS.length - 1)];

    // Other measures of a failed test still run
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
      .replace(/\D\d+$/, fraction => applyStyle(STYLE_NUMBER_DECIMAL, fraction));

    return applyStyle(STYLE_NUMBER_INTEGER, valueLabel) + unitLabel;
  }

  function formatRme(histogram: Histogram): string {
    // The margin of error is unknown for a single sample
    if (histogram.size < 2) {
      return ' '.repeat(9);
    }

    return applyStyle(STYLE_RME, ' ± ' + rmeFormat.format(histogram.rme).padEnd(6));
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
              formatMeasurement(durationHistogram.hz, 'Hz') +
              formatRme(durationHistogram) +
              PADDING +
              formatMeasurement(memoryHistogram.mean, 'B') +
              formatRme(memoryHistogram) +
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
