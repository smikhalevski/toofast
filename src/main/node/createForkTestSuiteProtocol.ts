import {AsyncHook, Hook, MeasureOptions, TestSuiteProtocol} from "../test-model";

export function createForkTestSuiteProtocol(stack: number[]): TestSuiteProtocol {

  let run!: () => void;
  let promise = new Promise<void>((resolve) => {
    run = resolve;
  });

  let j = 0;
  let i = 0;

  const beforeEachHooks: AsyncHook[] = [];
  const afterEachHooks: AsyncHook[] = [];
  const afterWarmupHooks: AsyncHook[] = [];
  const beforeBatchHooks: AsyncHook[] = [];
  const afterBatchHooks: AsyncHook[] = [];
  const beforeIterationHooks: Hook[] = [];
  const afterIterationHooks: Hook[] = [];

  const measureOptions: MeasureOptions = {};

  return {
    run,
    promise,
    testProtocol: {
      beforeEach(cb) {
        beforeEachHooks.push(cb);
      },
      afterEach(cb) {
        afterEachHooks.push(cb);
      },
      afterWarmup(cb) {
        afterWarmupHooks.push(cb);
      },
      beforeBatch(cb) {
        beforeBatchHooks.push(cb);
      },
      afterBatch(cb) {
        afterBatchHooks.push(cb);
      },
      beforeIteration(cb) {
        beforeIterationHooks.push(cb);
      },
      afterIteration(cb) {
        afterIterationHooks.push(cb);
      },

      describe(label, cb, options) {
        if (j === -1 || i === stack.length - 1 || j++ !== stack[i]) {
          return;
        }
        j = 0;
        i++;

        // Apply options
        Object.assign(measureOptions, options);
      },

      test(label, cb, options) {
        if (j === -1 || i !== stack.length - 1 || j++ !== stack[i]) {
          return;
        }
        j = -1;

        // Apply options
        Object.assign(measureOptions, options);

        if (afterWarmupHooks.length) {
          measureOptions.afterWarmup = () => {
          };
        }
        if (beforeBatchHooks.length) {
          measureOptions.beforeBatch = () => {
          };
        }
        if (afterBatchHooks.length) {
          measureOptions.afterBatch = () => {
          };
        }
        if (beforeIterationHooks.length) {
          measureOptions.beforeIteration = () => {
          };
        }
        if (afterIterationHooks.length) {
          measureOptions.afterIteration = () => {
          };
        }

        cb(() => {
          // Run test here
          return Promise.resolve();
        });
      },
    },
  };
}
