const dependencyValue = require('./perf-dependency');

function factorial(x) {
  if (x < 0) {
    return -1;
  } else if (x === 0) {
    return 1;
  } else {
    return x * factorial(x - 1);
  }
}

describe('describe 0', () => {

  test('test 0.0', (measure) => {
    measure(() => factorial(30));
  });

  test('test 0.1 (' + dependencyValue + ')', (measure) => {
    measure(() => 'a' + 'b');
  });

  describe('describe 0.1', () => {

    test('test 0.1.0 (throws error)', (measure) => {
      measure(() => {
        throw new Error('Expected error');
      });
    });

    test('test 0.1.1', (measure) => {
      measure(() => 'a' + 'b');
    });
  });

  describe('describe 0.2', () => {

    test('test 0.2.0 (stack overflow)', () => {
      const stackOverflow = () => stackOverflow();
      stackOverflow();
    });

    test('test 0.2.1 (multiple measurements)', (measure) => {

      measure(() => 'a' + 'b', {measureTimeout: 3_000, targetRme: 0});

      measure(() => 'a' + 'b', {measureTimeout: 3_000, targetRme: 0});

      measure(() => 'a' + 'b', {measureTimeout: 3_000, targetRme: 0});
    });
  });

});

describe('describe 1', () => {

  test('test 1.0', (measure) => {
    measure(() => factorial(30));
  });

  test('test 1.1', (measure) => {
    measure(() => 'a' + 'b');
  });
});
