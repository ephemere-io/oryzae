import type { BoardSnippet } from '../models/board-snippet.js';

export interface BoardSnippetRepositoryGateway {
  findById(id: string): Promise<BoardSnippet | null>;
  findByIds(ids: string[]): Promise<BoardSnippet[]>;
  save(snippet: BoardSnippet): Promise<void>;
  update(snippet: BoardSnippet): Promise<void>;
  delete(id: string): Promise<void>;
}
