import { beforeEach, expect, test, vi } from 'vitest';
import { createTestLifecycle, Histogram, runMeasureLifecycle, TestLifecycleHandlers } from '../main/index.js';

const runMeasureLifecycleMock = vi.fn(() =>
  Promise.resolve({
    durationHistogram: new Histogram(),
    memoryHistogram: new Histogram(),
  })
);

const onTestStartMock = vi.fn();
const onTestEndMock = vi.fn();

const handlers: TestLifecycleHandlers = {
  onTestStart: onTestStartMock,
  onTestEnd: onTestEndMock,
};

beforeEach(() => {
  runMeasureLifecycleMock.mockClear();

  onTestStartMock.mockClear();
  onTestEndMock.mockClear();
});

test('runs the lifecycle', async () => {
  const lifecycle = createTestLifecycle([1, 1, 1], runMeasureLifecycleMock, handlers);

  const r = lifecycle.runtime;

  r.describe('0', () => {
    r.test('0.0', measure => {
      measure(() => undefined);
    });
  });
  r.describe('1', () => {
    r.describe('1.0', () => {
      r.test('1.0.0', measure => {
        measure(() => undefined);
      });
    });
    r.describe('1.1', () => {
      r.test('1.1.0', measure => {
        measure(() => undefined);
      });
      r.test('1.1.1', measure => {
        measure(() => undefined);
      });
    });
  });
  r.test('2', measure => {
    measure(() => undefined);
  });

  await lifecycle.run();

  expect(runMeasureLifecycleMock).toHaveBeenCalledTimes(1);

  expect(onTestStartMock).toHaveBeenCalledTimes(1);
  expect(onTestEndMock).toHaveBeenCalledTimes(1);
});

test('executes hooks', async () => {
  const lifecycle = createTestLifecycle([0], runMeasureLifecycle, handlers);

  const r = lifecycle.runtime;

  const beforeEachHookMock = vi.fn();
  const afterEachHookMock = vi.fn();
  const afterWarmupHookMock = vi.fn();
  const beforeBatchHookMock = vi.fn();
  const afterBatchHookMock = vi.fn();
  const beforeIterationHookMock = vi.fn();
  const afterIterationHookMock = vi.fn();

  r.beforeEach(beforeEachHookMock);
  r.afterEach(afterEachHookMock);
  r.afterWarmup(afterWarmupHookMock);
  r.beforeBatch(beforeBatchHookMock);
  r.afterBatch(afterBatchHookMock);
  r.beforeIteration(beforeIterationHookMock);
  r.afterIteration(afterIterationHookMock);

  r.test('0', measure => {
    measure({ measureTimeout: -1, warmupIterationCount: 1 }, () => undefined);
  });

  await lifecycle.run();

  expect(beforeEachHookMock).toHaveBeenCalledTimes(1);
  expect(afterEachHookMock).toHaveBeenCalledTimes(1);
  expect(afterWarmupHookMock).toHaveBeenCalledTimes(1);
  expect(beforeBatchHookMock).toHaveBeenCalledTimes(2);
  expect(afterBatchHookMock).toHaveBeenCalledTimes(2);
  expect(beforeIterationHookMock).toHaveBeenCalledTimes(2);
  expect(afterIterationHookMock).toHaveBeenCalledTimes(2);
});

test('executes hooks defined in test', async () => {
  const lifecycle = createTestLifecycle([0], runMeasureLifecycle, handlers);

  const r = lifecycle.runtime;

  const afterWarmupHookMock = vi.fn();
  const beforeBatchHookMock = vi.fn();
  const afterBatchHookMock = vi.fn();
  const beforeIterationHookMock = vi.fn();
  const afterIterationHookMock = vi.fn();

  r.test('0', measure => {
    r.afterWarmup(afterWarmupHookMock);
    r.beforeBatch(beforeBatchHookMock);
    r.afterBatch(afterBatchHookMock);
    r.beforeIteration(beforeIterationHookMock);
    r.afterIteration(afterIterationHookMock);

    measure({ measureTimeout: -1, warmupIterationCount: 1 }, () => undefined);
  });

  await lifecycle.run();

  expect(afterWarmupHookMock).toHaveBeenCalledTimes(1);
  expect(beforeBatchHookMock).toHaveBeenCalledTimes(2);
  expect(afterBatchHookMock).toHaveBeenCalledTimes(2);
  expect(beforeIterationHookMock).toHaveBeenCalledTimes(2);
  expect(afterIterationHookMock).toHaveBeenCalledTimes(2);
});
