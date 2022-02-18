import {TestNode, TestOptions} from './test-model';

export function cycle(node: TestNode, options: TestOptions): Promise<void> {
  const {
    testTimeout = 5_000,
    targetRme = 0.002,
    warmupIterationCount = 1,
    batchIterationCount = Infinity,
    batchTimeout = 1_000,
    afterWarmup,
    beforeBatch,
    afterBatch,
    beforeIteration,
    afterIteration,
  } = options;

  let i = 0;

  const {cb, histogram} = node;

  while (i < warmupIterationCount) {
    beforeIteration?.();
    cb();
    afterIteration?.();
    ++i;
  }

  afterWarmup?.();

  i = 0;

  const cycleTs = Date.now();

  const nextBatch = (): Promise<void> | void => {
    const batchTs = Date.now();

    let j = 0;

    while (true) {
      beforeIteration?.();

      const iterationTs = performance.now();
      cb();
      histogram.add(performance.now() - iterationTs);

      afterIteration?.();

      if (Date.now() - cycleTs > testTimeout || i > 2 && histogram.rme <= targetRme) {
        return Promise.resolve(afterBatch?.());
      }

      const batchDuration = Date.now() - batchTs;

      if (batchDuration > batchTimeout || j >= batchIterationCount) {
        return Promise.resolve(afterBatch?.()).then(beforeBatch).then(nextBatch);
      }

      ++i;
      ++j;
    }
  };

  return Promise.resolve(beforeBatch).then(nextBatch);
}
