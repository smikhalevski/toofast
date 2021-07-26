import {cycle, ICycleOptions} from './cycle';
import {createHistogram} from './createHistogram';
import readline from 'readline';
import {formatHistogram} from './format';

const stdout = process.stdout;

export function test(label: string, callback: () => void, options?: ICycleOptions): void {
  const histogram = createHistogram();

  stdout.write(label + ' ');

  cycle(callback, histogram, options);

  readline.cursorTo(stdout, 0);
  readline.clearLine(stdout, 0);
  stdout.write(`${label} ${formatHistogram(histogram)}\n`);
}

export function valueTest<T>(values: Array<T>, label: string, callback: (value: T) => void, options?: ICycleOptions): void {
  const valueCount = values.length;

  const histogram = createHistogram();

  stdout.write(label + ' ');

  for (let i = 0; i < valueCount; ++i) {
    const value = values[i];

    cycle(() => callback(value), histogram, options);

    if (i !== valueCount - 1) {
      readline.cursorTo(stdout, 0);
      readline.clearLine(stdout, 0);
      stdout.write(`${label} ${formatHistogram(histogram)} (${i + 1}/${valueCount})`);
    }
  }

  readline.cursorTo(stdout, 0);
  readline.clearLine(stdout, 0);
  stdout.write(`${label} ${formatHistogram(histogram)}\n`);
}
