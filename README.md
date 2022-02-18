# perf-test

The Node.js performance testing tool.

```shell
npm install --save-dev @smikhalevski/perf-test
```

⚠️ [API documentation is available here.](https://smikhalevski.github.io/perf-test/)

## Usage

Measure performance of a callback:

```js
const {test} = require('@smikhalevski/perf-test');

function callback() {
  // The code you want to test goes here
}

test('My test', callback, {testTimeout: 3000});
// stdout: "My test 7,331,041.16 ops/sec ± 0.19%"
```

Measure performance of a callback across a population of values:

```js
const {valueTest} = require('@smikhalevski/perf-test');

function callback(value) {
  // value is 1, 2 or 3 
  // The code you want to test goes here
}

valueTest([1, 2, 3], 'My test', callback, {testTimeout: 3000});
// stdout: "My test 7,331,041.16 ops/sec ± 0.19%"
```

Get programmatic access to the test result statistics:

```js
const {createHistogram, cycle} = require('@smikhalevski/perf-test');

function callback() {
  // The code you want to test goes here
}

const histogram = createHistogram();

cycle(callback, histogram, {testTimeout: 3000});

histogram.getHz(); // → 7331041.16
```
