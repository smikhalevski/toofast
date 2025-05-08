import { Hook, SyncHook } from './types.js';

export function noop() {}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function callHooks(hooks: Hook[] | undefined): Promise<void> | undefined {
  if (hooks === undefined) {
    return;
  }

  let promise = Promise.resolve();

  for (const hook of hooks) {
    promise = promise.then(hook);
  }
  return promise;
}

export function combineHooks(hooks: Hook[] | undefined, hook: Hook | undefined): Hook | undefined {
  if (hooks === undefined && hook === undefined) {
    return;
  }
  return () => Promise.resolve(callHooks(hooks)).then(hook);
}

export function combineSyncHooks(hooks: SyncHook[] | undefined, hook: SyncHook | undefined): SyncHook | undefined {
  if (hooks === undefined) {
    return hook;
  }
  return () => {
    for (const hook of hooks) {
      hook();
    }
    hook?.();
  };
}
