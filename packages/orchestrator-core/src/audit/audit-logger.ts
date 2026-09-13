import * as fs from 'fs';
import * as path from 'path';

export interface AuditRecord {
  id: string;
  timestamp: string;
  taskId: string;
  stageId: string;
  stageName: string;
  agent: string;
  provider?: string;
  model: string;
  rulesApplied: string[];
  filesChanged: string[];
  commandsExecuted: string[];
  reviewResult?: any;
  verificationResult?: any;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
}

export class AuditLogger {
  private auditFilePath: string;

  constructor(storageDir: string) {
    if (!fs.existsSync(storageDir)) {
      try { fs.mkdirSync(storageDir, { recursive: true }); } catch {}
    }
    this.auditFilePath = path.join(storageDir, 'audit.jsonl');
  }

  public log(record: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const fullRecord: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...record,
    };

    try {
      fs.appendFileSync(this.auditFilePath, JSON.stringify(fullRecord) + '\n', 'utf8');
    } catch (err) {
      console.error('[AUDIT] Failed to append audit record:', err);
    }

    return fullRecord;
  }

  public getHistory(): AuditRecord[] {
    if (!fs.existsSync(this.auditFilePath)) return [];
    try {
      return fs.readFileSync(this.auditFilePath, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }
}
