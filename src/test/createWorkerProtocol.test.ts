import {createWorkerProtocol, WorkerHandlers} from '../main';

describe('createWorkerProtocol', () => {

  const runMeasureMock = jest.fn(() => Promise.resolve());
  const onErrorMock = jest.fn();
  const onProgressMock = jest.fn();
  const onTestCompleteMock = jest.fn();

  const handlers: WorkerHandlers = {
    onError: onErrorMock,
    onProgress: onProgressMock,
    onTestComplete: onTestCompleteMock,
  };

  beforeEach(() => {
    runMeasureMock.mockClear();
    onErrorMock.mockClear();
    onProgressMock.mockClear();
    onTestCompleteMock.mockClear();
  });

  test('runs the protocol', async () => {

    const testedCb = () => undefined;

    const protocol = createWorkerProtocol(handlers, {testPath: [1, 1, 1], runMeasure: runMeasureMock});

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

    expect(runMeasureMock).toHaveBeenCalledTimes(1);
  });
});
