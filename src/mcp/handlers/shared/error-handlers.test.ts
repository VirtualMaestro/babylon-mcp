import { describe, it, expect } from 'vitest';
import { withErrorHandling } from './error-handlers.js';

type McpResult = { content: Array<{ type: 'text'; text: string }> };

const mcpResponse = (text: string): McpResult => ({
  content: [{ type: 'text' as const, text }],
});

const throwingHandler = (error: unknown) =>
  async (_args: Record<string, unknown>): Promise<McpResult> => {
    throw error;
  };

describe('Error Handlers', () => {
  describe('withErrorHandling', () => {
    it('should return result when handler succeeds', async () => {
      const handler = async (args: Record<string, unknown>) =>
        mcpResponse(String(Number(args['value']) * 2));
      const wrappedHandler = withErrorHandling(handler, 'testing');

      const result = await wrappedHandler({ value: 5 });

      expect(result.content[0]!.text).toBe('10');
    });

    it('should catch and format errors when handler throws', async () => {
      const wrappedHandler = withErrorHandling(
        throwingHandler(new Error('Test error')),
        'processing data'
      );

      const result = await wrappedHandler({});

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]!.text).toContain('Error processing data');
      expect(result.content[0]!.text).toContain('Test error');
    });

    it('should handle string errors', async () => {
      const wrappedHandler = withErrorHandling(
        throwingHandler('String error message'),
        'fetching'
      );

      const result = await wrappedHandler({});

      expect(result.content[0]!.text).toContain('Error fetching');
      expect(result.content[0]!.text).toContain('String error message');
    });

    it('should handle non-Error objects', async () => {
      const wrappedHandler = withErrorHandling(
        throwingHandler({ code: 500, message: 'Server error' }),
        'API call'
      );

      const result = await wrappedHandler({});

      expect(result.content[0]!.text).toContain('Error API call');
    });

    it('should pass through handler arguments', async () => {
      const handler = async (args: Record<string, unknown>) =>
        mcpResponse(JSON.stringify(args));
      const wrappedHandler = withErrorHandling(handler, 'testing');

      const result = await wrappedHandler({ a: 42, b: 'test', c: true });

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed).toEqual({ a: 42, b: 'test', c: true });
    });

    it('should handle async errors in promise rejections', async () => {
      const handler = async (_args: Record<string, unknown>): Promise<McpResult> => {
        return Promise.reject(new Error('Async rejection'));
      };
      const wrappedHandler = withErrorHandling(handler, 'async operation');

      const result = await wrappedHandler({});

      expect(result.content[0]!.text).toContain('Error async operation');
      expect(result.content[0]!.text).toContain('Async rejection');
    });
  });
});
