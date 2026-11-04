import path from 'path';
import { describe, expect, test } from 'vitest';
import { resolveConfig } from '../../main/nodejs/resolveConfig.ts';
import { makeTestDir } from '../test-utils.ts';

describe('resolveConfig', () => {
  test('accepts $schema in a config file', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ $schema: './node_modules/toofast/config_schema.json' }),
    });

    expect(() => resolveConfig([], dir)).not.toThrow();
  });

  test('accepts 0 warmup iterations in a config file', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: { maxWarmupBatchIterationCount: 0 } }),
    });

    const config = resolveConfig([], dir);

    expect(config.testOptions.maxWarmupBatchIterationCount).toBe(0);
  });

  test('does not include test files from node_modules', () => {
    const dir = makeTestDir({
      'aaa.perf.ts': '',
      'node_modules/bbb/ccc.perf.ts': '',
    });

    const config = resolveConfig([], dir);

    expect(config.testFiles).toEqual([path.join(dir, 'aaa.perf.ts')]);
  });

  test('resolves patterns from a config file relative to the config file', () => {
    const dir = makeTestDir({
      'aaa/toofast.json': JSON.stringify({ testFilePatterns: ['bbb/*.perf.ts'], setupFilePatterns: ['fff.ts'] }),
      'aaa/bbb/ccc.perf.ts': '',
      'aaa/ddd.perf.ts': '',
      'aaa/fff.ts': '',
      'bbb/eee.perf.ts': '',
      'fff.ts': '',
    });

    const config = resolveConfig(['--config', 'aaa/toofast.json'], dir);

    expect(config.testFiles).toEqual([path.join(dir, 'aaa/bbb/ccc.perf.ts')]);
    expect(config.setupFiles).toEqual([path.join(dir, 'aaa/fff.ts')]);
  });

  test('resolves default patterns relative to the config file', () => {
    const dir = makeTestDir({
      'aaa/toofast.json': '{}',
      'aaa/bbb.perf.ts': '',
      'ccc.perf.ts': '',
    });

    const config = resolveConfig(['--config', 'aaa/toofast.json'], dir);

    expect(config.testFiles).toEqual([path.join(dir, 'aaa/bbb.perf.ts')]);
  });

  test('throws if a config file from arguments does not exist', () => {
    const dir = makeTestDir({});

    expect(() => resolveConfig(['--config', 'aaa.json'], dir)).toThrow("Config file doesn't exist: aaa.json");
  });

  test('throws if a config file is not valid JSON', () => {
    const dir = makeTestDir({
      'toofast.json': '{',
    });

    expect(() => resolveConfig([], dir)).toThrow('Cannot parse config: toofast.json');
  });

  test('throws if a config file does not contain an object', () => {
    const dir = makeTestDir({
      'toofast.json': '[]',
    });

    expect(() => resolveConfig([], dir)).toThrow('Config file must export an object: toofast.json');
  });

  test('throws if a config file has an unknown option', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ aaa: 111 }),
    });

    expect(() => resolveConfig([], dir)).toThrow('Unknown config option: aaa');
  });

  test('throws if a config file has test file patterns that are not strings', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testFilePatterns: ['aaa', 111] }),
    });

    expect(() => resolveConfig([], dir)).toThrow('testFilePatterns must be an array of strings');
  });

  test('throws if a config file has setup file patterns that are not strings', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ setupFilePatterns: [111] }),
    });

    expect(() => resolveConfig([], dir)).toThrow('setupFilePatterns must be an array of strings');
  });

  test('throws if test options in a config file are not an object', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: 111 }),
    });

    expect(() => resolveConfig([], dir)).toThrow('testOptions must be an object');
  });

  test('throws if a test option in a config file is a string', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: { targetRme: '0.5' } }),
    });

    expect(() => resolveConfig([], dir)).toThrow('targetRme must be greater than 0 and less than 1');
  });

  test('throws if a config file has an unknown test option', () => {
    const dir = makeTestDir({
      'toofast.json': JSON.stringify({ testOptions: { aaa: 111 } }),
    });

    expect(() => resolveConfig([], dir)).toThrow('Unknown test option: aaa');
  });

  test('throws if an argument is unknown', () => {
    const dir = makeTestDir({});

    expect(() => resolveConfig(['--aaa'], dir)).toThrow("Unknown option '--aaa'");
  });
});
