import { Histogram, type HistogramSummary, summarizeHistograms } from './Histogram.ts';
import type { HookCallback, TestOptions } from './index.ts';
import {
  assert,
  getErrorStackOrMessage,
  isNonNegativeInteger,
  isPositiveInteger,
  isPromiseLike,
  noop,
  sleep,
} from './utils.ts';

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

export type NodeKind = 'test_suite' | 'describe' | 'test' | 'measure';

/**
 * A node of the tree that a test file declares: the test suite at the root, describe blocks, tests and measures.
 */
export interface Node {
  kind: NodeKind;
  name: string;
  parent: Node | null;
  children: Node[];
  hooks: Hook[];
  testOptions: Required<TestOptions>;

  /**
   * Declares children and hooks of a describe block or a test. For a measure, this is the callback that is measured.
   */
  callback: () => unknown;
}

/**
 * A describe block or a test that a worker has collected from a test file. The main process reports blocks and runs
 * each test in a new worker.
 */
export type Block = DescribeBlock | TestBlock;

export interface DescribeBlock {
  kind: 'describe';
  name: string;

  /**
   * Indices of nodes on the way from the test suite to the describe block.
   */
  path: number[];

  children: Block[];

  /**
   * The error that the describe block has thrown, or `null` if its children were collected.
   */
  errorMessage: string | null;
}

export interface TestBlock {
  kind: 'test';
  name: string;

  /**
   * Indices of nodes on the way from the test suite to the test. The worker that runs the test finds it by this path.
   */
  path: number[];
}

/**
 * A test file and the describe blocks and tests that it declares.
 */
export interface TestModule {
  testFile: string;
  blocks: Block[];

  /**
   * The error that the test file has thrown when it was imported, or `null` if its blocks were collected.
   */
  errorMessage: string | null;
}

/**
 * A job that the main process sends to a new worker. The worker imports setup files and the test file, and then runs
 * the job.
 */
export type WorkerJob =
  | { type: 'collect_blocks'; setupFiles: string[]; testFile: string; testOptions: TestOptions }
  | { type: 'run_test'; setupFiles: string[]; testFile: string; testOptions: TestOptions; testPath: number[] };

/**
 * An event of a job that runs in a worker. The last event of a job is `blocks_collected`, `test_ended` or `job_failed`.
 */
export type WorkerEvent =
  | { type: 'blocks_collected'; blocks: Block[] }
  | { type: 'warmup_started'; measureIndex: number; measureCount: number }
  | { type: 'progress_updated'; measureIndex: number; measureCount: number; percentage: number }
  | { type: 'error_caught'; errorMessage: string }
  | { type: 'test_ended'; durationSummary: HistogramSummary; memorySummary: HistogramSummary }
  | { type: 'job_failed'; errorMessage: string };

export interface MeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

export interface TestResult {
  durationSummary: HistogramSummary;
  memorySummary: HistogramSummary;
}

export interface WarmupStartParams {
  block: TestBlock;

  /**
   * The index of the measure among measures of the test.
   */
  measureIndex: number;

  /**
   * The number of measures of the test.
   */
  measureCount: number;
}

export interface ProgressParams extends WarmupStartParams {
  /**
   * The progress of the measure, between `0` and `1`.
   */
  percentage: number;
}

export interface TestEndParams extends TestResult {
  block: TestBlock;

  /**
   * Errors that the test has thrown, and the error that has stopped its worker, if any. The test has failed if there
   * are any.
   */
  errorMessages: readonly string[];
}

/**
 * Receives events of a test run, for example, to print results.
 */
export interface Reporter {
  /**
   * Called once after describe blocks and tests of all test files were collected, before tests run.
   */
  onTestModulesCollected(testModules: readonly TestModule[]): void;

  /**
   * Called before tests of a test module run. A test module whose test file has thrown an error when it was imported
   * has no tests.
   */
  onTestModuleStart(testModule: TestModule): void;

  /**
   * Called after tests of a test module have run.
   */
  onTestModuleEnd(testModule: TestModule): void;

  /**
   * Called before tests of a describe block run. A describe block that has thrown an error has no tests.
   */
  onDescribeStart(block: DescribeBlock): void;

  /**
   * Called after tests of a describe block have run.
   */
  onDescribeEnd(block: DescribeBlock): void;

  /**
   * Called before a test runs in a new worker.
   */
  onTestStart(block: TestBlock): void;

