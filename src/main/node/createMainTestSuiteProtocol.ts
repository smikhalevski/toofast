import {TestSuiteProtocol} from "../test-model";

export function createMainTestSuiteProtocol(runTest: (stack: number[]) => Promise<void>): TestSuiteProtocol {

  let run!: () => void;
  let promise = new Promise<void>((resolve) => {
    run = resolve;
  });

  const stack: number[] = [-1];
  let i = 0;

  return {
    run,
    promise,
    testProtocol: {
      beforeEach: noop,
      afterEach: noop,
      afterWarmup: noop,
      beforeBatch: noop,
      afterBatch: noop,
      beforeIteration: noop,
      afterIteration: noop,

      describe(label, cb) {
        promise = promise.then(() => {
          stack[i++]++;
          stack[i] = 0;
          return cb();
        }).then(() => {
          i--;
        });
      },

      test() {
        promise = promise.then(() => {
          stack[i]++;
          return runTest(stack.slice(0, i + 1));
        });
      },
    },
  };
}

function noop() {
}
