import {cycle, ICycleOptions} from './cycle';
import {Histogram} from './Histogram';

export class Protocol {

  public promise = Promise.resolve();

// beforeEach
// afterEach
// beforeBatch
// afterBatch

  describe = (label: string, cb: () => void): void => {
    this.promise = this.promise.then(() => {
      console.log(label);
      cb();
    });
  };

  test = (label: string, cb: () => void, options?: ICycleOptions): void => {
    this.promise = this.promise.then(() => {
      const histogram = new Histogram();

      console.log(label);
      return cycle(cb, histogram, options).then(() => {
        console.log(histogram.hz + 'ops/sec');
      });
    });
  };
}
