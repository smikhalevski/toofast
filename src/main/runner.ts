import { Histogram, type HistogramSnapshot } from './Histogram.ts';
import type { HookCallback, TestOptions } from './index.ts';
import { assert, getErrorStackOrMessage, isNonNegativeInteger, isPositiveInteger, noop, sleep } from './utils.ts';

export type NodeKind = 'test_suite' | 'describe' | 'test' | 'measure';

export type HookType =
  | 'before_each'
  | 'after_each'
  | 'before_warmup'
  | 'after_warmup'
  | 'before_batch'
  | 'after_batch'
  | 'before_iteration'
  | 'after_iteration';

export interface Hook {
  type: HookType;
  callback: HookCallback;
}

/**
 * A test suite of a test file, a describe block, a test or a measure.
 */
export interface Node {
  kind: NodeKind;
  name: string;
  parent: Node | null;
  children: Node[];
  hooks: Hook[];
  testOptions: Required<TestOptions>;

  /**
   * Declares children and hooks of a describe block or a test, or a callback that is measured.
   */
  callback: () => unknown;
}

/**
 * A describe block or a test collected from a test file.
 */
export type Block =
  | { kind: 'describe'; name: string; path: number[]; children: Block[]; errorMessage: string | null }
  | { kind: 'test'; name: string; path: number[] };

/**
 * A job that a worker process runs after it imports setup files and the test file.
 */
export type WorkerJob =
  | { type: 'collect_blocks'; setupFiles: string[]; testFile: string; testOptions: TestOptions }
  | { type: 'run_test'; setupFiles: string[]; testFile: string; testOptions: TestOptions; testPath: number[] };

export type WorkerEvent =
  | { type: 'blocks_collected'; blocks: Block[] }
  | { type: 'warmup_started'; measureIndex: number; measureCount: number }
  | { type: 'progress_updated'; measureIndex: number; measureCount: number; percentage: number }
  | { type: 'error_caught'; errorMessage: string }
  | { type: 'test_ended'; durationSnapshot: HistogramSnapshot; memorySnapshot: HistogramSnapshot }
  | { type: 'file_failed'; errorMessage: string };

export interface MeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

/**
 * Returns test options with defaults applied. Throws if an option is unknown or invalid.
 */
export function toValidatedTestOptions(testOptions: TestOptions): Required<TestOptions> {
  const {
    measureTimeout = 10_000,
    targetRme = 0.05,
    minBatchCount = 5,
    maxWarmupBatchIterationCount = 10_000,
    maxBatchIterationCount = Infinity,
    batchTimeout = 1_000,
    batchPauseDuration = 200,
    minLoopDuration = 1,
    maxBatchMemorySampleCount = 10,
    ...unknownOptions
  } = testOptions;

  const unknownOptionNames = Object.keys(unknownOptions);

  assert(unknownOptionNames.length === 0, 'Unknown test option: ' + unknownOptionNames[0]);

  assert(isPositiveInteger(measureTimeout), 'measureTimeout must be a positive integer');
  assert(isPositiveInteger(minBatchCount), 'minBatchCount must be a positive integer');
  assert(
    maxBatchIterationCount === Infinity || isPositiveInteger(maxBatchIterationCount),
    'maxBatchIterationCount must be a positive integer'
  );
  assert(isPositiveInteger(batchTimeout), 'batchTimeout must be a positive integer');
  assert(isPositiveInteger(batchPauseDuration), 'batchPauseDuration must be a positive integer');
  assert(isPositiveInteger(minLoopDuration), 'minLoopDuration must be a positive integer');

  assert(
    isNonNegativeInteger(maxWarmupBatchIterationCount),
    'maxWarmupBatchIterationCount must be a non-negative integer'
  );
  assert(isNonNegativeInteger(maxBatchMemorySampleCount), 'maxBatchMemorySampleCount must be a non-negative integer');

  assert(
    typeof targetRme === 'number' && targetRme > 0 && targetRme < 1,
    'targetRme must be greater than 0 and less than 1'
  );

  return {
    measureTimeout,
    targetRme,
    minBatchCount,
    maxWarmupBatchIterationCount,
    maxBatchIterationCount,
    batchTimeout,
    batchPauseDuration,
    minLoopDuration,
    maxBatchMemorySampleCount,
  };
}

/**
 * Creates the root node of a test file. Throws if test options are invalid.
 */
export function createTestSuite(testOptions: TestOptions): Node {
  return {
    kind: 'test_suite',
    name: '',
    parent: null,
    children: [],
    hooks: [],
    testOptions: toValidatedTestOptions(testOptions),
    callback: noop,
  };
}

