import { formatErrorResponse } from './response-formatters.js';

interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  [key: string]: unknown;
}

type HandlerFunction = (...args: any[]) => Promise<McpToolResponse>;

export function withErrorHandling<T extends HandlerFunction>(
  handler: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return formatErrorResponse(error, context);
    }
  }) as unknown as T;
}
