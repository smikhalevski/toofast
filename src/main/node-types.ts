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
  testPath: number[];
}

/**
 * Population statistics.
 */
export interface Stats {

  /**
   * The total number of measurements in the population.
   */
  size: number;

  /**
   * The mean value.
   */
  mean: number;

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance on Wikipedia}
   */
  variance: number;

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  sd: number;

  /**
   * Standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  sem: number;

  /**
   * Margin of error.
   */
  moe: number;

  /**
   * Relative margin of error [0, 1].
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error on Wikipedia}
   */
  rme: number;

  /**
   * Number of executions per second.
   */
  hz: number;
}
