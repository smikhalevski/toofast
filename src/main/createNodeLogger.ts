import { bold, dim, green, red, yellow } from 'kleur/colors';
import rl from 'readline';
import { BlockChild, RunnerMessage } from './runner-api.js';

const MESSAGE_PADDING = '  ';
const MESSAGE_PENDING = dim('○ ');
const MESSAGE_PENDING_ERROR = red('○ ');
const MESSAGE_WARMUP = yellow('● ');
const MESSAGE_ERROR = red('● ');
const MESSAGE_SUCCESS = green('● ');
const NEW_LINE = '\n';

export function createNodeLogger(): (message: RunnerMessage) => void {
  let depth = 0;
  let testName: string;
  let errorMessage: string | undefined;
  let measureIndex = 0;
  let hasMargin = false;

  const blocks: BlockChild[][] = [];

  return message => {
    switch (message.type) {
      case 'blockStart':
        blocks.push(message.children);
        break;

      case 'blockEnd':
        blocks.pop();
        break;

      case 'fatalError':
        print(NEW_LINE + red(message.errorMessage) + NEW_LINE);
        break;

      case 'describeStart':
        print(NEW_LINE + MESSAGE_PADDING.repeat(depth) + bold(message.name) + NEW_LINE);

        hasMargin = false;
        ++depth;
        break;

      case 'describeEnd':
        if (errorMessage !== undefined) {
          print(red(errorMessage));
        }
        hasMargin = true;
        --depth;
        break;

      case 'testStart':
        const maxTestNameLength = blocks[blocks.length - 1].reduce(
          (length, child) => (child.type === 'test' ? Math.max(length, child.name.length) : length),
          0
        );

        testName = message.name.padEnd(maxTestNameLength);
        measureIndex = 0;

        clearLine();
        print(
          (hasMargin ? NEW_LINE : '') + MESSAGE_PADDING.repeat(depth) + MESSAGE_PENDING + testName + MESSAGE_PADDING
        );

        hasMargin = false;
        break;

      case 'testEnd':
        clearLine();
        print(
          MESSAGE_PADDING.repeat(depth) +
            (errorMessage !== undefined ? MESSAGE_ERROR : MESSAGE_SUCCESS) +
            testName +
            MESSAGE_PADDING +
            formatMeasurement(message.durationStats.hz, 'Hz') +
            formatRme(message.durationStats.rme) +
            MESSAGE_PADDING +
            formatMeasurement(message.memoryStats.mean, 'B') +
            formatRme(message.memoryStats.rme) +
            NEW_LINE +
            (errorMessage !== undefined ? red(errorMessage) + NEW_LINE : '')
        );
        hasMargin = errorMessage !== undefined;
        errorMessage = undefined;
        break;

      case 'error':
        errorMessage = message.errorMessage;
        break;

      case 'measureWarmupStart':
        clearLine();
        print(
          MESSAGE_PADDING.repeat(depth) +
            MESSAGE_WARMUP +
            testName +
            MESSAGE_PADDING +
            formatMeasureIndex(measureIndex, blocks[blocks.length - 1].length) +
            MESSAGE_PADDING
        );
        break;

      case 'measureWarmupEnd':
        break;

      case 'measureStart':
        break;

      case 'measureEnd':
        ++measureIndex;
        break;

      case 'measureError':
        if (errorMessage === undefined) {
          errorMessage = message.errorMessage;
        }
        break;

      case 'measureProgress':
        clearLine();
        print(
          MESSAGE_PADDING.repeat(depth) +
            (errorMessage !== undefined ? MESSAGE_PENDING_ERROR : MESSAGE_PENDING) +
            testName +
            MESSAGE_PADDING +
            formatMeasureIndex(measureIndex, blocks[blocks.length - 1].length) +
            formatPercent(message.percentage)
        );
        break;
    }
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

function formatMeasureIndex(index: number, count: number): string {
  return count === 1 ? '' : dim(integerFormat.format(index + 1) + '/' + integerFormat.format(count));
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
