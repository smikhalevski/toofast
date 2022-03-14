describe('foo', () => {

  test('bar baz', (measure) => {
    measure(() => 1 + 1);
  });

  test('qux', (measure) => {
    measure(() => 'a' + 'b');
  });
});
