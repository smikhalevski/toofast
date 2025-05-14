import { describe, test, measure } from '../../lib/index.js';

function factorial(x) {
  return x === 0 ? 1 : x * factorial(x - 1);
}

describe('factorial', () => {
  test('of 33', () => {
    measure(() => {
      factorial(33);
    });
  });

  test('of 42', () => {
    measure(() => {
      factorial(42);
    });
  });
});

describe('describe 0', () => {
  test('test 0.0', () => {
    measure(() => {
      factorial(42);
    });
  });

  test('test 0.1', () => {
    let str = [];
    measure(() => {
      if (str.length > 10000) {
        str = [];
      }
      str.push({});
    });
  });

  describe('describe 0.1', () => {
    test('test 0.1.0 (error)', () => {
      measure(() => {
        throw new Error('Expected error');
      });
    });

    test('test 0.1.1', () => {
      measure(() => {
        // noop
      });
    });
  });

  describe('describe 0.2', () => {
    test('test 0.2.0 (stack overflow)', () => {
      const stackOverflow = () => stackOverflow();
      stackOverflow();
    });

    test('test 0.2.1 (multiple measurements)', () => {
      measure(() => 'a' + 'b', { measureTimeout: 5_000, targetRme: 0 });

      measure(() => 'a' + 'b', { measureTimeout: 5_000, targetRme: 0 });

      measure(() => 'a' + 'b', { measureTimeout: 5_000, targetRme: 0 });
    });
  });

  test('test 0.1.2 (long warmup)', () => {
    measure(() => 'a' + 'b', { warmupIterationCount: 100_000_000 });
  });
});

describe('describe 1', () => {
  test('test 1.0', () => {
    measure(() => {
      factorial(30);
    });
  });

  test('test 1.1', () => {
    measure(() => {
      // noop
    });
  });
});
