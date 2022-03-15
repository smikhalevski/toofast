/**
 * Population statistics passed between master and fork processes.
 */
export interface Stats {

  /**
   * The total number of measurements in the population.
   */
  size: number;

  /**
   * The mean value.
   */
  mean: number;

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance on Wikipedia}
   */
  variance: number;

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  sd: number;

  /**
   * The standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  sem: number;

  /**
   * The margin of error.
   */
  moe: number;

  /**
   * The relative margin of error [0, 1].
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error on Wikipedia}
   */
  rme: number;

  /**
   * The number of executions per second.
   */
  hz: number;
}

export interface MasterMessageHandler {

  onTestStartMessage(message: TestStartMessage): void;

  onTestEndMessage(message: TestEndMessage): void;

  onTestErrorMessage(message: TestErrorMessage): void;

  onMeasureWarmupStartMessage(message: MeasureWarmupStartMessage): void;

  onMeasureWarmupEndMessage(message: MeasureWarmupEndMessage): void;

  onMeasureStartMessage(message: MeasureStartMessage): void;

  onMeasureEndMessage(message: MeasureEndMessage): void;

  onMeasureErrorMessage(message: MeasureErrorMessage): void;

  onMeasureProgressMessage(message: MeasureProgressMessage): void;
}

export interface WorkerMessageHandler {
  onTestLifecycleInitMessage(message: TestLifecycleInitMessage): void;
}

export type MasterMessage =
    | TestStartMessage
    | TestEndMessage
    | TestErrorMessage
    | MeasureWarmupStartMessage
    | MeasureWarmupEndMessage
    | MeasureStartMessage
    | MeasureEndMessage
    | MeasureErrorMessage
    | MeasureProgressMessage;

export type WorkerMessage =
    | TestLifecycleInitMessage

export const enum MessageType {
  TEST_LIFECYCLE_INIT,
  TEST_START,
  TEST_END,
  TEST_ERROR,
  MEASURE_WARMUP_START,
  MEASURE_WARMUP_END,
  MEASURE_START,
  MEASURE_END,
  MEASURE_ERROR,
  MEASURE_PROGRESS,
}

export interface TestLifecycleInitMessage {
  type: MessageType.TEST_LIFECYCLE_INIT;
  filePath: string;
  testPath: number[];
}

export interface TestStartMessage {
  type: MessageType.TEST_START;
}

export interface TestEndMessage {
  type: MessageType.TEST_END;
  stats: Stats;
}

export interface TestErrorMessage {
  type: MessageType.TEST_ERROR;
  message: string;
}

export interface MeasureWarmupStartMessage {
  type: MessageType.MEASURE_WARMUP_START;
}

export interface MeasureWarmupEndMessage {
  type: MessageType.MEASURE_WARMUP_END;
}

export interface MeasureStartMessage {
  type: MessageType.MEASURE_START;
}

export interface MeasureEndMessage {
  type: MessageType.MEASURE_END;
  stats: Stats;
}

export interface MeasureErrorMessage {
  type: MessageType.MEASURE_ERROR;
  message: string;
}

export interface MeasureProgressMessage {
  type: MessageType.MEASURE_PROGRESS;
  percent: number;
}
