export function noop(): void {}

/**
 * Throws an error with the message if the condition is `false`. Unlike the Node.js assert module, works on any
 * platform.
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function getErrorStackOrMessage(error: any): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

export function getErrorMessage(error: any): string {
  return error instanceof Error ? error.message : String(error);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Returns `true` if the value is a number between `0` and `100`, inclusive.
 */
export function isPercentile(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

/**
 * Returns `true` if the value is an object, but not an array.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isObject(value) && typeof value.then === 'function';
}

export function isArrayOf<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Converts a glob pattern, where `*` matches any characters, to a case-insensitive RegExp that matches the whole
 * string.
 */
export function globToRegExp(pattern: string): RegExp {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
}
