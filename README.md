# TooFast [![build](https://github.com/smikhalevski/toofast/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/toofast/actions/workflows/master.yml)

The Node.js performance testing tool with unit-test-like API.

```shell
npm install --save-dev toofast
```

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
npx toofast ./sum.perf.js
```

# Lifecycle

Each test is run in a separate process.

Before performance is measured a warmup run of the tested function is performed.

`performance` is used to measure function execution time. Measurements are taken on every function call.

To measure performance, a function is run multiple times in batches. After each batch a process is idle for some time to allow garbage collection to kick in.

In test files, each of these methods is available in the global environment. You don't have to require or import anything to use them.


#### `test`

All you need in a test file is the `test` method which runs a test. For example, let's say there's a function `myFunction()` which performance must be measured. Your whole test could be:

```ts
test('without args', (measure) => {
  measure(() => {
    myFunction();
  });
});
```

Measurements in `test` can be tweaked using an options argument:

```ts
test('without args', (measure) => {
  // ...
}, {
  warmupIterationCount: 20
});
```

[There are multiple options that can be configured.](#options)

`measure` callback starts actual performance measurement. It can be invoked mutiple times in a test block.

```ts
test('average across varargs', (measure) => {

  measure(() => {
    myFunction(1, 2);
  });

  measure(() => {
    myFunction('a', 'b');
  });

});
```

`measure` accepts options:

```ts
test('without args', (measure) => {
  
  measure(() => {
    myFunction(1, 2);
  }, {
    warmupIterationCount: 20
  });
});
```

#### `describe`

Creates a block that groups together several related tests.

```ts
describe('my function', () => {

  test('without arguments', (measure) => {
    measure(() => {
      myFunction(1, 2);
    });
  });

  test('with two arguments', (measure) => {
    measure(() => {
      myFunction();
    });
  });
});
```

[There are multiple options that can be configured.](#options)

#### `beforeEach`

Runs a function before each of the tests in the file runs. If the function returns a promise, then it is awaited before running the test.

```ts
beforeEach(() => {
  // ...
})
```

#### `afterEach`

Runs a function after each one of the tests in this file completes. If the function returns a promise, then it is awaited before before continuing.

```ts
afterEach(() => {
  // ...
})
```

#### `afterWarmup`

Runs a function after warmup is completed. If the function returns a promise, then it is awaited before before continuing.

```ts
afterWarmup(() => {
  // ...
})
```

#### `beforeBatch`

Runs before a batch of iterations is started. If the function returns a promise, then it is awaited before before continuing.

```ts
beforeBatch(() => {
  // ...
})
```

#### `afterBatch`

Runs after a batch of iterations is completed. If the function returns a promise, then it is awaited before before continuing.

```ts
afterBatch(() => {
  // ...
})
```

#### `beforeIteration`

Runs before each call of a function which performance is measured.

```ts
beforeIteration(() => {
  // ...
})
```

#### `afterIteration`

Runs after each call of a function which performance is measured.

```ts
afterIteration(() => {
  // ...
})
```

# Options

#### `measureTimeout = 10_000`

Maximum measure duration. Doesn't include the duration of warmup iterations.

#### `targetRme = 0.002`

The maximum relative margin of error that must be reached for each measurement [0, 1].

#### `warmupIterationCount = 1`

The maximum number of warmup iterations that are run before each measurement.

#### `batchIterationCount = Infinity`

The maximum number of iterations in a batch.

#### `batchTimeout = 1_000`

The maximum duration of batched measurements.

#### `batchIntermissionTimeout = 200`

The delay between batched measurements. VM is expected to run garbage collector during this delay.
