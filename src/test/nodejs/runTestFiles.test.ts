import { spawnSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, test } from 'vitest';
import { getWorkerExecArgv } from '../../main/nodejs/runTestFiles.ts';
import { makeTestDir } from '../test-utils.ts';

const toofastPath = path.resolve('src/main/toofast.ts');

const importToofast = `import { beforeWarmup, describe, measure, test } from ${JSON.stringify(pathToFileURL(path.resolve('src/main/index.ts')).href)};\n`;

// Colors must depend only on streams, and not on the environment of the test run
const env = { ...process.env };

delete env.FORCE_COLOR;
delete env.NO_COLOR;
delete env.NODE_DISABLE_COLORS;

function runToofast(cwd: string, args: string[] = [], nodeOptions: string[] = []) {
  return spawnSync(process.execPath, [...nodeOptions, toofastPath, ...args], { cwd, env, encoding: 'utf8' });
}

describe('runTestFiles', () => {
  test('exits with 1 if a test throws and later tests pass', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "describe('bbb', () => { test('ccc', () => { throw new Error('expected'); }); });" +
        "describe('ddd', () => { test('eee', () => {}); });",
      'fff.perf.ts': importToofast + "test('ggg', () => {});",

      // Files run in the order of patterns
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa.perf.ts', 'fff.perf.ts'] }),
    });

    const result = runToofast(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ ccc');
    expect(result.stdout).toContain('✓ eee');
    expect(result.stdout).toContain('✓ ggg');
  });

  test('reports an error thrown by a describe block and runs other tests', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "describe('bbb', () => { throw new Error('expected'); }); test('ccc', () => {});",
    });

    const result = runToofast(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^bbb +│.*\nError: expected/m);
    expect(result.stdout).toContain('✓ ccc');
  });

  test('exits with 1 if a test file throws', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': "throw new Error('expected');",

      // Tests are found, so the exit code doesn't come from "No tests found"
      'bbb.perf.ts': importToofast + "test('ccc', () => {});",
    });

    expect(runToofast(dir).status).toBe(1);
  });

  test('prints an error thrown by a test file with its stack trace', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': "throw new Error('expected');",
    });

    // The stack trace shows which test file has thrown
    expect(runToofast(dir).stdout).toMatch(/Error: expected\n\s+at .*aaa\.perf\.ts/);
  });

  test('runs other test files if a test file throws', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': "throw new Error('expected');",
      'bbb.perf.ts': importToofast + "test('ccc', () => {});",
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa.perf.ts', 'bbb.perf.ts'] }),
    });

    expect(runToofast(dir).stdout).toContain('✓ ccc');
  });

  test('reports a worker that exits unexpectedly and runs other tests', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "test('bbb', () => { process.exit(0); }); test('ccc', () => {});",
    });

    const result = runToofast(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ bbb');
    expect(result.stdout).toContain('Test worker exited unexpectedly: 0');
    expect(result.stdout).toContain('✓ ccc');
  });

  test('reports an error that escapes a test', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', async () => { setTimeout(() => { throw new Error('expected'); }); await new Promise(resolve => setTimeout(resolve, 100)); });",
    });

    const result = runToofast(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✗ bbb');
    expect(result.stdout).toContain('Error: expected');
  });

  test('prints n/a if the margin of error is unknown', () => {
    const dir = makeTestDir({
      // Each measure times out after its first batch
      'aaa.perf.ts':
        importToofast +
        "test('bbb', { measureTimeout: 1, maxWarmupBatchIterationCount: 0 }, () => { measure(() => {}); measure(() => {}); });",
    });

    expect(runToofast(dir).stdout).toMatch(/Hz +± +n\/a/);
  });

  test('prints names of columns first, and aligns all tests and describe blocks of all test files', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', () => { throw new Error('expected'); }); describe('ccc', () => { test('dddd', () => { throw new Error('expected'); }); });",
      'eee.perf.ts': importToofast + "test('ffffffff', () => { throw new Error('expected'); });",
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa.perf.ts', 'eee.perf.ts'] }),
    });

    const lines = runToofast(dir).stdout.split('\n');

    // Tests throw, so nothing is measured, and error messages are printed without separators
    expect(lines[0]).toMatch(/^Test +│ Speed +│ Memory$/);
    expect(lines.filter(line => line.includes('│'))).toEqual([
      'Test       │ Speed               │ Memory',
      '✗ bbb      │    n/a              │    n/a            ',
      '           │                     │ ',
      'ccc        │                     │ ',
      '  ✗ dddd   │    n/a              │    n/a            ',
      '           │                     │ ',
      '✗ ffffffff │    n/a              │    n/a            ',
    ]);
  });

  test('prints durations in the unit from the config file', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "test('bbb', () => { throw new Error('expected'); });",
      'toofast.json': JSON.stringify({ durationUnit: 'second' }),
    });

    expect(runToofast(dir).stdout).toMatch(/^Test +│ Duration +│ Memory$/m);
  });

  test('exits with 1 if no tests are found', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "test('bbb', () => {});",
    });

    // For example, a test name pattern has a typo
    const result = runToofast(dir, ['ccc']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('No tests found');
  });

  test('runs each test in a separate process', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', () => { globalThis.isTouched = true; });" +
        "test('ccc', () => { if (globalThis.isTouched === true) { throw new Error('unexpected'); } });",
    });

    expect(runToofast(dir).status).toBe(0);
  });

  test('imports setup files before test files', () => {
    const dir = makeTestDir({
      'aaa.ts': 'globalThis.isSetUp = true;',
      'bbb.perf.ts':
        importToofast + "if (globalThis.isSetUp !== true) { throw new Error('unexpected'); } test('ccc', () => {});",
      'toofast.json': JSON.stringify({ setupFilePatterns: ['aaa.ts'] }),
    });

    expect(runToofast(dir).status).toBe(0);
  });

  test('passes test options from the config file to tests', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "test('bbb', () => { beforeWarmup(() => { throw new Error('unexpected'); }); measure({ measureTimeout: 10, batchTimeout: 1, batchPauseDuration: 1 }, () => {}); });",

      // Warmup hooks don't run if warmup is disabled
      'toofast.json': JSON.stringify({ testOptions: { maxWarmupBatchIterationCount: 0 } }),
    });

    expect(runToofast(dir).status).toBe(0);
  });

  test('imports test files from a directory with # in its name', () => {
    const dir = makeTestDir({
      '#aaa/bbb.perf.ts': importToofast + "test('ccc', () => {});",
    });

    expect(runToofast(dir).status).toBe(0);
  });

  test('runs TypeScript test files', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "test('bbb', (): void => {});",
    });

    expect(runToofast(dir).status).toBe(0);
  });

  test('prints an invalid config without a stack trace', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: { measureTimeout: 0 } }),
    });

    const result = runToofast(dir);

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('measureTimeout must be a positive integer');
  });

  test('prints an invalid config without colors if stderr is not a terminal', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: { measureTimeout: 0 } }),
    });

    // Colors are supported by stdout, but not by stderr
    const result = runToofast(dir, [], ['--import', 'data:text/javascript,process.stdout.isTTY=true']);

    expect(result.stderr.trim()).toBe('measureTimeout must be a positive integer');
  });

  test('does not pass inspector options to workers', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': importToofast + "test('bbb', () => {});",
    });

    // Workers would fail to listen on the same port, which is reported but doesn't fail the run
    const result = runToofast(dir, [], ['--inspect=9229']);

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('address already in use');
  });

  test('runs only tests whose names match patterns', () => {
    const dir = makeTestDir({
      'aaa.perf.ts':
        importToofast +
        "describe('bbb', () => { test('ccc', () => {}); test('ddd', () => { throw new Error('unexpected'); }); });",
    });

    expect(runToofast(dir, ['BBB.c*']).status).toBe(0);
  });
});

describe('getWorkerExecArgv', () => {
  test('enables type stripping in workers if the main process does not strip types', () => {
    expect(getWorkerExecArgv({ execArgv: [], isTypeStrippingEnabled: false })).toEqual([
      '--experimental-strip-types',
      '--no-warnings=ExperimentalWarning',
    ]);
  });
});
