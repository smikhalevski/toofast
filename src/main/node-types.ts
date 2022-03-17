export const enum NodeType {
  TEST_SUITE = 'testSuite',
  DESCRIBE = 'describe',
  TEST = 'test',
}

export interface TestSuiteNode {
  nodeType: NodeType.TEST_SUITE;
  children: (DescribeNode | TestNode)[];
}

export interface DescribeNode {
  nodeType: NodeType.DESCRIBE;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  children: (DescribeNode | TestNode)[];
}

export interface TestNode {
  nodeType: NodeType.TEST;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
}
