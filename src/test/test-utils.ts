import fs from 'fs';
import os from 'os';
import path from 'path';
import { onTestFinished } from 'vitest';
import { appendChild, createTestSuiteNode, type Node, setCurrentNode } from '../main/runner.ts';
import { noop } from '../main/utils.ts';

/**
 * Creates a test suite and makes it the node to which describe blocks, tests and hooks are added.
 */
export function makeTestSuite(): Node {
  const testSuite = createTestSuiteNode({});

  setCurrentNode(testSuite);
  return testSuite;
}

/**
 * Creates a test in a new test suite and makes it the node to which measures and hooks are added.
 */
export function makeTestNode(): Node {
  const testNode = appendChild(createTestSuiteNode({}), { kind: 'test', name: 'aaa', testOptions: {}, callback: noop });

  setCurrentNode(testNode);
  return testNode;
}

/**
 * Creates a temporary directory that is removed after the current test.
 *
 * @param files The map from a file path relative to the directory to the file contents.
 * @returns The absolute path of the directory.
 */
export function makeTestDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toofast-'));

  onTestFinished(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(dir, file);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
  return dir;
}
