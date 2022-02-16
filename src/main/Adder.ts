/**
 * An add operation accumulator that significantly reduces the numerical error in the total obtained by adding a
 * sequence of finite-precision floating-point numbers.
 *
 * @see {@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm Kahan summation algorithm on Wikipedia}
 */
export class Adder {

  private _result = 0;
  private _c = 0;

  /**
   * The total sum of added measurements.
   */
  public get sum(): number {
    return this._result + this._c;
  }

  /**
   * Adds a new measurement.
   *
   * @param x The measurement value.
   */
  public add(x: number): void {
    const {_result} = this;
    const t = _result + x;

    this._c += Math.abs(_result) < Math.abs(x) ? x - t + _result : _result - t + x;
    this._result = t;
  }
}
