import {Adder} from './Adder';

/**
 * Provides access to mutable population statistics.
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

  private _adder = new Adder();
  private _sqAdder = new Adder();

  /**
   * The total number of added measurements.
   */
  public size = 0;

  /**
   * The mean value.
   */
  public getMean(): number {
    const {size, _adder} = this;
    return size === 0 ? 0 : _adder.getSum() / size;
  }

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance on Wikipedia}
   */
  public getVariance(): number {
    const {size, _sqAdder, _adder} = this;
    const sum = _adder.getSum();
    return size === 0 ? 0 : (_sqAdder.getSum() - (sum * sum) / size) / size;
  }

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  public getSd(): number {
    return Math.sqrt(this.getVariance());
  }

  /**
   * The standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  public getSem(): number {
    const {size} = this;
    return size === 0 ? 0 : this.getSd() / Math.sqrt(size);
  }

  /**
   * The margin of error.
   */
  public getMoe(): number {
    const {tTable} = Histogram;
    const {size} = this;
    return size === 0 ? 0 : this.getSem() * tTable[Math.min(size, tTable.length) - 1];
  }

  /**
   * The relative margin of error [0, 1].
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error on Wikipedia}
   */
  public getRme(): number {
    return this.size === 0 ? 0 : this.getMoe() / this.getMean();
  }

  /**
   * The number of executions per second.
   */
  public getHz(): number {
    return this.size === 0 ? 0 : 1000 / this.getMean();
  }

  /**
   * Add a new measurement.
   *
   * @param x The measurement value.
   */
  public add(x: number): void {
    this._adder.add(x);
    this._sqAdder.add(x * x);
    ++this.size;
  }

  /**
   * Adds measurements from another histogram.
   *
   * @param histogram The histogram to add measurements from.
   */
  public addFromHistogram(histogram: Histogram): void {
    this._adder.add(histogram._adder.getSum());
    this._sqAdder.add(histogram._sqAdder.getSum());
    this.size += histogram.size;
  }
}
