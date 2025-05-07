import { Adder } from './Adder.js';
import { tTable } from './constants.js';

/**
 * Provides access to mutable population statistics.
 */
export class Histogram {
  /**
   * The total number of added measurements.
   */
  public size = 0;
  private _adder = new Adder();
  private _sqAdder = new Adder();

  /**
   * The mean value.
   */
  getMean(): number {
    const { size, _adder } = this;
    return size === 0 ? 0 : _adder.getSum() / size;
  }

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance on Wikipedia}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance on Wikipedia}
   */
  getVariance(): number {
    const { size, _sqAdder, _adder } = this;
    const sum = _adder.getSum();
    return size === 0 ? 0 : (_sqAdder.getSum() - (sum * sum) / size) / size;
  }

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation on Wikipedia}
   */
  getSd(): number {
    return Math.sqrt(this.getVariance());
  }

  /**
   * The standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error on Wikipedia}
   */
  public getSem(): number {
    const { size } = this;
    return size === 0 ? 0 : this.getSd() / Math.sqrt(size);
  }

  /**
   * The margin of error.
   */
  public getMoe(): number {
    const { size } = this;
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
