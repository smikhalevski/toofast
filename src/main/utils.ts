import { HookCallback } from './index.js';

export function noop(): void {}

export function getErrorMessage(error: any): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function combineHooks(a: HookCallback | undefined, b: HookCallback | undefined): HookCallback | undefined {
  if (a === undefined || b === undefined) {
    return a || b;
  }
  return async () => {
    await a();
    await b();
  };
}
