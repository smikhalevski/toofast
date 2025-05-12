import { bold, dim, green, red, yellow } from 'kleur/colors';
import rl from 'readline';
import { MasterLifecycleHandlers } from '../runner/types.js';
import { getErrorMessage, getNameLength } from '../runner/utils.js';

const MESSAGE_PADDING = '  ';
const MESSAGE_PENDING = dim('○ ');
const MESSAGE_PENDING_ERROR = red('○ ');
const MESSAGE_WARMUP = yellow('○ ');
const MESSAGE_ERROR = red('● ');
const MESSAGE_SUCCESS = green('● ');
const NEW_LINE = '\n';

export function createLoggingHandlers(): MasterLifecycleHandlers {
  let depth = 0;
  let testName: string;
  let errorMessage: string | undefined;
  let measureCount = 0;

  return {
    onDescribeStart(node) {
      if (node.parent.type !== 'testSuite' || node.parent.children[0] !== node) {
        print(NEW_LINE);
      }
      print(MESSAGE_PADDING.repeat(depth) + bold(node.name) + NEW_LINE);
      ++depth;
    },

    onDescribeEnd(_node) {
      --depth;
    },

    onTestStart(node) {
      if (errorMessage !== undefined) {
        print(NEW_LINE + NEW_LINE);
      } else if (node.parent.children[node.parent.children.indexOf(node) - 1]?.type === 'describe') {
        print(NEW_LINE);
      }

      testName = node.name.padEnd(getNameLength(node));
      measureCount = 0;
      errorMessage = undefined;

      clearLine();
      print(MESSAGE_PADDING.repeat(depth) + MESSAGE_PENDING + testName + MESSAGE_PADDING);
    },

    onTestEnd(_node, durationStats, memoryStats) {
      clearLine();
      print(
        MESSAGE_PADDING.repeat(depth) +
          (errorMessage ? MESSAGE_ERROR : MESSAGE_SUCCESS) +
          testName +
          MESSAGE_PADDING +
          formatMeasurement(durationStats.hz, 'Hz') +
          formatRme(durationStats.rme) +
          MESSAGE_PADDING +
          formatMeasurement(memoryStats.mean, 'B') +
          formatRme(memoryStats.rme) +
          NEW_LINE +
          (errorMessage ? red(errorMessage) : '')
      );
    },

    onTestFatalError(_node, error) {
      errorMessage = getErrorMessage(error);
      clearLine();
      print(MESSAGE_PADDING.repeat(depth) + MESSAGE_ERROR + testName + NEW_LINE + red(errorMessage));
    },

    onTestSuiteError(_node, error) {
      print(NEW_LINE + NEW_LINE + red(getErrorMessage(error)));
    },

    onMeasureWarmupStart(_node) {
      clearLine();
      print(
        MESSAGE_PADDING.repeat(depth) +
          MESSAGE_WARMUP +
          testName +
          MESSAGE_PADDING +
          formatMeasureCount(measureCount) +
          MESSAGE_PADDING
      );
    },

    onMeasureWarmupEnd(_node) {},

    onMeasureStart(_node) {},

    onMeasureEnd(_node, _stats) {
      ++measureCount;
    },

    onMeasureError(_node, error) {
      if (errorMessage === undefined) {
        errorMessage = getErrorMessage(error);
      }
    },

    onMeasureProgress(_node, percent) {
      clearLine();
      print(
        MESSAGE_PADDING.repeat(depth) +
          (errorMessage ? MESSAGE_PENDING_ERROR : MESSAGE_PENDING) +
          testName +
          MESSAGE_PADDING +
          formatMeasureCount(measureCount) +
          formatPercent(percent)
      );
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

function formatMeasureCount(count: number): string {
  return count > 0 ? dim(integerFormat.format(count + 1) + 'x') : '';
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
    .replace(/\D?\d+$/, dim)
    .padStart(5 + dim('').length);

  return valueLabel + unitLabel;
}

function formatPercent(value: number): string {
  return percentFormat.format(value).padStart(5);
}

function formatRme(rme: number): string {
  return dim(' ± ' + rmeFormat.format(rme).padEnd(6));
}

function clearLine(): void {
  rl.clearLine(process.stdout, 0);
  rl.cursorTo(process.stdout, 0);
}

function print(message: string): void {
  process.stdout.write(message);
}
