/**
 * An add operation accumulator that significantly reduces the numerical error in the total obtained by adding a
 * sequence of finite-precision floating-point numbers.
 *
 * @see {@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm Kahan summation algorithm on Wikipedia}
 */
export class Adder {
  private _sum = 0;
  private _c = 0;

  /**
   * The total sum of added measurements.
   */
  getSum(): number {
    return this._sum + this._c;
  }

  /**
   * Adds a new measurement.
   *
   * @param x The measurement value.
   */
  add(x: number): void {
    const { _sum } = this;
    const sum = _sum + x;

    this._c += Math.abs(_sum) < Math.abs(x) ? x - sum + _sum : _sum - sum + x;
    this._sum = sum;
  }
}
