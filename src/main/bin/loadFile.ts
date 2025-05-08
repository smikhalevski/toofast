export function loadFile(filePath: string): Promise<any> {
  return new Promise(resolve => resolve(require(filePath)));
}