/**
 * Creates a node from inline options that aren't validated yet, and appends it to the parent. The node inherits test
 * options of the parent.
 */
export function appendNode(
  parent: Node,
  child: { kind: NodeKind; name: string; testOptions: TestOptions; callback: () => unknown }
): Node {
  const node: Node = {
    ...child,
    parent,
    children: [],
    hooks: [],
    testOptions: toValidatedTestOptions({
      ...parent.testOptions,
      ...child.testOptions,
    }),
  };

  parent.children.push(node);
  return node;
}

/**
 * Calls callbacks of describe blocks to declare nested blocks, and returns blocks of the node. Test callbacks aren't
 * called.
 *
 * @param node The node which callback was already called.
 * @param path Indices of nodes from the test suite to the node.
 */
export async function collectBlocks(node: Node, path: number[] = []): Promise<Block[]> {
  const blocks: Block[] = [];

  for (let i = 0; i < node.children.length; ++i) {
    const child = node.children[i];
    const childPath = path.concat(i);

    if (child.kind === 'test') {
      blocks.push({
        kind: 'test',
        name: child.name,
        path: childPath,
      });

      continue;
    }

    let errorMessage: string | null = null;

    setCurrentNode(child);

    try {
      await child.callback();
    } catch (error) {
      errorMessage = getErrorStackOrMessage(error);
    }

    blocks.push({
      kind: 'describe',
      name: child.name,
      path: childPath,
      // Blocks of a describe that has thrown are never run
      children: errorMessage === null ? await collectBlocks(child, childPath) : [],
      errorMessage,
    });
  }

  return blocks;
}

export interface RunTestParams {
  testSuite: Node;

  /**
   * Indices of nodes from the test suite to the test.
   */
  testPath: number[];

  getMemoryUsed(): number;

  sendMessage(message: WorkerEvent): void;
}

/**
 * Runs a test. Only callbacks of describe blocks on the test path are called, so other blocks don't allocate memory in
 * the measured heap.
 */
export async function runTest(params: RunTestParams): Promise<MeasureResult> {
  const { testSuite, testPath, getMemoryUsed, sendMessage } = params;

  const durationHistogram = new Histogram();
  const memoryHistogram = new Histogram();

  let node = testSuite;

  for (const index of testPath) {
    node = node.children[index];

    if (node.kind === 'describe') {
      setCurrentNode(node);
      await node.callback();
    }
  }

  try {
    await runHooks(getHookCallbacks(node, 'before_each'));

    setCurrentNode(node);
    await node.callback();

    const measureCount = node.children.length;

    for (let measureIndex = 0; measureIndex < measureCount; ++measureIndex) {
      const result = await runMeasure({
        node: node.children[measureIndex],
        measureIndex,
        measureCount,
        getMemoryUsed,
        sendMessage,
      });

      if (result !== null) {
        durationHistogram.merge(result.durationHistogram);
        memoryHistogram.merge(result.memoryHistogram);
      }
    }
  } catch (error) {
    sendMessage({
      type: 'error_caught',
      errorMessage: getErrorStackOrMessage(error),
    });
  }

  // Cleanup runs even if the test has failed
  try {
    await runHooks(getReversedHookCallbacks(node, 'after_each'));
  } catch (error) {
    sendMessage({
      type: 'error_caught',
      errorMessage: getErrorStackOrMessage(error),
    });
  }

  return { durationHistogram, memoryHistogram };
}

export interface RunMeasureParams {
  node: Node;
  measureIndex: number;
  measureCount: number;

  getMemoryUsed(): number;

  sendMessage(message: WorkerEvent): void;
}

/**
 * Warms up and measures a callback of a measure node. Returns null if the callback has thrown an error.
 *
 * A measure runs batches with a pause between them for garbage collection. A batch runs loops, and a loop times
 * iterations with a single pair of timer reads, so timer resolution and overhead don't distort the results. CPU
 * frequency and scheduling change between batches, so the mean iteration duration of a batch is a sample of the
 * reported statistics, and the measure runs until batches agree to the target relative margin of error.
 */
