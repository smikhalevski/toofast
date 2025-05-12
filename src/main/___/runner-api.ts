import { HookCallback, MeasureOptions, TestOptions } from './index.js';
import { combineHooks, getErrorMessage, sleep } from './utils.js';
import { Histogram, HistogramStats } from './Histogram.js';

const MEASURE_TIMEOUT = 10_000;
const TARGET_RME = 0.01;
const WARMUP_ITERATION_COUNT = 1;
const BATCH_ITERATION_COUNT = Infinity;
const BATCH_TIMEOUT = 1_000;
const BATCH_INTERMISSION_TIMEOUT = 200;

export type ParentNode = TestSuiteNode | DescribeNode;

export type ChildNode = DescribeNode | TestNode | MeasureNode;

export class Node {
  parent: ParentNode | null = null;
  children: Array<ChildNode> = [];
  isSkipped = false;

  beforeEachHook: HookCallback | undefined = undefined;
  afterEachHook: HookCallback | undefined = undefined;
  beforeWarmupHook: HookCallback | undefined = undefined;
  afterWarmupHook: HookCallback | undefined = undefined;
  beforeBatchHook: HookCallback | undefined = undefined;
  afterBatchHook: HookCallback | undefined = undefined;
  beforeIterationHook: HookCallback | undefined = undefined;
  afterIterationHook: HookCallback | undefined = undefined;

  constructor(public testOptions: TestOptions) {}

  beforeEach(hook: HookCallback): void {
    this.beforeEachHook = combineHooks(this.beforeEachHook, hook);
  }

  afterEach(hook: HookCallback): void {
    this.afterEachHook = combineHooks(this.afterEachHook, hook);
  }

  beforeWarmup(hook: HookCallback): void {
    this.beforeWarmupHook = combineHooks(this.beforeWarmupHook, hook);
  }

  afterWarmup(hook: HookCallback): void {
    this.afterWarmupHook = combineHooks(this.afterWarmupHook, hook);
  }

  beforeBatch(hook: HookCallback): void {
    this.beforeBatchHook = combineHooks(this.beforeBatchHook, hook);
  }

  afterBatch(hook: HookCallback): void {
    this.afterBatchHook = combineHooks(this.afterBatchHook, hook);
  }

  beforeIteration(hook: HookCallback): void {
    this.beforeIterationHook = combineHooks(this.beforeIterationHook, hook);
  }

  afterIteration(hook: HookCallback): void {
    this.afterIterationHook = combineHooks(this.afterIterationHook, hook);
  }

  appendChild(child: ChildNode): this {
    if (child.parent !== null) {
      throw new Error('Child already has a parent');
    }

    child.parent = this;
    child.testOptions = { ...this.testOptions, ...child.testOptions };

    child.beforeEachHook = combineHooks(this.beforeEachHook, child.beforeEachHook);
    child.afterEachHook = combineHooks(this.afterEachHook, child.afterEachHook);
    child.beforeWarmupHook = combineHooks(this.beforeWarmupHook, child.beforeWarmupHook);
    child.afterWarmupHook = combineHooks(this.afterWarmupHook, child.afterWarmupHook);
    child.beforeBatchHook = combineHooks(this.beforeBatchHook, child.beforeBatchHook);
    child.afterBatchHook = combineHooks(this.afterBatchHook, child.afterBatchHook);
    child.beforeIterationHook = combineHooks(this.beforeIterationHook, child.beforeIterationHook);
    child.afterIterationHook = combineHooks(this.afterIterationHook, child.afterIterationHook);

    this.children.push(child);

    return this;
  }
}

export class TestSuiteNode extends Node {}

export class DescribeNode extends Node {
  constructor(
    readonly name: string,
    readonly callback: () => PromiseLike<void> | void,
    testOptions: TestOptions = {}
  ) {
    super(testOptions);
  }
}

export class TestNode extends Node {
  constructor(
    readonly name: string,
    readonly callback: () => PromiseLike<void> | void,
    testOptions: TestOptions = {}
  ) {
    super(testOptions);
  }

  get absoluteName(): string {
    let absoluteName = this.name;

    for (let node = this.parent; node instanceof DescribeNode; node = node.parent) {
      absoluteName = node.name + '.' + absoluteName;
    }

    return absoluteName;
  }
}