  /**
   * Called when a measure of the test starts its warmup.
   */
  onWarmupStart(params: WarmupStartParams): void;

  /**
   * Called when the progress of a measure changes after warmup.
   */
  onProgress(params: ProgressParams): void;

  /**
   * Called after a test has ended, even if its worker has exited before the test ended.
   */
  onTestEnd(params: TestEndParams): void;

  /**
   * Called with an error that doesn't belong to a test module, a describe block or a test, for example, if no tests
   * are found.
   */
  onError(errorMessage: string): void;
}

const defaultTestOptions: Required<TestOptions> = {
  measureTimeout: 10_000,
  targetRme: 0.05,
  minBatchCount: 5,
  maxWarmupBatchIterationCount: 10_000,
  maxBatchIterationCount: Infinity,
  batchTimeout: 1_000,
  batchPauseDuration: 200,
  minLoopDuration: 1,
  maxBatchMemorySampleCount: 10,
};

/**
 * Validates test options and fills in the options that aren't set. Throws if an option is unknown or invalid.
 *
 * @param options The options to validate.
 * @param defaultOptions The options that fill in the options that aren't set.
 */
export function resolveTestOptions(options: TestOptions, defaultOptions = defaultTestOptions): Required<TestOptions> {
  const {
    measureTimeout = defaultOptions.measureTimeout,
    targetRme = defaultOptions.targetRme,
    minBatchCount = defaultOptions.minBatchCount,
    maxWarmupBatchIterationCount = defaultOptions.maxWarmupBatchIterationCount,
    maxBatchIterationCount = defaultOptions.maxBatchIterationCount,
    batchTimeout = defaultOptions.batchTimeout,
    batchPauseDuration = defaultOptions.batchPauseDuration,
    minLoopDuration = defaultOptions.minLoopDuration,
    maxBatchMemorySampleCount = defaultOptions.maxBatchMemorySampleCount,
    ...unknownOptions
  } = options;

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
 * Creates the root node of a test file.
 */
export function createTestSuiteNode(testOptions: TestOptions): Node {
  return {
    kind: 'test_suite',
    name: '',
    parent: null,
    children: [],
    hooks: [],
    testOptions: resolveTestOptions(testOptions),
    callback: noop,
  };
}

/**
 * Creates a node and appends it to the parent. Test options that the child doesn't set are inherited from the parent.
 */
export function appendChild(
  parent: Node,
  child: { kind: NodeKind; name: string; testOptions: TestOptions; callback: () => unknown }
): Node {
  const node: Node = {
    ...child,
    parent,
    children: [],
    hooks: [],
    testOptions: resolveTestOptions(child.testOptions, parent.testOptions),
  };

  parent.children.push(node);
  return node;
}

/**
 * Returns describe blocks and tests that the node contains. Callbacks of describe blocks are called to declare their
 * contents, and callbacks of tests aren't called.
 *
 * @param node A node whose callback was already called.
 * @param path Indices of nodes on the way from the test suite to the node.
 */
export async function collectBlocks(node: Node, path: number[] = []): Promise<Block[]> {
  const blocks: Block[] = [];

  for (let i = 0; i < node.children.length; ++i) {
    const childNode = node.children[i];
    const childPath = path.concat(i);

    if (childNode.kind === 'test') {
      blocks.push({
        kind: 'test',
        name: childNode.name,
        path: childPath,
      });
      continue;
    }

    let errorMessage: string | null = null;

    setCurrentNode(childNode);

    try {
      await childNode.callback();
    } catch (error) {
      errorMessage = getErrorStackOrMessage(error);
    }

    blocks.push({
      kind: 'describe',
      name: childNode.name,
      path: childPath,
      // Blocks of a describe block that has thrown are never run
      children: errorMessage === null ? await collectBlocks(childNode, childPath) : [],
      errorMessage,
    });
  }

  return blocks;
}

/**
 * Removes tests whose names don't match any of the patterns, and describe blocks that have no tests left. Describe
 * blocks that have thrown an error are kept, so the error is reported.
 *
 * @param blocks Blocks that are pruned in place.
 * @param testNamePatterns Patterns of test names prefixed with names of enclosing describe blocks. If empty, all tests
 * are kept.
 * @param separator Separates names of enclosing describe blocks and the test name.
 * @param parentName The name of the parent describe block followed by the separator.
 */
export function pruneBlocks(blocks: Block[], testNamePatterns: RegExp[], separator: string, parentName = ''): void {
  for (let i = blocks.length - 1; i >= 0; --i) {
    const block = blocks[i];
    const name = parentName + block.name;

    if (block.kind === 'test') {
      if (testNamePatterns.length !== 0 && !testNamePatterns.some(pattern => pattern.test(name))) {
        blocks.splice(i, 1);
      }
      continue;
    }

    pruneBlocks(block.children, testNamePatterns, separator, name + separator);

    if (block.children.length === 0 && block.errorMessage === null) {
      blocks.splice(i, 1);
    }
  }
}

/**
 * Returns tests in blocks, including tests in nested describe blocks, in the order they are declared.
 *
 * @param blocks The blocks to search.
 * @param testBlocks The array to which tests are added, and which is returned.
 */
export function getTestBlocks(blocks: Block[], testBlocks: TestBlock[] = []): TestBlock[] {
  for (const block of blocks) {
    if (block.kind === 'test') {
      testBlocks.push(block);
      continue;
    }

    getTestBlocks(block.children, testBlocks);
  }

  return testBlocks;
}

export interface RunTestParams {
  /**
   * The root node, in which the test is looked up by {@link RunTestParams.testPath}.
   */
  rootNode: Node;

  /**
   * Indices of nodes on the way from the test suite to the test.
   */
  testPath: number[];

  getMemoryUsed(): number;

  sendMessage(message: WorkerEvent): void;
}

/**
 * Runs the test at the path. Only callbacks of describe blocks on the path are called, so other blocks don't add
 * objects to the measured heap.
 */
export async function runTest(params: RunTestParams): Promise<TestResult> {
  const { rootNode, testPath, getMemoryUsed, sendMessage } = params;

  const durationHistograms: Histogram[] = [];
  const memoryHistograms: Histogram[] = [];

  let node = rootNode;

  for (const index of testPath) {
    node = node.children[index];

    assert(node !== undefined, 'Test order must not change between invokations');

    if (node.kind === 'describe') {
      setCurrentNode(node);
      await node.callback();
    }
  }

  assert(node.kind === 'test', 'Test order must not change between invokations');

  try {
    await runHooks(getBeforeHookCallbacks(node, 'before_each'));

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
        durationHistograms.push(result.durationHistogram);
        memoryHistograms.push(result.memoryHistogram);
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
    await runHooks(getAfterHookCallbacks(node, 'after_each'));
  } catch (error) {
    sendMessage({
      type: 'error_caught',
      errorMessage: getErrorStackOrMessage(error),
    });
  }

  return {
    durationSummary: summarizeHistograms(durationHistograms),
    memorySummary: summarizeHistograms(memoryHistograms),
  };
}

export interface RunMeasureParams {
  node: Node;
  measureIndex: number;
  measureCount: number;

  getMemoryUsed(): number;

  sendMessage(message: WorkerEvent): void;
}

/**
 * Warms up the callback of a measure node, and then measures it. Returns `null` if the callback has thrown or its
 * promise was rejected.
 *
 * After warmup, the measure runs batches with a pause after each. A batch calls the callback in loops, and times each
 * loop with two timer reads, so the overhead of the timer is spread over many calls. Each batch adds its mean call
 * duration to the results. The measure stops when batches agree within {@link TestOptions.targetRme}, or when
 * {@link TestOptions.measureTimeout} is reached.
 *
 * The callback is async if its first call returns a promise. Then each call starts after the promise of the previous
 * call has settled, and a loop is timed until the promise of its last call settles.
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

  const beforeBatchHooks = getBeforeHookCallbacks(node, 'before_batch');
  const afterBatchHooks = getAfterHookCallbacks(node, 'after_batch');
  const beforeIterationHooks = getBeforeHookCallbacks(node, 'before_iteration');
  const afterIterationHooks = getAfterHookCallbacks(node, 'after_iteration');

  const durationHistogram = new Histogram();
  const memoryHistogram = new Histogram();

  // Iteration hooks run around every call, so then a loop has a single iteration. Otherwise, loops of the first batch
  // double until a loop lasts at least minLoopDuration.
  let loopIterationCount = 1;
  let isLoopCalibrated = beforeIterationHooks.length !== 0 || afterIterationHooks.length !== 0;

  // Unknown until the first call shows whether the callback returns a promise
  let isAsync: boolean | undefined;

  /**
   * Calls the callback once, and returns how long the call took in milliseconds. A call of an async callback lasts
   * until its promise settles.
   */
  async function measureCallDuration(): Promise<number> {
    // Lets the caller await this function before the timer is read, see measureAsyncLoopDuration
    await resolvedPromise;

    const timestamp = performance.now();
    const result = callback();

    if (isAsync === undefined) {
      isAsync = isPromiseLike(result);
    }

    if (isAsync) {
      await result;
    } else {
      assertNotAsync(result);
    }

    return performance.now() - timestamp;
  }

  /**
   * Calls the callback one iteration at a time until warmup is over. Returns `false` if the callback has thrown.
   */
  async function runWarmupBatch(): Promise<boolean> {
    // Warmup is a batch, so batch options limit it too
    const maxIterationCount = Math.min(maxWarmupBatchIterationCount, maxBatchIterationCount);

    await runHooks(beforeBatchHooks);

    const batchTimestamp = performance.now();

    try {
      for (let i = 0; i < maxIterationCount && performance.now() - batchTimestamp <= batchTimeout; ++i) {
        await runHooks(beforeIterationHooks);

        await measureCallDuration();

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
   * Runs loops until the batch is over. Returns the mean call duration, or `null` if the callback has thrown.
   *
   * @param timeout The maximum duration of the batch in milliseconds. A batch times at least one loop, even if the loop
   * takes longer.
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

        let loopDuration;

        if (isAsync === undefined) {
          // The callback wasn't called yet, so this is the first loop of the measure, which has a single call
          loopDuration = await measureCallDuration();
        } else if (isAsync) {
          loopDuration = await measureAsyncLoopDuration(callback, currentLoopIterationCount);
        } else {
          loopDuration = measureLoopDuration(callback, currentLoopIterationCount);
        }

        await runHooks(afterIterationHooks);

        iterationCount += currentLoopIterationCount;

        // A loop that is too short to time precisely is discarded, unless the batch has no iterations left
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
   * Calls the callback once, and adds the number of bytes it has allocated to the memory histogram.
   */
  async function sampleMemoryUsed(): Promise<void> {
    await runHooks(beforeIterationHooks);

    const memoryUsed = isAsync
      ? await measureAsyncMemoryUsed(callback, getMemoryUsed)
      : measureMemoryUsed(callback, getMemoryUsed);

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

    await runHooks(getBeforeHookCallbacks(node, 'before_warmup'));

    const isWarmedUp = await runWarmupBatch();

    if (!isWarmedUp) {
      return null;
    }

    await runHooks(getAfterHookCallbacks(node, 'after_warmup'));

    // The pause lets the garbage collector run before the first batch
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

    // The margin of error is unknown for a single batch, and is 0 if all batches have the same mean call duration
    const rmeProgress = size < minBatchCount || Number.isNaN(rme) ? 0 : rme === 0 ? 1 : targetRme / rme;

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

    // Progress is reported in whole percents
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
 * Calls the callback several times in a row, and returns how long all calls took in milliseconds.
 */
function measureLoopDuration(callback: () => unknown, iterationCount: number): number {
  let result;

  const timestamp = performance.now();

  for (let i = 0; i < iterationCount; ++i) {
    result = callback();
  }

  const duration = performance.now() - timestamp;

  assertNotAsync(result);

  return duration;
}

/**
 * Calls an async callback several times in a row, and returns how long all calls took in milliseconds. Each call starts
 * after the promise of the previous call has settled.
 */
async function measureAsyncLoopDuration(callback: () => unknown, iterationCount: number): Promise<number> {
  // An async function returns its promise when it first suspends, and the caller's await of that promise runs before
  // the function resumes. The function suspends before the timer is read, so the caller's await isn't timed.
  await resolvedPromise;

  const timestamp = performance.now();

  for (let i = 0; i < iterationCount; ++i) {
    await callback();
  }

  return performance.now() - timestamp;
}

/**
 * Throws if a synchronous callback has returned a promise. A synchronous callback isn't awaited, so only the part of
 * the call before its first await would be measured.
 */
function assertNotAsync(result: unknown): void {
  if (!isPromiseLike(result)) {
    return;
  }

  // The thrown error reports the problem, so a rejection of the promise must not crash the process
  Promise.resolve(result).then(undefined, noop);

  throw new Error('measure() callback must not return a promise if its first call did not');
}

/**
 * Calls the callback once, and returns the number of bytes it has allocated, or `null` if the garbage collector has
 * distorted the measurement.
 */
function measureMemoryUsed(callback: () => unknown, getMemoryUsed: () => number): number | null {
  // Reading the heap size can allocate memory itself, so the heap growth around a noop is subtracted
  const probeMemoryUsed = measureHeapGrowth(noop, getMemoryUsed);
  const callbackMemoryUsed = measureHeapGrowth(callback, getMemoryUsed);

  return getCallbackMemoryUsed(probeMemoryUsed, callbackMemoryUsed);
}

/**
 * Calls an async callback once, and returns the number of bytes it has allocated until its promise has settled, or
 * `null` if the garbage collector has distorted the measurement.
 */
async function measureAsyncMemoryUsed(callback: () => unknown, getMemoryUsed: () => number): Promise<number | null> {
  // Lets the caller await this function before the heap is read, see measureAsyncLoopDuration. Otherwise, only the
  // heap growth around the probe would include the caller's await.
  await resolvedPromise;

  // Awaiting allocates memory itself, so the heap growth around awaiting a promise that already exists is subtracted.
  // Awaiting a value that isn't a promise, or a new promise, would allocate a promise, and hide the one that an async
  // callback allocates.
  const probeMemoryUsed = await measureAsyncHeapGrowth(getResolvedPromise, getMemoryUsed);
  const callbackMemoryUsed = await measureAsyncHeapGrowth(callback, getMemoryUsed);

  return getCallbackMemoryUsed(probeMemoryUsed, callbackMemoryUsed);
}

/**
 * Returns the number of bytes that a callback has allocated, or `null` if the garbage collector has distorted the
 * measurement.
 *
 * @param probeMemoryUsed How many bytes the heap has grown around a call that allocates nothing.
 * @param callbackMemoryUsed How many bytes the heap has grown around a call of the callback.
 */
function getCallbackMemoryUsed(probeMemoryUsed: number, callbackMemoryUsed: number): number | null {
  const memoryUsed = callbackMemoryUsed - probeMemoryUsed;

  // The heap shrinks if the garbage collector runs. The difference is also negative if the probe has allocated more
  // memory, which happens the first few times the probe runs.
  return probeMemoryUsed < 0 || memoryUsed < 0 ? null : memoryUsed;
}

/**
 * Returns how many bytes the heap has grown during a call. Both the noop and the callback must be measured by this
 * function: V8 optimizes each call site separately, so heap reads at different call sites allocate different amounts
 * of memory.
 */
function measureHeapGrowth(callback: () => unknown, getMemoryUsed: () => number): number {
  const startMemoryUsed = getMemoryUsed();

  callback();

  return getMemoryUsed() - startMemoryUsed;
}

/**
 * Returns how many bytes the heap has grown during a call and until its promise has settled. Both the probe and the
 * callback must be measured by this function, like in {@link measureHeapGrowth}.
 */
async function measureAsyncHeapGrowth(callback: () => unknown, getMemoryUsed: () => number): Promise<number> {
  const startMemoryUsed = getMemoryUsed();

  await callback();

  return getMemoryUsed() - startMemoryUsed;
}

const resolvedPromise = Promise.resolve();

/**
 * Returns the same promise every time, so a call allocates nothing.
 */
function getResolvedPromise(): Promise<void> {
  return resolvedPromise;
}

/**
 * Returns callbacks of hooks of the type that are registered on the node and its ancestors, in the order before-hooks
 * run: outer blocks first, and hooks of the same block in the order they were registered.
 */
function getBeforeHookCallbacks(node: Node, type: HookType): HookCallback[] {
  return getAfterHookCallbacks(node, type).reverse();
}

/**
 * Returns callbacks of hooks of the type that are registered on the node and its ancestors, in the order after-hooks
 * run: inner blocks first, and hooks of the same block in reverse order of registration.
 */
function getAfterHookCallbacks(node: Node, type: HookType): HookCallback[] {
  const callbacks: HookCallback[] = [];

  for (let ancestorNode: Node | null = node; ancestorNode !== null; ancestorNode = ancestorNode.parent) {
    for (let i = ancestorNode.hooks.length - 1; i >= 0; --i) {
      if (ancestorNode.hooks[i].type === type) {
        callbacks.push(ancestorNode.hooks[i].callback);
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

let currentNode = createTestSuiteNode({});

/**
 * Returns the node to which describe blocks, tests, measures and hooks are added when they are declared.
 */
export function getCurrentNode(): Node {
  return currentNode;
}

/**
 * Sets the node to which describe blocks, tests, measures and hooks are added when they are declared.
 */
export function setCurrentNode(node: Node): void {
  currentNode = node;
}
