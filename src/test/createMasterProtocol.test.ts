import {createMasterProtocol, DescribeNode, MasterHandlers, NodeType, TestNode, TestSuiteNode} from '../main';

describe('createMasterProtocol', () => {

  const runTestMock = jest.fn(() => Promise.resolve());
  const onDescribeStartMock = jest.fn();
  const onDescribeEndMock = jest.fn();
  const onTestStartMock = jest.fn();
  const onTestEndMock = jest.fn();

  const handlers: MasterHandlers = {
    onDescribeStart: onDescribeStartMock,
    onDescribeEnd: onDescribeEndMock,
    onTestStart: onTestStartMock,
    onTestEnd: onTestEndMock,
  };

  beforeEach(() => {
    runTestMock.mockClear();
    onDescribeStartMock.mockClear();
    onDescribeEndMock.mockClear();
    onTestStartMock.mockClear();
    onTestEndMock.mockClear();
  });

  test('assembles nodes', () => {
    const protocol = createMasterProtocol(handlers, {runTest: runTestMock});

    const t = protocol.testProtocol;

    t.describe('0', () => {

      t.test('0.0', () => undefined);
    });

    t.describe('1', () => {

      t.describe('1.0', () => {

        t.test('1.0.0', () => undefined);
      });

      t.describe('1.1', () => {

        t.test('1.1.0', () => undefined);

        t.test('1.1.1', () => undefined);
      });
    });

    t.test('2', () => undefined);

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
      testPath: [0, 0]
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
      testPath: [1, 0, 0],
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
      testPath: [1, 1, 0],
    };
    node11.children.push(node110);

    const node111: TestNode = {
      nodeType: NodeType.TEST,
      parentNode: node11,
      label: '1.1.1',
      testPath: [1, 1, 1],
    };
    node11.children.push(node111);

    const node2: TestNode = {
      nodeType: NodeType.TEST,
      parentNode: node,
      label: '2',
      testPath: [2],
    };
    node.children.push(node2);

    expect(protocol.node).toEqual(node);
  });

  test('runs the protocol', async () => {

    const protocol = createMasterProtocol(handlers, {runTest: runTestMock});

    const t = protocol.testProtocol;

    t.describe('0', () => {
      t.test('0.0', () => undefined);
    });
    t.test('2', () => undefined);

    protocol.run();

    await protocol.getPromise();

    expect(runTestMock).toHaveBeenCalledTimes(2);
    expect(runTestMock).toHaveBeenNthCalledWith(1, (protocol.node.children[0] as DescribeNode).children[0]);
    expect(runTestMock).toHaveBeenNthCalledWith(2, protocol.node.children[1]);

    expect(onDescribeStartMock).toHaveBeenCalledTimes(1);
    expect(onDescribeEndMock).toHaveBeenCalledTimes(1);
    expect(onTestStartMock).toHaveBeenCalledTimes(2);
    expect(onTestEndMock).toHaveBeenCalledTimes(2);
  });
});