export class MeasureNode extends Node {
  constructor(
    readonly callback: () => void,
    measureOptions: MeasureOptions = {}
  ) {
    super(measureOptions);

    this.afterWarmupHook = measureOptions.afterWarmup;
    this.beforeBatchHook = measureOptions.beforeBatch;
    this.afterBatchHook = measureOptions.afterBatch;
    this.beforeIterationHook = measureOptions.beforeIteration;
    this.afterIterationHook = measureOptions.afterIteration;
  }
}

export type RunnerMessage =
  | { type: 'noTests' }
  | { type: 'fatalError'; errorMessage: string }
  | { type: 'describeStart'; name: string }
  | { type: 'describeEnd' }
  | { type: 'testStart'; name: string; nodeLocation: number[] }
  | { type: 'testEnd'; durationStats: HistogramStats; memoryStats: HistogramStats }
  | { type: 'error'; errorMessage: string }
  | { type: 'measureWarmupStart' }
  | { type: 'measureWarmupEnd' }
  | { type: 'measureStart' }
  | { type: 'measureEnd'; durationStats: HistogramStats; memoryStats: HistogramStats }
  | { type: 'measureError'; errorMessage: string }
  | { type: 'measureProgress'; percentage: number };

export interface BootstrapRunnerOptions {
  setupFilePaths: string[];
  testFilePath: string;

  evalFile(filePath: string): Promise<void> | void;

  sendMessage(message: RunnerMessage): void;
}

export async function bootstrapRunner(options: BootstrapRunnerOptions): Promise<boolean> {
  const { setupFilePaths, testFilePath, evalFile, sendMessage } = options;

  try {
    for (const filePath of setupFilePaths) {
      await evalFile(filePath);
    }

    evalFile(testFilePath);
  } catch (error) {
    sendMessage({ type: 'fatalError', errorMessage: getErrorMessage(error) });
    return false;
  }

  return true;
}

export interface MeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

export interface RunTestOptions {
  startNode: Node;
  nodeLocation: number[];

  isSkipped(testNode: TestNode): boolean;

  setCurrentNode(node: Node): void;

  runMeasure(node: MeasureNode): Promise<MeasureResult | null>;

  sendMessage(message: RunnerMessage): void;
}

export async function runTest(options: RunTestOptions): Promise<void> {
  const { startNode, isSkipped, setCurrentNode, runMeasure, sendMessage } = options;

  let node = startNode;

  const nodeLocation = options.nodeLocation.splice(0);

  for (const index of nodeLocation.splice(0, -1)) {
    node = node.children[index];
    setCurrentNode(node);
    await (node as ChildNode).callback();
  }

  let depth = 0;
  let startIndex = 0;

  if (nodeLocation.length !== 0) {
    depth = nodeLocation.length - 1;
    startIndex = nodeLocation[depth] + 1;
  }

  traversal: while (true) {
    for (let i = startIndex; i < node.children.length; ++i) {
      const child = node.children[i];

      nodeLocation[depth] = i;

      if (child.isSkipped) {
        continue;
      }

      if (child instanceof DescribeNode) {
        sendMessage({ type: 'describeStart', name: child.name });
        setCurrentNode(child);

        try {
          await child.callback();
        } catch (error) {
          // Skip describe block after an error
          sendMessage({ type: 'error', errorMessage: getErrorMessage(error) });
          sendMessage({ type: 'describeEnd' });
          continue;
        }

        depth++;
        startIndex = nodeLocation[depth] = 0;
        node = child;
        continue traversal;
      }

      if (child instanceof TestNode && !isSkipped(child)) {
        sendMessage({
          type: 'testStart',
          name: child.name,
          nodeLocation: nodeLocation.slice(0, depth + 1),
        });

        setCurrentNode(child);

        const durationHistogram = new Histogram();
        const memoryHistogram = new Histogram();

        try {
          await child.beforeEachHook?.();

          await child.callback();

          for (const node of child.children) {
            const result = await runMeasure(node as MeasureNode);

            if (result !== null) {
              durationHistogram.add(result.durationHistogram);
              memoryHistogram.add(result.memoryHistogram);
            }
          }

          await child.afterEachHook?.();
        } catch (error) {
          sendMessage({ type: 'error', errorMessage: getErrorMessage(error) });
        }

        sendMessage({
          type: 'testEnd',
          durationStats: durationHistogram.getStats(),
          memoryStats: memoryHistogram.getStats(),
        });

        return;
      }
    }

    while (node.parent !== null) {
      sendMessage({ type: 'describeEnd' });

      node = node.parent;

      startIndex = nodeLocation[--depth] + 1;

      if (startIndex < node.children.length) {
        continue traversal;
      }
    }

    break;
  }

  sendMessage({ type: 'noTests' });
}

