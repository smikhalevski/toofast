import { MeasureLifecycleHandlers, runMeasureLifecycle } from '../main';

describe('runMeasureLifecycle', () => {
  const onMeasureWarmupStartMock = jest.fn();
  const onMeasureWarmupEndMock = jest.fn();
  const onMeasureStartMock = jest.fn();
  const onMeasureEndMock = jest.fn();
  const onMeasureErrorMock = jest.fn();
  const onMeasureProgressMock = jest.fn();

  const handlers: MeasureLifecycleHandlers = {
    onMeasureWarmupStart: onMeasureWarmupStartMock,
    onMeasureWarmupEnd: onMeasureWarmupEndMock,
    onMeasureStart: onMeasureStartMock,
    onMeasureEnd: onMeasureEndMock,
    onMeasureError: onMeasureErrorMock,
    onMeasureProgress: onMeasureProgressMock,
  };

  beforeEach(() => {
    onMeasureWarmupStartMock.mockClear();
    onMeasureWarmupEndMock.mockClear();
    onMeasureStartMock.mockClear();
    onMeasureEndMock.mockClear();
    onMeasureErrorMock.mockClear();
    onMeasureProgressMock.mockClear();
  });

  test('returns a Promise', () => {
    expect(runMeasureLifecycle(() => undefined, handlers, { measureTimeout: -1 })).toBeInstanceOf(Promise);
  });

  test('invokes a callback', async () => {
    const cbMock = jest.fn();

    await runMeasureLifecycle(cbMock, handlers, { warmupIterationCount: 0, measureTimeout: -1 });

    expect(cbMock).toHaveBeenCalledTimes(1);
  });

  test('invokes afterWarmup callback', async () => {
    const afterWarmupMock = jest.fn();

    await runMeasureLifecycle(() => undefined, handlers, {
      warmupIterationCount: 1,
      measureTimeout: -1,
      afterWarmup: afterWarmupMock,
    });

    expect(afterWarmupMock).toHaveBeenCalledTimes(1);
  });

  test('respects warmupIterationCount', done => {
    const cbMock = jest.fn();
    const beforeIterationMock = jest.fn();
    const afterIterationMock = jest.fn();

    runMeasureLifecycle(cbMock, handlers, {
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

    await runMeasureLifecycle(() => undefined, handlers, {
      warmupIterationCount: 0,
      measureTimeout: -1,
      afterWarmup: afterWarmupMock,
    });

    expect(afterWarmupMock).not.toHaveBeenCalled();
  });

  test('triggers onError', async () => {
    await runMeasureLifecycle(
      () => {
        throw new Error();
      },
      handlers,
      { measureTimeout: -1 }
    );

    expect(handlers.onMeasureError).toHaveBeenCalled();
  });

  test('triggers onProgress', async () => {
    await runMeasureLifecycle(() => undefined, handlers, { measureTimeout: -1 });

    expect(handlers.onMeasureProgress).toHaveBeenCalledTimes(2);
    expect(handlers.onMeasureProgress).toHaveBeenNthCalledWith(1, 0);
    expect(handlers.onMeasureProgress).toHaveBeenNthCalledWith(2, 1);
  });

  test('runs measurements in batches', async () => {
    const beforeBatchMock = jest.fn();
    const afterBatchMock = jest.fn();
    const beforeIterationMock = jest.fn();
    const afterIterationMock = jest.fn();

    const { durationHistogram } = await runMeasureLifecycle(() => undefined, handlers, {
      measureTimeout: 100,
      warmupIterationCount: 0,
      batchIntermissionTimeout: 0,
      batchTimeout: 10,
      beforeBatch: beforeBatchMock,
      afterBatch: afterBatchMock,
      beforeIteration: beforeIterationMock,
      afterIteration: afterIterationMock,
    });

    expect(durationHistogram.size).toBeGreaterThan(500);
    expect(beforeBatchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(afterBatchMock.mock.calls.length).toBe(beforeBatchMock.mock.calls.length);
    expect(beforeIterationMock).toHaveBeenCalledTimes(durationHistogram.size);
    expect(afterIterationMock).toHaveBeenCalledTimes(durationHistogram.size);

    expect(onMeasureWarmupStartMock).not.toHaveBeenCalled();
    expect(onMeasureWarmupEndMock).not.toHaveBeenCalled();
    expect(onMeasureStartMock).toHaveBeenCalledTimes(1);
    expect(onMeasureEndMock).toHaveBeenCalledTimes(1);
    expect(onMeasureErrorMock).not.toHaveBeenCalled();
    expect(onMeasureProgressMock).toHaveBeenCalledTimes(durationHistogram.size + 1);

    expect(onMeasureProgressMock).toHaveBeenNthCalledWith(1, 0);
    expect(onMeasureProgressMock).toHaveBeenLastCalledWith(1);
  });

  test('captures errors in measured callback', async () => {
    const { durationHistogram } = await runMeasureLifecycle(
      () => {
        throw new Error();
      },
      handlers,
      {
        measureTimeout: 10,
        warmupIterationCount: 0,
      }
    );

    expect(durationHistogram.size).toBeGreaterThan(50);
    expect(onMeasureErrorMock).toHaveBeenCalledTimes(durationHistogram.size);
  });
});
