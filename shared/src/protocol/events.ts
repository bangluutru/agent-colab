import * as fs from 'fs';
import * as path from 'path';
import { WorkflowEvent, EventType } from './types.js';

export class EventLogger {
  private logFilePath: string;

  constructor(runDir: string) {
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }
    this.logFilePath = path.join(runDir, 'events.jsonl');
  }

  private listeners: ((event: WorkflowEvent) => void)[] = [];

  public onEvent(callback: (event: WorkflowEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public log(event: Omit<WorkflowEvent, 'timestamp'>): WorkflowEvent {
    const fullEvent: WorkflowEvent = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Append to JSONL file
    fs.appendFileSync(this.logFilePath, JSON.stringify(fullEvent) + '\n', 'utf8');

    // Console representation
    const agentBadge = `[${fullEvent.from.toUpperCase()} -> ${fullEvent.to.toUpperCase()}]`;
    const statusBadge = `[${fullEvent.status.toUpperCase()}]`;
    console.log(`${fullEvent.timestamp.slice(11, 19)} ${agentBadge.padEnd(24)} ${fullEvent.type.padEnd(25)} ${statusBadge}`);

    // Notify listeners (e.g. SSE stream)
    for (const listener of this.listeners) {
      try { listener(fullEvent); } catch (e) { console.error('Error in event listener:', e); }
    }

    return fullEvent;
  }

  public getEvents(): WorkflowEvent[] {
    if (!fs.existsSync(this.logFilePath)) {
      return [];
    }
    const lines = fs.readFileSync(this.logFilePath, 'utf8').trim().split('\n');
    return lines.filter(Boolean).map(l => JSON.parse(l) as WorkflowEvent);
  }
}
