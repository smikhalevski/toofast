/**
 * An add operation sum that significantly reduces the numerical error in the total obtained by adding a
 * sequence of finite-precision floating-point numbers.
 *
 * @see {@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm Kahan summation algorithm}
 */
export class Adder {
  /**
   * The accumulated sum.
   */
  private _sum = 0;

  /**
   * A running compensation for lost low-order bits.
   */
  private _compensation = 0;

  /**
   * The total sum of added measurements.
   */
  get sum(): number {
    return this._sum + this._compensation;
  }

  /**
   * Adds a new value to a sum.
   *
   * @param value The value to add.
   */
  add(value: number): void {
    const { _sum } = this;
    const sum = _sum + value;

    this._compensation += Math.abs(_sum) < Math.abs(value) ? value - sum + _sum : _sum - sum + value;
    this._sum = sum;
  }
}
