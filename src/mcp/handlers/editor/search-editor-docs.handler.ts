import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSearchInstance } from '../shared/search-instance.js';
import {
  formatJsonResponse,
  formatNoResultsResponse,
} from '../shared/response-formatters.js';
import { withErrorHandling } from '../shared/error-handlers.js';
import type { SearchResult } from '../../../search/types.js';

export function register(server: McpServer): void {
  server.registerTool(
    'search_babylon_editor_docs',
    {
      description:
        'Search Babylon.js Editor documentation for tool usage, workflows, and features',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe('Search query for Editor documentation'),
        category: z
          .string()
          .max(100)
          .optional()
          .describe(
            'Optional category filter (e.g., "scripting", "advanced", "tips")'
          ),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(5)
          .describe('Maximum number of results to return (default: 5)'),
      },
    },
    withErrorHandling(
      async ({ query, category, limit = 5 }) => {
        const search = await getSearchInstance();

        // Search with higher limit to ensure we get enough Editor results
        const searchLimit = category ? limit : limit * 3;
        const options = category ? { category: `editor/${category}`, limit: searchLimit } : { limit: searchLimit };
        const results = await search.search(query, options);

        // Filter to only Editor documentation (source = 'editor-docs')
        const editorResults = results
          .filter((r: SearchResult) => r.source === 'editor-docs')
          .slice(0, limit);

        if (editorResults.length === 0) {
          return formatNoResultsResponse(query, 'Editor documentation');
        }

        // Format results for better readability
        const formattedResults = editorResults.map((result: SearchResult, index: number) => ({
          rank: index + 1,
          title: result.title,
          description: result.description,
          url: result.url,
          category: result.category,
          relevance: (result.score * 100).toFixed(1) + '%',
          snippet: result.content,
          keywords: result.keywords,
        }));

        return formatJsonResponse({
          query,
          source: 'editor-docs',
          totalResults: editorResults.length,
          results: formattedResults,
        });
      },
      'searching Editor documentation'
    )
  );
}
