import { Hook } from './types.js';

export function noop() {}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callHooks(hooks: Hook[] | undefined): Promise<void> {
  if (hooks === undefined) {
    return;
  }
  for (const hook of hooks) {
    await hook();
  }
}

export function combineHooks(hooks: Hook[] | undefined, hook: Hook | undefined): Hook | undefined {
  if (hooks === undefined && hook === undefined) {
    return;
  }
  return () => Promise.resolve(callHooks(hooks)).then(hook);
}
