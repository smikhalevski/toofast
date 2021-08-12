import {createAdder} from './createAdder';

/**
 * T-Distribution two-tailed critical values for 95% confidence.
 */
const tTable = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447,
  2.365, 2.306, 2.262, 2.228, 2.201, 2.179,
  2.160, 2.145, 2.131, 2.120, 2.110, 2.101,
  2.093, 2.086, 2.080, 2.074, 2.069, 2.064,
  2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
  1.960,
];

/**
 * Provides access to population statistics.
 */
export interface IHistogram {

  /**
   * The total number of added measurements.
   */
  getSize(): number;

  getSum(): number;

  /**
   * The mean value.
   */
  getMean(): number;

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   */
  getVariance(): number;

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  getSd(): number;

  /**
   * Standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  getSem(): number;

  /**
   * Margin of error.
   */
  getMoe(): number;

  /**
   * Relative margin of error.
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error on Wikipedia}
   */
  getRme(): number;

  /**
   * Number of executions per second.
   */
  getHz(): number;

  /**
   * Add a new measurement.
   *
   * @param x The measurement value.
   */
  add(x: number): void;
}

/**
 * Creates a new {@link IHistogram} that provides access to population statistics.
 */
export function createHistogram(): IHistogram {

  const xAdder = createAdder();
  const sqxAdder = createAdder();

  let size = 0;

  const getSize = () => size;

  const getMean = () => size === 0 ? 0 : xAdder.getSum() / size;

  const getHz = () => 1000 / getMean();

  // https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
  const getVariance = () => size === 0 ? 0 : (sqxAdder.getSum() - (xAdder.getSum() * xAdder.getSum()) / size) / size;

  const getSd = () => Math.sqrt(getVariance());

  const getSem = () => getSd() / Math.sqrt(size);

  const getMoe = () => getSem() * tTable[Math.min(size, tTable.length) - 1];

  const getRme = () => getMoe() / getMean();

  const add = (x: number): void => {
    xAdder.add(x);
    sqxAdder.add(x * x);
    size++;
  };

  return {
    getSize,
    getSum: xAdder.getSum,
    getMean,
    getHz,
    getVariance,
    getSd,
    getSem,
    getMoe,
    getRme,
    add,
  };
}
