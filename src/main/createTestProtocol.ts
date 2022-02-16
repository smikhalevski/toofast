import {cycle, ICycleOptions} from './cycle';
import {Histogram} from './Histogram';

export interface ITestProtocolOptions {
  beforeEach(cb: () => void): void;
  afterEach(cb: () => void): void;

  afterWarmup(cb: () => void): void;

  beforeBatch(cb: () => void): void;
  afterBatch(cb: () => void): void;

  beforeIteration(cb: () => void): void;
  afterIteration(cb: () => void): void;

  describeStarted(label: string, cb: () => void, options?: ICycleOptions): void;
  describeEnded(): void;
  describeCalled(): void;
  describeResolved(): void;
  describeRejected(): void;

  testStarted(label: string, cb: () => void, options?: ICycleOptions): void;
  testEnded(): void;
  testCalled(): void;
  testResolved(histogram: Histogram): void;
  testRejected(): void;
}

export function createTestProtocol(options: ITestProtocolOptions) {
  const {
    beforeEach,
    afterEach,

    afterWarmup,

    beforeBatch,
    afterBatch,

    beforeIteration,
    afterIteration,

    describeStarted,
    describeEnded,
    describeCalled,
    describeResolved,
    describeRejected,

    testStarted,
    testEnded,
    testCalled,
    testResolved,
    testRejected,
  } = options;

  let run!: () => void;

  let promise = new Promise<void>((resolve) => {
    run = resolve;
  });

  const describe = (label: string, cb: () => void, options?: ICycleOptions): void => {
    describeStarted(label, cb, options);
    promise = promise.then(describeCalled).then(cb).then(describeResolved, describeRejected);
    describeEnded();
  };

  const test = (label: string, cb: () => void, options?: ICycleOptions): void => {
    testStarted(label, cb, options);
    promise = promise.then(testCalled).then(() => {
      const histogram = new Histogram();
      return cycle(cb, histogram, options).then(() => testResolved(histogram), testRejected);
    });
    testEnded();
  };

  return {
    run,

    beforeEach,
    afterEach,
    afterWarmup,
    beforeBatch,
    afterBatch,
    beforeIteration,
    afterIteration,

    describe,
    test,
  };
}
