import {MeasureLifecycleHandlers, measureLifecycle} from '../main/measureLifecycle';

describe('measureLifecycle', () => {

  const onErrorMock = jest.fn();
  const onProgressMock = jest.fn();

  const handlers: MeasureLifecycleHandlers = {
    onMeasureError: onErrorMock,
    onMeasureProgress: onProgressMock,
  };

  beforeEach(() => {
    onErrorMock.mockClear();
    onProgressMock.mockClear();
  });

  test('returns a Promise', () => {
    expect(measureLifecycle(() => undefined, handlers, {measureTimeout: -1})).toBeInstanceOf(Promise);
  });

  test('invokes a callback', async () => {
    const cbMock = jest.fn();

    await measureLifecycle(cbMock, handlers, {warmupIterationCount: 0, measureTimeout: -1});

    expect(cbMock).toHaveBeenCalledTimes(1);
  });

  test('invokes afterWarmup callback', async () => {
    const afterWarmupMock = jest.fn();

    await measureLifecycle(() => undefined, handlers, {
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

    measureLifecycle(cbMock, handlers, {
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

    await measureLifecycle(() => undefined, handlers, {
      warmupIterationCount: 0,
      measureTimeout: -1,
      afterWarmup: afterWarmupMock
    });

    expect(afterWarmupMock).not.toHaveBeenCalled();
  });

  test('triggers onError', async () => {
    await measureLifecycle(() => {
      throw new Error();
    }, handlers, {measureTimeout: -1});

    expect(handlers.onMeasureError).toHaveBeenCalled();
  });

  test('triggers onProgress', async () => {
    await measureLifecycle(() => undefined, handlers, {measureTimeout: -1});

    expect(handlers.onMeasureProgress).toHaveBeenCalledTimes(2);
    expect(handlers.onMeasureProgress).toHaveBeenNthCalledWith(1, 0);
    expect(handlers.onMeasureProgress).toHaveBeenNthCalledWith(2, 1);
  });

  test('runs measurements in batches', async () => {
    const beforeBatchMock = jest.fn();
    const afterBatchMock = jest.fn();
    const beforeIterationMock = jest.fn();
    const afterIterationMock = jest.fn();

    const histogram = await measureLifecycle(() => undefined, handlers, {
      measureTimeout: 100,
      warmupIterationCount: 0,
      batchIntermissionTimeout: 0,
      batchTimeout: 10,
      beforeBatch: beforeBatchMock,
      afterBatch: afterBatchMock,
      beforeIteration: beforeIterationMock,
      afterIteration: afterIterationMock,
    });

    expect(histogram.size).toBeGreaterThan(500);
    expect(beforeBatchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(afterBatchMock.mock.calls.length).toBe(beforeBatchMock.mock.calls.length);
    expect(beforeIterationMock).toHaveBeenCalledTimes(histogram.size);
    expect(afterIterationMock).toHaveBeenCalledTimes(histogram.size);
  });
});
