import {Message, MessageHandler, MessageType, Stats} from './bin-types';
import {Histogram} from '../Histogram';

/**
 * Passes message to the appropriate handler.
 *
 * @param message The message to process.
 * @param handler The message handler.
 */
export function handleMessage(message: Message, handler: MessageHandler): void {

  const {
    onTestLifecycleInitMessage,
    onTestStartMessage,
    onTestEndMessage,
    onTestErrorMessage,
    onMeasureWarmupStartMessage,
    onMeasureWarmupEndMessage,
    onMeasureStartMessage,
    onMeasureEndMessage,
    onMeasureErrorMessage,
    onMeasureProgressMessage,
  } = handler;

  switch (message.type) {

    case MessageType.TEST_LIFECYCLE_INIT:
      return onTestLifecycleInitMessage?.(message);

    case MessageType.TEST_START:
      return onTestStartMessage?.(message);

    case MessageType.TEST_END:
      return onTestEndMessage?.(message);

    case MessageType.TEST_ERROR:
      return onTestErrorMessage?.(message);

    case MessageType.MEASURE_WARMUP_START:
      return onMeasureWarmupStartMessage?.(message);

    case MessageType.MEASURE_WARMUP_END:
      return onMeasureWarmupEndMessage?.(message);

    case MessageType.MEASURE_START:
      return onMeasureStartMessage?.(message);

    case MessageType.MEASURE_END:
      return onMeasureEndMessage?.(message);

    case MessageType.MEASURE_ERROR:
      return onMeasureErrorMessage?.(message);

    case MessageType.MEASURE_PROGRESS:
      return onMeasureProgressMessage?.(message);
  }
}

export function createStats(histogram: Histogram): Stats {
  return {
    size: histogram.size,
    mean: histogram.getMean(),
    variance: histogram.getVariance(),
    sd: histogram.getSd(),
    sem: histogram.getSem(),
    moe: histogram.getMoe(),
    rme: histogram.getRme(),
    hz: histogram.getHz(),
  };
}

export function extractMessage(error: any): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}
