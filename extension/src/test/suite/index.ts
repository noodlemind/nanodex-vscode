import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';
// import { glob } from 'glob'; // REMOVED: glob dependency causes packaging issues

/**
 * Recursively find all .test.js files
 */
function findTestFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findTestFiles(filePath, fileList);
    } else if (file.endsWith('.test.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname, '..');

  try {
    const files = findTestFiles(testsRoot);

    // Add files to the test suite
    files.forEach((f: string) => mocha.addFile(f));

    // Run the mocha test
    return new Promise<void>((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err as Error);
      }
    });
  } catch (err) {
    throw new Error(`Failed to find test files: ${err}`);
  }
}
