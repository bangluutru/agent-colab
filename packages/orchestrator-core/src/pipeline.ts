import { ConfiguredStage } from './protocol/types.js';

export class StagePipeline {
  private stages: ConfiguredStage[] = [];

  constructor(initialStages: ConfiguredStage[] = []) {
    this.stages = [...initialStages];
  }

  public getStages(): ConfiguredStage[] {
    return [...this.stages];
  }

  public getStage(stageId: string): ConfiguredStage | undefined {
    return this.stages.find(s => s.id === stageId);
  }

  public addStage(stage: ConfiguredStage, index?: number): void {
    if (index !== undefined && index >= 0 && index <= this.stages.length) {
      this.stages.splice(index, 0, stage);
    } else {
      this.stages.push(stage);
    }
  }

  public removeStage(stageId: string): boolean {
    const idx = this.stages.findIndex(s => s.id === stageId);
    if (idx !== -1) {
      this.stages.splice(idx, 1);
      return true;
    }
    return false;
  }

  public updateStage(stageId: string, updates: Partial<ConfiguredStage>): boolean {
    const stage = this.getStage(stageId);
    if (stage) {
      Object.assign(stage, updates);
      return true;
    }
    return false;
  }

  public reorderStages(stageIds: string[]): void {
    const stageMap = new Map(this.stages.map(s => [s.id, s]));
    const reordered: ConfiguredStage[] = [];
    for (const id of stageIds) {
      const s = stageMap.get(id);
      if (s) reordered.push(s);
    }
    for (const s of this.stages) {
      if (!reordered.includes(s)) reordered.push(s);
    }
    this.stages = reordered;
  }
}
