import path from 'path';
import { describe, expect, test } from 'vitest';
import { resolveConfig } from '../../main/nodejs/resolveConfig.ts';
import { makeTestDirectory } from './test-utils.ts';

describe('resolveConfig', () => {
  test('accepts 0 warmup iterations in a config file', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testOptions: { maxWarmupBatchIterationCount: 0 } }),
    });

    const config = resolveConfig([], directory);

    expect(config.testOptions.maxWarmupBatchIterationCount).toBe(0);
  });

  test('does not include test files from node_modules', () => {
    const directory = makeTestDirectory({
      'aaa.perf.ts': '',
      'node_modules/bbb/ccc.perf.ts': '',
    });

    const config = resolveConfig([], directory);

    expect(config.testFiles).toEqual([path.join(directory, 'aaa.perf.ts')]);
  });

  test('resolves patterns from a config file relative to the config file', () => {
    const directory = makeTestDirectory({
      'aaa/toofast.json': JSON.stringify({ testFilePatterns: ['bbb/*.perf.ts'], setupFilePatterns: ['fff.ts'] }),
      'aaa/bbb/ccc.perf.ts': '',
      'aaa/ddd.perf.ts': '',
      'aaa/fff.ts': '',
      'bbb/eee.perf.ts': '',
      'fff.ts': '',
    });

    const config = resolveConfig(['--config', 'aaa/toofast.json'], directory);

    expect(config.testFiles).toEqual([path.join(directory, 'aaa/bbb/ccc.perf.ts')]);
    expect(config.setupFiles).toEqual([path.join(directory, 'aaa/fff.ts')]);
  });

  test('resolves default patterns relative to the config file', () => {
    const directory = makeTestDirectory({
      'aaa/toofast.json': '{}',
      'aaa/bbb.perf.ts': '',
      'ccc.perf.ts': '',
    });

    const config = resolveConfig(['--config', 'aaa/toofast.json'], directory);

    expect(config.testFiles).toEqual([path.join(directory, 'aaa/bbb.perf.ts')]);
  });

  test('throws if a config file from arguments does not exist', () => {
    const directory = makeTestDirectory({});

    expect(() => resolveConfig(['--config', 'aaa.json'], directory)).toThrow("Config file aaa.json doesn't exist");
  });

  test('throws if a config file is not valid JSON', () => {
    const directory = makeTestDirectory({
      'toofast.json': '{',
    });

    expect(() => resolveConfig([], directory)).toThrow("Config file toofast.json isn't valid JSON");
  });

  test('throws if a config file does not contain an object', () => {
    const directory = makeTestDirectory({
      'toofast.json': '[]',
    });

    expect(() => resolveConfig([], directory)).toThrow('Config file toofast.json must contain an object');
  });

  test('throws if a config file has an unknown option', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ aaa: 111 }),
    });

    expect(() => resolveConfig([], directory)).toThrow('Config file toofast.json has an unknown option: aaa');
  });

  test('throws if a config file has patterns that are not strings', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa', 111] }),
    });

    expect(() => resolveConfig([], directory)).toThrow('testFilePatterns in toofast.json must be an array of strings');
  });

  test('throws if a test option in a config file is a string', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testOptions: { targetRme: '0.5' } }),
    });

    expect(() => resolveConfig([], directory)).toThrow('targetRme must be greater than 0 and less than 1');
  });

  test('throws if a config file has an unknown test option', () => {
    const directory = makeTestDirectory({
      'toofast.json': JSON.stringify({ testOptions: { aaa: 111 } }),
    });

    expect(() => resolveConfig([], directory)).toThrow('Unknown test option: aaa');
  });

  test('throws if an argument is unknown', () => {
    const directory = makeTestDirectory({});

    expect(() => resolveConfig(['--aaa'], directory)).toThrow("Unknown option '--aaa'");
  });
});
