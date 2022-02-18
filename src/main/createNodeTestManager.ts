import {createTestManager, TestManager} from './createTestManager';
import {DescribeOptions} from './test-model';

export function createNodeTestManager(options: DescribeOptions = {}): TestManager {

  const numberFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  return createTestManager(options, {

    describeStarted(node) {
      process.stdout.write(node.label + '\n');
    },

    describeCompleted() {
      process.stdout.write('\n');
    },

    testStarted(node) {
      process.stdout.write(node.label);
    },

    testCompleted(node) {
      process.stdout.write(' ' + numberFormat.format(node.histogram.hz) + ' ops/sec\n');
    },
  });
}
