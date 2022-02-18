const {describe, test, afterBatch} = require('../../lib/node');

describe('foo', () => {

  afterBatch(() => {
    console.log('----');
  });

  test('bar', () => 1 + 1);
  test('qux', () => 1 + 1);
});
