import rl from 'readline';
import { type InspectColor, styleText } from 'util';
import type { Block, Reporter } from '../runner.ts';
import { createFormatter, type TestColumnLine, type TextRole } from './createFormatter.ts';

/**
 * Colors and modifiers of text roles. They're applied only if the stream supports colors.
 */
const textRoleColors: Record<TextRole, InspectColor | InspectColor[]> = {
  column_name: 'dim',
  column_separator: 'dim',
  describe_name: 'bold',
  warmup_symbol: 'yellow',
  progress_symbol: 'dim',
  progress_percentage: 'dim',
  measure_index: 'gray', // For example, 2/5
  success_symbol: 'green',
  error_symbol: 'red',
  error_message: 'red',
  number_integer: 'yellow',
  number_fraction: ['dim', 'yellow'],
  not_available: 'dim',
  rme: 'dim',
  excessive_rme: 'red',
};

/**
 * Creates a reporter that prints test results.
 *
 * @param stream The stream to print to. Progress is redrawn in place, so it's printed only if the stream is a TTY.
 * Colors are used if the stream supports them.
 */
export function createStreamReporter(stream: NodeJS.WriteStream = process.stdout): Reporter {
  const formatter = createFormatter({
    applyStyle: (textRole, text) => styleText(textRoleColors[textRole], text, { stream }),
  });

  let testColumnWidth = 0;
  let hasMargin = false;

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

  function printError(errorMessage: string): void {
    clearLine();
    print(formatter.formatError(errorMessage) + '\n');

    hasMargin = true;
  }

  return {
    onTestModulesCollected(testModules) {
      const lines: TestColumnLine[] = [];

      for (const testModule of testModules) {
        getTestColumnLines(testModule.blocks, lines);
      }

      // Names of columns are printed only if there are lines to align to them, for example, a describe block that has
      // thrown and has no tests
      if (lines.length === 0) {
        return;
      }

      testColumnWidth = formatter.getTestColumnWidth(lines);

      print(formatter.formatHeader(testColumnWidth) + '\n');
    },

    onTestModuleStart(testModule) {
      if (testModule.errorMessage !== null) {
        printError(testModule.errorMessage);
      }
    },

    onTestModuleEnd() {},

    onDescribeStart(block) {
      print(formatter.formatEmptyLine(testColumnWidth) + '\n');

      print(formatter.formatDescribeStart({ depth: getDepth(block), name: block.name, testColumnWidth }) + '\n');

      hasMargin = false;

      if (block.errorMessage !== null) {
        printError(block.errorMessage);
      }
    },

    onDescribeEnd() {
      hasMargin = true;
    },

    onTestStart(block) {
      if (hasMargin) {
        print(formatter.formatEmptyLine(testColumnWidth) + '\n');
      }

      printStatus(formatter.formatTestStart({ depth: getDepth(block), testName: block.name, testColumnWidth }));

      hasMargin = false;
    },

    onWarmupStart(params) {
      const { block, measureIndex, measureCount } = params;

      printStatus(
        formatter.formatWarmupStart({
          depth: getDepth(block),
          testName: block.name,
          testColumnWidth,
          measureIndex,
          measureCount,
        })
      );
    },

    onProgress(params) {
      const { block, measureIndex, measureCount, percentage } = params;

      printStatus(
        formatter.formatProgress({
          depth: getDepth(block),
          testName: block.name,
          testColumnWidth,
          measureIndex,
          measureCount,
          percentage,
        })
      );
    },

    onTestEnd(params) {
      const { block, durationSummary, memorySummary, errorMessages } = params;

      clearLine();

      print(
        formatter.formatTestEnd({
          depth: getDepth(block),
          testName: block.name,
          testColumnWidth,
          isFailed: errorMessages.length !== 0,
          durationSummary,
          memorySummary,
        }) + '\n'
      );

      for (const errorMessage of errorMessages) {
        print(formatter.formatError(errorMessage) + '\n');
      }

      hasMargin = errorMessages.length !== 0;
    },

    onError(errorMessage) {
      printError(errorMessage);
    },
  };
}

/**
 * Returns the number of describe blocks that enclose the block.
 */
function getDepth(block: Block): number {
  // The path has an index for each enclosing describe block, and one for the block itself
  return block.path.length - 1;
}

/**
 * Returns lines that show names of describe blocks and tests in the test column, including those of nested blocks.
 *
 * @param blocks The blocks to show.
 * @param lines The array to which lines are added, and which is returned.
 */
function getTestColumnLines(blocks: readonly Block[], lines: TestColumnLine[] = []): TestColumnLine[] {
  for (const block of blocks) {
    lines.push({
      kind: block.kind,
      depth: getDepth(block),
      name: block.name,
    });

    if (block.kind === 'describe') {
      getTestColumnLines(block.children, lines);
    }
  }

  return lines;
}
