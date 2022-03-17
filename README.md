# TooFast [![build](https://github.com/smikhalevski/toofast/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/toofast/actions/workflows/master.yml)

The Node.js performance testing tool with unit-test-like API.

```shell
npm install --save-dev toofast
```

[API documentation is available here.](https://smikhalevski.github.io/toofast/)

## Usage

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

test('add 1 + 2', (measure) => {
  measure(() => {
    sum(1, 2);
  });
});
```

To run tests:

```shell
npx toofast ./sum.perf.js
```
