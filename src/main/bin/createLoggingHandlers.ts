import {bold, dim, green, red, yellow} from 'kleur/colors';
import rl from 'readline';
import {NodeType} from '../node-types';
import {MasterLifecycleHandlers, Stats} from './bin-types';
import {getErrorMessage, getLabelLength} from './utils';

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
      if (node.parentNode.nodeType !== NodeType.TEST_SUITE || node.parentNode.children[0] !== node) {
        write('\n');
      }
      write(
          M_PADDING.repeat(depth)
          + bold(node.label)
          + '\n'
      );
      ++depth;
    },

    onDescribeEnd(node) {
      --depth;
    },

    onTestStart(node) {

      if (errorMessage != null) {
        write('\n\n');
      } else if (node.parentNode.children[node.parentNode.children.indexOf(node) - 1]?.nodeType === NodeType.DESCRIBE) {
        write('\n');
      }

      testLabel = node.label.padEnd(getLabelLength(node));
      measureCount = 0;
      errorMessage = undefined;

      clearLine();
      write(
          M_PADDING.repeat(depth)
          + M_PENDING
          + testLabel
          + M_PADDING
      );
    },

    onTestEnd(node, durationStats, heapStats) {
      clearLine();
      write(
          M_PADDING.repeat(depth)
          + (errorMessage ? M_ERROR : M_SUCCESS)
          + testLabel
          + M_PADDING
          + formatDurationStats(durationStats)
          + (heapStats.size > 0 ? M_PADDING + formatHeapStats(heapStats) : '')
          + '\n'
          + (errorMessage ? red(errorMessage) : '')
      );
    },

    onTestFatalError(node, error) {
      errorMessage = getErrorMessage(error);
      clearLine();
      write(
          M_PADDING.repeat(depth)
          + M_ERROR
          + testLabel
          + '\n'
          + red(errorMessage)
      );
    },

    onTestSuiteError(node, error) {
      write('\n\n' + red(getErrorMessage(error)));
    },

    onMeasureWarmupStart(node) {
      clearLine();
      write(
          M_PADDING.repeat(depth)
          + M_WARMUP
          + testLabel
          + M_PADDING
          + formatMeasureCount(measureCount)
          + M_PADDING
      );
    },

    onMeasureWarmupEnd(node) {
    },
    onMeasureStart(node) {
    },

    onMeasureEnd(node, stats) {
      ++measureCount;
    },

    onMeasureError(node, error) {
      errorMessage ||= getErrorMessage(error);
    },

    onMeasureProgress(node, percent) {
      clearLine();
      write(
          M_PADDING.repeat(depth)
          + (errorMessage ? M_PENDING_ERROR : M_PENDING)
          + testLabel
          + M_PADDING
          + formatMeasureCount(measureCount)
          + percentFormat.format(percent).padStart(4)
      );
    },
  };
}

function formatMeasureCount(count: number): string {
  return count > 0 ? dim(integerFormat.format(count + 1) + 'x') : '';
}

function formatDurationStats(stats: Stats): string {
  const hz = stats.hz;
  const format = hz < 100 ? decimalFormat : integerFormat;

  return format.format(hz) + dim(' ops/sec ± ' + rmeFormat.format(stats.rme));
}

function formatHeapStats(stats: Stats): string {
  let mean = stats.mean;
  let label = 'bytes';
  let format = integerFormat;

  if (mean > 1024) {
    mean /= 1024;
    label = 'kB';
    format = decimalFormat;
  }
  if (mean > 1024) {
    mean /= 1024;
    label = 'MB';
    format = decimalFormat;
  }

  return format.format(mean) + dim(' ' + label + ' ± ' + rmeFormat.format(stats.rme));
}

function clearLine(): void {
  rl.clearLine(process.stdout, 0);
  rl.cursorTo(process.stdout, 0);
}

function write(message: string): void {
  process.stdout.write(message);
}
