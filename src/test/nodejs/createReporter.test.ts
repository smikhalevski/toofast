import { PassThrough } from 'stream';
import { describe, expect, test } from 'vitest';
import { Histogram } from '../../main/Histogram.ts';
import { createReporter } from '../../main/nodejs/createReporter.ts';

describe('createReporter', () => {
  const snapshot = new Histogram().getSnapshot();

  test('prints status lines if the stream is a TTY', () => {
    const stream = Object.assign(new PassThrough(), { isTTY: true });
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });

    expect(String(stream.read()).match(/aaa/g)).toHaveLength(2);
  });

  test('prints only results if the stream is not a TTY', () => {
    const stream = new PassThrough();
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'warmup_started', measureIndex: 0, measureCount: 1 });
    reporter.printTestEvent({ type: 'progress_updated', measureIndex: 0, measureCount: 1, percentage: 0.5 });
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });

    expect(String(stream.read()).match(/aaa/g)).toHaveLength(1);
  });

  test('marks a passed test with ✓ and a failed test with ✗', () => {
    const stream = new PassThrough();
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });
    reporter.printTestStart('bbb');
    reporter.printTestEvent({ type: 'error_caught', errorMessage: 'expected' });
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });

    const output = String(stream.read());

    expect(output).toContain('✓ aaa');
    expect(output).toContain('✗ bbb');
  });

  test('prints progress as a bar', () => {
    const stream = Object.assign(new PassThrough(), { isTTY: true });
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'progress_updated', measureIndex: 0, measureCount: 1, percentage: 0.5 });

    expect(String(stream.read())).toContain('▅');
  });

  test('prints all errors of a test', () => {
    const stream = new PassThrough();
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'error_caught', errorMessage: 'bbb' });
    reporter.printTestEvent({ type: 'error_caught', errorMessage: 'ccc' });
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });

    expect(String(stream.read())).toMatch(/bbb[\s\S]*ccc/);
  });

  test('prints an unknown margin of error for a single sample', () => {
    const stream = new PassThrough();
    const reporter = createReporter(stream);
    const histogram = new Histogram();

    histogram.add(111);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({
      type: 'test_ended',
      durationSnapshot: histogram.getSnapshot(),
      memorySnapshot: snapshot,
    });

    expect(String(stream.read())).toContain('± ?');
  });

  test('prints a test error only with results of that test', () => {
    const stream = new PassThrough();
    const reporter = createReporter(stream);

    reporter.printTestStart('aaa');
    reporter.printTestEvent({ type: 'error_caught', errorMessage: 'expected' });
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });
    reporter.printTestStart('bbb');
    reporter.printTestEvent({ type: 'test_ended', durationSnapshot: snapshot, memorySnapshot: snapshot });

    expect(String(stream.read()).match(/expected/g)).toHaveLength(1);
  });
});
