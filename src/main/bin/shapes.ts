import * as d from 'doubter';
import { ParseArgsOptions } from 'argcat';

export const testOptionsShape = d
  .object({
    measureTimeout: d.number().int().positive(),
    targetRme: d.number().gt(0).lt(1),
    warmupIterationCount: d.number().int().positive(),
    batchIterationCount: d.number().int().positive(),
    batchTimeout: d.number().int().positive(),
    batchIntermissionTimeout: d.number().int().positive(),
  })
  .partial();

export const configShape = d
  .object({
    testOptions: testOptionsShape,
    include: d.array(d.string()),
    setupMatch: d.array(d.string()),
    testMatch: d.array(d.string()),
  })
  .partial();

export const cliOptionsShape = testOptionsShape.extend({
  config: d.string().optional(),
  include: d.array(d.string()).optional(),
  setupMatch: d.array(d.string()).optional(),
  // testMatch
  '': d.array(d.string()),
});

export const cliParseArgsOptions: ParseArgsOptions = {
  shorthands: {
    c: 'config',
    i: 'include',
    t: 'testMatch',
  },
};
