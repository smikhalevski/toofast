#!/usr/bin/env node

import { styleText } from 'util';
import { getErrorMessage } from '../utils.ts';
import { createReporter } from './createReporter.ts';
import { resolveConfig } from './resolveConfig.ts';
import { runTestFiles } from './runTestFiles.ts';

try {
  await runTestFiles({
    config: resolveConfig(),
    reporter: createReporter(),
  });
} catch (error) {
  process.stderr.write(styleText('red', getErrorMessage(error), { stream: process.stderr }) + '\n');
  process.exit(1);
}
