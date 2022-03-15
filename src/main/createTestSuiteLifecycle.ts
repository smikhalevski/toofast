import {Protocol} from './test-types';
import {noop} from './utils';

export interface TestSuiteLifecycleHandlers {

  onDescribeDeclarationStart?(label: string): void;

  onDescribeDeclarationEnd?(): void;

  onTestDeclarationStart?(label: string): void;

  onTestDeclarationEnd?(): void;

  onDescribeStart?(label: string): void;

  onDescribeEnd?(): void;
}

export interface TestSuiteLifecycle {

  /**
   * Functions that should be exposed in a test script.
   */
  protocol: Protocol;

  /**
   * Starts the test suite lifecycle execution.
   *
   * @returns The promise that resolves when the test suite lifecycle is completed.
   */
  run(): Promise<void>;
}

export function createTestSuiteLifecycle(testLifecycle: (testPath: number[]) => Promise<void>, handlers: TestSuiteLifecycleHandlers): TestSuiteLifecycle {
  const {
    onDescribeDeclarationStart,
    onDescribeDeclarationEnd,
    onTestDeclarationStart,
    onTestDeclarationEnd,
    onDescribeStart,
    onDescribeEnd,
  } = handlers;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>((resolve) => {
    runLifecycle = resolve;
  });

  const stack: number[] = [-1];
  let i = 0;

  const protocol: Protocol = {

    beforeEach: noop,
    afterEach: noop,
    afterWarmup: noop,
    beforeBatch: noop,
    afterBatch: noop,
    beforeIteration: noop,
    afterIteration: noop,

    describe(label, cb) {
      onDescribeDeclarationStart?.(label);
      ++stack[i];
      stack[++i] = -1;

      lifecyclePromise = lifecyclePromise.then(() => onDescribeStart?.(label));
      cb();
      lifecyclePromise = lifecyclePromise.then(onDescribeEnd);

      --i;
      onDescribeDeclarationEnd?.();
    },

    test(label) {
      onTestDeclarationStart?.(label);
      stack[i]++;

      const testPath = stack.slice(0, i + 1);
      lifecyclePromise = lifecyclePromise.then(() => testLifecycle(testPath));

      onTestDeclarationEnd?.();
    },
  };

  return {
    protocol,
    run() {
      runLifecycle();
      return lifecyclePromise;
    },
  };
}
