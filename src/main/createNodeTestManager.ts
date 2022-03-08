import {createTestManager, TestManager} from './createTestManager';
import {TestOptions, NodeType} from './test-model';
import {bold, dim, green} from 'kleur/colors';
import readline from 'readline';

export function createNodeTestManager(options: TestOptions = {}): TestManager {

  const numberFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  let labelLength = 0;

  return createTestManager(options, {

    describeStarted(node) {
      process.stdout.write(bold(node.label) + '\n');
    },

    describeCompleted() {
      process.stdout.write('\n');
    },

    testStarted(node) {
      labelLength = 0;

      for (const siblingNode of node.parentNode.children) {
        if (siblingNode.nodeType === NodeType.TEST) {
          labelLength = Math.max(siblingNode.label.length, labelLength);
        }
      }
      process.stdout.write(
          ' '
          + dim('→')
          + ' ' + node.label
          + ' '.repeat(labelLength - node.label.length + 2),
      );
    },

    testCompleted(node) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      process.stdout.write(
          ' '
          + green(bold('✓'))
          + ' ' + node.label
          + ' '.repeat(labelLength - node.label.length + 2)
          + numberFormat.format(node.histogram.hz)
          + ' ops/sec\n');
    },
  });
}
