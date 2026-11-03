import { execFileSync, spawnSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
import { beforeAll, describe, expect, test } from 'vitest';
import { makeTestDirectory } from './test-utils.ts';

const cliPath = path.resolve('lib/nodejs/cli.ts');

// Test files import the package that is built before tests
const importToofast = `import { describe, test } from ${JSON.stringify(pathToFileURL(path.resolve('lib/index.ts')).href)};\n`;

beforeAll(() => {
  execFileSync(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'), '--project', 'tsconfig.build.json']);
}, 60_000);

function runToofast(cwd: string, args: string[] = [], nodeOptions: string[] = []) {
  return spawnSync(process.execPath, [...nodeOptions, cliPath, ...args], { cwd, encoding: 'utf8' });
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

    expect(runToofast(directory).status).toBe(1);
  });

  test('exits with 1 if a describe block throws', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "describe('bbb', () => { throw new Error('expected'); });",
    });

    expect(runToofast(directory).status).toBe(1);
  });

  test('exits with 1 if a test file throws', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': "throw new Error('expected');",
    });

    expect(runToofast(directory).status).toBe(1);
  });

  test('prints an error thrown by a test file', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': "throw new Error('expected');",
    });

    expect(runToofast(directory).stdout).toContain('Error: expected');
  });

  test('exits with 1 if a test process exits unexpectedly', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': importToofast + "test('bbb', () => { process.exit(0); });",
    });

    expect(runToofast(directory).status).toBe(1);
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
    expect(runToofast(directory, [], ['--inspect=9229']).stderr).not.toContain('address already in use');
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
