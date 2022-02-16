import {Adder} from './Adder';

/**
 * Provides access to population statistics.
 */
export class Histogram {

  /**
   * T-Distribution two-tailed critical values for 95% confidence.
   */
  static tTable = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447,
    2.365, 2.306, 2.262, 2.228, 2.201, 2.179,
    2.160, 2.145, 2.131, 2.120, 2.110, 2.101,
    2.093, 2.086, 2.080, 2.074, 2.069, 2.064,
    2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
    1.960,
  ];

  private _xAdder = new Adder();
  private _sqxAdder = new Adder();

  /**
   * The total number of added measurements.
   */
  public size = 0;

  public get sum(): number {
    return this._xAdder.sum;
  }

  /**
   * The mean value.
   */
  public get mean(): number {
    const {size, _xAdder} = this;
    return size === 0 ? 0 : _xAdder.sum / size;
  }

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance on Wikipedia}
   */
  public get variance(): number {
    const {size, _sqxAdder, _xAdder} = this;
    return size === 0 ? 0 : (_sqxAdder.sum - (_xAdder.sum * _xAdder.sum) / size) / size;
  }

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  public get sd(): number {
    return Math.sqrt(this.variance);
  }

  /**
   * Standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  public get sem(): number {
    return this.sd / Math.sqrt(this.size);
  }

  /**
   * Margin of error.
   */
  public get moe(): number {
    return this.sem * Histogram.tTable[Math.min(this.size, Histogram.tTable.length) - 1];
  }

  /**
   * Relative margin of error.
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error on Wikipedia}
   */
  public get rme(): number {
    return this.moe / this.mean;
  }

  /**
   * Number of executions per second.
   */
  public get hz(): number {
    return 1000 / this.mean;
  }

  /**
   * Add a new measurement.
   *
   * @param x The measurement value.
   */
  public add(x: number): void {
    this._xAdder.add(x);
    this._sqxAdder.add(x * x);
    this.size++;
  }
}
