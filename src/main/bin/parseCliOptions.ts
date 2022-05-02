/**
 * Parses CLI options from the list of CLI arguments.
 *
 * @param args CLI arguments retrieved by `process.argv.slice(2)`.
 * @param aliases Map from a shorthand
 */
export function parseCliOptions(args: string[], aliases?: Record<string, string | undefined>): Record<string, string[] | undefined> {
  const res: Record<string, string[] | undefined> = {};

  let optionKey: string | undefined = '';

  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];

    // Everything after -- is preserved as is
    if (arg === '--') {
      res['--'] = args.slice(i + 1);
      break;
    }

    // --foo as foo option if it is among aliases
    if (arg.startsWith('--')) {
      optionKey = arg.substring(2);
      res[optionKey] ||= [];
      continue;
    }

    // -abc is the same as -a -b -c
    if (arg.length !== 1 && arg.charAt(0) === '-') {

      // No aliases, no key
      if (!aliases) {
        optionKey = undefined;
        continue;
      }

      // Only known aliases are allowed
      for (const shorthand of arg.substring(1).split('')) {
        optionKey = aliases[shorthand];
        if (optionKey !== undefined) {
          res[optionKey] ||= [];
        }
      }
      continue;
    }

    if (optionKey === undefined) {
      optionKey = '';
      continue;
    }

    if (optionKey === '') {
      res[optionKey] ||= [];
    }

    res[optionKey]!.push(arg);
    optionKey = '';
  }

  return res;
}
