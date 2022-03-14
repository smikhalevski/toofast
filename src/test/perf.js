describe('foo', () => {

  test('bar baz', (cycle) => {
    cycle(() => 1 + 1);
  });

  test('qux', (measure) => {
    measure(() => 'a' + 'b');
  });
});
