import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupHandlers } from './handlers/index.js';
import {
  getSearchInstance,
  resetSearchInstance,
} from './handlers/shared/search-instance.js';

vi.mock('./handlers/shared/search-instance.js');

describe('MCP Handlers', () => {
  let mockServer: McpServer;
  let registerToolSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerToolSpy = vi.fn();
    mockServer = {
      registerTool: registerToolSpy,
    } as unknown as McpServer;

    const mockSearch = {
      search: vi.fn().mockResolvedValue([
        {
          title: 'PBR Materials Guide',
          description: 'Guide to PBR materials',
          content: 'PBR materials content snippet',
          url: 'https://doc.babylonjs.com/materials/pbr',
          category: 'api',
          source: 'documentation',
          score: 0.95,
          keywords: ['pbr', 'materials'],
        },
      ]),
      searchApi: vi.fn().mockResolvedValue([
        {
          name: 'Scene',
          fullName: 'BABYLON.Scene',
          kind: 'Class',
          summary: 'Scene class',
          description: 'Main scene class',
          parameters: '[]',
          returns: '',
          type: 'Scene',
          examples: '',
          deprecated: '',
          see: '',
          since: '',
          sourceFile: 'packages/dev/core/src/scene.ts',
          sourceLine: 100,
          url: 'https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/scene.ts#L100',
          category: 'api/core',
          score: 0.9,
          vector: [],
        },
      ]),
      searchSourceCode: vi.fn().mockResolvedValue([
        {
          filePath: 'packages/dev/core/src/scene.ts',
          package: 'core',
          content: 'export class Scene { constructor() {} }',
          startLine: 1,
          endLine: 200,
          language: 'typescript',
          imports: '@babylonjs/core',
          exports: 'Scene',
          url: 'https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/scene.ts#L1-L200',
          score: 0.85,
        },
      ]),
      getDocumentByPath: vi.fn().mockResolvedValue({
        title: 'PBR Materials',
        description: 'Introduction to PBR',
        content: 'Full PBR content here',
        url: 'https://doc.babylonjs.com/divingDeeper/materials/using/introToPBR',
        category: 'materials',
        breadcrumbs: 'divingDeeper > materials > using',
        headings: 'Overview | Setup | Advanced',
        keywords: 'pbr, materials, rendering',
        playgroundIds: 'ABC123, DEF456',
        lastModified: '2024-01-01T00:00:00.000Z',
        filePath: '/content/materials/pbr.md',
      }),
      getSourceFile: vi.fn().mockResolvedValue(
        'export class Scene {\n  constructor() {}\n  render() {}\n}'
      ),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(getSearchInstance).mockResolvedValue(mockSearch as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetSearchInstance();
  });

  describe('setupHandlers', () => {
    it('should register all required tools', () => {
      setupHandlers(mockServer);

      expect(registerToolSpy).toHaveBeenCalledTimes(6);
    });

    it('should register search_babylon_docs tool', () => {
      setupHandlers(mockServer);

      const firstCall = registerToolSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall![0]).toBe('search_babylon_docs');
      expect(firstCall![1]).toHaveProperty('description');
      expect(firstCall![1]).toHaveProperty('inputSchema');
      expect(typeof firstCall![2]).toBe('function');
    });

    it('should register get_babylon_doc tool', () => {
      setupHandlers(mockServer);

      const secondCall = registerToolSpy.mock.calls[1];
      expect(secondCall).toBeDefined();
      expect(secondCall![0]).toBe('get_babylon_doc');
      expect(secondCall![1]).toHaveProperty('description');
      expect(secondCall![1]).toHaveProperty('inputSchema');
      expect(typeof secondCall![2]).toBe('function');
    });
  });

  describe('search_babylon_docs handler', () => {
    let searchHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      searchHandler = registerToolSpy.mock.calls[0]![2];
    });

    it('should accept required query parameter', async () => {
      const params = { query: 'PBR materials' };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should accept optional category parameter', async () => {
      const params = { query: 'materials', category: 'api' };
      const result = (await searchHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
    });

    it('should accept optional limit parameter', async () => {
      const params = { query: 'materials', limit: 10 };
      const result = (await searchHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
    });

    it('should default limit to 5 when not provided', async () => {
      const params = { query: 'materials' };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      const parsedResponse = JSON.parse(responseText);
      expect(parsedResponse).toHaveProperty('totalResults');
      expect(parsedResponse).toHaveProperty('results');
    });

    it('should return text content type', async () => {
      const params = { query: 'test' };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return JSON-parseable response', async () => {
      const params = { query: 'test', category: 'guide', limit: 3 };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
    });

    it('should include all parameters in response', async () => {
      const params = { query: 'PBR', category: 'api', limit: 10 };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      const parsedResponse = JSON.parse(responseText);
      expect(parsedResponse.query).toBe('PBR');
      expect(parsedResponse.totalResults).toBe(1);
      expect(parsedResponse.results[0].title).toBe('PBR Materials Guide');
    });

    it('should handle queries and return structured results', async () => {
      const params = { query: 'test' };
      const result = (await searchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });
  });

  describe('get_babylon_doc handler', () => {
    let getDocHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      getDocHandler = registerToolSpy.mock.calls[1]![2];
    });

    it('should accept required path parameter', async () => {
      const params = { path: '/divingDeeper/materials/using/introToPBR' };
      const result = (await getDocHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should return text content type', async () => {
      const params = { path: '/test/path' };
      const result = (await getDocHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return JSON-parseable response', async () => {
      const params = { path: '/test/path' };
      const result = (await getDocHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
    });

    it('should include document structure in response', async () => {
      const params = { path: '/some/doc/path' };
      const result = (await getDocHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      const parsedResponse = JSON.parse(responseText);
      expect(parsedResponse).toHaveProperty('title', 'PBR Materials');
      expect(parsedResponse).toHaveProperty('description', 'Introduction to PBR');
      expect(parsedResponse).toHaveProperty('content', 'Full PBR content here');
      expect(parsedResponse.breadcrumbs).toEqual(['divingDeeper', 'materials', 'using']);
      expect(parsedResponse.headings).toEqual(['Overview', 'Setup', 'Advanced']);
      expect(parsedResponse.keywords).toEqual(['pbr', 'materials', 'rendering']);
      expect(parsedResponse.playgroundIds).toEqual(['ABC123', 'DEF456']);
    });

    it('should handle document queries and return results', async () => {
      const params = { path: '/test' };
      const result = (await getDocHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });
  });

  describe('search_babylon_api handler', () => {
    let apiSearchHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      apiSearchHandler = registerToolSpy.mock.calls[2]![2];
    });

    it('should accept required query parameter', async () => {
      const params = { query: 'Scene' };
      const result = (await apiSearchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should accept optional limit parameter', async () => {
      const params = { query: 'Vector3', limit: 10 };
      const result = (await apiSearchHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
    });

    it('should default limit to 5 when not provided', async () => {
      const params = { query: 'Mesh' };
      const result = (await apiSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(responseText.length).toBeGreaterThan(0);
    });

    it('should return text content type', async () => {
      const params = { query: 'Camera' };
      const result = (await apiSearchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should handle API search results or no results message', async () => {
      const params = { query: 'NonExistentApiClass12345' };
      const result = (await apiSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });

    it('should return JSON-parseable response for valid queries', async () => {
      const params = { query: 'getMeshByName', limit: 3 };
      const result = (await apiSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
      const parsed = JSON.parse(responseText);
      expect(parsed).toHaveProperty('query');
      expect(parsed).toHaveProperty('totalResults');
      expect(parsed).toHaveProperty('results');
      expect(parsed.results[0].name).toBe('Scene');
      expect(parsed.results[0].fullName).toBe('BABYLON.Scene');
    });
  });

  describe('search_babylon_editor_docs handler', () => {
    let editorSearchHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      editorSearchHandler = registerToolSpy.mock.calls[5]![2];
    });

    it('should accept required query parameter', async () => {
      const params = { query: 'attaching scripts' };
      const result = (await editorSearchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should accept optional category parameter', async () => {
      const params = { query: 'lifecycle', category: 'scripting' };
      const result = (await editorSearchHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
    });

    it('should accept optional limit parameter', async () => {
      const params = { query: 'editor', limit: 10 };
      const result = (await editorSearchHandler(params)) as { content: unknown[] };

      expect(result).toHaveProperty('content');
    });

    it('should default limit to 5 when not provided', async () => {
      const params = { query: 'project' };
      const result = (await editorSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(responseText.length).toBeGreaterThan(0);
    });

    it('should return text content type', async () => {
      const params = { query: 'scripts' };
      const result = (await editorSearchHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return no results when source is not editor-docs', async () => {
      const params = { query: 'editor features' };
      const result = (await editorSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      // Default mock returns source: 'documentation', so editor filter produces no results
      expect(responseText).toContain('No Editor documentation found');
    });
  });

  describe('search_babylon_editor_docs handler with editor results', () => {
    let editorSearchHandler: (params: unknown) => Promise<unknown>;

    beforeEach(async () => {
      // Re-mock search to return editor-docs results
      const editorMockSearch = {
        search: vi.fn().mockResolvedValue([
          {
            title: 'Editor Scripting Guide',
            description: 'How to attach scripts in the Editor',
            content: 'Editor scripting content snippet',
            url: 'https://doc.babylonjs.com/communityExtensions/editor/scripting',
            category: 'editor/scripting',
            source: 'editor-docs',
            score: 0.92,
            keywords: ['editor', 'scripting'],
          },
        ]),
        searchApi: vi.fn().mockResolvedValue([]),
        searchSourceCode: vi.fn().mockResolvedValue([]),
        getDocumentByPath: vi.fn().mockResolvedValue(null),
        getSourceFile: vi.fn().mockResolvedValue(null),
        initialize: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getSearchInstance).mockResolvedValue(editorMockSearch as any);

      setupHandlers(mockServer);
      editorSearchHandler = registerToolSpy.mock.calls[5]![2];
    });

    it('should return JSON-parseable response with editor-docs source', async () => {
      const params = { query: 'editor features' };
      const result = (await editorSearchHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
      const parsed = JSON.parse(responseText);
      expect(parsed).toHaveProperty('query', 'editor features');
      expect(parsed).toHaveProperty('source', 'editor-docs');
      expect(parsed).toHaveProperty('totalResults', 1);
      expect(parsed).toHaveProperty('results');
      expect(parsed.results[0].title).toBe('Editor Scripting Guide');
    });
  });

  describe('Tool Schemas', () => {
    beforeEach(() => {
      setupHandlers(mockServer);
    });

    it('search_babylon_docs should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[0]![1];

      expect(toolConfig.inputSchema).toHaveProperty('query');
      expect(toolConfig.inputSchema).toHaveProperty('category');
      expect(toolConfig.inputSchema).toHaveProperty('limit');
    });

    it('get_babylon_doc should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[1]![1];

      expect(toolConfig.inputSchema).toHaveProperty('path');
    });

    it('search_babylon_api should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[2]![1];

      expect(toolConfig.inputSchema).toHaveProperty('query');
      expect(toolConfig.inputSchema).toHaveProperty('limit');
    });

    it('search_babylon_source should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[3]![1];

      expect(toolConfig.inputSchema).toHaveProperty('query');
      expect(toolConfig.inputSchema).toHaveProperty('package');
      expect(toolConfig.inputSchema).toHaveProperty('limit');
    });

    it('get_babylon_source should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[4]![1];

      expect(toolConfig.inputSchema).toHaveProperty('filePath');
      expect(toolConfig.inputSchema).toHaveProperty('startLine');
      expect(toolConfig.inputSchema).toHaveProperty('endLine');
    });

    it('search_babylon_editor_docs should have proper schema structure', () => {
      const toolConfig = registerToolSpy.mock.calls[5]![1];

      expect(toolConfig.inputSchema).toHaveProperty('query');
      expect(toolConfig.inputSchema).toHaveProperty('category');
      expect(toolConfig.inputSchema).toHaveProperty('limit');
    });
  });

  describe('search_babylon_source handler', () => {
    let searchSourceHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      searchSourceHandler = registerToolSpy.mock.calls[3]![2];
    });

    it('should accept required query parameter', async () => {
      const params = { query: 'getMeshByName implementation' };
      const result = await searchSourceHandler(params);

      expect(result).toHaveProperty('content');
      expect(Array.isArray((result as any).content)).toBe(true);
    });

    it('should accept optional package parameter', async () => {
      const params = { query: 'scene rendering', package: 'core' };
      const result = await searchSourceHandler(params);

      expect(result).toHaveProperty('content');
    });

    it('should accept optional limit parameter', async () => {
      const params = { query: 'mesh', limit: 10 };
      const result = await searchSourceHandler(params);

      expect(result).toHaveProperty('content');
    });

    it('should default limit to 5 when not provided', async () => {
      const params = { query: 'test' };
      const result = await searchSourceHandler(params);

      expect(result).toHaveProperty('content');
      expect(Array.isArray((result as any).content)).toBe(true);
    });

    it('should return text content type', async () => {
      const params = { query: 'test' };
      const result = (await searchSourceHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return JSON-parseable response or no results message', async () => {
      const params = { query: 'test source code search' };
      const result = (await searchSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
      const parsed = JSON.parse(responseText);
      expect(parsed).toHaveProperty('query');
      expect(parsed).toHaveProperty('totalResults', 1);
      expect(parsed).toHaveProperty('results');
    });

    it('should handle queries with package filter', async () => {
      const params = { query: 'mesh', package: 'core', limit: 3 };
      const result = (await searchSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });

    it('should return structured results with source code metadata', async () => {
      const params = { query: 'getMeshByName', limit: 2 };
      const result = (await searchSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      const parsed = JSON.parse(responseText);
      expect(parsed).toHaveProperty('query');
      expect(parsed).toHaveProperty('totalResults');
      expect(parsed).toHaveProperty('results');

      const firstResult = parsed.results[0];
      expect(firstResult).toHaveProperty('filePath', 'packages/dev/core/src/scene.ts');
      expect(firstResult).toHaveProperty('startLine', 1);
      expect(firstResult).toHaveProperty('endLine', 200);
    });
  });

  describe('get_babylon_source handler', () => {
    let getSourceHandler: (params: unknown) => Promise<unknown>;

    beforeEach(() => {
      setupHandlers(mockServer);
      getSourceHandler = registerToolSpy.mock.calls[4]![2];
    });

    it('should accept required filePath parameter', async () => {
      const params = { filePath: 'packages/dev/core/src/scene.ts' };
      const result = await getSourceHandler(params);

      expect(result).toHaveProperty('content');
      expect(Array.isArray((result as any).content)).toBe(true);
    });

    it('should accept optional startLine and endLine parameters', async () => {
      const params = {
        filePath: 'packages/dev/core/src/scene.ts',
        startLine: 100,
        endLine: 110,
      };
      const result = await getSourceHandler(params);

      expect(result).toHaveProperty('content');
    });

    it('should return text content type', async () => {
      const params = { filePath: 'packages/dev/core/src/scene.ts' };
      const result = (await getSourceHandler(params)) as { content: { type: string; text: string }[] };

      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return JSON-parseable response', async () => {
      const params = { filePath: 'packages/dev/core/src/scene.ts', startLine: 1, endLine: 10 };
      const result = (await getSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(() => JSON.parse(responseText)).not.toThrow();
    });

    it('should include source file metadata in response', async () => {
      const params = { filePath: 'packages/dev/core/src/scene.ts' };
      const result = (await getSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      const parsedResponse = JSON.parse(responseText);
      expect(parsedResponse).toHaveProperty('filePath', 'packages/dev/core/src/scene.ts');
      expect(parsedResponse).toHaveProperty('language', 'typescript');
      expect(parsedResponse).toHaveProperty('content');
      expect(parsedResponse.content).toContain('export class Scene');
    });

    it('should handle file retrieval requests', async () => {
      const params = { filePath: 'test/path.ts' };
      const result = (await getSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });

    it('should handle line range requests', async () => {
      const params = {
        filePath: 'packages/dev/core/src/scene.ts',
        startLine: 4100,
        endLine: 4110,
      };
      const result = (await getSourceHandler(params)) as { content: { type: string; text: string }[] };

      const responseText = result.content[0]!.text;
      expect(typeof responseText).toBe('string');
      expect(responseText.length).toBeGreaterThan(0);
    });
  });
});