export async function runMeasure(params: RunMeasureParams): Promise<MeasureResult | null> {
  const { node, measureIndex, measureCount, getMemoryUsed, sendMessage } = params;
  const { callback } = node;
  const {
    measureTimeout,
    targetRme,
    minBatchCount,
    maxWarmupBatchIterationCount,
    maxBatchIterationCount,
    batchTimeout,
    batchPauseDuration,
    minLoopDuration,
    maxBatchMemorySampleCount,
  } = node.testOptions;

  // Blocks and hooks can't be declared while the measure runs
  setCurrentNode(node);

  const beforeBatchHooks = getHookCallbacks(node, 'before_batch');
  const afterBatchHooks = getReversedHookCallbacks(node, 'after_batch');
  const beforeIterationHooks = getHookCallbacks(node, 'before_iteration');
  const afterIterationHooks = getReversedHookCallbacks(node, 'after_iteration');

  const durationHistogram = new Histogram();
  const memoryHistogram = new Histogram();

  // Iteration hooks run around every iteration, so a loop has a single iteration if there are such hooks. Otherwise,
  // loops of the first batch double until a loop lasts at least minLoopDuration.
  let loopIterationCount = 1;
  let isLoopCalibrated = beforeIterationHooks.length !== 0 || afterIterationHooks.length !== 0;

  /**
   * Runs iterations one by one until warmup is over. Returns false if the callback has thrown an error.
   */
  async function runWarmupBatch(): Promise<boolean> {
    // Warmup is a single batch, so it's also limited by batch options
    const maxIterationCount = Math.min(maxWarmupBatchIterationCount, maxBatchIterationCount);

    await runHooks(beforeBatchHooks);

    const batchTimestamp = performance.now();

    try {
      for (let i = 0; i < maxIterationCount && performance.now() - batchTimestamp <= batchTimeout; ++i) {
        await runHooks(beforeIterationHooks);

        callback();

        await runHooks(afterIterationHooks);
      }
    } catch (error) {
      sendMessage({
        type: 'error_caught',
        errorMessage: getErrorStackOrMessage(error),
      });

      return false;
    } finally {
      await runHooks(afterBatchHooks);
    }

    return true;
  }

  /**
   * Runs loops until the batch is over. Returns the mean iteration duration, or null if the callback has thrown an
   * error.
   *
   * @param timeout The maximum duration of the batch in milliseconds. A batch times at least one loop.
   */
  async function runBatch(timeout: number): Promise<number | null> {
    let iterationCount = 0;
    let timedIterationCount = 0;
    let timedDuration = 0;
    let memorySampleCount = 0;

    await runHooks(beforeBatchHooks);

    const batchTimestamp = performance.now();

    try {
      while (
        iterationCount < maxBatchIterationCount &&
        (timedIterationCount === 0 || performance.now() - batchTimestamp <= timeout)
      ) {
        // The last loop of a batch is shortened to fit maxBatchIterationCount
        const currentLoopIterationCount = Math.min(loopIterationCount, maxBatchIterationCount - iterationCount);

        await runHooks(beforeIterationHooks);

        const loopDuration = measureLoopDuration(callback, currentLoopIterationCount);

        await runHooks(afterIterationHooks);

        iterationCount += currentLoopIterationCount;

        // A short loop isn't timed precisely, so it's discarded, unless the batch has no iterations left
        if (!isLoopCalibrated && loopDuration < minLoopDuration && iterationCount < maxBatchIterationCount) {
          loopIterationCount *= 2;
          continue;
        }

        isLoopCalibrated = true;
        timedIterationCount += currentLoopIterationCount;
        timedDuration += loopDuration;

        if (memorySampleCount < maxBatchMemorySampleCount && iterationCount < maxBatchIterationCount) {
          await sampleMemoryUsed();

          memorySampleCount++;
          iterationCount++;
        }
      }
    } catch (error) {
      sendMessage({
        type: 'error_caught',
        errorMessage: getErrorStackOrMessage(error),
      });

      return null;
    } finally {
      await runHooks(afterBatchHooks);
    }

    return timedDuration / timedIterationCount;
  }

  /**
   * Adds the memory allocated by an iteration to the memory histogram.
   */
  async function sampleMemoryUsed(): Promise<void> {
    await runHooks(beforeIterationHooks);

    const memoryUsed = measureMemoryUsed(callback, getMemoryUsed);

    await runHooks(afterIterationHooks);

    if (memoryUsed !== null) {
      memoryHistogram.add(memoryUsed);
    }
  }

  if (maxWarmupBatchIterationCount > 0) {
    sendMessage({
      type: 'warmup_started',
      measureIndex,
      measureCount,
    });

    await runHooks(getHookCallbacks(node, 'before_warmup'));

    const isWarmedUp = await runWarmupBatch();

    if (!isWarmedUp) {
      return null;
    }

    await runHooks(getReversedHookCallbacks(node, 'after_warmup'));

    // The pause between batches is required for garbage collection
    await sleep(batchPauseDuration);
  }

  let percentage = 0;

  const measureTimestamp = performance.now();

  sendMessage({
    type: 'progress_updated',
    measureIndex,
    measureCount,
    percentage,
  });

  while (true) {
    // A batch ends early if the measure times out
    const remainingTime = measureTimestamp + measureTimeout - performance.now();
    const iterationDuration = await runBatch(Math.min(batchTimeout, remainingTime));

    if (iterationDuration === null) {
      return null;
    }

    durationHistogram.add(iterationDuration);

    const { size, rme } = durationHistogram;
    const timeoutProgress = (performance.now() - measureTimestamp) / measureTimeout;

    // The margin of error is 0 if all batches have the same mean iteration duration
    const rmeProgress = size < minBatchCount ? 0 : rme === 0 ? 1 : targetRme / rme;

    if (timeoutProgress >= 1 || rmeProgress >= 1) {
      sendMessage({
        type: 'progress_updated',
        measureIndex,
        measureCount,
        percentage: 1,
      });

      return {
        durationHistogram,
        memoryHistogram,
      };
    }

    // Progress is reported in whole percents, since finer steps aren't displayed anyway
    const nextPercentage = Math.trunc(Math.max(percentage, timeoutProgress, rmeProgress) * 100) / 100;

    if (percentage !== nextPercentage) {
      percentage = nextPercentage;

      sendMessage({
        type: 'progress_updated',
        measureIndex,
        measureCount,
        percentage,
      });
    }

    await sleep(batchPauseDuration);
  }
}

