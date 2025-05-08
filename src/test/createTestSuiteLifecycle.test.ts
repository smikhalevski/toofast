import { beforeEach, expect, test, vi } from 'vitest';
import {
  createTestSuiteLifecycle,
  DescribeNode,
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
    type: 'testSuite',
    children: [],
  };

  const node0: DescribeNode = {
    type: 'describe',
    parent: node,
    children: [],
    name: '0',
  };
  node.children.push(node0);

  const node00: TestNode = {
    type: 'test',
    parent: node0,
    name: '0.0',
    isEnabled: true,
  };
  node0.children.push(node00);

  const node1: DescribeNode = {
    type: 'describe',
    parent: node,
    children: [],
    name: '1',
  };
  node.children.push(node1);

  const node10: DescribeNode = {
    type: 'describe',
    parent: node1,
    children: [],
    name: '1.0',
  };
  node1.children.push(node10);

  const node100: TestNode = {
    type: 'test',
    parent: node10,
    name: '1.0.0',
    isEnabled: true,
  };
  node10.children.push(node100);

  const node11: DescribeNode = {
    type: 'describe',
    parent: node1,
    children: [],
    name: '1.1',
  };
  node1.children.push(node11);

  const node110: TestNode = {
    type: 'test',
    parent: node11,
    name: '1.1.0',
    isEnabled: true,
  };
  node11.children.push(node110);

  const node111: TestNode = {
    type: 'test',
    parent: node11,
    name: '1.1.1',
    isEnabled: true,
  };
  node11.children.push(node111);

  const node2: TestNode = {
    type: 'test',
    parent: node,
    name: '2',
    isEnabled: true,
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
