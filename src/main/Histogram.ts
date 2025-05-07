import { Adder } from './Adder.js';

/**
 * Provides access to mutable population statistics.
 */
export class Histogram {
  /**
   * The total number of added measurements.
   */
  size = 0;

  /**
   * Total sum of all values added to the histogram.
   */
  private readonly _adder = new Adder();

  /**
   * Total sum of all squared values added to the histogram.
   */
  private readonly _sqAdder = new Adder();

  /**
   * The mean value.
   */
  get mean(): number {
    const { size, _adder } = this;

    return size === 0 ? 0 : _adder.sum / size;
  }

  /**
   * The expectation of the squared deviation of a random variable from its mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance}
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance Algorithms for calculating variance}
   */
  get variance(): number {
    const { size, _sqAdder, _adder } = this;

    return size === 0 ? 0 : (_sqAdder.sum - (_adder.sum * _adder.sum) / size) / size;
  }

  /**
   * The standard deviation is a measure of the amount of variation or dispersion of a set of values.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation}
   */
  get sd(): number {
    return Math.sqrt(this.variance);
  }

  /**
   * The standard error of the mean.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error}
   */
  get sem(): number {
    const { size } = this;

    return size === 0 ? 0 : this.sd / Math.sqrt(size);
  }

  /**
   * The margin of error.
   */
  get moe(): number {
    const { size } = this;

    return size === 0 ? 0 : this.sem * tTable[Math.min(size, tTable.length) - 1];
  }

  /**
   * The relative margin of error [0, 1].
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error}
   */
  get rme(): number {
    return this.size === 0 ? 0 : this.moe / this.mean;
  }

  /**
   * The number of executions per second.
   */
  get hz(): number {
    return this.size === 0 ? 0 : 1000 / this.mean;
  }

  /**
   * Add a new measurement to the histogram.
   *
   * @param value The value to add.
   */
  add(value: number): void;

  /**
   * Adds all measurements from another histogram.
   *
   * @param histogram The histogram to add measurements from.
   */
  add(histogram: Histogram): void;

  add(value: number | Histogram): void {
    const { _adder, _sqAdder } = this;

    if (typeof value === 'number') {
      _adder.add(value);
      _sqAdder.add(value * value);
    } else {
      _adder.add(value._adder.sum);
      _sqAdder.add(value._sqAdder.sum);
    }

    this.size++;
  }
}

/**
 * T-Distribution two-tailed critical values for 95% confidence.
 */
// prettier-ignore
const tTable = [
  12.710, 4.3030, 3.1820, 2.7760, 2.5710, 2.4470, 2.3650, 2.3060,
  2.2620, 2.2280, 2.2010, 2.1790, 2.1600, 2.1450, 2.1310, 2.1200,
  2.1100, 2.1010, 2.0930, 2.0860, 2.0800, 2.0740, 2.0690, 2.0640,
  2.0600, 2.0560, 2.0520, 2.0480, 2.0450, 2.0420, 2.0399, 2.0378,
  2.0357, 2.0336, 2.0315, 2.0294, 2.0273, 2.0252, 2.0231, 2.0210,
  2.0198, 2.0186, 2.0174, 2.0162, 2.0150, 2.0138, 2.0126, 2.0114,
  2.0102, 2.0090, 2.0081, 2.0072, 2.0063, 2.0054, 2.0045, 2.0036,
  2.0027, 2.0018, 2.0009, 2.0000, 1.9995, 1.9990, 1.9985, 1.9980,
  1.9975, 1.9970, 1.9965, 1.9960, 1.9955, 1.9950, 1.9945, 1.9940,
  1.9935, 1.9930, 1.9925, 1.9920, 1.9915, 1.9910, 1.9905, 1.9900,
  1.9897, 1.9894, 1.9891, 1.9888, 1.9885, 1.9882, 1.9879, 1.9876,
  1.9873, 1.9870, 1.9867, 1.9864, 1.9861, 1.9858, 1.9855, 1.9852,
  1.9849, 1.9846, 1.9843, 1.9840, 1.9838, 1.9836, 1.9834, 1.9832,
  1.9830, 1.9828, 1.9826, 1.9824, 1.9822, 1.9820, 1.9818, 1.9816,
  1.9814, 1.9812, 1.9819, 1.9808, 1.9806, 1.9804, 1.9802, 1.9800,
];
