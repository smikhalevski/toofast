import { TestOptions } from '../types.js';
import { DescribeNode, TestNode, TestSuiteNode } from '../createTestSuiteLifecycle.js';
import { HistogramStats } from '../Histogram.js';

export interface MasterLifecycleHandlers {
  onDescribeStart(node: DescribeNode): void;

  onDescribeEnd(node: DescribeNode): void;

  onTestStart(node: TestNode): void;

  onTestEnd(node: TestNode, durationStats: HistogramStats, memoryStats: HistogramStats): void;

  onTestFatalError(node: TestNode, error: any): void;

  onTestSuiteError(node: TestSuiteNode, error: any): void;

  onMeasureWarmupStart(node: TestNode): void;

  onMeasureWarmupEnd(node: TestNode): void;

  onMeasureStart(node: TestNode): void;

  onMeasureEnd(node: TestNode, stats: HistogramStats): void;

  onMeasureError(node: TestNode, error: any): void;

  onMeasureProgress(node: TestNode, percent: number): void;
}

/**
 * Handles messages sent from the worker to the master.
 */
export interface WorkerMessageHandlers {
  onReady(message: ReadyMessage): void;

  onTestStartMessage(message: TestStartMessage): void;

  onTestEndMessage(message: TestEndMessage): void;

  onTestFatalErrorMessage(message: TestFatalErrorMessage): void;

  onMeasureWarmupStartMessage(message: MeasureWarmupStartMessage): void;

  onMeasureWarmupEndMessage(message: MeasureWarmupEndMessage): void;

  onMeasureStartMessage(message: MeasureStartMessage): void;

  onMeasureEndMessage(message: MeasureEndMessage): void;

  onMeasureErrorMessage(message: MeasureErrorMessage): void;

  onMeasureProgressMessage(message: MeasureProgressMessage): void;
}

/**
 * Handles messages sent from the master to the worker.
 */
export interface MasterMessageHandlers {
  onTestLifecycleInitMessage(message: TestLifecycleInitMessage): void;
}

export type WorkerMessage =
  | ReadyMessage
  | TestStartMessage
  | TestEndMessage
  | TestFatalErrorMessage
  | MeasureWarmupStartMessage
  | MeasureWarmupEndMessage
  | MeasureStartMessage
  | MeasureEndMessage
  | MeasureErrorMessage
  | MeasureProgressMessage;

export type MasterMessage = TestLifecycleInitMessage;

export interface TestLifecycleInitMessage {
  type: 'testLifecycleInit';
  file: string;
  testLocation: number[];
  setupFiles: string[];
  testOptions: TestOptions | undefined;
}

export interface ReadyMessage {
  type: 'ready';
}

export interface TestStartMessage {
  type: 'testStart';
}

export interface TestEndMessage {
  type: 'testEnd';
  durationStats: HistogramStats;
  memoryStats: HistogramStats;
}

export interface TestFatalErrorMessage {
  type: 'testFatalError';
  message: string;
}

export interface MeasureWarmupStartMessage {
  type: 'measureWarmupStart';
}

export interface MeasureWarmupEndMessage {
  type: 'measureWarmupEnd';
}

export interface MeasureStartMessage {
  type: 'measureStart';
}

export interface MeasureEndMessage {
  type: 'measureEnd';
  stats: HistogramStats;
}

export interface MeasureErrorMessage {
  type: 'measureError';
  errorMessage: string;
}

export interface MeasureProgressMessage {
  type: 'measureProgress';
  percent: number;
}
