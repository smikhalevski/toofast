import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import * as toofast from '../main/index.ts';
import { MeasureOptions } from '../main/index.ts';
import {
  appendNode,
  collectBlocks,
  createTestSuite,
  Node,
  runMeasure,
  runTest,
  setCurrentNode,
} from '../main/runner.ts';
import { noop, sleep } from '../main/utils.ts';

describe('collectBlocks', () => {
  test('collects nested blocks', async () => {
    const testSuite = makeTestSuite();

    toofast.describe('aaa', () => {
      toofast.test('bbb', noop);

      toofast.describe('ccc', () => {
        toofast.test('ddd', noop);
      });
    });
    toofast.test('eee', noop);

    await expect(collectBlocks(testSuite)).resolves.toEqual([
      {
        kind: 'describe',
        name: 'aaa',
        path: [0],
        children: [
          { kind: 'test', name: 'bbb', path: [0, 0] },
          {
            kind: 'describe',
            name: 'ccc',
            path: [0, 1],
            children: [{ kind: 'test', name: 'ddd', path: [0, 1, 0] }],
            errorMessage: null,
          },
        ],
        errorMessage: null,
      },
      { kind: 'test', name: 'eee', path: [1] },
    ]);
  });

  test('does not call test callbacks', async () => {
    const testMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', testMock);

    await collectBlocks(testSuite);

    expect(testMock).not.toHaveBeenCalled();
  });

  test('skips blocks of a describe that has thrown', async () => {
    const testSuite = makeTestSuite();

    toofast.describe('aaa', () => {
      toofast.test('bbb', noop);
      throw new Error('expected');
    });
    toofast.test('ccc', noop);

    await expect(collectBlocks(testSuite)).resolves.toEqual([
      { kind: 'describe', name: 'aaa', path: [0], children: [], errorMessage: expect.stringContaining('expected') },
      { kind: 'test', name: 'ccc', path: [1] },
    ]);
  });
});

describe('appendNode', () => {
  test('throws if inline test options are invalid', () => {
    expect(() =>
      appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: { measureTimeout: 0 }, callback: noop })
    ).toThrow('measureTimeout must be a positive integer');
  });

  test('inherits test options of the parent', () => {
    const node = appendNode(createTestSuite({ measureTimeout: 111 }), {
      kind: 'test',
      name: 'aaa',
      testOptions: { targetRme: 0.5 },
      callback: noop,
    });

    expect(node.testOptions.measureTimeout).toBe(111);
  });
});

