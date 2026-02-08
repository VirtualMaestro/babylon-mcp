import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  sanitizeWhereValue,
  buildWhereClause,
  resolveSecurePath,
} from './input-sanitizer.js';

describe('sanitizeWhereValue', () => {
  it('should return normal strings unchanged', () => {
    expect(sanitizeWhereValue('hello world')).toBe('hello world');
    expect(sanitizeWhereValue('api')).toBe('api');
    expect(sanitizeWhereValue('BabylonJS')).toBe('BabylonJS');
  });

  it('should escape single quotes by doubling them', () => {
    expect(sanitizeWhereValue("it's")).toBe("it''s");
  });

  it('should handle multiple single quotes', () => {
    expect(sanitizeWhereValue("a'b'c")).toBe("a''b''c");
  });

  it('should strip null bytes', () => {
    expect(sanitizeWhereValue('hello\0world')).toBe('helloworld');
    expect(sanitizeWhereValue('\0start')).toBe('start');
    expect(sanitizeWhereValue('end\0')).toBe('end');
  });

  it('should strip control characters', () => {
    expect(sanitizeWhereValue('hello\x01world')).toBe('helloworld');
    expect(sanitizeWhereValue('test\x0a\x0dvalue')).toBe('testvalue');
    expect(sanitizeWhereValue('\x1fprefix')).toBe('prefix');
  });

  it('should handle combined SQL injection attempts', () => {
    const input = "'; DROP TABLE docs; --";
    const result = sanitizeWhereValue(input);
    expect(result).toBe("''; DROP TABLE docs; --");
  });

  it('should return empty string unchanged', () => {
    expect(sanitizeWhereValue('')).toBe('');
  });

  it('should handle unicode strings correctly', () => {
    expect(sanitizeWhereValue('babylonjs')).toBe('babylonjs');
    expect(sanitizeWhereValue('hello world')).toBe('hello world');
  });
});

describe('buildWhereClause', () => {
  it('should build correct clause for simple values', () => {
    expect(buildWhereClause('category', 'api')).toBe("category = 'api'");
  });

  it('should escape values with single quotes', () => {
    expect(buildWhereClause('title', "it's here")).toBe(
      "title = 'it''s here'"
    );
  });

  it('should handle SQL injection attempts in values', () => {
    const result = buildWhereClause('name', "'; DROP TABLE docs; --");
    expect(result).toBe("name = '''; DROP TABLE docs; --'");
  });

  it('should work with different column names', () => {
    expect(buildWhereClause('type', 'class')).toBe("type = 'class'");
    expect(buildWhereClause('section', 'overview')).toBe(
      "section = 'overview'"
    );
  });
});

describe('resolveSecurePath', () => {
  const basePath = '/data/repos/docs';

  it('should return resolved path for valid relative paths', () => {
    const result = resolveSecurePath(basePath, 'packages/core/src/scene.ts');
    expect(result).toBe(
      path.resolve(basePath, 'packages/core/src/scene.ts')
    );
  });

  it('should return null for path traversal with ../', () => {
    const result = resolveSecurePath(basePath, '../../etc/passwd');
    expect(result).toBeNull();
  });

  it('should return null for deeply nested path traversal', () => {
    const result = resolveSecurePath(basePath, '../../../etc/shadow');
    expect(result).toBeNull();
  });

  it('should return null for paths containing null bytes', () => {
    const result = resolveSecurePath(basePath, 'valid\0path.ts');
    expect(result).toBeNull();
  });

  it('should return the base path itself when userPath is empty', () => {
    const result = resolveSecurePath(basePath, '');
    expect(result).toBe(path.resolve(basePath));
  });

  it('should return the base path itself when userPath is .', () => {
    const result = resolveSecurePath(basePath, '.');
    expect(result).toBe(path.resolve(basePath));
  });

  it('should reject absolute paths that escape the base directory', () => {
    const result = resolveSecurePath(basePath, '/etc/passwd');
    expect(result).toBeNull();
  });

  it('should work with deeply nested valid paths', () => {
    const deep = 'a/b/c/d/e/f/g.ts';
    const result = resolveSecurePath(basePath, deep);
    expect(result).toBe(path.resolve(basePath, deep));
  });
});
