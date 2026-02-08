import { connect } from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';
import type { SearchOptions, SearchResult } from './types.js';
import type { EmbeddedDocument } from './lancedb-indexer.js';
import type { EmbeddedApiDoc } from './api-indexer.js';
import { buildWhereClause, resolveSecurePath } from './input-sanitizer.js';
import fs from 'fs/promises';
import path from 'path';

const REPO_BASE_PATH = './data/repositories';

export class LanceDBSearch {
  private db: any;
  private table: any;
  private embedder: any;
  private readonly dbPath: string;
  private readonly tableName: string;

  constructor(
    dbPath: string = './data/lancedb',
    tableName: string = 'babylon_docs'
  ) {
    this.dbPath = dbPath;
    this.tableName = tableName;
  }

  async initialize(): Promise<void> {
    this.db = await connect(this.dbPath);
    this.table = await this.db.openTable(this.tableName);

    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.table || !this.embedder) {
      throw new Error('Search not initialized. Call initialize() first.');
    }

    const limit = options.limit || 5;
    const queryVector = await this.generateEmbedding(query);

    let searchQuery = this.table.vectorSearch(queryVector).limit(limit);

    if (options.category) {
      searchQuery = searchQuery.where(buildWhereClause('category', options.category));
    }

    const results = await searchQuery.toArray();

    return results.map((doc: any) => ({
      title: doc.title,
      description: doc.description,
      content: this.extractRelevantSnippet(doc.content, query),
      url: doc.url,
      category: doc.category,
      source: doc.source,
      score: doc._distance ? 1 - doc._distance : 0,
      keywords: doc.keywords.split(', ').filter(Boolean),
    }));
  }

  async searchApi(query: string, options: { limit?: number } = {}): Promise<Array<EmbeddedApiDoc & { score: number }>> {
    if (!this.db || !this.embedder) {
      throw new Error('Search not initialized. Call initialize() first.');
    }

    const limit = options.limit || 5;
    const queryVector = await this.generateEmbedding(query);

    const apiTable = await this.db.openTable('babylon_api');

    const results = await apiTable
      .vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    return results.map((doc: any) => ({
      ...doc,
      score: doc._distance ? 1 - doc._distance : 0,
    }));
  }

  async getDocument(docId: string): Promise<EmbeddedDocument | null> {
    if (!this.table) {
      throw new Error('Search not initialized. Call initialize() first.');
    }

    const results = await this.table
      .query()
      .where(buildWhereClause('id', docId))
      .limit(1)
      .toArray();

    return results.length > 0 ? results[0] : null;
  }

  async getDocumentByPath(filePath: string): Promise<EmbeddedDocument | null> {
    if (!this.table) {
      throw new Error('Search not initialized. Call initialize() first.');
    }

    let results = await this.table
      .query()
      .where(buildWhereClause('url', filePath))
      .limit(1)
      .toArray();

    if (results.length > 0) {
      const doc = results[0];
      const freshContent = await this.fetchLocalContent(doc.filePath);
      if (freshContent) {
        return { ...doc, content: freshContent };
      }
      return doc;
    }

    const docId = this.pathToDocId(filePath);
    return this.getDocument(docId);
  }

  private async fetchLocalContent(filePath: string): Promise<string | null> {
    const possiblePaths = [
      filePath,
      path.join(REPO_BASE_PATH, 'Documentation', filePath.replace(/^.*\/content\//, '')),
      path.join(REPO_BASE_PATH, 'Babylon.js', filePath.replace(/^.*\/Babylon\.js\//, '')),
      path.join(REPO_BASE_PATH, 'havok', filePath.replace(/^.*\/havok\//, '')),
    ];

    for (const possiblePath of possiblePaths) {
      try {
        const content = await fs.readFile(possiblePath, 'utf-8');
        return content;
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const result = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(result.data);
  }

  private extractRelevantSnippet(content: string, query: string, snippetLength: number = 300): string {
    const queryTerms = query.toLowerCase().split(/\s+/);

    let bestIndex = 0;
    let maxMatches = 0;

    const words = content.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const windowText = words.slice(i, i + 50).join(' ').toLowerCase();
      const matches = queryTerms.filter(term => windowText.includes(term)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIndex = i;
      }
    }

    const start = Math.max(0, bestIndex - 10);
    const snippetWords = words.slice(start, start + 60);
    let snippet = snippetWords.join(' ');

    if (snippet.length > snippetLength) {
      snippet = snippet.substring(0, snippetLength) + '...';
    }

    if (start > 0) {
      snippet = '...' + snippet;
    }

    return snippet;
  }

  private pathToDocId(filePath: string): string {
    let normalizedPath = filePath.replace(/\.md$/, '');
    normalizedPath = normalizedPath.replace(/^.*\/content\//, '');
    const pathWithUnderscores = normalizedPath.replace(/\//g, '_');
    return `documentation_${pathWithUnderscores}`;
  }

  async searchSourceCode(
    query: string,
    options: { package?: string; limit?: number; tableName?: string } = {}
  ): Promise<Array<any & { score: number }>> {
    if (!this.db || !this.embedder) {
      throw new Error('Search not initialized');
    }

    const limit = options.limit || 5;
    const tableName = options.tableName || 'babylon_source_code';
    const queryVector = await this.generateEmbedding(query);

    const sourceTable = await this.db.openTable(tableName);
    let searchQuery = sourceTable.vectorSearch(queryVector).limit(limit);

    if (options.package) {
      searchQuery = searchQuery.where(buildWhereClause('package', options.package));
    }

    const results = await searchQuery.toArray();
    return results.map((doc: any) => ({
      ...doc,
      score: doc._distance ? Math.max(0, 1 - doc._distance) : 0,
    }));
  }

  async getSourceFile(
    filePath: string,
    startLine?: number,
    endLine?: number
  ): Promise<string | null> {
    const basePath = path.join(REPO_BASE_PATH, 'Babylon.js');
    const securePath = resolveSecurePath(basePath, filePath);

    if (!securePath) {
      console.error(`Path traversal blocked: ${filePath}`);
      return null;
    }

    try {
      const content = await fs.readFile(securePath, 'utf-8');

      if (startLine !== undefined && endLine !== undefined) {
        const lines = content.split('\n');
        return lines.slice(startLine - 1, endLine).join('\n');
      }
      return content;
    } catch (error) {
      console.error(`Error reading source file ${filePath}:`, error);
      return null;
    }
  }

  async close(): Promise<void> {
    // LanceDB doesn't require explicit closing
  }
}
