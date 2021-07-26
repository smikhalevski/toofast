import {cycle} from '../main/cycle';
import {createHistogram} from '../main/createHistogram';

describe('cycle', () => {

  test('invokes a callback', () => {
    const callbackMock = jest.fn();

    cycle(callbackMock, createHistogram(), {timeout: 10});

    expect(callbackMock.mock.calls.length).toBeGreaterThan(1);
  });
});
