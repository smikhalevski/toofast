import { test, expect, beforeEach, vi } from 'vitest';
import {
  createTestSuiteLifecycle,
  DescribeNode,
  NodeType,
  TestNode,
  TestSuiteLifecycleHandlers,
  TestSuiteNode,
} from '../main/index.js';

const testLifecycleMock = vi.fn(() => Promise.resolve());

const onDescribeStartMock = vi.fn();
const onDescribeEndMock = vi.fn();

const handlers: TestSuiteLifecycleHandlers = {
  onDescribeStart: onDescribeStartMock,
  onDescribeEnd: onDescribeEndMock,
};

beforeEach(() => {
  testLifecycleMock.mockClear();

  onDescribeStartMock.mockClear();
  onDescribeEndMock.mockClear();
});

test('assembles nodes', () => {
  const lifecycle = createTestSuiteLifecycle(testLifecycleMock, handlers);

  const r = lifecycle.runtime;

  r.describe('0', () => {
    r.test('0.0', () => undefined);
  });
  r.describe('1', () => {
    r.describe('1.0', () => {
      r.test('1.0.0', () => undefined);
    });
    r.describe('1.1', () => {
      r.test('1.1.0', () => undefined);
      r.test('1.1.1', () => undefined);
    });
  });
  r.test('2', () => undefined);

  const node: TestSuiteNode = {
    nodeType: NodeType.TEST_SUITE,
    children: [],
  };

  const node0: DescribeNode = {
    nodeType: NodeType.DESCRIBE,
    parentNode: node,
    children: [],
    label: '0',
  };
  node.children.push(node0);

  const node00: TestNode = {
    nodeType: NodeType.TEST,
    parentNode: node0,
    label: '0.0',
    enabled: true,
  };
  node0.children.push(node00);

  const node1: DescribeNode = {
    nodeType: NodeType.DESCRIBE,
    parentNode: node,
    children: [],
    label: '1',
  };
  node.children.push(node1);

  const node10: DescribeNode = {
    nodeType: NodeType.DESCRIBE,
    parentNode: node1,
    children: [],
    label: '1.0',
  };
  node1.children.push(node10);

  const node100: TestNode = {
    nodeType: NodeType.TEST,
    parentNode: node10,
    label: '1.0.0',
    enabled: true,
  };
  node10.children.push(node100);

  const node11: DescribeNode = {
    nodeType: NodeType.DESCRIBE,
    parentNode: node1,
    children: [],
    label: '1.1',
  };
  node1.children.push(node11);

  const node110: TestNode = {
    nodeType: NodeType.TEST,
    parentNode: node11,
    label: '1.1.0',
    enabled: true,
  };
  node11.children.push(node110);

  const node111: TestNode = {
    nodeType: NodeType.TEST,
    parentNode: node11,
    label: '1.1.1',
    enabled: true,
  };
  node11.children.push(node111);

  const node2: TestNode = {
    nodeType: NodeType.TEST,
    parentNode: node,
    label: '2',
    enabled: true,
  };
  node.children.push(node2);

  expect(lifecycle.node).toEqual(node);
});

test('runs the lifecycle', async () => {
  const lifecycle = createTestSuiteLifecycle(testLifecycleMock, handlers);

  const r = lifecycle.runtime;

  r.describe('0', () => {
    r.test('0.0', () => undefined);
  });
  r.test('2', () => undefined);

  await lifecycle.run();

  expect(testLifecycleMock).toHaveBeenCalledTimes(2);
  expect(testLifecycleMock).toHaveBeenNthCalledWith(1, (lifecycle.node.children[0] as DescribeNode).children[0]);
  expect(testLifecycleMock).toHaveBeenNthCalledWith(2, lifecycle.node.children[1]);

  expect(onDescribeStartMock).toHaveBeenCalledTimes(1);
  expect(onDescribeEndMock).toHaveBeenCalledTimes(1);
});