describe('runTest', () => {
  const sendMessageMock = vi.fn();

  beforeEach(() => {
    sendMessageMock.mockClear();
  });

  test('runs the test at the path', async () => {
    const bbbMock = vi.fn();
    const cccMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.describe('aaa', () => {
      toofast.test('bbb', bbbMock);
      toofast.test('ccc', cccMock);
    });

    await runTest({ testSuite, testPath: [0, 1], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(bbbMock).not.toHaveBeenCalled();
    expect(cccMock).toHaveBeenCalledTimes(1);
  });

  test('calls only describe callbacks on the test path', async () => {
    const describeMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.describe('aaa', describeMock);
    toofast.describe('bbb', () => {
      toofast.test('ccc', noop);
    });

    await runTest({ testSuite, testPath: [1, 0], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(describeMock).not.toHaveBeenCalled();
  });

  test('calls hooks registered after the test was declared', async () => {
    const beforeEachMock = vi.fn();
    const afterEachMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', noop);
    toofast.beforeEach(beforeEachMock);
    toofast.afterEach(afterEachMock);

    await runTest({ testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(beforeEachMock).toHaveBeenCalledTimes(1);
    expect(afterEachMock).toHaveBeenCalledTimes(1);
  });

  test('calls after each hooks if the test has thrown', async () => {
    const afterEachMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', () => {
      throw new Error('expected');
    });
    toofast.afterEach(afterEachMock);

    await runTest({ testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(afterEachMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  test('calls before hooks of outer blocks first and after hooks in reverse order', async () => {
    const hookNames: string[] = [];
    const testSuite = makeTestSuite();

    toofast.beforeEach(() => {
      hookNames.push('aaa');
    });
    toofast.afterEach(() => {
      hookNames.push('bbb');
    });

    toofast.describe('ccc', () => {
      toofast.beforeEach(() => {
        hookNames.push('ddd');
      });
      toofast.afterEach(() => {
        hookNames.push('eee');
      });
      toofast.test('fff', noop);
    });

    await runTest({ testSuite, testPath: [0, 0], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(hookNames).toEqual(['aaa', 'ddd', 'eee', 'bbb']);
  });
});

describe('runMeasure', () => {
  const sendMessageMock = vi.fn();

  // Batches are short, so tests are fast
  const fastOptions: MeasureOptions = {
    maxWarmupBatchIterationCount: 0,
    measureTimeout: 50,
    batchTimeout: 1,
    batchPauseDuration: 1,
  };

  let memoryUsed = 0;

  function getMemoryUsed(): number {
    // The heap probe allocates memory itself
    memoryUsed += 111;
    return memoryUsed;
  }

  function measureNode(node: Node) {
    return runMeasure({ node, measureIndex: 0, measureCount: 1, getMemoryUsed, sendMessage: sendMessageMock });
  }

  function getProgressPercentages(): number[] {
    return sendMessageMock.mock.calls
      .map(([message]) => message)
      .filter(message => message.type === 'progress_updated')
      .map(message => message.percentage);
  }

  beforeEach(() => {
    sendMessageMock.mockClear();
  });

  test('stops the measure after the first error', async () => {
    const node = makeTestMeasure(fastOptions, () => {
      throw new Error('expected');
    });

    await expect(measureNode(node)).resolves.toBeNull();

    expect(sendMessageMock.mock.calls.map(([message]) => message.type)).toEqual(['progress_updated', 'error_caught']);
  });

  test('reports an error if a hook is registered while the measure runs', async () => {
    const node = makeTestMeasure(fastOptions, () => {
      toofast.beforeIteration(noop);
    });

    await expect(measureNode(node)).resolves.toBeNull();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'error_caught',
      errorMessage: expect.stringContaining('Unexpected beforeIteration() invocation'),
    });
  });

  test('stops warmup after batchTimeout', async () => {
    // Without the limit, warmup would last for more than 10 seconds
    const node = makeTestMeasure(
      { ...fastOptions, maxWarmupBatchIterationCount: 10_000, batchTimeout: 10, beforeIteration: () => sleep(1) },
      noop
    );

    await expect(measureNode(node)).resolves.not.toBeNull();
  });

  test('calls hooks registered after the measure was declared', async () => {
    const beforeIterationMock = vi.fn();
    const node = makeTestMeasure(fastOptions, noop);

    toofast.beforeIteration(beforeIterationMock);

    await measureNode(node);

    expect(beforeIterationMock).toHaveBeenCalled();
  });

  test('calls hooks from options', async () => {
    const beforeWarmupMock = vi.fn();
    const node = makeTestMeasure(
      { ...fastOptions, maxWarmupBatchIterationCount: 1, beforeWarmup: beforeWarmupMock },
      noop
    );

    await measureNode(node);

    expect(beforeWarmupMock).toHaveBeenCalledTimes(1);
  });

  test('calls after batch hooks if the callback has thrown', async () => {
    const afterBatchMock = vi.fn();
    const node = makeTestMeasure({ ...fastOptions, afterBatch: afterBatchMock }, () => {
      throw new Error('expected');
    });

    await measureNode(node);

    expect(afterBatchMock).toHaveBeenCalledTimes(1);
  });

  test('times loops of many iterations if there are no iteration hooks', async () => {
    const nowSpy = vi.spyOn(performance, 'now');

    onTestFinished(() => {
      nowSpy.mockRestore();
    });

    let iterationCount = 0;

    const node = makeTestMeasure(fastOptions, () => {
      iterationCount++;
    });

    await measureNode(node);

    // A loop reads the timer twice, so loops of a single iteration would read the timer more often than they iterate
    expect(iterationCount).toBeGreaterThan(nowSpy.mock.calls.length * 10);
  });

  test('calls iteration hooks around every call', async () => {
    const events: string[] = [];

    // A batch has a timed iteration and an iteration that samples memory
    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 20,
        maxBatchIterationCount: 2,
        beforeIteration: () => void events.push('before'),
        afterIteration: () => void events.push('after'),
      },
      () => {
        events.push('call');
      }
    );

    await measureNode(node);

    expect(events.join(' ')).toMatch(/^(before call after ?)+$/);
  });

  test('times loops that last at least minLoopDuration', async () => {
    const batchDurations: number[] = [];

    let batchTimestamp = 0;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 200,
        minLoopDuration: 20,
        beforeBatch() {
          batchTimestamp = performance.now();
        },
        afterBatch() {
          batchDurations.push(performance.now() - batchTimestamp);
        },
      },
      noop
    );

    await measureNode(node);

    // A batch times a single loop, since the batch timeout is shorter, and loop durations vary
    expect(Math.min(...batchDurations)).toBeGreaterThan(10);
  });

  test('times at least one loop in a batch', async () => {
    // Loops that calibrate minLoopDuration outlast the batch timeout
    const node = makeTestMeasure({ ...fastOptions, measureTimeout: 20, minLoopDuration: 5 }, noop);

    const result = await measureNode(node);

    expect(result!.durationHistogram.mean).toBeGreaterThan(0);
  });

  test('ends a batch when the measure times out', async () => {
    const node = makeTestMeasure({ ...fastOptions, measureTimeout: 50, batchTimeout: 2_000 }, noop);

    const timestamp = performance.now();

    await measureNode(node);

    expect(performance.now() - timestamp).toBeLessThan(1_000);
  });

  test('does not measure memory if maxBatchMemorySampleCount is 0', async () => {
    const node = makeTestMeasure({ ...fastOptions, maxBatchMemorySampleCount: 0 }, noop);

    const result = await measureNode(node);

    expect(result!.memoryHistogram.size).toBe(0);
  });

  test('samples the mean iteration duration of a batch', async () => {
    // A fast callback runs thousands of loops in a batch, but each batch is a single sample
    const node = makeTestMeasure({ ...fastOptions, measureTimeout: 20 }, noop);

    const result = await measureNode(node);

    expect(result!.durationHistogram.size).toBeLessThan(30);
  });

  test('runs at least minBatchCount batches', async () => {
    let batchCount = 0;

    // Calls last the same time regardless of JIT tiering, and any margin of error below 99% stops the measure, so only
    // minBatchCount keeps it running
    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 10_000,
        targetRme: 0.99,
        minBatchCount: 7,
        maxBatchIterationCount: 1,
        beforeBatch: () => void batchCount++,
      },
      () => busyWait(5)
    );

    await measureNode(node);

    expect(batchCount).toBeGreaterThanOrEqual(7);
  });

  test('stops after the margin of error reaches the target', async () => {
    // Calls last the same time, so batches agree right away
    const node = makeTestMeasure(
      { ...fastOptions, measureTimeout: 10_000, targetRme: 0.99, maxBatchIterationCount: 1 },
      () => busyWait(1)
    );

    const timestamp = performance.now();

    await measureNode(node);

    expect(performance.now() - timestamp).toBeLessThan(1_000);
  });

  test('counts all iterations of a batch toward maxBatchIterationCount', async () => {
    const batchIterationCounts: number[] = [];

    let iterationCount = 0;

    // Iterations that calibrate loops and sample memory are counted as well
    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxBatchIterationCount: 10,
        beforeBatch() {
          iterationCount = 0;
        },
        afterBatch() {
          batchIterationCounts.push(iterationCount);
        },
      },
      () => {
        iterationCount++;
      }
    );

    await measureNode(node);

    expect(Math.max(...batchIterationCounts)).toBe(10);
  });

  test('limits warmup by maxBatchIterationCount', async () => {
    let iterationCount = 0;
    let warmupIterationCount = 0;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxWarmupBatchIterationCount: 100,
        maxBatchIterationCount: 10,
        afterWarmup() {
          warmupIterationCount = iterationCount;
        },
      },
      () => {
        iterationCount++;
      }
    );

    await measureNode(node);

    expect(warmupIterationCount).toBe(10);
  });

  test('does not count memory allocated by the heap probe', async () => {
    const node = makeTestMeasure(fastOptions, () => {
      memoryUsed += 222;
    });

    const result = await measureNode(node);

    expect(result!.memoryHistogram.mean).toBe(222);
  });

  test('discards distorted memory samples', async () => {
    let heapSize = 0;
    let probeCount = 0;

    const node = makeTestMeasure(fastOptions, () => {
      heapSize += 222;
    });

    // A memory sample probes the heap four times: around a noop, and around the callback
    const result = await runMeasure({
      node,
      measureIndex: 0,
      measureCount: 1,
      getMemoryUsed() {
        ++probeCount;

        if (probeCount === 2) {
          // The probe allocates more memory than usual while measuring the noop of the first sample
          heapSize += 444;
        } else if (probeCount === 6) {
          // The garbage collector runs while measuring the noop of the second sample
          heapSize -= 1_000;
        } else {
          heapSize += 111;
        }
        return heapSize;
      },
      sendMessage: sendMessageMock,
    });

    expect(result!.memoryHistogram.mean).toBe(222);
  });

  test('reports progress in whole percents', async () => {
    // The margin of error can't stop the measure, and batches are a tiny fraction of the timeout, so progress is
    // reported after most of them
    const node = makeTestMeasure({ ...fastOptions, measureTimeout: 300, minBatchCount: 1_000_000 }, noop);

    await measureNode(node);

    const percentages = getProgressPercentages();

    expect(percentages.length).toBeGreaterThan(20);
    expect(percentages).toEqual(percentages.map(percentage => Math.round(percentage * 100) / 100));
  });

  test('reports 100% progress once', async () => {
    const node = makeTestMeasure(fastOptions, noop);

    await measureNode(node);

    expect(getProgressPercentages().filter(percentage => percentage === 1)).toEqual([1]);
  });
});

/**
 * Blocks the thread, so a call lasts the same time regardless of JIT tiering.
 */
function busyWait(ms: number): void {
  const timestamp = performance.now();

  while (performance.now() - timestamp < ms) {}
}

/**
 * Creates a test suite to which blocks are declared.
 */
function makeTestSuite(): Node {
  const testSuite = createTestSuite({});

  setCurrentNode(testSuite);
  return testSuite;
}

/**
 * Creates a measure in a test. The test becomes the node to which hooks are declared.
 */
function makeTestMeasure(options: MeasureOptions, callback: () => unknown): Node {
  const testNode = appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop });

  setCurrentNode(testNode);
  toofast.measure(options, callback);

  return testNode.children[0];
}
