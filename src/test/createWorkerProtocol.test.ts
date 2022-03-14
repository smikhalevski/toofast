import {createWorkerProtocol, WorkerHandlers} from '../main';

describe('createWorkerProtocol', () => {

  const measureMock = jest.fn(() => Promise.resolve());
  const onErrorMock = jest.fn();
  const onProgressMock = jest.fn();
  const onCompleteMock = jest.fn();

  const handlers: WorkerHandlers = {
    onError: onErrorMock,
    onProgress: onProgressMock,
    onComplete: onCompleteMock,
  };

  beforeEach(() => {
    measureMock.mockClear();
    onErrorMock.mockClear();
    onProgressMock.mockClear();
    onCompleteMock.mockClear();
  });

  test('runs the protocol', async () => {

    const testedCb = () => undefined;

    const protocol = createWorkerProtocol(handlers, {testPath: [1, 1, 1], runMeasure: measureMock});

    const t = protocol.testProtocol;

    t.describe('0', () => {

      t.test('0.0', (measure) => {
        measure(() => undefined);
      });
    });

    t.describe('1', () => {

      t.describe('1.0', () => {

        t.test('1.0.0', (measure) => {
          measure(() => undefined);
        });
      });

      t.describe('1.1', () => {

        t.test('1.1.0', (measure) => {
          measure(() => undefined);
        });

        t.test('1.1.1', (measure) => {
          measure(testedCb);
        });
      });
    });

    t.test('2', (measure) => {
      measure(() => undefined);
    });

    protocol.run();

    await protocol.getPromise();

    expect(measureMock).toHaveBeenCalledTimes(1);
  });
});
