import {MasterLifecycleHandlers} from './runMaster';
import {bold, dim, green, red} from 'kleur/colors';
import {extractErrorMessage} from './utils';
import {NodeType, TestNode} from '../node-types';

export function createLoggingHandlers(): MasterLifecycleHandlers {

  let depth = 0;
  let testLabel: string;
  let errorMessage: string | undefined;

  const numberFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  const percentFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    style: 'percent',
  });

  return {
    onDescribeDeclarationStart(node) {
      // noop
    },
    onDescribeDeclarationEnd(node) {
      // noop
    },
    onTestDeclarationStart(node) {
      // noop
    },
    onTestDeclarationEnd(node) {
      // noop
    },
    onDescribeStart(node) {
      if (errorMessage) {
        write('\n\n');
        errorMessage = undefined;
      }
      write('  '.repeat(depth) + bold(node.label) + '\n');
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
      testLabel = node.label.padEnd(fitLabelLength(node));
      write('\r' + '  '.repeat(depth) + dim('→ ') + testLabel);
    },
    onTestEnd(node, stats) {
      write(
          '\r'
          + '  '.repeat(depth)
          + (errorMessage ? red(bold('• ')) : green(bold('• ')))
          + testLabel
          + '  '
          + numberFormat.format(stats.hz)
          + dim(' ops/sec ± ' + numberFormat.format(stats.variance))
          + '\n'
          + (errorMessage ? red(errorMessage) : '')
      );
    },
    onTestError(node, error) {
      errorMessage = extractErrorMessage(error);
      write(red(errorMessage));
    },
    onTestSuiteError(node, error) {
      write('\n\n' + red(extractErrorMessage(error)));
    },
    onMeasureWarmupStart(node) {
      // noop
    },
    onMeasureWarmupEnd(node) {
      // noop
    },
    onMeasureStart(node) {
      // noop
    },
    onMeasureEnd(node, stats) {
      // noop
    },
    onMeasureError(node, error) {
      errorMessage ||= extractErrorMessage(error);
    },
    onMeasureProgress(node, percent) {
      write(
          '\r'
          + '  '.repeat(depth)
          + '  '
          + testLabel
          + '  '
          + percentFormat.format(percent).padStart(5)
      );
    },
  };
}

function fitLabelLength(node: TestNode): number {
  const siblings = node.parentNode.children;

  let i = siblings.indexOf(node);

  while (i !== 0 && siblings[i - 1].nodeType === NodeType.TEST) {
    i--;
  }

  let length = 0;

  while (i < siblings.length && siblings[i].nodeType === NodeType.TEST) {
    length = Math.max(length, siblings[i].label.length);
  }

  return length;
}

function write(message: string): void {
  process.stdout.write(message);
}
