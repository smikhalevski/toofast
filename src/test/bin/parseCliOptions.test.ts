import { parseCliOptions } from '../../main/bin/parseCliOptions';

describe('parseCliOptions', () => {
  test('parses empty args', () => {
    expect(parseCliOptions([], {})).toEqual({});
  });

  test('parses an arg', () => {
    expect(parseCliOptions(['--foo'])).toEqual({ foo: [] });
  });

  test('parses an arg shorthand', () => {
    expect(parseCliOptions(['-f'], { f: 'foo' })).toEqual({ foo: [] });
  });

  test('does not parse an arg shorthand without an alias', () => {
    expect(parseCliOptions(['-f'])).toEqual({});
  });

  test('parses a multiple arg shorthands', () => {
    expect(parseCliOptions(['-abc'], { a: 'aaa', b: 'bbb', c: 'ccc' })).toEqual({ aaa: [], bbb: [], ccc: [] });
  });

  test('parses an arg with value', () => {
    expect(parseCliOptions(['--foo', 'bar'])).toEqual({ foo: ['bar'] });
  });

  test('parses a repeated args', () => {
    expect(parseCliOptions(['--foo', 'bar', '--foo', 'baz'])).toEqual({ foo: ['bar', 'baz'] });
  });

  test('parses an arg shorthand with a value', () => {
    expect(parseCliOptions(['-f', 'bar'], { f: 'foo' })).toEqual({ foo: ['bar'] });
  });

  test('parses an arg shorthand with multiple values', () => {
    expect(parseCliOptions(['-f', 'bar', '-f', 'baz'], { f: 'foo' })).toEqual({ foo: ['bar', 'baz'] });
  });

  test('parses multiple arg shorthands with a value', () => {
    expect(parseCliOptions(['-abc', 'bar'], { a: 'aaa', b: 'bbb', c: 'ccc' })).toEqual({
      aaa: [],
      bbb: [],
      ccc: ['bar'],
    });
  });

  test('puts value without an option under ""', () => {
    expect(parseCliOptions(['bar'], {})).toEqual({ '': ['bar'] });
  });

  test('does not parse after --', () => {
    expect(parseCliOptions(['--', '--foo', 'bar'], {})).toEqual({ '--': ['--foo', 'bar'] });
  });
});
