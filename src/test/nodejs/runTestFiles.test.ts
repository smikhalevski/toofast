import { spawnSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, test } from 'vitest';
import { makeTestDirectory } from '../test-utils.ts';

const cliPath = path.resolve('lib/nodejs/cli.js');

// Test files import the package that is built before tests
const importToofast = `import { beforeWarmup, describe, measure, test } from ${JSON.stringify(pathToFileURL(path.resolve('lib/index.js')).href)};\n`;

// Colors must depend only on streams, and not on the environment of the test run
const env = { ...process.env };

delete env.FORCE_COLOR;
delete env.NO_COLOR;
delete env.NODE_DISABLE_COLORS;

function runToofast(cwd: string, args: string[] = [], nodeOptions: string[] = []) {
  return spawnSync(process.execPath, [...nodeOptions, cliPath, ...args], { cwd, env, encoding: 'utf8' });
}

describe('runTestFiles', () => {
  test('exits with 1 if a test throws and later tests pass', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts':
        importToofast +
        "describe('bbb', () => { test('ccc', () => { throw new Error('expected'); }); });" +
        "describe('ddd', () => { test('eee', () => {}); });",
      'fff.perf.ts': importToofast + "test('ggg', () => {});",

      // Files run in the order of patterns
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa.perf.ts', 'fff.perf.ts'] }),
    });

    const result = runToofast(directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ ccc');
    expect(result.stdout).toContain('✓ eee');
    expect(result.stdout).toContain('✓ ggg');
  });

  test('reports an error thrown by a describe block and runs other tests', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "describe('bbb', () => { throw new Error('expected'); }); test('ccc', () => {});",
    });

    const result = runToofast(directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('bbb\nError: expected');
    expect(result.stdout).toContain('✓ ccc');
  });

  test('exits with 1 if a test file throws', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': "throw new Error('expected');",
    });

    expect(runToofast(directory).status).toBe(1);
  });

  test('prints an error thrown by a test file after the path of the file', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': "throw new Error('expected');",
    });

    expect(runToofast(directory).stdout).toContain('Error: expected');
  });

  test('runs other test files if a test file throws', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': "throw new Error('expected');",
      'bbb.perf.ts': importToofast + "test('ccc', () => {});",
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa.perf.ts', 'bbb.perf.ts'] }),
    });

    expect(runToofast(directory).stdout).toContain('✓ ccc');
  });

  test('reports a test process that exits unexpectedly and runs other tests', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', () => { process.exit(0); }); test('ccc', () => {});",
    });

    const result = runToofast(directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ bbb');
    expect(result.stdout).toContain('Test process exited unexpectedly: 0');
    expect(result.stdout).toContain('✓ ccc');
  });

  test('reports an error that escapes a test', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', async () => { setTimeout(() => { throw new Error('expected'); }); await new Promise(resolve => setTimeout(resolve, 100)); });",
    });

    const result = runToofast(directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ bbb');
    expect(result.stdout).toContain('Error: expected');
  });

  test('prints n/a if the margin of error is unknown', () => {
    const directory = makeTestDirectory({
      // Each measure times out after its first batch
      'aaa.perf.ts':
        importToofast +
        "test('bbb', { measureTimeout: 1, maxWarmupBatchIterationCount: 0 }, () => { measure(() => {}); measure(() => {}); });",
    });

    expect(runToofast(directory).stdout).toMatch(/Hz +± n\/a/);
  });

  test('exits with 1 if no tests are found', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', () => {});",
    });

    // For example, a test name pattern has a typo
    const result = runToofast(directory, ['ccc']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('No tests found');
  });

  test('runs each test in a separate process', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', () => { globalThis.isTouched = true; });" +
        "test('ccc', () => { if (globalThis.isTouched === true) { throw new Error('unexpected'); } });",
    });

    expect(runToofast(directory).status).toBe(0);
  });

  test('imports setup files before test files', () => {
    const directory = makeTestDirectory({
      'aaa.ts': 'globalThis.isSetUp = true;',
      'bbb.perf.ts':
        importToofast + "if (globalThis.isSetUp !== true) { throw new Error('unexpected'); } test('ccc', () => {});",
      'toofast.json': JSON.stringify({ setupFilePatterns: ['aaa.ts'] }),
    });

    expect(runToofast(directory).status).toBe(0);
  });

  test('passes test options from the config file to tests', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', () => { beforeWarmup(() => { throw new Error('unexpected'); }); measure({ measureTimeout: 10, batchTimeout: 1, batchPauseDuration: 1 }, () => {}); });",

      // Warmup hooks don't run if warmup is disabled
      'toofast.json': JSON.stringify({ testOptions: { maxWarmupBatchIterationCount: 0 } }),
    });

    expect(runToofast(directory).status).toBe(0);
  });

  test('imports test files from a directory with # in its name', () => {
    const directory = makeTestDirectory({
      '#aaa/bbb.perf.ts': importToofast + "test('ccc', () => {});",
    });

    expect(runToofast(directory).status).toBe(0);
  });

  test('runs TypeScript test files', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', (): void => {});",
    });

    expect(runToofast(directory).status).toBe(0);
  });

  test('prints an invalid config without a stack trace', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testOptions: { measureTimeout: 0 } }),
    });

    const result = runToofast(directory);

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('measureTimeout must be a positive integer');
  });

  test('prints an invalid config without colors if stderr is not a terminal', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testOptions: { measureTimeout: 0 } }),
    });

    // Colors are supported by stdout, but not by stderr
    const result = runToofast(directory, [], ['--import', 'data:text/javascript,process.stdout.isTTY=true']);

    expect(result.stderr.trim()).toBe('measureTimeout must be a positive integer');
  });

  test('does not pass inspector options to test processes', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', () => {});",
    });

    // Test processes would fail to listen on the same port, which is reported but doesn't fail the run
    const result = runToofast(directory, [], ['--inspect=9229']);

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('address already in use');
  });

  test('strips types in test processes if the main process does not', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', (): void => {});",
    });

    expect(runToofast(directory, [], ['--no-experimental-strip-types']).status).toBe(0);
  });

  test('runs only tests which names match patterns', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts':
        importToofast +
        "describe('bbb', () => { test('ccc', () => {}); test('ddd', () => { throw new Error('unexpected'); }); });",
    });

    expect(runToofast(directory, ['BBB.c*']).status).toBe(0);
  });
});
