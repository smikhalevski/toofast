/**
 * The mean of values in histograms with its margin of error, for example, the result of a test. Workers send summaries
 * to the main process.
 */
export interface HistogramSummary {
  /**
   * The number of values, or `0` if nothing was measured.
   */
  size: number;

  /**
   * The estimated mean.
   */
  mean: number;

  /**
   * The margin of error relative to the mean at 95% confidence, or `NaN` if it's unknown, for example, if nothing was
   * measured or a histogram has a single value.
   */
  rme: number;
}

export const emptyHistogramSummary: HistogramSummary = Object.freeze({
  size: 0,
  mean: 0,
  rme: NaN,
});

/**
 * Accumulates values of a sample and computes statistics without storing the values. Uses Welford's online algorithm,
 * which is numerically stable and never produces a negative variance.
 *
 * @see [Welford's online algorithm](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm)
 */
export class Histogram {
  private _size = 0;
  private _mean = 0;
  private _sumOfSquaredDeviations = 0;

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
   * The unbiased sample variance. The sum of squared deviations from the mean is divided by {@link size} - 1, because
   * the mean is estimated from the same sample.
   *
   * `NaN` if there are less than two values, since a single value doesn't show how much values vary.
   *
   * @see [Variance](https://en.wikipedia.org/wiki/Variance)
   */
  get variance(): number {
    return this._size < 2 ? NaN : this._sumOfSquaredDeviations / (this._size - 1);
  }

  /**
   * The standard deviation, the square root of {@link variance}, or `NaN` if there are less than two values.
   *
   * @see [Standard deviation](https://en.wikipedia.org/wiki/Standard_deviation)
   */
  get sd(): number {
    return Math.sqrt(this.variance);
  }

  /**
   * The standard error of the mean, {@link sd} divided by the square root of {@link size}, or `NaN` if there are less
   * than two values.
   *
   * @see [Standard error](https://en.wikipedia.org/wiki/Standard_error)
   */
  get sem(): number {
    return this.sd / Math.sqrt(this._size);
  }

  /**
   * The margin of error of the mean at 95% confidence, {@link sem} multiplied by the critical value of the
   * t-distribution, or `NaN` if there are less than two values.
   *
   * @see [Margin of error](https://en.wikipedia.org/wiki/Margin_of_error)
   */
  get moe(): number {
    return this.sem * getCriticalValue(this._size - 1);
  }

  /**
   * The margin of error relative to the mean, for example, `0.05` for ±5%, or `NaN` if there are less than two values.
   */
  get rme(): number {
    // All values are equal, so there's no error, even if the mean is 0
    return this.moe === 0 ? 0 : this.moe / this.mean;
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
}

/**
 * Summarizes histograms of measures of different callbacks, for example, into the result of a test.
 * {@link HistogramSummary.mean} is the mean of means of histograms. Histograms without values are skipped.
 *
 * Histograms have equal weights, since a noisy measure runs more batches but must not outweigh others. The gap between
 * means is the difference between callbacks, so only the noise within histograms adds to the margin of error. Don't
 * summarize histograms of the same callback this way: then the gap is noise too.
 *
 * {@link HistogramSummary.rme} is `NaN` if nothing was measured or a histogram has a single value.
 *
 * @see [Welch–Satterthwaite equation](https://en.wikipedia.org/wiki/Welch%E2%80%93Satterthwaite_equation)
 */
export function summarizeHistograms(histograms: readonly Histogram[]): HistogramSummary {
  let histogramCount = 0;
  let size = 0;
  let sumOfMeans = 0;
  let sumOfSquaredSems = 0;
  let welchDenominator = 0;

  for (const histogram of histograms) {
    // For example, the memory histogram of a measure that doesn't sample memory
    if (histogram.size === 0) {
      continue;
    }

    // NaN if the histogram has a single value, which makes the margin of error unknown
    const squaredSem = histogram.sem ** 2;

    histogramCount++;
    size += histogram.size;
    sumOfMeans += histogram.mean;
    sumOfSquaredSems += squaredSem;
    welchDenominator += squaredSem ** 2 / (histogram.size - 1);
  }

  if (histogramCount === 0) {
    return emptyHistogramSummary;
  }

  const mean = sumOfMeans / histogramCount;

  // Values within each histogram are equal, so there's no error
  if (sumOfSquaredSems === 0) {
    return {
      size,
      mean,
      rme: 0,
    };
  }

  // Welch–Satterthwaite equation. Rounding to an integer also absorbs rounding errors, such as 6.999… for 7.
  const degreesOfFreedom = Math.round(sumOfSquaredSems ** 2 / welchDenominator);
  const moe = (Math.sqrt(sumOfSquaredSems) / histogramCount) * getCriticalValue(degreesOfFreedom);

  return {
    size,
    mean,
    rme: moe / mean,
  };
}

/**
 * Returns the two-tailed critical value of the t-distribution at 95% confidence, or `NaN` if there are no degrees of
 * freedom.
 *
 * @param degreesOfFreedom An integer.
 */
function getCriticalValue(degreesOfFreedom: number): number {
  // Beyond the table, values decrease slowly from 1.98 to 1.96, so the last value is used
  return tTable[Math.min(degreesOfFreedom, tTable.length) - 1] ?? NaN;
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
