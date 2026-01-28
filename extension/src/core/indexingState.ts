/**
 * Indexing state management for agent feedback
 */

import * as vscode from 'vscode';

export interface IndexingStatus {
  isIndexing: boolean;
  progress: number; // 0-100
  currentFile?: string;
  totalFiles?: number;
  indexedFiles?: number;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
}

/**
 * Global indexing state manager
 */
class IndexingStateManager {
  private static instance: IndexingStateManager;
  private status: IndexingStatus = { isIndexing: false, progress: 0 };
  private readonly onStatusChangeEmitter = new vscode.EventEmitter<IndexingStatus>();

  readonly onStatusChange = this.onStatusChangeEmitter.event;

  private constructor() {}

  static getInstance(): IndexingStateManager {
    if (!IndexingStateManager.instance) {
      IndexingStateManager.instance = new IndexingStateManager();
    }
    return IndexingStateManager.instance;
  }

  getStatus(): IndexingStatus {
    return { ...this.status };
  }

  startIndexing(totalFiles: number): void {
    this.status = {
      isIndexing: true,
      progress: 0,
      totalFiles,
      indexedFiles: 0,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      lastError: undefined
    };
    this.onStatusChangeEmitter.fire(this.getStatus());
  }

  updateProgress(indexedFiles: number, currentFile: string): void {
    if (!this.status.isIndexing || !this.status.totalFiles) return;

    this.status.indexedFiles = indexedFiles;
    this.status.currentFile = currentFile;
    this.status.progress = Math.round((indexedFiles / this.status.totalFiles) * 100);
    this.onStatusChangeEmitter.fire(this.getStatus());
  }

  completeIndexing(): void {
    this.status.isIndexing = false;
    this.status.progress = 100;
    this.status.completedAt = new Date().toISOString();
    this.status.currentFile = undefined;
    this.onStatusChangeEmitter.fire(this.getStatus());
  }

  failIndexing(error: string): void {
    this.status.isIndexing = false;
    this.status.lastError = error;
    this.status.completedAt = new Date().toISOString();
    this.onStatusChangeEmitter.fire(this.getStatus());
  }

  dispose(): void {
    this.onStatusChangeEmitter.dispose();
    // Reset singleton so getInstance() recreates a valid instance
    IndexingStateManager.instance = null as unknown as IndexingStateManager;
  }
}

// Export singleton getter
export function getIndexingState(): IndexingStateManager {
  return IndexingStateManager.getInstance();
}
