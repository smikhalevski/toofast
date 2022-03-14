describe('foo', () => {

  test('bar baz', (cycle) => {
    cycle(() => {
    throw new Error('shit')
    });
  });

  test('qux', (measure) => {
    measure(() => 'a' + 'b');
  });
});
