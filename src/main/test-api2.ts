import {cycle, ICycleOptions} from './cycle';
import {createHistogram} from './createHistogram';

let promise = Promise.resolve();

export function describe(label: string, cb: () => void) {
  promise = promise.then(() => {
    console.log(label);
    cb();
  });
}

export function test(label: string, cb: () => void, options?: ICycleOptions): void {
  promise = promise.then(() => {
    const histogram = createHistogram();

    console.log(label);
    return cycle(cb, histogram, options).then(() => {
      console.log(histogram.getHz() + 'ops/sec');
    });
  });
}
