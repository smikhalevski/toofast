import {MasterLifecycleHandlers} from './runMaster';
import {bold, dim, green, red} from 'kleur/colors';

export function createLogHandlers(): MasterLifecycleHandlers {

  let depth = 0;
  let testLabel: string;

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
    onDescribeDeclarationStart(label) {
      // noop
    },
    onDescribeDeclarationEnd() {
      // noop
    },
    onTestDeclarationStart(label) {
      // noop
    },
    onTestDeclarationEnd() {
      // noop
    },
    onDescribeStart(label) {
      console.log('  '.repeat(depth) + label);
      ++depth;
    },
    onDescribeEnd() {
      --depth;
    },
    onTestStart() {
      // testLabel = label.padEnd(node.parentNode.children.map((node) => node.label.length).sort((a, b) => b - a)[0]);
      // errorMessage = undefined;
      process.stdout.write('\r' + '  '.repeat(depth) + dim('→ ') + testLabel);
    },
    onTestEnd(stats) {
      // process.stdout.write(
      //     '\r'
      //     + '  '.repeat(depth)
      //     + (errorMessage ? red(bold('× ')) : green(bold('✓ ')))
      //     + testLabel
      //     + '  '
      //     + numberFormat.format(stats.hz)
      //     + ' ops/sec ± '
      //     + numberFormat.format(stats.variance)
      // );
      //
      // process.stdout.write('\n');
      //
      // if (errorMessage) {
      //   process.stdout.write(red(errorMessage) + '\n\n');
      // }
    },
    onTestError(error) {
    },
    onTestSuiteError(error) {
    },
    onMeasureWarmupStart() {
    },
    onMeasureWarmupEnd() {
    },
    onMeasureStart() {
    },
    onMeasureEnd(stats) {
    },
    onMeasureError(error) {
    },
    onMeasureProgress(percent) {
      process.stdout.write(
          '\r'
          + '  '.repeat(depth)
          + '  '
          + testLabel
          + '  '
          + percentFormat.format(percent).padStart(3)
      );
    },
  };
}
