import v8 from 'v8';
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import * as toofast from '../main/index.ts';
import type { MeasureOptions } from '../main/index.ts';
import {
  appendChild,
  collectBlocks,
  createTestSuiteNode,
  type Node,
  runMeasure,
  type RunMeasureParams,
  runTest,
  resolveTestOptions,
} from '../main/runner.ts';
import { noop, sleep } from '../main/utils.ts';
import { makeTestNode, makeTestSuite } from './test-utils.ts';

// Batches are short, so tests are fast
const fastOptions: MeasureOptions = {
  maxWarmupBatchIterationCount: 0,
  measureTimeout: 50,
  batchTimeout: 1,
  batchPauseDuration: 1,
};

describe('resolveTestOptions', () => {
  test('applies default test options', () => {
    expect(resolveTestOptions({})).toEqual({
      measureTimeout: 10_000,
      targetRme: 0.05,
      minBatchCount: 5,
      maxWarmupBatchIterationCount: 10_000,
      maxBatchIterationCount: Infinity,
      batchTimeout: 1_000,
      batchPauseDuration: 200,
      minLoopDuration: 1,
      maxBatchMemorySampleCount: 10,
    });
  });

  test('throws if minBatchCount is not a positive integer', () => {
    expect(() => resolveTestOptions({ minBatchCount: 0 })).toThrow('minBatchCount must be a positive integer');
  });

  test('throws if maxBatchIterationCount is not a positive integer', () => {
    expect(() => resolveTestOptions({ maxBatchIterationCount: 0 })).toThrow(
      'maxBatchIterationCount must be a positive integer'
    );
  });

  test('throws if batchTimeout is not a positive integer', () => {
    expect(() => resolveTestOptions({ batchTimeout: 0 })).toThrow('batchTimeout must be a positive integer');
  });

  test('throws if batchPauseDuration is not a positive integer', () => {
    expect(() => resolveTestOptions({ batchPauseDuration: 0 })).toThrow(
      'batchPauseDuration must be a positive integer'
    );
  });

  test('throws if minLoopDuration is not a positive integer', () => {
    expect(() => resolveTestOptions({ minLoopDuration: 0 })).toThrow('minLoopDuration must be a positive integer');
  });

  test('throws if maxWarmupBatchIterationCount is not a non-negative integer', () => {
    expect(() => resolveTestOptions({ maxWarmupBatchIterationCount: -1 })).toThrow(
      'maxWarmupBatchIterationCount must be a non-negative integer'
    );
  });

  test('throws if maxBatchMemorySampleCount is not a non-negative integer', () => {
    expect(() => resolveTestOptions({ maxBatchMemorySampleCount: -1 })).toThrow(
      'maxBatchMemorySampleCount must be a non-negative integer'
    );
  });
});

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

  test('collects blocks declared by an async describe callback', async () => {
    const testSuite = makeTestSuite();

    toofast.describe('aaa', async () => {
      await sleep(0);
      toofast.test('bbb', noop);
    });

    await expect(collectBlocks(testSuite)).resolves.toEqual([
      {
        kind: 'describe',
        name: 'aaa',
        path: [0],
        children: [{ kind: 'test', name: 'bbb', path: [0, 0] }],
        errorMessage: null,
      },
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

describe('appendChild', () => {
  test('throws if inline test options are invalid', () => {
    expect(() =>
      appendChild(createTestSuiteNode({}), {
        kind: 'test',
        name: 'aaa',
        testOptions: { measureTimeout: 0 },
        callback: noop,
      })
    ).toThrow('measureTimeout must be a positive integer');
  });

  test('inherits test options of the parent', () => {
    const node = appendChild(createTestSuiteNode({ measureTimeout: 111 }), {
      kind: 'test',
      name: 'aaa',
      testOptions: { targetRme: 0.5 },
      callback: noop,
    });

    expect(node.testOptions.measureTimeout).toBe(111);
  });

  test('inherits test options that are undefined', () => {
    const node = appendChild(createTestSuiteNode({ measureTimeout: 111 }), {
      kind: 'test',
      name: 'aaa',
      testOptions: { measureTimeout: undefined },
      callback: noop,
    });

    expect(node.testOptions.measureTimeout).toBe(111);
  });

  test('overrides test options of the parent', () => {
    const node = appendChild(createTestSuiteNode({ measureTimeout: 111 }), {
      kind: 'test',
      name: 'aaa',
      testOptions: { measureTimeout: 222 },
      callback: noop,
    });

    expect(node.testOptions.measureTimeout).toBe(222);
  });
});

describe('runTest', () => {
  test('runs the test at the path', async () => {
    const bbbMock = vi.fn();
    const cccMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.describe('aaa', () => {
      toofast.test('bbb', bbbMock);
      toofast.test('ccc', cccMock);
    });

    await runTest({ rootNode: testSuite, testPath: [0, 1], getMemoryUsed: () => 0, sendMessage: noop });

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

    await runTest({ rootNode: testSuite, testPath: [1, 0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(describeMock).not.toHaveBeenCalled();
  });

  test('runs a test declared by an async describe callback', async () => {
    const testMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.describe('aaa', async () => {
      await sleep(0);
      toofast.test('bbb', testMock);
    });

    await runTest({ rootNode: testSuite, testPath: [0, 0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(testMock).toHaveBeenCalledTimes(1);
  });

  test('runs measures declared by an async test callback', async () => {
    const measureMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', async () => {
      await sleep(0);
      toofast.measure(fastOptions, measureMock);
    });

    await runTest({ rootNode: testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(measureMock).toHaveBeenCalled();
  });

  test('waits for async hooks', async () => {
    const testSuite = makeTestSuite();

    let isHookDone = false;
    let isHookDoneBeforeTest = false;

    toofast.beforeEach(async () => {
      await sleep(0);
      isHookDone = true;
    });
    toofast.test('aaa', () => {
      isHookDoneBeforeTest = isHookDone;
    });

    await runTest({ rootNode: testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(isHookDoneBeforeTest).toBe(true);
  });

  test('calls hooks registered after the test was declared', async () => {
    const beforeEachMock = vi.fn();
    const afterEachMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', noop);
    toofast.beforeEach(beforeEachMock);
    toofast.afterEach(afterEachMock);

    await runTest({ rootNode: testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(beforeEachMock).toHaveBeenCalledTimes(1);
    expect(afterEachMock).toHaveBeenCalledTimes(1);
  });

  test('reports an error thrown by the test', async () => {
    const sendMessageMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', () => {
      throw new Error('expected');
    });

    await runTest({ rootNode: testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: sendMessageMock });

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'error_caught',
      errorMessage: expect.stringContaining('Error: expected'),
    });
  });

  test('calls after each hooks if the test has thrown', async () => {
    const afterEachMock = vi.fn();
    const testSuite = makeTestSuite();

    toofast.test('aaa', () => {
      throw new Error('expected');
    });
    toofast.afterEach(afterEachMock);

    await runTest({ rootNode: testSuite, testPath: [0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(afterEachMock).toHaveBeenCalledTimes(1);
  });

  test('calls before hooks of outer blocks first and after hooks in reverse order', async () => {
    const hookNames: string[] = [];
    const testSuite = makeTestSuite();

    toofast.beforeEach(() => {
      hookNames.push('aaa');
    });
    toofast.beforeEach(() => {
      hookNames.push('bbb');
    });
    toofast.afterEach(() => {
      hookNames.push('ccc');
    });
    toofast.afterEach(() => {
      hookNames.push('ddd');
    });

    toofast.describe('eee', () => {
      toofast.beforeEach(() => {
        hookNames.push('fff');
      });
      toofast.afterEach(() => {
        hookNames.push('ggg');
      });
      toofast.test('hhh', noop);
    });

    await runTest({ rootNode: testSuite, testPath: [0, 0], getMemoryUsed: () => 0, sendMessage: noop });

    expect(hookNames).toEqual(['aaa', 'bbb', 'fff', 'ggg', 'ddd', 'ccc']);
  });

  test('combines results of all measures', async () => {
    const batchCounts = [0, 0];
    const testSuite = makeTestSuite();

    let heapSize = 0;

    toofast.test('aaa', () => {
      toofast.measure({ ...fastOptions, beforeBatch: () => void batchCounts[0]++ }, () => {
        heapSize += 222;
      });
      toofast.measure({ ...fastOptions, beforeBatch: () => void batchCounts[1]++ }, () => {
        heapSize += 444;
      });
    });

    const result = await runTest({
      rootNode: testSuite,
      testPath: [0],
      // The heap probe allocates memory itself
      getMemoryUsed: () => (heapSize += 111),
      sendMessage: noop,
    });

    // Each batch of each measure adds a sample
    expect(result.durationSummary.size).toBe(batchCounts[0] + batchCounts[1]);

    // Measures have equal weights, and the difference between callbacks isn't an error
    expect(result.memorySummary.mean).toBe(333);
    expect(result.memorySummary.rme).toBe(0);
  });
});

describe('runMeasure', () => {
  const sendMessageMock = vi.fn();

  let memoryUsed = 0;

  function getMemoryUsed(): number {
    // The heap probe allocates memory itself
    memoryUsed += 111;
    return memoryUsed;
  }

  function measureNode(node: Node, overrides: Partial<RunMeasureParams> = {}) {
    return runMeasure({
      node,
      measureIndex: 0,
      measureCount: 1,
      getMemoryUsed,
      sendMessage: sendMessageMock,
      ...overrides,
    });
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

  test('reports an error if the promise of an async callback is rejected', async () => {
    const node = makeTestMeasure(fastOptions, () => Promise.reject(new Error('expected')));

    await expect(measureNode(node)).resolves.toBeNull();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'error_caught',
      errorMessage: expect.stringContaining('Error: expected'),
    });
  });

  test('reports an error if the promise of an async callback is rejected during warmup', async () => {
    const node = makeTestMeasure({ ...fastOptions, maxWarmupBatchIterationCount: 1 }, () =>
      Promise.reject(new Error('expected'))
    );

    await expect(measureNode(node)).resolves.toBeNull();

    // The measure fails before batches start
    expect(sendMessageMock.mock.calls.map(([message]) => message)).toEqual([
      { type: 'warmup_started', measureIndex: 0, measureCount: 1 },
      { type: 'error_caught', errorMessage: expect.stringContaining('Error: expected') },
    ]);
  });

  test('reports an error if the callback returns a promise after its first call did not', async () => {
    let isFirstCall = true;

    // Warmup checks the result of every call, and isn't limited by time
    const node = makeTestMeasure({ ...fastOptions, maxWarmupBatchIterationCount: 2, batchTimeout: 1_000 }, () => {
      if (isFirstCall) {
        isFirstCall = false;
        return;
      }

      // The rejection would fail the test run if it wasn't handled
      return Promise.reject(new Error('expected'));
    });

    await expect(measureNode(node)).resolves.toBeNull();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'error_caught',
      errorMessage: expect.stringContaining('measure() callback must not return a promise if its first call did not'),
    });
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

  test('does not warm up if maxWarmupBatchIterationCount is 0', async () => {
    const beforeWarmupMock = vi.fn();
    const node = makeTestMeasure(
      { ...fastOptions, maxWarmupBatchIterationCount: 0, beforeWarmup: beforeWarmupMock },
      noop
    );

    await measureNode(node);

    expect(beforeWarmupMock).not.toHaveBeenCalled();
  });

  test('limits warmup by maxWarmupBatchIterationCount', async () => {
    let iterationCount = 0;
    let warmupIterationCount = 0;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxWarmupBatchIterationCount: 10,
        // Warmup isn't limited by time
        batchTimeout: 1_000,
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

  test('limits warmup by maxBatchIterationCount', async () => {
    let iterationCount = 0;
    let warmupIterationCount = 0;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxWarmupBatchIterationCount: 100,
        maxBatchIterationCount: 10,
        // Warmup isn't limited by time
        batchTimeout: 1_000,
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

  test('stops warmup after batchTimeout', async () => {
    let warmupTimestamp = 0;
    let warmupDuration = Infinity;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxWarmupBatchIterationCount: 10_000,
        batchTimeout: 10,
        // Without the timeout, warmup would last for more than 10 seconds
        beforeIteration: () => sleep(1),
        beforeWarmup() {
          warmupTimestamp = performance.now();
        },
        afterWarmup() {
          warmupDuration = performance.now() - warmupTimestamp;
        },
      },
      noop
    );

    await measureNode(node);

    expect(warmupDuration).toBeLessThan(1_000);
  });

  test('runs batch hooks around warmup', async () => {
    const hookNames: string[] = [];

    const node = makeTestMeasure(
      {
        ...fastOptions,
        maxWarmupBatchIterationCount: 1,
        beforeWarmup: () => void hookNames.push('beforeWarmup'),
        afterWarmup: () => void hookNames.push('afterWarmup'),
        beforeBatch: () => void hookNames.push('beforeBatch'),
        afterBatch: () => void hookNames.push('afterBatch'),
      },
      noop
    );

    await measureNode(node);

    // Hooks of batches that follow warmup aren't checked
    expect(hookNames.slice(0, 4)).toEqual(['beforeWarmup', 'beforeBatch', 'afterBatch', 'afterWarmup']);
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

  test('calls after batch hooks if the callback has thrown during warmup', async () => {
    const afterBatchMock = vi.fn();
    const node = makeTestMeasure(
      { ...fastOptions, maxWarmupBatchIterationCount: 1, afterBatch: afterBatchMock },
      () => {
        throw new Error('expected');
      }
    );

    await measureNode(node);

    expect(afterBatchMock).toHaveBeenCalledTimes(1);
  });

  test('pauses after each batch', async () => {
    const pauseDurations: number[] = [];

    let batchEndTimestamp = 0;

    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 100,
        batchPauseDuration: 20,
        beforeBatch() {
          if (batchEndTimestamp !== 0) {
            pauseDurations.push(performance.now() - batchEndTimestamp);
          }
        },
        afterBatch() {
          batchEndTimestamp = performance.now();
        },
      },
      noop
    );

    await measureNode(node);

    // A timer can fire up to 1 ms early
    expect(pauseDurations.length).toBeGreaterThan(0);
    expect(Math.min(...pauseDurations)).toBeGreaterThanOrEqual(19);
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
    const batchIterationCounts: number[] = [];

    let iterationCount = 0;

    // The timer advances only when the callback is called, so a call lasts exactly 1 ms
    vi.useFakeTimers({ toFake: ['performance'] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 200,
        minLoopDuration: 20,
        maxBatchMemorySampleCount: 0,
        beforeBatch() {
          iterationCount = 0;
        },
        afterBatch() {
          batchIterationCounts.push(iterationCount);
        },
      },
      () => {
        vi.advanceTimersByTime(1);
        iterationCount++;
      }
    );

    await measureNode(node);

    // A loop outlasts batchTimeout, so a batch times a single loop. The first batch also has loops that are too short.
    expect(batchIterationCounts.length).toBeGreaterThan(1);
    expect(Math.min(...batchIterationCounts.slice(1))).toBeGreaterThanOrEqual(20);
  });

  test('times at least one loop in a batch', async () => {
    // Loops that calibrate minLoopDuration outlast the batch timeout
    const node = makeTestMeasure({ ...fastOptions, measureTimeout: 20, minLoopDuration: 5 }, noop);

    const result = await measureNode(node);

    expect(result!.durationHistogram.mean).toBeGreaterThan(0);
  });

  test('times loops of an async callback until the promise of the last call settles', async () => {
    // The timer advances only when the callback is called, so a call lasts exactly 1 ms
    vi.useFakeTimers({ toFake: ['performance'] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    // Loops last at least 5 ms, so they have several calls
    const node = makeTestMeasure({ ...fastOptions, minLoopDuration: 5 }, async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(1);
    });

    const result = await measureNode(node);

    expect(result!.durationHistogram.mean).toBe(1);
  });

  test('times the first call of an async callback', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    // Without warmup, the first call of the measure is the only call of the first batch
    const node = makeTestMeasure({ ...fastOptions, maxBatchIterationCount: 1 }, async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(1);
    });

    const result = await measureNode(node);

    expect(result!.durationHistogram.mean).toBe(1);
  });

  test('calls an async callback after the promise of the previous call has settled', async () => {
    let isCallPending = false;

    const node = makeTestMeasure(fastOptions, async () => {
      if (isCallPending) {
        throw new Error('unexpected');
      }

      isCallPending = true;
      await Promise.resolve();
      isCallPending = false;
    });

    await expect(measureNode(node)).resolves.not.toBeNull();
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

  test('adds a single sample for each batch', async () => {
    let batchCount = 0;

    // A batch runs many loops
    const node = makeTestMeasure(
      { ...fastOptions, measureTimeout: 100, batchTimeout: 20, beforeBatch: () => void batchCount++ },
      noop
    );

    const result = await measureNode(node);

    expect(result!.durationHistogram.size).toBe(batchCount);
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

  test('does not stop after a single batch if minBatchCount is 1', async () => {
    let batchCount = 0;

    // The margin of error of a single batch is unknown, and any margin of error below 99% stops the measure
    const node = makeTestMeasure(
      {
        ...fastOptions,
        measureTimeout: 10_000,
        targetRme: 0.99,
        minBatchCount: 1,
        maxBatchIterationCount: 1,
        beforeBatch: () => void batchCount++,
      },
      () => busyWait(5)
    );

    await measureNode(node);

    expect(batchCount).toBeGreaterThanOrEqual(2);
    expect(getProgressPercentages()).not.toContainEqual(NaN);
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
        // Batches end only when they run out of iterations
        batchTimeout: 1_000,
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

  test('does not count memory allocated by the heap probe', async () => {
    const node = makeTestMeasure(fastOptions, () => {
      memoryUsed += 222;
    });

    const result = await measureNode(node);

    expect(result!.memoryHistogram.mean).toBe(222);
  });

  test('counts memory that an async callback allocates until its promise settles', async () => {
    const node = makeTestMeasure(fastOptions, async () => {
      await Promise.resolve();
      memoryUsed += 222;
    });

    const result = await measureNode(node);

    expect(result!.memoryHistogram.mean).toBe(222);
  });

  test('does not count memory allocated by awaiting an async callback', async () => {
    // The promise escapes, so the optimizing compiler can't remove its allocation
    const sink = { promise: Promise.resolve() };

    // Both callbacks allocate a promise, but only the promise of the async callback is awaited
    const syncNode = makeTestMeasure(fastOptions, () => {
      sink.promise = Promise.resolve();
    });
    const asyncNode = makeTestMeasure(fastOptions, () => Promise.resolve());

    function getUsedHeapSize(): number {
      return v8.getHeapStatistics().used_heap_size;
    }

    const syncResult = await measureNode(syncNode, { getMemoryUsed: getUsedHeapSize });
    const asyncResult = await measureNode(asyncNode, { getMemoryUsed: getUsedHeapSize });

    // V8 can allocate memory for itself while a call is measured, for example, for compiled code, so means differ by a
    // few bytes
    expect(asyncResult!.memoryHistogram.mean).toBeCloseTo(syncResult!.memoryHistogram.mean, -1);
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
 * Creates a measure in a test. The test becomes the node to which hooks are added.
 */
function makeTestMeasure(options: MeasureOptions, callback: () => unknown): Node {
  const testNode = makeTestNode();

  toofast.measure(options, callback);

  return testNode.children[0];
}
