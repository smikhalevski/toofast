import {Adder} from '../main';

describe('Adder', () => {

  test('reduces the error', () => {
    const adder = new Adder();

    adder.add(0.1);
    adder.add(0.2);
    adder.add(0.3);
    adder.add(0.4);
    adder.add(0.5);
    adder.add(0.6);
    adder.add(0.7);
    adder.add(0.8);
    adder.add(0.9);
    adder.add(1.0);
    adder.add(1.1);
    adder.add(1.2);
    adder.add(1.3);
    adder.add(1.4);
    adder.add(1.5);
    adder.add(1.6);
    adder.add(1.7);

    const naiveResult = 0.1 + 0.2 + 0.3 + 0.4 + 0.5 + 0.6 + 0.7 + 0.8 + 0.9 + 1.0 + 1.1 + 1.2 + 1.3 + 1.4 + 1.5 + 1.6 + 1.7;

    expect(naiveResult).toBe(15.299999999999999);
    expect(adder.sum).toBe(15.3);
  });
});
