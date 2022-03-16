import {bold, dim, green, red} from 'kleur/colors';
import {getErrorMessage, getLabelLength} from './utils';
import {MasterLifecycleHandlers} from './bin-types';
import {NodeType} from '../node-types';

const PADDING = '  ';
const PENDING = dim('○ ');
const FAILURE = red('● ');
const SUCCESS = green('● ');

export function createLoggingHandlers(): MasterLifecycleHandlers {

  let depth = 0;
  let testLabel: string;
  let errorMessage: string | undefined;

  const numberFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  const rmeFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    style: 'percent',
  });

  const percentFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    style: 'percent',
  });

  return {

    onDescribeStart(node) {
      if (errorMessage) {
        write('\n\n');
        errorMessage = undefined;
      }
      if (node.parentNode.nodeType !== NodeType.TEST_SUITE || node.parentNode.children[0] !== node) {
        write('\n');
      }
      write(
          PADDING.repeat(depth)
          + bold(node.label)
          + '\n'
      );
      ++depth;
    },

    onDescribeEnd(node) {
      --depth;
    },

    onTestStart(node) {
      if (errorMessage) {
        write('\n\n');
        errorMessage = undefined;
      }
      testLabel = node.label.padEnd(getLabelLength(node));

      if (node.parentNode.children[node.parentNode.children.indexOf(node) - 1]?.nodeType === NodeType.DESCRIBE) {
        write('\n');
      }
      write(
          '\r'
          + PADDING.repeat(depth)
          + PENDING
          + testLabel
          + PADDING
      );
    },

    onTestEnd(node, stats) {
      write(
          '\r'
          + PADDING.repeat(depth)
          + (errorMessage ? FAILURE : SUCCESS)
          + testLabel
          + PADDING
          + numberFormat.format(stats.hz)
          + dim(' ops/sec ± ' + rmeFormat.format(stats.rme))
          + '\n'
          + (errorMessage ? red(errorMessage) : '')
      );
    },

    onTestFatalError(node, error) {
      errorMessage = getErrorMessage(error);
      write(
          '\r'
          + PADDING.repeat(depth)
          + FAILURE
          + testLabel
          + '\n'
          + red(errorMessage)
      );
    },

    onTestSuiteError(node, error) {
      write('\n\n' + red(getErrorMessage(error)));
    },

    onMeasureWarmupStart(node) {
    },
    onMeasureWarmupEnd(node) {
    },
    onMeasureStart(node) {
    },
    onMeasureEnd(node, stats) {
    },

    onMeasureError(node, error) {
      errorMessage ||= getErrorMessage(error);
    },

    onMeasureProgress(node, percent) {
      write(
          '\r'
          + PADDING.repeat(depth)
          + PENDING
          + testLabel
          + PADDING
          + percentFormat.format(percent).padStart(4)
      );
    },
  };
}

function write(message: string): void {
  process.stdout.write(message);
}
