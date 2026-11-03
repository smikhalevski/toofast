import fs from 'fs';
import os from 'os';
import path from 'path';
import { onTestFinished } from 'vitest';

/**
 * Creates a temporary directory that is removed after the current test.
 *
 * @param files The map from a file path relative to the directory to the file contents.
 * @returns The absolute path of the directory.
 */
export function makeTestDirectory(files: Record<string, string>): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toofast-'));

  onTestFinished(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(directory, file);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
  return directory;
}
