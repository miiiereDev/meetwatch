import type { IngestService } from '../services/ingest.js';
import type { SseHub } from '../services/sse.js';
import type { IntervalRepo } from '../repositories/intervals.js';
import type { SessionRepo } from '../repositories/sessions.js';
import type { SettingRepo } from '../repositories/settings.js';
import type { StudentRepo } from '../repositories/students.js';

export type ProviderName = 'simulator' | 'google' | 'csv';

export type ProviderRunState = 'idle' | 'running' | 'needs_auth' | 'error';

export interface ProviderStatus {
  state: ProviderRunState;
  message?: string;
  updatedAt: string;
}

export type ProviderLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
  debug: (obj: object, msg?: string) => void;
};

/** Everything a provider may touch, injected by the API at start(). */
export interface ProviderServices {
  ingest: IngestService;
  hub: SseHub;
  sessions: SessionRepo;
  intervals: IntervalRepo;
  students: StudentRepo;
  settings: SettingRepo;
  logger: ProviderLogger;
}

export interface MeetProvider {
  readonly name: ProviderName;
  start(services: ProviderServices): Promise<void>;
  stop(): Promise<void>;
  status(): ProviderStatus;
}
