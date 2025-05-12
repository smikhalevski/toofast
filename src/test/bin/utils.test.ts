import { describe, expect, test } from 'vitest';
import { createTestSuiteLifecycle, DescribeNode, TestNode } from '../../main/index.js';
import { getNameLength, getTestLocation } from '../../main/runner/utils.js';

describe('getTestLocation', () => {
  test('returns path of the nested test', () => {
    const lifecycle = createTestSuiteLifecycle({ runTestLifecycle: () => Promise.resolve() });
    const r = lifecycle.runtime;

    r.describe('0', () => {
      r.test('0.0', () => undefined);

      r.test('0.1', () => undefined);
    });

    expect(getTestLocation(lifecycle.node.children[0])).toEqual([0]);
    expect(getTestLocation((lifecycle.node.children[0] as DescribeNode).children[1])).toEqual([0, 1]);
  });
});

describe('getNameLength', () => {
  test('returns the maximum name length', () => {
    const lifecycle = createTestSuiteLifecycle({ runTestLifecycle: () => Promise.resolve() });
    const r = lifecycle.runtime;

    r.describe('', () => {
      r.test('aaaaaa', () => undefined);

      r.test('bbb', () => undefined);
    });

    expect(getNameLength((lifecycle.node.children[0] as DescribeNode).children[1] as TestNode)).toBe(6);
  });
});
