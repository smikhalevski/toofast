/**
 * A snapshot of a histogram, from which all statistics are computed. A worker process sends it to the main process.
 */
export interface HistogramSnapshot {
  /**
   * The number of values in the sample.
   */
  size: number;

  /**
   * The arithmetic mean of values.
   */
  mean: number;

  /**
   * The sum of squared deviations of values from the mean.
   */
  sumOfSquaredDeviations: number;
}

/**
 * Accumulates values of a sample and computes statistics without storing the values. Uses Welford's online algorithm,
 * which is numerically stable and never produces a negative variance.
 *
 * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm Welford's online algorithm}
 */
export class Histogram {
  private _size: number;
  private _mean: number;
  private _sumOfSquaredDeviations: number;

  /**
   * Creates an empty histogram, or restores a histogram from its snapshot, for example, after the snapshot was sent
   * from another process.
   */
  constructor(snapshot: HistogramSnapshot = { size: 0, mean: 0, sumOfSquaredDeviations: 0 }) {
    this._size = snapshot.size;
    this._mean = snapshot.mean;
    this._sumOfSquaredDeviations = snapshot.sumOfSquaredDeviations;
  }

  /**
   * The number of values in the sample.
   */
  get size(): number {
    return this._size;
  }

  /**
   * The arithmetic mean of values.
   */
  get mean(): number {
    return this._mean;
  }

  /**
   * The unbiased sample variance. The sum of squared deviations from the mean is divided by size - 1, because the mean
   * is estimated from the same sample.
   *
   * @see {@link https://en.wikipedia.org/wiki/Variance Variance}
   */
  get variance(): number {
    return this.size < 2 ? 0 : this._sumOfSquaredDeviations / (this.size - 1);
  }

  /**
   * The standard deviation, the square root of {@link variance}.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_deviation Standard deviation}
   */
  get sd(): number {
    return Math.sqrt(this.variance);
  }

  /**
   * The standard error of the mean, {@link sd} divided by the square root of {@link size}.
   *
   * @see {@link https://en.wikipedia.org/wiki/Standard_error Standard error}
   */
  get sem(): number {
    return this.size === 0 ? 0 : this.sd / Math.sqrt(this.size);
  }

  /**
   * The margin of error of the mean at 95% confidence, {@link sem} multiplied by the critical value of the
   * t-distribution.
   *
   * @see {@link https://en.wikipedia.org/wiki/Margin_of_error Margin of error}
   */
  get moe(): number {
    return this.size < 2 ? 0 : this.sem * getCriticalValue(this.size - 1);
  }

  /**
   * The margin of error relative to the mean, for example, 0.05 for ±5%.
   */
  get rme(): number {
    // The mean is 0 if all values are 0, so there's no error
    return this.mean === 0 ? 0 : this.moe / this.mean;
  }

  /**
   * The number of iterations per second, if values are iteration durations in milliseconds.
   */
  get hz(): number {
    return this.size === 0 ? 0 : 1000 / this.mean;
  }

  /**
   * Adds a value to the sample.
   */
  add(value: number): void {
    const delta = value - this._mean;

    this._size++;
    this._mean += delta / this._size;

    // The deviation from the previous mean is multiplied by the deviation from the updated mean
    this._sumOfSquaredDeviations += delta * (value - this._mean);
  }

  /**
   * Adds all values of another histogram to the sample.
   *
   * @see {@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Parallel_algorithm}
   */
  merge(histogram: Histogram): void {
    if (histogram._size === 0) {
      return;
    }

    const size = this._size + histogram._size;
    const delta = histogram._mean - this._mean;

    this._mean += (delta * histogram._size) / size;
    this._sumOfSquaredDeviations +=
      histogram._sumOfSquaredDeviations + (delta * delta * this._size * histogram._size) / size;
    this._size = size;
  }

  /**
   * Returns the snapshot that restores the histogram with the constructor.
   */
  getSnapshot(): HistogramSnapshot {
    return { size: this._size, mean: this._mean, sumOfSquaredDeviations: this._sumOfSquaredDeviations };
  }
}

/**
 * Returns the two-tailed critical value of the t-distribution at 95% confidence.
 */
function getCriticalValue(degreesOfFreedom: number): number {
  // Beyond the table, values decrease slowly from 1.98 to 1.96, so the last value is used
  return tTable[Math.min(degreesOfFreedom, tTable.length) - 1];
}

/**
 * Critical values of the t-distribution. The value at index i is for i + 1 degrees of freedom.
 */
// prettier-ignore
const tTable = [
  12.7100, 4.3030, 3.1820, 2.7760, 2.5710, 2.4470, 2.3650, 2.3060,
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
   1.9814, 1.9812, 1.9810, 1.9808, 1.9806, 1.9804, 1.9802, 1.9800,
];
