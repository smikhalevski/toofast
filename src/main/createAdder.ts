/**
 * An add operation accumulator.
 */
export interface IAdder {

  /**
   * The total sum of added measurements.
   */
  getResult(): number;

  /**
   * Add a new measurement.
   *
   * @param x The measurement value.
   */
  add(x: number): void;
}

/**
 * Creates a new {@link IAdder} that significantly reduces the numerical error in the total obtained by adding a
 * sequence of finite-precision floating-point numbers.
 *
 * @see {@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm Kahan summation algorithm on Wikipedia}
 */
export function createAdder(): IAdder {

  let result = 0;
  let c = 0;

  const getResult = () => result + c;

  const add = (x: number): void => {
    const t = result + x;
    c += Math.abs(result) < Math.abs(x) ? x - t + result : result - t + x;
    result = t;
  };

  return {
    getResult,
    add,
  };
}
