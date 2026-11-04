import rl from 'readline';
import { type InspectColor, styleText } from 'util';
import type { WorkerEvent } from '../runner.ts';
import { createFormatter, type Style } from './createFormatter.ts';

/**
 * Colors and modifiers of text styles. They're applied only if the stream supports colors.
 */
const styleColors: Record<Style, InspectColor | InspectColor[]> = {
  describe_name: 'bold',
  warmup_symbol: 'yellow',
  progress_symbol: 'dim',
  progress_percentage: 'dim',
  measure_index: 'gray', // 2/5
  success_symbol: 'green',
  error_symbol: 'red',
  error_message: 'red',
  number_integer: 'yellow',
  number_fraction: ['dim', 'yellow'],
  not_available: 'dim',
  rme: 'dim',
};

export interface Reporter {
  /**
   * Prints the name of a describe block and indents the output that follows.
   */
  printDescribeStart(name: string): void;

  /**
   * Removes the indent of the describe block that was started last.
   */
  printDescribeEnd(): void;

  /**
   * Prints the pending status of a test.
   *
   * @param name The name of the test, padded to align results of sibling tests.
   */
  printTestStart(name: string): void;

  /**
   * Prints the progress or the result of the test that was started last.
   */
  printTestEvent(event: WorkerEvent): void;

  /**
   * Prints an error that doesn't belong to a test, for example, an error thrown by a describe block or a test file.
   */
  printError(errorMessage: string): void;
}

/**
 * Creates a reporter that prints test results.
 *
 * @param stream The stream to print to. Progress is redrawn in place, so it's printed only if the stream is a TTY.
 * Colors are used if the stream supports them.
 */
export function createStreamReporter(stream: NodeJS.WriteStream = process.stdout): Reporter {
  const formatter = createFormatter({
    applyStyle: (style, text) => styleText(styleColors[style], text, { stream }),
  });

  let depth = 0;
  let hasMargin = false;
  let testName = '';
  let testErrorMessages: string[] = [];

  function print(text: string): void {
    stream.write(text);
  }

  function clearLine(): void {
    if (stream.isTTY) {
      rl.clearLine(stream, 0);
      rl.cursorTo(stream, 0);
    }
  }

  function printStatus(text: string): void {
    if (stream.isTTY) {
      clearLine();
      print(text);
    }
  }

  return {
    printDescribeStart(name) {
      print('\n' + formatter.formatDescribeStart({ depth, name }) + '\n');

      hasMargin = false;
      ++depth;
    },

    printDescribeEnd() {
      hasMargin = true;
      --depth;
    },

    printTestStart(name) {
      testName = name;
      testErrorMessages = [];

      if (hasMargin) {
        print('\n');
      }
      printStatus(formatter.formatTestStart({ depth, testName }));

      hasMargin = false;
    },

    printTestEvent(event) {
      switch (event.type) {
        case 'warmup_started':
          printStatus(
            formatter.formatWarmupStarted({
              depth,
              testName,
              measureIndex: event.measureIndex,
              measureCount: event.measureCount,
            })
          );
          break;

        case 'progress_updated':
          printStatus(
            formatter.formatProgressUpdated({
              depth,
              testName,
              measureIndex: event.measureIndex,
              measureCount: event.measureCount,
              percentage: event.percentage,
            })
          );
          break;

        case 'error_caught':
          testErrorMessages.push(event.errorMessage);
          break;

        case 'test_ended':
          clearLine();
          print(
            formatter.formatTestEnded({
              depth,
              testName,
              isFailed: testErrorMessages.length !== 0,
              durationSummary: event.durationSummary,
              memorySummary: event.memorySummary,
            }) + '\n'
          );

          for (const errorMessage of testErrorMessages) {
            print(formatter.formatError(errorMessage) + '\n');
          }

          hasMargin = testErrorMessages.length !== 0;
          break;
      }
    },

    printError(errorMessage) {
      clearLine();
      print(formatter.formatError(errorMessage) + '\n');

      hasMargin = true;
    },
  };
}
