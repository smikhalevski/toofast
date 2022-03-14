import {measure} from '../main/measure';
import {createHistogram} from '../main/createHistogram';

describe('cycle', () => {

  test('invokes a callback', () => {
    const callbackMock = jest.fn();

    measure(callbackMock, createHistogram(), {cycleTimeout: 10});

    expect(callbackMock.mock.calls.length).toBeGreaterThan(1);
  });
});
