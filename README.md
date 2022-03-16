# TooFast [![build](https://github.com/smikhalevski/toofast/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/toofast/actions/workflows/master.yml)

The Node.js performance testing tool with unit-test-like API.

```shell
npm install --save-dev toofast
```

[API documentation is available here.](https://smikhalevski.github.io/toofast/)

## Usage

```ts
// ./myPerfTest.js
import {myFunction} from './myModule';

describe('myFunction', () => {

  test('with one string arg', (measure) => {
    measure(() => {
      myFunction('abc');
    });
  });

  test('with string and number args', (measure) => {
    measure(() => {
      myFunction('abc', 123);
    });
  });
})
```

To run tests:

```shell
toofast ./myPerfTest.js
```
