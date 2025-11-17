import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Database from 'better-sqlite3';
import { parseTypeScript, indexFile, calculateContentHash, getSourceFiles } from '../core/indexer';
import { initializeGraphDatabase } from '../core/graph';

suite('Indexer Tests', () => {
  test('Parse TypeScript file', () => {
    const content = `
import { Foo } from './foo';
import * as Bar from './bar';

export class MyClass {
  method() {}
}

export interface MyInterface {
  prop: string;
}

export type MyType = string | number;

export enum MyEnum {
  A, B, C
}

export function myFunction() {}

export const MY_CONST = 42;
    `.trim();

    const result = parseTypeScript(content, 'test.ts');

    assert.strictEqual(result.symbols.length, 6);
    assert.ok(result.symbols.some(s => s.name === 'MyClass' && s.kind === 'class'));
    assert.ok(result.symbols.some(s => s.name === 'MyInterface' && s.kind === 'interface'));
    assert.ok(result.symbols.some(s => s.name === 'MyType' && s.kind === 'type'));
    assert.ok(result.symbols.some(s => s.name === 'MyEnum' && s.kind === 'enum'));
    assert.ok(result.symbols.some(s => s.name === 'myFunction' && s.kind === 'function'));
    assert.ok(result.symbols.some(s => s.name === 'MY_CONST' && s.kind === 'const'));

    assert.strictEqual(result.imports.length, 2);
    assert.ok(result.imports.some(i => i.source === './foo' && i.specifiers.includes('Foo')));
    assert.ok(result.imports.some(i => i.source === './bar' && i.specifiers.includes('Bar')));
  });

  test('Calculate content hash', () => {
    const content1 = 'Hello, World!';
    const content2 = 'Hello, World!';
    const content3 = 'Hello, Universe!';

    const hash1 = calculateContentHash(content1);
    const hash2 = calculateContentHash(content2);
    const hash3 = calculateContentHash(content3);

    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hash3);
  });

  test('Index file', async () => {
    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanodex-test-'));
    const testFile = path.join(tempDir, 'test.ts');

    fs.writeFileSync(
      testFile,
      `
export class TestClass {}
export function testFunction() {}
      `.trim()
    );

    // Create database
    const dbPath = path.join(tempDir, 'test.sqlite');
    const db = initializeGraphDatabase(dbPath);

    try {
      // Index the file
      await indexFile(testFile, tempDir, db);

      // Verify module node
      const moduleNode = db
        .prepare('SELECT * FROM nodes WHERE id = ?')
        .get('module:test.ts') as { id: string; name: string } | undefined;

      assert.ok(moduleNode);
      assert.strictEqual(moduleNode.name, 'test.ts');

      // Verify symbol nodes
      const symbols = db
        .prepare('SELECT * FROM nodes WHERE id LIKE ?')
        .all('symbol:test.ts:%') as Array<{ name: string }>;

      assert.strictEqual(symbols.length, 2);
      assert.ok(symbols.some(s => s.name === 'TestClass'));
      assert.ok(symbols.some(s => s.name === 'testFunction'));

      // Verify edges
      const edges = db
        .prepare('SELECT * FROM edges WHERE source_id = ?')
        .all('module:test.ts') as Array<{ target_id: string }>;

      assert.ok(edges.length >= 2);
    } finally {
      db.close();

      // Cleanup
      fs.unlinkSync(testFile);
      fs.unlinkSync(dbPath);
      if (fs.existsSync(`${dbPath}-wal`)) {
        fs.unlinkSync(`${dbPath}-wal`);
      }
      if (fs.existsSync(`${dbPath}-shm`)) {
        fs.unlinkSync(`${dbPath}-shm`);
      }
      fs.rmdirSync(tempDir);
    }
  });

  test('Skip unchanged files', async () => {
    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanodex-test-'));
    const testFile = path.join(tempDir, 'test.ts');

    fs.writeFileSync(testFile, 'export class Test {}');

    // Create database
    const dbPath = path.join(tempDir, 'test.sqlite');
    const db = initializeGraphDatabase(dbPath);

    try {
      // Index file first time
      await indexFile(testFile, tempDir, db);

      const initialCount = (
        db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }
      ).count;

      // Index again without changes
      await indexFile(testFile, tempDir, db);

      const afterCount = (
        db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }
      ).count;

      // Count should remain the same
      assert.strictEqual(initialCount, afterCount);
    } finally {
      db.close();

      // Cleanup
      fs.unlinkSync(testFile);
      fs.unlinkSync(dbPath);
      if (fs.existsSync(`${dbPath}-wal`)) {
        fs.unlinkSync(`${dbPath}-wal`);
      }
      if (fs.existsSync(`${dbPath}-shm`)) {
        fs.unlinkSync(`${dbPath}-shm`);
      }
      fs.rmdirSync(tempDir);
    }
  });

  test('Get source files with exclusions', () => {
    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanodex-test-'));

    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'node_modules'));

    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'src', 'test.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'lib.ts'), '');

    try {
      const files = getSourceFiles(tempDir, ['**/node_modules/**']);

      assert.strictEqual(files.length, 2);
      assert.ok(files.some(f => f.endsWith('index.ts')));
      assert.ok(files.some(f => f.endsWith('test.ts')));
      assert.ok(!files.some(f => f.includes('node_modules')));
    } finally {
      // Cleanup
      fs.unlinkSync(path.join(tempDir, 'src', 'index.ts'));
      fs.unlinkSync(path.join(tempDir, 'src', 'test.ts'));
      fs.unlinkSync(path.join(tempDir, 'node_modules', 'lib.ts'));
      fs.rmdirSync(path.join(tempDir, 'src'));
      fs.rmdirSync(path.join(tempDir, 'node_modules'));
      fs.rmdirSync(tempDir);
    }
  });
});
