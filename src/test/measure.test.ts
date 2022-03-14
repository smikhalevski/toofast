import {Histogram, measure, MeasureHandlers} from '../main';

describe('measure', () => {

  let handlers: MeasureHandlers;

  beforeEach(() => {
    handlers = {
      onProgress: jest.fn(),
      onError: jest.fn(),
    };
  });

  test('returns a Promise', () => {
    expect(measure(() => undefined, new Histogram(), handlers, {})).toBeInstanceOf(Promise);
  });

  test('invokes a callback', async () => {
    const cbMock = jest.fn();

    await measure(cbMock, new Histogram(), handlers, {warmupIterationCount: 0, measureTimeout: -1});

    expect(cbMock).toHaveBeenCalledTimes(1);
  });

  test('invokes afterWarmup callback', async () => {
    const afterWarmupMock = jest.fn();

    await measure(() => undefined, new Histogram(), handlers, {
      warmupIterationCount: 1,
      measureTimeout: -1,
      afterWarmup: afterWarmupMock,
    });

    expect(afterWarmupMock).toHaveBeenCalledTimes(1);
  });

  test('respects warmupIterationCount', (done) => {
    const cbMock = jest.fn();
    const beforeIterationMock = jest.fn();
    const afterIterationMock = jest.fn();

    measure(cbMock, new Histogram(), handlers, {
      warmupIterationCount: 10,
      measureTimeout: -1,

      afterWarmup() {
        expect(cbMock).toHaveBeenCalledTimes(10);
        expect(beforeIterationMock).toHaveBeenCalledTimes(10);
        expect(afterIterationMock).toHaveBeenCalledTimes(10);
        done();
      },
      beforeIteration: beforeIterationMock,
      afterIteration: afterIterationMock,
    });
  });

  test('does not invoke afterWarmup callback', async () => {
    const afterWarmupMock = jest.fn();

    await measure(() => undefined, new Histogram(), handlers, {
      warmupIterationCount: 0,
      measureTimeout: -1,
      afterWarmup: afterWarmupMock
    });

    expect(afterWarmupMock).not.toHaveBeenCalled();
  });

  test('triggers onError', async () => {
    await measure(() => {
      throw new Error();
    }, new Histogram(), handlers, {measureTimeout: -1});

    expect(handlers.onError).toHaveBeenCalled();
  });

  test('triggers onProgress', async () => {
    await measure(() => undefined, new Histogram(), handlers, {measureTimeout: -1});

    expect(handlers.onProgress).toHaveBeenCalledTimes(2);
    expect(handlers.onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(handlers.onProgress).toHaveBeenNthCalledWith(2, 1);
  });

  test('runs measurements in batches', async () => {
    const beforeBatchMock = jest.fn();
    const afterBatchMock = jest.fn();
    const beforeIterationMock = jest.fn();
    const afterIterationMock = jest.fn();

    const histogram = new Histogram();

    await measure(() => undefined, histogram, handlers, {
      warmupIterationCount: 0,
      measureTimeout: 50,
      batchTimeout: 10,
      beforeBatch: beforeBatchMock,
      afterBatch: afterBatchMock,
      beforeIteration: beforeIterationMock,
      afterIteration: afterIterationMock,
    });

    expect(histogram.size).toBeGreaterThan(500);
    expect(beforeBatchMock.mock.calls.length).toBeGreaterThan(2);
    expect(afterBatchMock.mock.calls.length).toBeGreaterThan(beforeBatchMock.mock.calls.length);
    expect(beforeIterationMock).toHaveBeenCalledTimes(histogram.size);
    expect(afterIterationMock).toHaveBeenCalledTimes(histogram.size);
  });
});
