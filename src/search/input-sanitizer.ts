/**
 * Input sanitization utilities for LanceDB queries and file path validation.
 * Prevents SQL injection in where() clauses and path traversal attacks.
 */
import path from 'path';

/**
 * Sanitize a string value for use in LanceDB SQL-like where() clauses.
 * Escapes single quotes by doubling them (standard SQL escaping)
 * and strips null bytes and control characters.
 */
export function sanitizeWhereValue(value: string): string {
  return value
    .replace(/\0/g, '')           // Strip null bytes
    .replace(/[\x01-\x1f]/g, '') // Strip control characters
    .replace(/'/g, "''");         // Escape single quotes (SQL standard)
}

/**
 * Build a safe where clause for LanceDB queries.
 * Uses sanitizeWhereValue to prevent injection.
 */
export function buildWhereClause(column: string, value: string): string {
  const sanitized = sanitizeWhereValue(value);
  return `${column} = '${sanitized}'`;
}

/**
 * Validate and resolve a file path, ensuring it stays within the allowed base directory.
 * Returns the resolved path if valid, or null if the path escapes the base directory.
 */
export function resolveSecurePath(basePath: string, userPath: string): string | null {
  if (userPath.includes('\0')) return null;

  const resolvedBase = path.resolve(basePath);
  const resolvedFull = path.resolve(basePath, userPath);

  if (!resolvedFull.startsWith(resolvedBase + '/') && resolvedFull !== resolvedBase) {
    return null;
  }

  return resolvedFull;
}
