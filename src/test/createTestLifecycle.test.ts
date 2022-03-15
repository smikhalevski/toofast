import {createTestLifecycle, Histogram, TestLifecycleHandlers} from '../main';

describe('createTestLifecycle', () => {

  const measureLifecycleMock = jest.fn(() => Promise.resolve(new Histogram()));

  const onTestStartMock = jest.fn();
  const onTestEndMock = jest.fn();

  const handlers: TestLifecycleHandlers = {
    onTestStart: onTestStartMock,
    onTestEnd: onTestEndMock,
    onMeasureWarmupStart: () => undefined,
    onMeasureWarmupEnd: () => undefined,
    onMeasureStart: () => undefined,
    onMeasureEnd: () => undefined,
    onMeasureError: () => undefined,
    onMeasureProgress: () => undefined,
  };

  beforeEach(() => {
    measureLifecycleMock.mockClear();

    onTestStartMock.mockClear();
    onTestEndMock.mockClear();
  });

  test('runs the lifecycle', async () => {

    const testedCb = () => undefined;

    const lifecycle = createTestLifecycle([1, 1, 1], measureLifecycleMock, handlers);

    const r = lifecycle.runtime;

    r.describe('0', () => {

      r.test('0.0', (measure) => {
        measure(() => undefined);
      });
    });

    r.describe('1', () => {

      r.describe('1.0', () => {

        r.test('1.0.0', (measure) => {
          measure(() => undefined);
        });
      });

      r.describe('1.1', () => {

        r.test('1.1.0', (measure) => {
          measure(() => undefined);
        });

        r.test('1.1.1', (measure) => {
          measure(testedCb);
        });
      });
    });

    r.test('2', (measure) => {
      measure(() => undefined);
    });

    await lifecycle.run();

    expect(measureLifecycleMock).toHaveBeenCalledTimes(1);

    expect(onTestStartMock).toHaveBeenCalledTimes(1);
    expect(onTestEndMock).toHaveBeenCalledTimes(1);
  });
});
