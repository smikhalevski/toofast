/**
 * A uniform random sample of values in fixed memory, from which percentiles are estimated. The reservoir keeps every
 * value until it's full, so until then percentiles are exact. After that, a new value replaces a random kept value, so
 * every added value has the same chance to be kept.
 *
 * @see [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling)
 */
export class Reservoir {
  private _values: Float64Array;
  private _count = 0;
  private _isSorted = true;

  /**
   * @param capacity The maximum number of kept values.
   */
  constructor(capacity: number) {
    this._values = new Float64Array(capacity);
  }

  /**
   * The number of added values, including values that weren't kept.
   */
  get count(): number {
    return this._count;
  }

  /**
   * Adds a value to the sample.
   */
  add(value: number): void {
    // Once the reservoir is full, the value is kept with the chance of capacity / (count + 1)
    const index = this._count < this._values.length ? this._count : Math.floor(Math.random() * (this._count + 1));

    this._count++;

    if (index < this._values.length) {
      this._values[index] = value;
      this._isSorted = false;
    }
  }

  /**
   * Returns the percentile of kept values, interpolated linearly between the two nearest values, or `NaN` if there are
   * no values.
   *
   * @param percentile The percentile between `0` and `100`.
   * @see [Percentile](https://en.wikipedia.org/wiki/Percentile)
   */
  getPercentile(percentile: number): number {
    const values = this._values.subarray(0, Math.min(this._count, this._values.length));

    if (values.length === 0) {
      return NaN;
    }

    if (!this._isSorted) {
      values.sort();
      this._isSorted = true;
    }

    const rank = (percentile / 100) * (values.length - 1);
    const lowerValue = values[Math.floor(rank)];
    const upperValue = values[Math.ceil(rank)];

    return lowerValue + (upperValue - lowerValue) * (rank - Math.floor(rank));
  }
}

/**
 * Returns percentiles of reservoirs of measures of different callbacks. Each percentile is the mean of percentiles of
 * reservoirs. Reservoirs without values are skipped.
 *
 * Reservoirs have equal weights, like histograms in `summarizeHistograms`, so the gap between callbacks doesn't spread
 * percentiles apart.
 *
 * @param reservoirs Reservoirs of measures.
 * @param percentiles Percentiles between `0` and `100`.
 * @returns Values of percentiles in the same order, or `NaN` if no reservoir has values.
 */
export function summarizeReservoirs(reservoirs: readonly Reservoir[], percentiles: readonly number[]): number[] {
  return percentiles.map(percentile => {
    let reservoirCount = 0;
    let sumOfValues = 0;

    for (const reservoir of reservoirs) {
      if (reservoir.count === 0) {
        continue;
      }

      reservoirCount++;
      sumOfValues += reservoir.getPercentile(percentile);
    }

    return reservoirCount === 0 ? NaN : sumOfValues / reservoirCount;
  });
}
