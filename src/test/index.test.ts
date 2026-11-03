import { describe as describeTest, expect, test } from 'vitest';
import { afterEach, beforeEach, describe, measure } from '../main/index.ts';
import { appendNode, createTestSuite, setCurrentNode } from '../main/runner.ts';
import { noop } from '../main/utils.ts';

describeTest('measure', () => {
  test('throws if options follow the callback', () => {
    setCurrentNode(appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop }));

    // @ts-expect-error options must precede the callback
    expect(() => measure(noop, { measureTimeout: 111 })).toThrow('options must precede the callback');
  });

  test('throws if a hook is not a function', () => {
    setCurrentNode(appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop }));

    // @ts-expect-error hooks must be functions
    expect(() => measure({ beforeBatch: 111 }, noop)).toThrow('hook must be a function');
  });
});

describeTest('describe', () => {
  test('throws if the callback is missing', () => {
    setCurrentNode(createTestSuite({}));

    // @ts-expect-error the callback is missing
    expect(() => describe('aaa', { measureTimeout: 111 })).toThrow('callback must be a function');
  });
});

describeTest('beforeEach', () => {
  test('throws if called inside a test', () => {
    setCurrentNode(appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop }));

    expect(() => beforeEach(noop)).toThrow('Unexpected beforeEach() invocation');
  });
});

describeTest('afterEach', () => {
  test('throws if called inside a test', () => {
    setCurrentNode(appendNode(createTestSuite({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop }));

    expect(() => afterEach(noop)).toThrow('Unexpected afterEach() invocation');
  });
});
