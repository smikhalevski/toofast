import { describe, expect, test } from 'vitest';
import * as toofast from '../main/index.ts';
import { noop } from '../main/utils.ts';
import { makeTestNode, makeTestSuite } from './test-utils.ts';

describe('describe', () => {
  test('throws if the name is not a string', () => {
    makeTestSuite();

    // @ts-expect-error the name must be a string
    expect(() => toofast.describe(111, noop)).toThrow('Name must be a string');
  });

  test('throws if options are not an object', () => {
    makeTestSuite();

    // @ts-expect-error options must be an object
    expect(() => toofast.describe('aaa', 111, noop)).toThrow('Options must be an object');
  });

  test('throws if the callback is missing', () => {
    makeTestSuite();

    // @ts-expect-error the callback is missing
    expect(() => toofast.describe('aaa', { measureTimeout: 111 })).toThrow('Callback must be a function');
  });

  test('throws if called inside a test', () => {
    makeTestNode();

    expect(() => toofast.describe('aaa', noop)).toThrow('Unexpected describe() invocation');
  });
});

describe('test', () => {
  test('throws if called inside a test', () => {
    makeTestNode();

    expect(() => toofast.test('aaa', noop)).toThrow('Unexpected test() invocation');
  });
});

describe('measure', () => {
  test('throws if called outside of a test', () => {
    makeTestSuite();

    expect(() => toofast.measure(noop)).toThrow('Unexpected measure() invocation');
  });

  test('throws if options follow the callback', () => {
    makeTestNode();

    // @ts-expect-error options must precede the callback
    expect(() => toofast.measure(noop, { measureTimeout: 111 })).toThrow('Options must precede the callback');
  });

  test('throws if a hook is not a function', () => {
    makeTestNode();

    // @ts-expect-error hooks must be functions
    expect(() => toofast.measure({ beforeBatch: 111 }, noop)).toThrow('Hook must be a function');
  });
});

describe('beforeEach', () => {
  test('throws if called inside a test', () => {
    makeTestNode();

    expect(() => toofast.beforeEach(noop)).toThrow('Unexpected beforeEach() invocation');
  });
});

describe('afterEach', () => {
  test('throws if called inside a test', () => {
    makeTestNode();

    expect(() => toofast.afterEach(noop)).toThrow('Unexpected afterEach() invocation');
  });
});
