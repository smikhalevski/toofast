import { bold, dim, green, red, yellow } from 'kleur/colors';
import rl from 'readline';
import { MasterLifecycleHandlers } from './types.js';
import { getErrorMessage, getLabelLength } from './utils.js';

const M_PADDING = '  ';
const M_PENDING = dim('○ ');
const M_PENDING_ERROR = red('○ ');
const M_WARMUP = yellow('○ ');
const M_ERROR = red('● ');
const M_SUCCESS = green('● ');

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

const rmeFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  style: 'percent',
});

export function createLoggingHandlers(): MasterLifecycleHandlers {
  let depth = 0;
  let testLabel: string;
  let errorMessage: string | undefined;
  let measureCount = 0;

  const percentFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    style: 'percent',
  });

  return {
    onDescribeStart(node) {
      if (node.parent.type !== 'testSuite' || node.parent.children[0] !== node) {
        write('\n');
      }
      write(M_PADDING.repeat(depth) + bold(node.label) + '\n');
      ++depth;
    },

    onDescribeEnd(_node) {
      --depth;
    },

    onTestStart(node) {
      if (errorMessage != null) {
        write('\n\n');
      } else if (node.parent.children[node.parent.children.indexOf(node) - 1]?.type === 'describe') {
        write('\n');
      }

      testLabel = node.label.padEnd(getLabelLength(node));
      measureCount = 0;
      errorMessage = undefined;

      clearLine();
      write(M_PADDING.repeat(depth) + M_PENDING + testLabel + M_PADDING);
    },

    onTestEnd(_node, durationStats, memoryStats) {
      clearLine();
      write(
        M_PADDING.repeat(depth) +
          (errorMessage ? M_ERROR : M_SUCCESS) +
          testLabel +
          M_PADDING +
          formatMeasurement(durationStats.hz, 'Hz') +
          formatRme(durationStats.rme) +
          M_PADDING +
          formatMeasurement(memoryStats.mean, 'B') +
          formatRme(memoryStats.rme) +
          '\n' +
          (errorMessage ? red(errorMessage) : '')
      );
    },

    onTestFatalError(_node, error) {
      errorMessage = getErrorMessage(error);
      clearLine();
      write(M_PADDING.repeat(depth) + M_ERROR + testLabel + '\n' + red(errorMessage));
    },

    onTestSuiteError(_node, error) {
      write('\n\n' + red(getErrorMessage(error)));
    },

    onMeasureWarmupStart(_node) {
      clearLine();
      write(M_PADDING.repeat(depth) + M_WARMUP + testLabel + M_PADDING + formatMeasureCount(measureCount) + M_PADDING);
    },

    onMeasureWarmupEnd(_node) {},

    onMeasureStart(_node) {},

    onMeasureEnd(_node, _stats) {
      ++measureCount;
    },

    onMeasureError(_node, error) {
      errorMessage ||= getErrorMessage(error);
    },

    onMeasureProgress(_node, percent) {
      clearLine();
      write(
        M_PADDING.repeat(depth) +
          (errorMessage ? M_PENDING_ERROR : M_PENDING) +
          testLabel +
          M_PADDING +
          formatMeasureCount(measureCount) +
          percentFormat.format(percent).padStart(5)
      );
    },
  };
}

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

function formatRme(rme: number): string {
  return dim(' ± ' + rmeFormat.format(rme).padEnd(6));
}

function clearLine(): void {
  rl.clearLine(process.stdout, 0);
  rl.cursorTo(process.stdout, 0);
}

function write(message: string): void {
  process.stdout.write(message);
}
