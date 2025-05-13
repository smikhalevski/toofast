import { beforeEach, describe, expect, test, vi } from 'vitest';
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
} from '../main/runner-api.js';

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const node = new Node();

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

    const aNode = new Node();
    const bNode = new Node();

    aNode.beforeEach(aMock);
    bNode.beforeEach(bMock);

    aNode.appendChild(bNode as ChildNode);

    await bNode.beforeEachHook!();

    expect(aMock).toHaveBeenCalledTimes(1);
    expect(bMock).toHaveBeenCalledTimes(1);
  });

  test('cannot append child if it already has a parent', () => {
    const aNode = new Node();
    const bNode = new Node();

    aNode.appendChild(bNode as ChildNode);
    expect(() => aNode.appendChild(bNode as ChildNode)).toThrow(new Error('Child already has a parent'));
  });
});

describe('bootstrapRunner', () => {
  test('eval files', async () => {
    const evalFileMock = vi.fn();
    const sendMessageMock = vi.fn();

    const isSuccessful = await bootstrapRunner({
      setupFiles: ['aaa', 'bbb'],
      testFile: 'ccc',
      evalFile: evalFileMock,
      sendMessage: sendMessageMock,
    });

    expect(isSuccessful).toBe(true);

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

    const isSuccessful = await bootstrapRunner({
      setupFiles: ['aaa', 'bbb'],
      testFile: 'ccc',
      evalFile: evalFileMock,
      sendMessage: sendMessageMock,
    });

    expect(isSuccessful).toBe(false);

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
  const setCurrentNodeMock = vi.fn();
  const runMeasureMock = vi.fn(async () => null);
  const sendMessageMock = vi.fn();

  let testSuiteNode: TestSuiteNode;

  let describe1Node: DescribeNode;
  let test11Node: TestNode;
  let test12Node: TestNode;

  let describe2Node: DescribeNode;
  let test21Node: TestNode;
  let test22Node: TestNode;
  let test23Node: TestNode;

  beforeEach(() => {
    setCurrentNodeMock.mockClear();
    runMeasureMock.mockClear();
    sendMessageMock.mockClear();

    describe1Node = new DescribeNode('describe1', () => {
      describe1Node.appendChild(test11Node).appendChild(test12Node);
    });
    test11Node = new TestNode('test11', () => {
      test11Node.appendChild(new MeasureNode(() => undefined));
    });
    test12Node = new TestNode('test12', () => {
      test12Node.appendChild(new MeasureNode(() => undefined));
    });

    describe2Node = new DescribeNode('describe2', () => {
      describe2Node.appendChild(test21Node).appendChild(test22Node).appendChild(test23Node);
    });
    test21Node = new TestNode('test21', () => {
      test21Node.appendChild(new MeasureNode(() => undefined));
    });
    test22Node = new TestNode('test22', () => {
      test22Node.appendChild(new MeasureNode(() => undefined));
    });
    test23Node = new TestNode('test23', () => {
      test23Node.appendChild(new MeasureNode(() => undefined));
    });

    testSuiteNode = new TestSuiteNode().appendChild(describe1Node).appendChild(describe2Node);
  });

  test('runs a single test', async () => {
    await runTest({
      startNode: testSuiteNode,
      nodeLocation: [],
      isSkipped: () => false,
      setCurrentNode: setCurrentNodeMock,
      runMeasure: runMeasureMock,
      sendMessage: sendMessageMock,
    });

    expect(setCurrentNodeMock).toHaveBeenCalledTimes(2);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(1, describe1Node);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(2, test11Node);

    expect(runMeasureMock).toHaveBeenCalledTimes(1);

    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'describeStart',
      name: 'describe1',
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'testStart',
      name: 'test11',
      nodeLocation: [0, 0],
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'testEnd',
      durationStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
      memoryStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
    } satisfies RunnerMessage);
  });

  test('resumes after the node location', async () => {
    await runTest({
      startNode: testSuiteNode,
      nodeLocation: [0, 0],
      isSkipped: () => false,
      setCurrentNode: setCurrentNodeMock,
      runMeasure: runMeasureMock,
      sendMessage: sendMessageMock,
    });

    expect(setCurrentNodeMock).toHaveBeenCalledTimes(2);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(1, describe1Node);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(2, test12Node);

    expect(runMeasureMock).toHaveBeenCalledTimes(1);

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'testStart',
      name: 'test12',
      nodeLocation: [0, 1],
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'testEnd',
      durationStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
      memoryStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
    } satisfies RunnerMessage);
  });

  test('sends describeEnd after resume', async () => {
    await runTest({
      startNode: testSuiteNode,
      nodeLocation: [0, 1],
      isSkipped: () => false,
      setCurrentNode: setCurrentNodeMock,
      runMeasure: runMeasureMock,
      sendMessage: sendMessageMock,
    });

    expect(setCurrentNodeMock).toHaveBeenCalledTimes(3);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(1, describe1Node);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(2, describe2Node);
    expect(setCurrentNodeMock).toHaveBeenNthCalledWith(3, test21Node);

    expect(runMeasureMock).toHaveBeenCalledTimes(1);

    expect(sendMessageMock).toHaveBeenCalledTimes(4);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'describeEnd',
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'describeStart',
      name: 'describe2',
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'testStart',
      name: 'test21',
      nodeLocation: [1, 0],
    } satisfies RunnerMessage);
    expect(sendMessageMock).toHaveBeenNthCalledWith(4, {
      type: 'testEnd',
      durationStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
      memoryStats: { hz: 0, mean: 0, moe: 0, rme: 0, sd: 0, sem: 0, size: 0, variance: 0 },
    } satisfies RunnerMessage);
  });
});
