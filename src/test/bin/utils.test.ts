import {createTestSuiteLifecycle, DescribeNode, TestNode} from '../../main';
import {getLabelLength, getTestPath} from '../../main/bin/utils';

describe('getTestPath', () => {

  test('returns path of the nested test', () => {

    const lifecycle = createTestSuiteLifecycle(() => Promise.resolve());
    const r = lifecycle.runtime;

    r.describe('0', () => {

      r.test('0.0', () => undefined);

      r.test('0.1', () => undefined);
    });

    expect(getTestPath(lifecycle.node.children[0])).toEqual([0]);
    expect(getTestPath((lifecycle.node.children[0] as DescribeNode).children[1])).toEqual([0, 1]);
  });
});

describe('getLabelLength', () => {

  test('returns the maximum label length', () => {

    const lifecycle = createTestSuiteLifecycle(() => Promise.resolve());
    const r = lifecycle.runtime;

    r.describe('', () => {

      r.test('aaaaaa', () => undefined);

      r.test('bbb', () => undefined);
    });

    expect(getLabelLength((lifecycle.node.children[0] as DescribeNode).children[1] as TestNode)).toBe(6);
  });
});
