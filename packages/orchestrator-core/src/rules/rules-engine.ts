import * as fs from 'fs';
import * as path from 'path';
import { RuleRef } from '../protocol/types.js';

export class RulesEngine {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Resolves rules for a stage across the 5-tier hierarchy:
   * Global -> Project -> Workflow -> Stage -> Agent
   */
  public resolveRulesForStage(
    stageRules: (string | RuleRef)[] = [],
    workflowRules: (string | RuleRef)[] = [],
    agentId?: string
  ): RuleRef[] {
    const resolved: RuleRef[] = [];
    const seenContents = new Set<string>();
    const seenIds = new Set<string>();

    const addRule = (rule: RuleRef) => {
      const normalizedContent = (rule.content || '').trim();
      if (seenIds.has(rule.id) || (normalizedContent && seenContents.has(normalizedContent))) {
        return; // Deduplicate
      }
      seenIds.add(rule.id);
      if (normalizedContent) seenContents.add(normalizedContent);
      resolved.push(rule);
    };

    // 1. Global Rules
    const globalRules = this.loadGlobalRules();
    globalRules.forEach(addRule);

    // 2. Project Rules (.orchestrator/rules)
    const projectRules = this.loadProjectRules();
    projectRules.forEach(addRule);

    // 3. Workflow Rules
    workflowRules.forEach(r => {
      const parsed = typeof r === 'string' ? this.resolveRuleByName(r, 'workflow') : r;
      if (parsed) addRule(parsed);
    });

    // 4. Stage Rules
    stageRules.forEach(r => {
      const parsed = typeof r === 'string' ? this.resolveRuleByName(r, 'stage') : r;
      if (parsed) addRule(parsed);
    });

    // 5. Agent Rules
    if (agentId) {
      const agentRule = this.loadAgentRule(agentId);
      if (agentRule) addRule(agentRule);
    }

    return resolved;
  }

  /**
   * Compiles the resolved rules into a markdown prompt block.
   */
  public compileRulesPrompt(rules: RuleRef[]): string {
    if (rules.length === 0) return '';
    const sections = rules.map(r => {
      const header = `### Rule: ${r.name || r.id} (${r.scope.toUpperCase()})`;
      return `${header}\n${r.content || ''}`;
    });
    return `\n## APPLIED GOVERNANCE RULES\n${sections.join('\n\n')}\n`;
  }

  private loadGlobalRules(): RuleRef[] {
    const rules: RuleRef[] = [];
    const globalDir = path.resolve(process.env.HOME || '', '.gemini/config/rules');
    if (fs.existsSync(globalDir)) {
      try {
        const files = fs.readdirSync(globalDir).filter(f => f.endsWith('.md'));
        for (const f of files) {
          const content = fs.readFileSync(path.join(globalDir, f), 'utf8');
          rules.push({ id: f.replace('.md', ''), name: f, scope: 'global', content, path: path.join(globalDir, f) });
        }
      } catch {}
    }
    return rules;
  }

  private loadProjectRules(): RuleRef[] {
    const rules: RuleRef[] = [];
    const projectDirs = [
      path.join(this.workspacePath, '.orchestrator/rules'),
      path.join(this.workspacePath, '.agents/rules'),
    ];

    for (const dir of projectDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
          for (const f of files) {
            const content = fs.readFileSync(path.join(dir, f), 'utf8');
            rules.push({ id: f.replace('.md', ''), name: f, scope: 'project', content, path: path.join(dir, f) });
          }
        } catch {}
      }
    }

    // If no project rules exist yet, use bundled defaults
    if (rules.length === 0) {
      const defaultsDir = path.resolve(__dirname, 'defaults');
      if (fs.existsSync(defaultsDir)) {
        try {
          const files = fs.readdirSync(defaultsDir).filter(f => f.endsWith('.md'));
          for (const f of files) {
            const content = fs.readFileSync(path.join(defaultsDir, f), 'utf8');
            rules.push({ id: f.replace('.md', ''), name: f, scope: 'project', content, path: path.join(defaultsDir, f) });
          }
        } catch {}
      }
    }

    return rules;
  }

  private resolveRuleByName(name: string, scope: 'workflow' | 'stage'): RuleRef | null {
    const cleanName = name.replace(/\.md$/, '');
    const filename = cleanName + '.md';

    // Search project rules
    const projectPath = path.join(this.workspacePath, '.orchestrator/rules', filename);
    if (fs.existsSync(projectPath)) {
      return { id: cleanName, name: filename, scope, content: fs.readFileSync(projectPath, 'utf8'), path: projectPath };
    }

    // Search defaults
    const defaultPath = path.resolve(__dirname, 'defaults', filename);
    if (fs.existsSync(defaultPath)) {
      return { id: cleanName, name: filename, scope, content: fs.readFileSync(defaultPath, 'utf8'), path: defaultPath };
    }

    return { id: cleanName, name: cleanName, scope, content: `# Rule: ${cleanName}\nAdhere to standard quality and safety specifications.` };
  }

  private loadAgentRule(agentId: string): RuleRef | null {
    const promptPath = path.resolve(this.workspacePath, 'prompts/agents', `${agentId}.md`);
    if (fs.existsSync(promptPath)) {
      return {
        id: `agent-${agentId}`,
        name: `${agentId} Agent Persona`,
        scope: 'agent',
        content: fs.readFileSync(promptPath, 'utf8'),
        path: promptPath,
      };
    }
    return null;
  }
}
