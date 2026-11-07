#!/usr/bin/env node

import { styleText } from 'util';
import { createStreamReporter } from './nodejs/createStreamReporter.ts';
import { resolveConfig } from './nodejs/resolveConfig.ts';
import { runTestFiles } from './nodejs/runTestFiles.ts';
import { getErrorMessage } from './utils.ts';

try {
  const config = resolveConfig();

  await runTestFiles({
    config,
    reporter: createStreamReporter({ durationUnit: config.durationUnit }),
  });
} catch (error) {
  process.stderr.write(styleText('red', getErrorMessage(error), { stream: process.stderr }) + '\n');
  process.exit(1);
}