/**
 * Returns the duration of a loop in milliseconds.
 */
function measureLoopDuration(callback: () => unknown, iterationCount: number): number {
  const timestamp = performance.now();

  for (let i = 0; i < iterationCount; ++i) {
    callback();
  }

  return performance.now() - timestamp;
}

/**
 * Returns the number of bytes allocated by an iteration, or null if the measurement is distorted.
 */
function measureMemoryUsed(callback: () => unknown, getMemoryUsed: () => number): number | null {
  // The heap probe can allocate memory itself, so the heap growth of a noop is subtracted
  const probeMemoryUsed = measureHeapGrowth(noop, getMemoryUsed);
  const callbackMemoryUsed = measureHeapGrowth(callback, getMemoryUsed);
  const memoryUsed = callbackMemoryUsed - probeMemoryUsed;

  // The heap shrinks if the garbage collector runs. The difference is negative if the probe allocated more memory while
  // measuring the noop, which happens the first few times the probe runs.
  return probeMemoryUsed < 0 || memoryUsed < 0 ? null : memoryUsed;
}

/**
 * Returns the heap growth during a call in bytes. A noop and a callback must be measured by this function, not by
 * inlined probes: V8 optimizes each call site of the probe differently, so probes at different call sites allocate
 * different amounts of memory.
 */
function measureHeapGrowth(callback: () => unknown, getMemoryUsed: () => number): number {
  const startMemoryUsed = getMemoryUsed();

  callback();

  return getMemoryUsed() - startMemoryUsed;
}

/**
 * Returns callbacks of hooks of the given type that are registered on the node and its ancestors: from the outermost
 * block to the innermost, in the order of registration. Before-hooks run in this order.
 */
function getHookCallbacks(node: Node, type: HookType): HookCallback[] {
  return getReversedHookCallbacks(node, type).reverse();
}

/**
 * Returns callbacks of hooks of the given type that are registered on the node and its ancestors: from the innermost
 * block to the outermost, the last registered first. After-hooks run in this order.
 */
function getReversedHookCallbacks(node: Node, type: HookType): HookCallback[] {
  const callbacks: HookCallback[] = [];

  for (let ancestor: Node | null = node; ancestor !== null; ancestor = ancestor.parent) {
    for (let i = ancestor.hooks.length - 1; i >= 0; --i) {
      if (ancestor.hooks[i].type === type) {
        callbacks.push(ancestor.hooks[i].callback);
      }
    }
  }

  return callbacks;
}

async function runHooks(callbacks: HookCallback[]): Promise<void> {
  for (const callback of callbacks) {
    await callback();
  }
}

let currentNode = createTestSuite({});

/**
 * Returns the node to which describe blocks, tests, measures and hooks are added.
 */
export function getCurrentNode(): Node {
  return currentNode;
}

export function setCurrentNode(node: Node): void {
  currentNode = node;
}
