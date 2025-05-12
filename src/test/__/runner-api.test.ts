import { describe, expect, test, vi } from 'vitest';
import {
  bootstrapRunner,
  ChildNode,
  DescribeNode,
  MeasureNode,
  Node,
  RunnerMessage,
  runTest,
  TestNode,
  TestSuiteNode,
} from '../../main/___/runner-api.js';

describe('Node', () => {
  test('creates a new node', () => {
    const testOptions = {};
    const node = new Node(testOptions);

    expect(node.testOptions).toBe(testOptions);
    expect(node.parent).toBeNull();
    expect(node.children).toEqual([]);
    expect(node.isSkipped).toBe(false);
    expect(node.beforeEachHook).toBeUndefined();
    expect(node.afterEachHook).toBeUndefined();
    expect(node.beforeWarmupHook).toBeUndefined();
    expect(node.afterWarmupHook).toBeUndefined();
    expect(node.beforeBatchHook).toBeUndefined();
    expect(node.afterBatchHook).toBeUndefined();
    expect(node.beforeIterationHook).toBeUndefined();
    expect(node.afterIterationHook).toBeUndefined();
  });

  test('beforeEach adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.beforeEach(aMock);

    expect(node.beforeEachHook).toBe(aMock);

    node.beforeEach(bMock);

    await node.beforeEachHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('afterEach adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.afterEach(aMock);

    expect(node.afterEachHook).toBe(aMock);

    node.afterEach(bMock);

    await node.afterEachHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('beforeWarmup adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.beforeWarmup(aMock);

    expect(node.beforeWarmupHook).toBe(aMock);

    node.beforeWarmup(bMock);

    await node.beforeWarmupHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('afterWarmup adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.afterWarmup(aMock);

    expect(node.afterWarmupHook).toBe(aMock);

    node.afterWarmup(bMock);

    await node.afterWarmupHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('beforeBatch adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.beforeBatch(aMock);

    expect(node.beforeBatchHook).toBe(aMock);

    node.beforeBatch(bMock);

    await node.beforeBatchHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('afterBatch adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.afterBatch(aMock);

    expect(node.afterBatchHook).toBe(aMock);

    node.afterBatch(bMock);

    await node.afterBatchHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('beforeIteration adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.beforeIteration(aMock);

    expect(node.beforeIterationHook).toBe(aMock);

    node.beforeIteration(bMock);

    await node.beforeIterationHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('afterIteration adds a hook', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const node = new Node({});

    node.afterIteration(aMock);

    expect(node.afterIterationHook).toBe(aMock);

    node.afterIteration(bMock);

    await node.afterIterationHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('appends a child', () => {
    const beforeEachHookMock = vi.fn();
    const afterEachHookMock = vi.fn();
    const beforeWarmupHookMock = vi.fn();
    const afterWarmupHookMock = vi.fn();
    const beforeBatchHookMock = vi.fn();
    const afterBatchHookMock = vi.fn();
    const beforeIterationHookMock = vi.fn();
    const afterIterationHookMock = vi.fn();

    const aNode = new Node({ batchTimeout: 111, targetRme: 222 });
    const bNode = new Node({ targetRme: 333 });

    aNode.beforeEach(beforeEachHookMock);
    aNode.afterEach(afterEachHookMock);
    aNode.beforeWarmup(beforeWarmupHookMock);
    aNode.afterWarmup(afterWarmupHookMock);
    aNode.beforeBatch(beforeBatchHookMock);
    aNode.afterBatch(afterBatchHookMock);
    aNode.beforeIteration(beforeIterationHookMock);
    aNode.afterIteration(afterIterationHookMock);

    aNode.appendChild(bNode as ChildNode);

    expect(aNode.children.length).toBe(1);
    expect(bNode.parent).toBe(aNode);
    expect(bNode.testOptions).toEqual({ batchTimeout: 111, targetRme: 333 });
    expect(bNode.beforeEachHook).toBe(beforeEachHookMock);
    expect(bNode.afterEachHook).toBe(afterEachHookMock);
    expect(bNode.beforeWarmupHook).toBe(beforeWarmupHookMock);
    expect(bNode.afterWarmupHook).toBe(afterWarmupHookMock);
    expect(bNode.beforeBatchHook).toBe(beforeBatchHookMock);
    expect(bNode.afterBatchHook).toBe(afterBatchHookMock);
    expect(bNode.beforeIterationHook).toBe(beforeIterationHookMock);
    expect(bNode.afterIterationHook).toBe(afterIterationHookMock);
  });

  test('combines hooks of a child node', async () => {
    const aMock = vi.fn();
    const bMock = vi.fn();

    const aNode = new Node({});
    const bNode = new Node({});

    aNode.beforeEach(aMock);
    bNode.beforeEach(bMock);

    aNode.appendChild(bNode as ChildNode);

    await bNode.beforeEachHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('cannot append child if it already has a parent', () => {
    const aNode = new Node({});
    const bNode = new Node({});

    aNode.appendChild(bNode as ChildNode);
    expect(() => aNode.appendChild(bNode as ChildNode)).toThrow(new Error('Child already has a parent'));
  });
});

describe('bootstrapRunner', () => {
  test('eval files', async () => {
    const evalFileMock = vi.fn();
    const sendMessageMock = vi.fn();

    const isOK = await bootstrapRunner({
      setupFilePaths: ['aaa', 'bbb'],
      testFilePath: 'ccc',
      evalFile: evalFileMock,
      sendMessage: sendMessageMock,
    });

    expect(isOK).toBe(true);

    expect(evalFileMock).toHaveBeenCalledTimes(3);
    expect(evalFileMock).toHaveBeenNthCalledWith(1, 'aaa');
    expect(evalFileMock).toHaveBeenNthCalledWith(2, 'bbb');
    expect(evalFileMock).toHaveBeenNthCalledWith(3, 'ccc');

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  test('sends fatal error message', async () => {
    const evalFileMock = vi.fn(() => {
      throw new Error('expected');
    });

    const sendMessageMock = vi.fn();

    const isOK = await bootstrapRunner({
      setupFilePaths: ['aaa', 'bbb'],
      testFilePath: 'ccc',
      evalFile: evalFileMock,
      sendMessage: sendMessageMock,
    });

    expect(isOK).toBe(false);

    expect(evalFileMock).toHaveBeenCalledTimes(1);
    expect(evalFileMock).toHaveBeenNthCalledWith(1, 'aaa');

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'fatalError',
      errorMessage: expect.stringContaining('expected'),
    } satisfies RunnerMessage);
  });
});

describe('runTest', () => {
  test('runs a single test', async () => {
    const setCurrentNodeMock = vi.fn();
    const runMeasureMock = vi.fn(async () => null);
    const sendMessageMock = vi.fn();

    const testNode = new TestNode('aaa', () => {
      testNode.appendChild(new MeasureNode(() => undefined));
    });

    const describeNode = new DescribeNode('bbb', () => {
      describeNode.appendChild(testNode);
    });

    const testSuiteNode = new TestSuiteNode({}).appendChild(describeNode);

    await runTest({
      startNode: testSuiteNode,
      nodeLocation: [],
      isSkipped: () => false,
      setCurrentNode: setCurrentNodeMock,
      runMeasure: runMeasureMock,
      sendMessage: sendMessageMock,
    });

    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, { type: 'describeStart', name: 'bbb' } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'testStart',
      name: 'aaa',
      nodeLocation: [0, 0],
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'testEnd',
      durationStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
      memoryStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
    } satisfies RunnerMessage);
  });
});
