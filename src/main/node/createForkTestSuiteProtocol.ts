import {AsyncHook, Hook, MeasureOptions, TestSuiteProtocol} from '../test-model';

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

        cb();

        j = -1;
      },

      test(label, cb, options) {
        if (j === -1 || i !== stack.length - 1 || j++ !== stack[i]) {
          return;
        }
        j = -1;

        // Apply options
        Object.assign(measureOptions, options);

        if (afterWarmupHooks.length) {
          measureOptions.afterWarmup = () => callAsyncHooks(afterWarmupHooks);
        }
        if (beforeBatchHooks.length) {
          measureOptions.beforeBatch = () => callAsyncHooks(beforeBatchHooks);
        }
        if (afterBatchHooks.length) {
          measureOptions.afterBatch = () => callAsyncHooks(afterBatchHooks);
        }
        if (beforeIterationHooks.length) {
          measureOptions.beforeIteration = () => {
            callHooks(beforeIterationHooks);
          };
        }
        if (afterIterationHooks.length) {
          measureOptions.afterIteration = () => {
            callHooks(afterIterationHooks);
          };
        }

        promise
            .then(() => callAsyncHooks(beforeEachHooks))
            .then(() => {
              cb((cb) => {
                // Cycle cb here
                cb();
                return Promise.resolve();
              });
            })
            .then(() => callAsyncHooks(afterEachHooks));
      },
    },
  };
}

function callHooks(hooks: Hook[]): void {
  for (const hook of hooks) {
    hook();
  }
}

function callAsyncHooks(hooks: AsyncHook[]): Promise<void> {
  let promise = Promise.resolve();
  for (const hook of hooks) {
    promise = promise.then(() => hook());
  }
  return promise;
}
