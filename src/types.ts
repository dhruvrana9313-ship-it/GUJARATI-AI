/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TranslationStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export interface HistoryEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  timestamp: number;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  isOffline?: boolean;
}

export interface LanguagePack {
  id: string;
  name: string;
  status: 'available' | 'downloading' | 'installed';
  size: string;
}
