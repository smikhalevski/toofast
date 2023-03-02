# TooFast ⚡️ [![build](https://github.com/smikhalevski/toofast/actions/workflows/test.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/toofast/actions/workflows/test.yml)

The Node.js performance testing tool with unit-test-like API.

```shell
npm install --save-dev toofast
```

- Each test is run in a separate process.

- [`performance`](https://developer.mozilla.org/en-US/docs/Web/API/Performance) is used to measure function execution
  time. Measurements are taken on every function call.

- To measure performance, a function is run multiple times in batches. After each batch a process is idle for some time
  to allow garbage collection to kick in.

- Before performance is measured a warmup run of the tested function is done. Warmup is always completed in a single
  batch.

- [`process.memoryUsage().heapUsed`](https://nodejs.org/api/process.html#processmemoryusagerss) is used to measure
  memory allocated during test execution. Memory measurement results are displayed if more than 1 kB was allocated.

[API documentation is available here.](https://smikhalevski.github.io/toofast/)

# Usage

Let's get started by writing a test for a hypothetical function that adds two numbers. First, create a `sum.js` file:

```ts
function sum(a, b) {
  return a + b;
}

module.exports = sum;
```

Then, create a file named `sum.perf.js`. This will contain our actual performance test:

```ts
const sum = require('./sum');

test('add numbers', (measure) => {
  measure(() => {
    sum(1, 2);
  });
});
```

To run tests:

```shell
toofast
```

# CLI options

##### `...files`

The list of file paths that contain tests. Defaults to `**/*.perf.js`.

##### `-t <regex>`, `--testNamePattern <regex>`

Run only tests with a name that matches the regex. This option can be specified multiple times.

The regex is matched against the full name, which is a combination of the test label and all its enclosing describe
blocks.

# Test API

In test files, each of these callbacks is available in the global environment. You don't have to require or import
anything to use them.

### `test`

All you need in a test file is the `test` callback which runs a test. For example, let's say there's a
function `myFunction()` which performance must be measured. Your whole test could be:

```ts
test('without arguments', (measure) => {
  measure(() => {
    myFunction();
  });
});
```

`measure` callback starts performance measurement and can be invoked multiple times inside a `test` block.

```ts
test('with various arguments', (measure) => {
  measure(() => {
    myFunction(123);
  });
  measure(() => {
    myFunction('abc');
  });
});
```

`measure` returns a promise that is resolved as soon as performance measurement is completed. Results collected during
all `measure` calls are used as a data population to derive function performance statistics.

You can customise the measurement process by providing options to `measure`:

```ts
measure(() => {
  myFunction();
}, {warmupIterationCount: 20});
```

Following options are available:

- `measureTimeout` = 10 000<br>
  The maximum measure duration. Doesn't include the duration of warmup iterations.

- `targetRme` = 0.002<br>
  The maximum relative margin of error that must be reached for each measurement [0, 1].

- `warmupIterationCount` = 1<br>
  The maximum number of warmup iterations that are run before each measurement.

- `batchIterationCount` = Infinity<br>
  The maximum number of iterations in a batch.

- `batchTimeout` = 1 000<br>
  The maximum duration of batched measurements.

- `batchIntermissionTimeout` = 200<br>
  The delay between batched measurements. VM is expected to run garbage collector during this delay.

### `describe`

Creates a block that groups together several related tests.

```ts
describe('my function', () => {

  test('without arguments', (measure) => {
    measure(() => {
      myFunction();
    });
  });

  test('with two arguments', (measure) => {
    measure(() => {
      myFunction(123, 'abc');
    });
  });
});
```

### `beforeEach`, `afterEach`, `afterWarmup`, `beforeBatch`, `afterBatch`, `beforeIteration`, and `afterIteration`

Hooks register callbacks that are invoked at different phases of the performance test lifecycle.

```ts
describe('my function', () => {

  beforeEach(() => {
    // Runs before each test
  });

  test('without arguments', (measure) => {

    beforeIteration(() => {
      // Runs before each measurement iteration
    });

    measure(() => {
      myFunction();
    });
  });

});
```