export interface RunMeasureOptions {
  sendMessage(message: RunnerMessage): void;

  getMemoryUsed(): number;
}

export function createRunMeasure(options: RunMeasureOptions): (node: MeasureNode) => Promise<MeasureResult | null> {
  const { sendMessage, getMemoryUsed } = options;

  return async node => {
    const durationHistogram = new Histogram();
    const memoryHistogram = new Histogram();

    const {
      testOptions: {
        measureTimeout = MEASURE_TIMEOUT,
        targetRme = TARGET_RME,
        warmupIterationCount = WARMUP_ITERATION_COUNT,
        batchIterationCount = BATCH_ITERATION_COUNT,
        batchTimeout = BATCH_TIMEOUT,
        batchIntermissionTimeout = BATCH_INTERMISSION_TIMEOUT,
      },
      callback,

      // beforeEachHook,
      // afterEachHook,
      beforeWarmupHook,
      afterWarmupHook,
      beforeBatchHook,
      afterBatchHook,
      beforeIterationHook,
      afterIterationHook,
    } = node;

    // Warmup phase
    if (warmupIterationCount > 0) {
      sendMessage({ type: 'measureWarmupStart' });

      await beforeWarmupHook?.();

      await beforeBatchHook?.();

      for (let i = 0; i < warmupIterationCount; ++i) {
        await beforeIterationHook?.();

        try {
          callback();
        } catch (error) {
          // Skip measure block after an error
          sendMessage({ type: 'error', errorMessage: getErrorMessage(error) });
          sendMessage({ type: 'measureWarmupEnd' });

          return null;
        }

        await afterIterationHook?.();
      }

      await afterBatchHook?.();

      await afterWarmupHook?.();

      sendMessage({ type: 'measureWarmupEnd' });

      await sleep(batchIntermissionTimeout);
    }

    let totalIterationCount = 0;
    let percentage = 0;

    const measureTimestamp = Date.now();

    const nextBatch = async (): Promise<void> => {
      const batchTimestamp = Date.now();

      let iterationCount = 0;

      while (true) {
        ++iterationCount;
        ++totalIterationCount;

        await beforeIterationHook?.();

        const prevMemoryUsed = getMemoryUsed();

        try {
          const timestamp = performance.now();

          callback();

          durationHistogram.add(performance.now() - timestamp);
        } catch (error) {
          sendMessage({ type: 'error', errorMessage: getErrorMessage(error) });
        }

        const memoryUsed = getMemoryUsed() - prevMemoryUsed;
        if (memoryUsed > 0) {
          memoryHistogram.add(memoryUsed);
        }

        await afterIterationHook?.();

        const measureDuration = Date.now() - measureTimestamp;
        const { rme } = durationHistogram;

        if (measureDuration > measureTimeout || (totalIterationCount > 2 && targetRme >= rme)) {
          sendMessage({ type: 'measureProgress', percentage: 1 });

          // Measurements completed
          await afterBatchHook?.();
          return;
        }

        percentage = Math.max(
          percentage,
          measureDuration / measureTimeout || 0,
          totalIterationCount > 2 ? targetRme / rme || 0 : 0
        );

        sendMessage({ type: 'measureProgress', percentage });

        if (Date.now() - batchTimestamp > batchTimeout || iterationCount >= batchIterationCount) {
          // Schedule the next measurement batch
          await afterBatchHook?.();

          // The pause between batches is required for garbage collection
          await sleep(batchIntermissionTimeout);

          await beforeBatchHook?.();

          return nextBatch();
        }
      }
    };

    sendMessage({ type: 'measureStart' });

    await beforeBatchHook?.();

    sendMessage({ type: 'measureProgress', percentage: 0 });

    await nextBatch();

    sendMessage({
      type: 'measureEnd',
      durationStats: durationHistogram.getStats(),
      memoryStats: memoryHistogram.getStats(),
    });

    return { durationHistogram, memoryHistogram };
  };
}

let currentNode: Node = new TestSuiteNode({});

export function getCurrentNode(): Node {
  return currentNode;
}

export function setCurrentNode(node: Node): void {
  currentNode = node;
}
