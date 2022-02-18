const {describe, test} = require('../../lib/node');

describe('foo', () => {

  test('bar baz', () => 1 + 1);
  test('qux', () => 1 + 1);
});
