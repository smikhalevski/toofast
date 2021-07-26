import {IHistogram} from './createHistogram';

export function formatHistogram(histogram: IHistogram): string {
  return `${formatNumber(histogram.getHz())} ops/sec ± ${formatNumber(histogram.getRme() * 100)}%`;
}

const reThousands = /(?=(?:\d{3})+$)(?!\b)/g;

export function formatNumber(x: number, fractionDigits = 2): string {
  const str = x.toFixed(fractionDigits);
  const i = str.indexOf('.');

  const integerPart = i !== -1 ? str.substr(0, i) : str;
  const decimalPart = i !== -1 ? str.substr(i + 1) : '';

  return integerPart.replace(reThousands, ',') + (decimalPart && '.' + decimalPart);
}
