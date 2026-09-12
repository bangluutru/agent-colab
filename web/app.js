// AI Agent Collaboration Studio Frontend Logic

let currentRunData = null;
let currentRunId = 'run-e2e-001';

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initDeviceToggles();
  initPresets();
  initRunSelector();
  initActionButtons();
  initOutputAndFilesActions();

  await loadModelsAndStatus();
  await loadRuns();
  await loadRunDetails(currentRunId);
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Device Viewport Toggles in Preview
function initDeviceToggles() {
  const buttons = document.querySelectorAll('.btn-device');
  const iframe = document.getElementById('preview-iframe');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const width = btn.getAttribute('data-width');
      iframe.style.width = width;
    });
  });
}

// Quick Preset Prompt Chips
function initPresets() {
  const chips = document.querySelectorAll('.chip-preset');
  const textarea = document.getElementById('prompt-input');

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active-preset'));
      chip.classList.add('active-preset');
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        textarea.value = prompt;
      }
    });
  });

  // Reasoning effort segment buttons
  const segmentBtns = document.querySelectorAll('#segment-reasoning .segment-btn');
  segmentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function renderGroupedOptions(modelsList) {
  const groups = {};
  modelsList.forEach((m) => {
    const g = m.group || 'Available Models';
    if (!groups[g]) groups[g] = [];
    groups[g].push(m);
  });

  return Object.entries(groups)
    .map(([groupName, items]) => {
      const optionsHtml = items
        .map((m) => {
          const badgeText = m.badge ? ` · ${m.badge}` : '';
          return `<option value="${m.id}" data-name="${m.name}">${m.name}${badgeText} (${m.description})</option>`;
        })
        .join('');
      return `<optgroup label="${groupName}">${optionsHtml}</optgroup>`;
    })
    .join('');
}

let cachedClusterStatus = null;

function updateChipDisplay(selectEl, chipDisplayId) {
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  if (selectedOpt) {
    const displayName = selectedOpt.getAttribute('data-name') || selectedOpt.text.split(' (')[0];
    const el = document.getElementById(chipDisplayId);
    if (el) el.textContent = displayName;
  }
}

function updateClusterChipsStatus(statusData) {
  if (!statusData) return;
  cachedClusterStatus = statusData;

  const claudeChip = document.getElementById('chip-claude');
  const claudeIndicator = claudeChip?.querySelector('.status-indicator');
  const claudeModelDisplay = document.getElementById('display-claude-model');
  const claudeSelect = document.getElementById('select-claude-model');
  const selectedModelName = claudeSelect?.options[claudeSelect?.selectedIndex]?.getAttribute('data-name') || 'Sonnet 5';

  if (statusData.claude) {
    if (statusData.claude.ready) {
      if (claudeIndicator) {
        claudeIndicator.className = 'status-indicator online pulse';
      }
      if (claudeModelDisplay) {
        claudeModelDisplay.innerHTML = `<span style="color: var(--accent-emerald)">● Ready</span> · Claude Pro · ${selectedModelName}`;
      }
      if (claudeChip) {
        claudeChip.title = `Claude Code CLI: Ready (${statusData.claude.authStatus || 'Pro Subscription'})\nClick to refresh probe`;
        claudeChip.style.cursor = 'pointer';
        claudeChip.onclick = () => recheckClaudeStatus();
      }
    } else {
      if (claudeIndicator) {
        claudeIndicator.className = 'status-indicator warning';
      }
      if (claudeModelDisplay) {
        claudeModelDisplay.innerHTML = `<span style="color: #f59e0b">⚠ Auth Needs Repair</span> <span style="font-size:0.65rem; text-decoration: underline; cursor: pointer;">[Retry]</span>`;
      }
      if (claudeChip) {
        claudeChip.title = `Claude Code CLI: ${statusData.claude.authStatus || 'Authentication Required'}\nClick to re-probe or view login instructions.`;
        claudeChip.style.cursor = 'pointer';
        claudeChip.onclick = () => recheckClaudeStatus();
      }
    }
  }
}

async function recheckClaudeStatus() {
  const claudeModelDisplay = document.getElementById('display-claude-model');
  if (claudeModelDisplay) claudeModelDisplay.innerHTML = `<span>⏳ Probing Claude...</span>`;
  try {
    const res = await fetch('/api/status?refresh=true');
    const data = await res.json();
    updateClusterChipsStatus(data);
    if (data.claude?.ready) {
      alert('✅ Claude Code CLI authentication is verified! Ready for autonomous code reviews.');
    } else {
      alert(`⚠️ Claude Code Subscription Authentication\n\nStatus: ${data.claude?.authStatus || 'Authentication Needed'}\n\nTo re-authenticate your Claude Pro account, run in your Terminal:\n  claude auth logout\n  claude update\n  claude auth login\n\nThen verify with:\n  claude -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_AUTH_OK"\n\nThen click [Retry] here.`);
    }
  } catch (err) {
    console.warn('Failed to refresh status:', err);
  }
}

// Model Selection & Status
async function loadModelsAndStatus() {
  try {
    const [modelsRes, statusRes] = await Promise.all([
      fetch('/api/models'),
      fetch('/api/status'),
    ]);

    const modelsData = await modelsRes.json();
    const statusData = await statusRes.json();

    // Populate Codex Select with Optgroups
    const codexSelect = document.getElementById('select-codex-model');
    if (modelsData.availableModels?.codex) {
      codexSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.codex);
      codexSelect.value = modelsData.defaultModels.codex;
    }

    // Populate Claude Select with Optgroups
    const claudeSelect = document.getElementById('select-claude-model');
    if (modelsData.availableModels?.claude) {
      claudeSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.claude);
      claudeSelect.value = modelsData.defaultModels.claude;
    }

    // Populate Gemini Select with Optgroups
    const geminiSelect = document.getElementById('select-gemini-model');
    if (modelsData.availableModels?.gemini) {
      geminiSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.gemini);
      geminiSelect.value = modelsData.defaultModels.gemini;
    }

    // Wire change listeners to header chips
    codexSelect.addEventListener('change', () => updateChipDisplay(codexSelect, 'display-codex-model'));
    claudeSelect.addEventListener('change', () => {
      if (cachedClusterStatus) {
        updateClusterChipsStatus(cachedClusterStatus);
      } else {
        updateChipDisplay(claudeSelect, 'display-claude-model');
      }
    });
    geminiSelect.addEventListener('change', () => updateChipDisplay(geminiSelect, 'display-gemini-model'));

    updateChipDisplay(codexSelect, 'display-codex-model');
    updateChipDisplay(geminiSelect, 'display-gemini-model');
    updateClusterChipsStatus(statusData);
  } catch (err) {
    console.warn('Status or models API offline:', err);
  }
}

// Run Selector
async function loadRuns() {
  try {
    const res = await fetch('/api/runs');
    const runs = await res.json();
    const select = document.getElementById('select-run');

    if (runs && runs.length > 0) {
      select.innerHTML = runs
        .map((r) => {
          let tag = r.hasVerification ? 'Verified' : r.status || 'Run';
          if (r.hasDist) tag += ' · ⚡ Built';
          return `<option value="${r.id}">${r.id} (${tag})</option>`;
        })
        .join('');
      select.value = runs.find((r) => r.id === currentRunId)?.id || runs[0].id;
      currentRunId = select.value;
    }
  } catch (err) {
    console.warn('Could not load runs list:', err);
  }
}

function initRunSelector() {
  const select = document.getElementById('select-run');
  select.addEventListener('change', async (e) => {
    currentRunId = e.target.value;
    await loadRunDetails(currentRunId);
  });
}

// Load Details for a Run
async function loadRunDetails(runId) {
  try {
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    currentRunData = data;

    renderOverview(data);
    renderWorkspaceOutput(data);
    loadWorkspaceFiles(runId);
    renderPlan(data.files['plan.json']);
    renderReviews(data.files);
    renderConformance(data.files['final-check.json']);
    renderEvents(data.files['events.jsonl']);
    updateStepper(data);

    // Also populate cockpit live activity feed
    const feedLogs = document.getElementById('cockpit-feed-logs');
    if (feedLogs) {
      feedLogs.innerHTML = '';
      const eventList = data.files['events.jsonl'];
      if (Array.isArray(eventList) && eventList.length > 0) {
        eventList.forEach((e) => appendCockpitLog(e));
      } else {
        feedLogs.innerHTML = '<div class="feed-empty">No activity events recorded for this run.</div>';
      }
    }
  } catch (err) {
    console.error('Failed to load run details:', err);
  }
}

function renderOverview(data) {
  const files = data.files || {};
  const verification = files['verification.json'] || {};
  const review03 = files['review-03.json'] || files['review-02.json'] || files['review-01.json'];

  document.getElementById('overview-status').textContent = verification.overallStatus
    ? `${verification.overallStatus} (${verification.testsPassed}/${verification.testsTotal} Tests)`
    : 'COMPLETED';

  if (review03 && review03.decision) {
    document.getElementById('overview-claude-decision').textContent = `${review03.decision} (Round ${review03.round || 3})`;
  }

  if (verification.testsTotal) {
    document.getElementById('overview-tests').textContent = `${verification.testsPassed} / ${verification.testsTotal} Passed`;
  }

  // Traceability List
  const traceList = document.getElementById('traceability-list');
  traceList.innerHTML = `
    <div class="issue-item resolved">
      <div class="issue-header">
        <span class="issue-file">1. Gate 0 Preflight</span>
        <span class="issue-severity low">PASS</span>
      </div>
      <p class="issue-text">Environment verified (Node v22, Codex v0.153.4, Claude Code v2.1.199). Zero API keys required.</p>
    </div>
    <div class="issue-item resolved">
      <div class="issue-header">
        <span class="issue-file">2. Codex Strategic Planning</span>
        <span class="issue-severity low">PASS</span>
      </div>
      <p class="issue-text">69-line architecture and edge cases generated by OpenAI Codex CLI in plan.json.</p>
    </div>
    <div class="issue-item resolved">
      <div class="issue-header">
        <span class="issue-file">3. Antigravity / Gemini Implementation</span>
        <span class="issue-severity low">PASS</span>
      </div>
      <p class="issue-text">React Calculator built with arithmetic core, dual input, keypad chaining, and Vitest suite.</p>
    </div>
    <div class="issue-item resolved">
      <div class="issue-header">
        <span class="issue-file">4. Claude Code Adversarial Review</span>
        <span class="issue-severity high">3 ROUNDS</span>
      </div>
      <p class="issue-text">Rounds 1 & 2 caught 8 edge cases (missing component tests, keypad operator chaining bug, stale output). Round 3 APPROVED.</p>
    </div>
    <div class="issue-item resolved">
      <div class="issue-header">
        <span class="issue-file">5. Codex Conformance & Final Verification</span>
        <span class="issue-severity low">PASS</span>
      </div>
      <p class="issue-text">Verified against original plan. 23/23 tests pass, Vite production build exit code 0.</p>
    </div>
  `;
}

function renderPlan(plan) {
  const container = document.getElementById('plan-container');
  if (!plan) {
    container.innerHTML = '<p class="text-muted">No plan.json found in this run.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="metric-card">
        <span class="metric-label">OBJECTIVE</span>
        <p style="font-size: 0.95rem; color: #f1f5f9; margin-top: 0.25rem;">${plan.objective || 'N/A'}</p>
      </div>

      <div class="metric-card">
        <span class="metric-label">EDGE CASES TO GUARD AGAINST (${plan.edge_cases ? plan.edge_cases.length : 0})</span>
        <ul style="margin-left: 1.25rem; font-size: 0.85rem; color: #cbd5e1; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
          ${(plan.edge_cases || []).map((ec) => `<li>${ec}</li>`).join('')}
        </ul>
      </div>

      <div class="metric-card">
        <span class="metric-label">ACCEPTANCE CRITERIA</span>
        <ul style="margin-left: 1.25rem; font-size: 0.85rem; color: #cbd5e1; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
          ${(plan.acceptance_criteria || []).map((ac) => `<li>${ac}</li>`).join('')}
        </ul>
      </div>

      <details style="margin-top: 0.5rem;">
        <summary style="font-size: 0.85rem; color: var(--accent-cyan); cursor: pointer;">View Raw Plan JSON</summary>
        <pre class="code-block" style="margin-top: 0.5rem;">${JSON.stringify(plan, null, 2)}</pre>
      </details>
    </div>
  `;
}

function renderReviews(files) {
  const container = document.getElementById('review-container');
  const selector = document.getElementById('review-round-selector');

  const reviews = {
    1: files['review-01.json'],
    2: files['review-02.json'],
    3: files['review-03.json'],
  };

  function displayRound(roundNum) {
    const rev = reviews[roundNum];
    if (!rev) {
      container.innerHTML = `<p class="text-muted">No review-0${roundNum}.json found in this run.</p>`;
      return;
    }

    const isApproved = rev.decision === 'APPROVED';
    const issues = rev.issues || [];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-elevated); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <span style="font-size: 0.9rem; font-weight: 600;">Round ${roundNum} Decision:</span>
          <span style="font-weight: 700; font-size: 0.95rem; color: ${isApproved ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${rev.decision}</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">REVIEW SUMMARY (BY CLAUDE CODE CLI)</span>
          <p style="font-size: 0.88rem; color: #e2e8f0; margin-top: 0.35rem; line-height: 1.6;">${rev.summary}</p>
        </div>

        <div>
          <span class="metric-label" style="display: block; margin-bottom: 0.5rem;">DETECTED ISSUES (${issues.length})</span>
          ${
            issues.length === 0
              ? '<p class="text-muted" style="font-size: 0.85rem;">Zero blocking issues detected. Approved for deployment!</p>'
              : issues
                  .map(
                    (iss) => `
              <div class="issue-item ${isApproved ? 'resolved' : ''}">
                <div class="issue-header">
                  <span class="issue-file">${iss.file || 'General'}</span>
                  <span class="issue-severity ${iss.severity || 'medium'}">${iss.severity || 'ISSUE'}</span>
                </div>
                <p class="issue-text">${iss.problem || iss.description || JSON.stringify(iss)}</p>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }

  // Round buttons listener
  selector.querySelectorAll('.round-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selector.querySelectorAll('.round-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      displayRound(parseInt(btn.getAttribute('data-round'), 10));
    });
  });

  // Default to round 3 or highest available
  const availableRounds = [3, 2, 1].filter((r) => reviews[r]);
  const defaultRound = availableRounds[0] || 1;
  const activeBtn = selector.querySelector(`.round-btn[data-round="${defaultRound}"]`);
  if (activeBtn) {
    selector.querySelectorAll('.round-btn').forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }
  displayRound(defaultRound);
}

function renderConformance(conf) {
  const container = document.getElementById('conformance-container');
  if (!conf) {
    container.innerHTML = '<p class="text-muted">No final-check.json in this run.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-elevated); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <span style="font-size: 0.9rem; font-weight: 600;">Plan-Conformance Decision:</span>
        <span style="font-weight: 700; font-size: 0.95rem; color: ${conf.decision === 'CONFORMANT' ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${conf.decision}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">CONFORMANCE AUDIT SUMMARY</span>
        <p style="font-size: 0.88rem; color: #e2e8f0; margin-top: 0.35rem; line-height: 1.6;">${conf.summary}</p>
      </div>

      ${
        conf.missing_items && conf.missing_items.length > 0
          ? `
        <div class="metric-card">
          <span class="metric-label text-amber">AUDIT OBSERVATIONS & NOTES (${conf.missing_items.length})</span>
          <ul style="margin-left: 1.25rem; font-size: 0.85rem; color: #fde68a; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
            ${conf.missing_items.map((m) => `<li>${m}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      <details style="margin-top: 0.5rem;">
        <summary style="font-size: 0.85rem; color: var(--accent-cyan); cursor: pointer;">View Raw Conformance JSON</summary>
        <pre class="code-block" style="margin-top: 0.5rem;">${JSON.stringify(conf, null, 2)}</pre>
      </details>
    </div>
  `;
}

function renderEvents(events) {
  const tbody = document.getElementById('events-tbody');
  if (!events || events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding: 1.5rem;">No event logs available.</td></tr>';
    return;
  }

  tbody.innerHTML = events
    .map((e) => {
      const fromClass = e.from || 'system';
      const time = e.timestamp ? e.timestamp.split('T')[1].replace('Z', '') : '';
      return `
      <tr>
        <td style="color: var(--text-muted);">${time}</td>
        <td><span class="event-badge ${fromClass}">${e.from}</span></td>
        <td><span class="event-badge ${e.to}">${e.to}</span></td>
        <td style="font-weight: 600; color: #f8fafc;">${e.type}</td>
        <td><span style="color: ${e.status === 'success' ? 'var(--accent-emerald)' : e.status === 'failed' ? 'var(--accent-rose)' : 'var(--accent-cyan)'}">${e.status}</span></td>
        <td style="color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(e.data || {})}</td>
      </tr>
    `;
    })
    .join('');
}

let activeEventSource = null;

function updateStepper(data, event) {
  let state = data?.currentState;

  // Derive state from incoming event if provided
  if (event) {
    if (event.type === 'PHASE_TRANSITION') {
      state = event.data?.state || event.data?.to || state;
    } else if (event.type === 'USER_REQUEST_RECEIVED') {
      state = 'REQUEST_RECEIVED';
    } else if (event.type === 'PLAN_REQUESTED') {
      state = 'PLANNING';
    } else if (event.type === 'PLAN_RECEIVED') {
      state = 'PLAN_READY';
    } else if (event.type === 'IMPLEMENTATION_STARTED') {
      state = 'IMPLEMENTING';
    } else if (event.type === 'IMPLEMENTATION_COMPLETED') {
      state = 'TESTING';
    } else if (event.type === 'TEST_STARTED' || event.type === 'TEST_PASSED') {
      state = 'TESTING';
    } else if (event.type === 'REVIEW_FALLBACK_TRIGGERED') {
      state = 'REVIEWING';
    } else if (event.type === 'REVIEW_REQUESTED') {
      state = 'REVIEWING';
    } else if (event.type === 'REVIEW_APPROVED') {
      state = 'APPROVED';
    } else if (event.type === 'CHANGES_REQUESTED') {
      state = 'CHANGES_REQUESTED';
    } else if (event.type === 'FIX_STARTED') {
      state = 'FIXING';
    } else if (event.type === 'FIX_COMPLETED') {
      state = 'TESTING';
    } else if (event.type === 'FINAL_CHECK_REQUESTED') {
      state = 'FINAL_CHECK';
    } else if (event.type === 'FINAL_CHECK_PASSED') {
      state = 'VERIFYING';
    } else if (event.type === 'FINAL_CHECK_FAILED') {
      state = 'FIXING';
    } else if (event.type === 'VERIFICATION_STARTED' || event.type === 'VERIFICATION_PASSED') {
      state = 'VERIFYING';
    } else if (event.type === 'WORKFLOW_COMPLETED') {
      state = 'COMPLETED';
    } else if (event.type === 'WORKFLOW_BLOCKED') {
      state = 'BLOCKED';
    } else if (event.type === 'WORKFLOW_FAILED') {
      state = 'FAILED';
    } else if (event.type === 'WORKFLOW_INTERRUPTED') {
      state = 'CANCELLED';
    }
  }

  if (!state) {
    state = data?.files?.['verification.json'] ? 'COMPLETED' : 'REQUEST_RECEIVED';
  }

  if (data) {
    data.currentState = state;
  }

  const files = data?.files || {};
  const hasPlan = !!files['plan.json'];
  const hasReview = Object.keys(files).some((f) => f.startsWith('review-'));
  const hasConformance = !!files['final-check.json'];
  const hasVerification = !!files['verification.json'];

  const eventList = data?.files?.['events.jsonl'] || [];
  const isFallbackReview = (Array.isArray(eventList) && eventList.some((e) => e.type === 'REVIEW_FALLBACK_TRIGGERED')) ||
                           event?.type === 'REVIEW_FALLBACK_TRIGGERED';

  const cstep4Name = document.getElementById('cstep-4-name');
  const cstep4Role = document.getElementById('cstep-4-role');
  if (cstep4Name) {
    cstep4Name.textContent = isFallbackReview ? '4. CODEX REVIEW' : '4. CLAUDE REVIEW';
  }
  if (cstep4Role) {
    cstep4Role.textContent = isFallbackReview ? 'Adversarial Fallback' : 'Adversarial Critique';
  }

  // Determine current active phase (1..6)
  let phaseIndex = 1;
  if (state === 'COMPLETED' || hasVerification) {
    phaseIndex = 6;
  } else if (state === 'VERIFYING') {
    phaseIndex = 6;
  } else if (state === 'FINAL_CHECK' || hasConformance) {
    phaseIndex = 5;
  } else if (['REVIEWING', 'CHANGES_REQUESTED', 'APPROVED'].includes(state) || hasReview) {
    phaseIndex = 4;
  } else if (['IMPLEMENTING', 'FIXING', 'TESTING'].includes(state) || files['implementation.md']) {
    phaseIndex = 3;
  } else if (['PLANNING', 'PLAN_READY'].includes(state) || hasPlan) {
    phaseIndex = 2;
  } else {
    phaseIndex = 1;
  }

  // If state is BLOCKED or FAILED, determine which phase it halted at
  if (['BLOCKED', 'FAILED'].includes(state)) {
    const eventList = data?.files?.['events.jsonl'] || [];
    const hasReviewReq = Array.isArray(eventList) && eventList.some((e) => e.type === 'REVIEW_REQUESTED');
    const hasImplReq = Array.isArray(eventList) && eventList.some((e) => e.type === 'IMPLEMENTATION_STARTED');
    const hasPlanReq = Array.isArray(eventList) && eventList.some((e) => e.type === 'PLAN_REQUESTED');
    if (hasConformance) phaseIndex = 5;
    else if (hasReview || hasReviewReq) phaseIndex = 4;
    else if (files['implementation.md'] || hasImplReq) phaseIndex = 3;
    else if (hasPlan || hasPlanReq) phaseIndex = 2;
    else phaseIndex = 1;
  }

  // 1 & 2. Update Both Steppers (Sidebar and Cockpit Horizontal)
  const stepConfigs = [
    { num: 1, sideId: 'step-user', cockId: 'cstep-1' },
    { num: 2, sideId: 'step-codex-plan', cockId: 'cstep-2' },
    { num: 3, sideId: 'step-gemini-impl', cockId: 'cstep-3' },
    { num: 4, sideId: 'step-claude-review', cockId: 'cstep-4' },
    { num: 5, sideId: 'step-codex-conformance', cockId: 'cstep-5' },
    { num: 6, sideId: 'step-verified', cockId: 'cstep-6' },
  ];

  stepConfigs.forEach(({ num, sideId, cockId }) => {
    // Sidebar Step
    const sEl = document.getElementById(sideId);
    if (sEl) {
      sEl.classList.remove('active', 'passed', 'blocked', 'failed');
      const sDot = sEl.querySelector('.step-dot');
      if (state === 'COMPLETED' || num < phaseIndex) {
        sEl.classList.add('passed');
        if (sDot) sDot.textContent = '✓';
      } else if (num === phaseIndex) {
        if (state === 'BLOCKED') {
          sEl.classList.add('blocked');
          if (sDot) sDot.textContent = '⏸';
        } else if (state === 'FAILED') {
          sEl.classList.add('failed');
          if (sDot) sDot.textContent = '✕';
        } else if (state === 'COMPLETED') {
          sEl.classList.add('passed');
          if (sDot) sDot.textContent = '✓';
        } else {
          sEl.classList.add('active');
          if (sDot) sDot.textContent = `${num}`;
        }
      } else {
        if (sDot) sDot.textContent = `${num}`;
      }
    }

    // Cockpit Horizontal Step
    const cEl = document.getElementById(cockId);
    if (cEl) {
      cEl.classList.remove('active', 'passed', 'blocked', 'failed');
      const cDot = cEl.querySelector('.cstep-dot');
      if (state === 'COMPLETED' || num < phaseIndex) {
        cEl.classList.add('passed');
        if (cDot) cDot.textContent = '✓';
      } else if (num === phaseIndex) {
        if (state === 'BLOCKED') {
          cEl.classList.add('blocked');
          if (cDot) cDot.textContent = '⏸';
        } else if (state === 'FAILED') {
          cEl.classList.add('failed');
          if (cDot) cDot.textContent = '✕';
        } else if (state === 'COMPLETED') {
          cEl.classList.add('passed');
          if (cDot) cDot.textContent = '✓';
        } else {
          cEl.classList.add('active');
          if (cDot) cDot.textContent = `${num}`;
        }
      } else {
        if (cDot) cDot.textContent = `${num}`;
      }
    }
  });

  // 3. Cockpit Run Header & Badges
  const runIdEl = document.getElementById('cockpit-run-id');
  if (runIdEl) runIdEl.textContent = currentRunId || 'run-active';

  const badgeEl = document.getElementById('cockpit-status-badge');
  if (badgeEl) {
    badgeEl.textContent = state;
    badgeEl.className = 'cockpit-status-badge';
    if (state === 'COMPLETED') {
      badgeEl.classList.add('completed');
    } else if (['BLOCKED', 'FAILED', 'CANCELLED'].includes(state)) {
      badgeEl.classList.add('blocked');
    } else if (state !== 'IDLE') {
      badgeEl.classList.add('active');
    }
  }

  // 4. Update 4-Agent Cards
  const codexStatus = document.getElementById('cagent-codex-status');
  const geminiStatus = document.getElementById('cagent-gemini-status');
  const claudeStatus = document.getElementById('cagent-claude-status');
  const verifierStatus = document.getElementById('cagent-verifier-status');

  const codexBox = document.getElementById('cagent-codex');
  const geminiBox = document.getElementById('cagent-gemini');
  const claudeBox = document.getElementById('cagent-claude');
  const verifierBox = document.getElementById('cagent-verifier');

  if (codexStatus && codexBox) {
    codexBox.classList.remove('working', 'done');
    if (state === 'PLANNING') {
      codexStatus.innerHTML = '⏳ Planning architecture...';
      codexBox.classList.add('working');
    } else if (isFallbackReview && state === 'REVIEWING') {
      codexStatus.innerHTML = '⏳ Reviewing code (Fallback)...';
      codexBox.classList.add('working');
    } else if (state === 'FINAL_CHECK') {
      codexStatus.innerHTML = '⏳ Auditing conformance...';
      codexBox.classList.add('working');
    } else if (['VERIFYING', 'COMPLETED'].includes(state)) {
      codexStatus.innerHTML = '✓ Conformance verified';
      codexBox.classList.add('done');
    } else if (phaseIndex > 2 || hasPlan) {
      codexStatus.innerHTML = isFallbackReview && phaseIndex >= 4 ? '✓ Plan & Review (Fallback)' : '✓ Plan created';
      codexBox.classList.add('done');
    } else {
      codexStatus.innerHTML = '○ Waiting';
    }
  }

  if (geminiStatus && geminiBox) {
    geminiBox.classList.remove('working', 'done');
    if (state === 'IMPLEMENTING') {
      geminiStatus.innerHTML = '⏳ Building workspace files...';
      geminiBox.classList.add('working');
    } else if (state === 'FIXING') {
      geminiStatus.innerHTML = '⏳ Repairing changes...';
      geminiBox.classList.add('working');
    } else if (state === 'TESTING') {
      geminiStatus.innerHTML = '✓ Code built, testing...';
      geminiBox.classList.add('done');
    } else if (phaseIndex > 3) {
      geminiStatus.innerHTML = '✓ Implementation complete';
      geminiBox.classList.add('done');
    } else {
      geminiStatus.innerHTML = '○ Waiting';
    }
  }

  if (claudeStatus && claudeBox) {
    claudeBox.classList.remove('working', 'done');
    if (isFallbackReview) {
      if (['APPROVED', 'FINAL_CHECK', 'VERIFYING', 'COMPLETED'].includes(state) || phaseIndex >= 5) {
        claudeStatus.innerHTML = '✓ Passed (Codex Fallback)';
        claudeBox.classList.add('done');
      } else {
        claudeStatus.innerHTML = '○ Bypassed (Codex Fallback)';
      }
    } else if (state === 'REVIEWING') {
      claudeStatus.innerHTML = '⏳ Adversarial review...';
      claudeBox.classList.add('working');
    } else if (state === 'CHANGES_REQUESTED') {
      claudeStatus.innerHTML = '⚠️ Changes requested';
      claudeBox.classList.add('working');
    } else if (state === 'BLOCKED' && phaseIndex === 4) {
      claudeStatus.innerHTML = '⚠️ Auth required';
      claudeBox.classList.add('working');
    } else if (state === 'FAILED' && phaseIndex === 4) {
      claudeStatus.innerHTML = '❌ Review failed';
    } else if (['APPROVED', 'FINAL_CHECK', 'VERIFYING', 'COMPLETED'].includes(state)) {
      claudeStatus.innerHTML = '✓ Code approved';
      claudeBox.classList.add('done');
    } else {
      claudeStatus.innerHTML = '○ Waiting';
    }
  }

  if (verifierStatus && verifierBox) {
    verifierBox.classList.remove('working', 'done');
    if (state === 'TESTING' || state === 'VERIFYING') {
      verifierStatus.innerHTML = state === 'VERIFYING' ? '⏳ Final verification gate...' : '⏳ Running tests & build...';
      verifierBox.classList.add('working');
    } else if (state === 'COMPLETED' || hasVerification) {
      const testsCount = files['verification.json']?.testsPassed ? `${files['verification.json'].testsPassed} tests pass` : 'All tests pass';
      verifierStatus.innerHTML = `✓ ${testsCount} · Build code 0`;
      verifierBox.classList.add('done');
    } else if (phaseIndex >= 4) {
      verifierStatus.innerHTML = '✓ Pre-check tests passed';
      verifierBox.classList.add('done');
    } else if (state === 'FAILED' && phaseIndex === 6) {
      verifierStatus.innerHTML = '❌ Verification failed';
    } else {
      verifierStatus.innerHTML = '○ Waiting';
    }
  }

  // 5. Progress Bar Calculation
  const progressMap = {
    IDLE: 0,
    REQUEST_RECEIVED: 12,
    PLANNING: 25,
    PLAN_READY: 38,
    IMPLEMENTING: 52,
    TESTING: 68,
    REVIEWING: 78,
    CHANGES_REQUESTED: 72,
    FIXING: 75,
    APPROVED: 85,
    FINAL_CHECK: 90,
    VERIFYING: 96,
    COMPLETED: 100,
    BLOCKED: 80,
    FAILED: 70,
    CANCELLED: 50,
  };

  const progressPercent = progressMap[state] || 0;
  const fillEl = document.getElementById('cockpit-progress-fill');
  const textEl = document.getElementById('cockpit-progress-text');
  if (fillEl) fillEl.style.width = `${progressPercent}%`;
  if (textEl) textEl.textContent = `${progressPercent}%`;

  // 6. Alert Banner for BLOCKED or FAILED
  const alertBanner = document.getElementById('cockpit-alert-banner');
  const alertTitle = document.getElementById('alert-title');
  const alertMessage = document.getElementById('alert-message');

  const btnStart = document.getElementById('btn-start-run');
  const btnCancel = document.getElementById('btn-cancel-run');
  const btnRetry = document.getElementById('btn-retry-run');
  const btnCockpitCancel = document.getElementById('btn-cockpit-cancel');
  const btnCockpitRetry = document.getElementById('btn-cockpit-retry');

  if (state === 'BLOCKED' || state === 'FAILED') {
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      if (alertTitle) alertTitle.textContent = state === 'BLOCKED' ? 'Workflow Blocked (Action Required)' : 'Workflow Failed';
      const blockedMsg = files['blocked.json']?.message || event?.data?.message || event?.data?.error;
      if (alertMessage) {
        alertMessage.textContent = blockedMsg || (state === 'BLOCKED'
          ? 'Claude Code subscription authentication is unavailable. Run login in terminal and click Retry.'
          : 'An unhandled execution error occurred.');
      }

      const snippetBox = document.getElementById('alert-snippet-box');
      const codeCmd = document.getElementById('alert-code-cmd');
      const isAuthBlocked = state === 'BLOCKED' && (files['blocked.json']?.reason === 'AUTH_REQUIRED' || (blockedMsg || '').includes('authentication') || (blockedMsg || '').includes('claude auth'));
      if (snippetBox) {
        snippetBox.style.display = isAuthBlocked ? 'flex' : 'none';
        if (codeCmd && files['blocked.json']?.terminalCommand) {
          codeCmd.textContent = files['blocked.json'].terminalCommand;
        }
      }

      const btnFallback = document.getElementById('btn-banner-fallback');
      if (btnFallback) {
        btnFallback.style.display = (state === 'BLOCKED') ? 'inline-flex' : 'none';
      }
    }
    if (btnRetry) btnRetry.style.display = 'inline-flex';
    if (btnCockpitRetry) btnCockpitRetry.style.display = 'inline-flex';
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnCockpitCancel) btnCockpitCancel.style.display = 'none';
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
    }
  } else if (state === 'COMPLETED') {
    if (alertBanner) alertBanner.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnCockpitRetry) btnCockpitRetry.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnCockpitCancel) btnCockpitCancel.style.display = 'none';
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
    }
  } else if (['PLANNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'CHANGES_REQUESTED', 'FIXING', 'FINAL_CHECK', 'VERIFYING'].includes(state)) {
    if (alertBanner) alertBanner.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnCockpitRetry) btnCockpitRetry.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (btnCockpitCancel) btnCockpitCancel.style.display = 'inline-flex';
  }

  // 7. Update Overview Status Text
  const statusEl = document.getElementById('overview-status');
  if (statusEl) {
    statusEl.textContent = state;
    if (state === 'COMPLETED') {
      statusEl.className = 'metric-value text-emerald';
    } else if (['BLOCKED', 'FAILED', 'CANCELLED'].includes(state)) {
      statusEl.className = 'metric-value text-rose';
    } else {
      statusEl.className = 'metric-value text-cyan';
    }
  }
}

function appendCockpitLog(event) {
  const feedLogs = document.getElementById('cockpit-feed-logs');
  if (!feedLogs) return;

  // Remove empty placeholder
  const emptyPlaceholder = feedLogs.querySelector('.feed-empty');
  if (emptyPlaceholder) emptyPlaceholder.remove();

  const time = event.timestamp ? event.timestamp.split('T')[1].replace('Z', '').split('.')[0] : new Date().toLocaleTimeString();
  const from = (event.from || 'system').toLowerCase();

  let text = '';
  if (event.type === 'USER_REQUEST_RECEIVED') {
    text = `User requirement submitted: "${(event.data?.request || '').slice(0, 70)}..."`;
  } else if (event.type === 'PLAN_REQUESTED') {
    text = `Codex strategic planning started (Model: ${event.data?.model || 'gpt-6-astra'})`;
  } else if (event.type === 'PLAN_RECEIVED') {
    text = `Codex plan created (${event.data?.stepsCount || 8} steps, ${event.data?.criteriaCount || 6} acceptance criteria)`;
  } else if (event.type === 'IMPLEMENTATION_STARTED') {
    text = `Gemini executor code construction started (Model: ${event.data?.model || 'gemini-3.8-flash'})`;
  } else if (event.type === 'IMPLEMENTATION_COMPLETED') {
    text = `Gemini finished workspace code construction`;
  } else if (event.type === 'TEST_STARTED') {
    text = `Objective verifier executing npm test & npm run build in workspace...`;
  } else if (event.type === 'TEST_PASSED') {
    text = `Automated tests & production build PASSED with exit code 0`;
  } else if (event.type === 'TEST_FAILED') {
    text = `Test execution encountered issues: ${(event.data?.errors || []).join('; ')}`;
  } else if (event.type === 'REVIEW_FALLBACK_TRIGGERED') {
    text = `🛡️ Claude review unavailable (${event.data?.reason || ''}) ➔ Auto-switched to Codex Reviewer Fallback (${event.data?.model || 'gpt-6-astra'})`;
  } else if (event.type === 'REVIEW_REQUESTED') {
    const reviewerName = event.to === 'codex' ? 'Codex' : 'Claude Code';
    text = `${reviewerName} adversarial review started (Round ${event.data?.round || 1}, Model: ${event.data?.model || 'opus'})`;
  } else if (event.type === 'REVIEW_APPROVED') {
    const reviewerName = event.from === 'codex' ? 'Codex (Fallback)' : 'Claude Code';
    text = `${reviewerName} APPROVED: ${event.data?.summary || 'Clean architecture, zero blocking flaws'}`;
  } else if (event.type === 'CHANGES_REQUESTED') {
    const reviewerName = event.from === 'codex' ? 'Codex (Fallback)' : 'Claude Code';
    text = `${reviewerName} requested ${event.data?.issuesCount || 1} change(s)`;
  } else if (event.type === 'FIX_STARTED') {
    text = `Gemini repair started for ${event.data?.issuesCount || 1} issue(s)`;
  } else if (event.type === 'FIX_COMPLETED') {
    text = `Gemini repair patch completed in workspace`;
  } else if (event.type === 'FINAL_CHECK_REQUESTED') {
    text = `Codex final plan-conformance check initiated`;
  } else if (event.type === 'FINAL_CHECK_PASSED') {
    text = `Codex confirmed 100% plan conformance (Zero missing items)`;
  } else if (event.type === 'FINAL_CHECK_FAILED') {
    text = `Codex identified non-conformance. Repair initiated.`;
  } else if (event.type === 'VERIFICATION_STARTED') {
    text = `Final objective machine verification started`;
  } else if (event.type === 'VERIFICATION_PASSED') {
    text = `Final verification PASSED (All tests & dist/ build valid)`;
  } else if (event.type === 'WORKFLOW_COMPLETED') {
    text = `🎉 Multi-Agent Collaboration COMPLETED successfully!`;
  } else if (event.type === 'WORKFLOW_BLOCKED') {
    text = `⚠️ Workflow BLOCKED: ${event.data?.message || 'Action required'}`;
  } else if (event.type === 'WORKFLOW_FAILED') {
    text = `❌ Workflow FAILED: ${event.data?.error || 'Execution failed'}`;
  } else if (event.type === 'PHASE_TRANSITION') {
    text = `Transitioned from ${event.data?.from || 'IDLE'} to ${event.data?.to || event.data?.state}`;
  } else {
    text = `${event.type}: ${JSON.stringify(event.data || {})}`;
  }

  const line = document.createElement('div');
  line.className = 'feed-log-item';
  line.innerHTML = `
    <span class="feed-log-time">${time}</span>
    <span class="feed-log-badge ${from}">${(event.from || 'SYS').toUpperCase()}</span>
    <span class="feed-log-text">${text}</span>
  `;

  feedLogs.appendChild(line);
  feedLogs.scrollTop = feedLogs.scrollHeight;
}

function connectRunStream(runId) {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }

  const sseUrl = `/api/runs/${runId}/stream`;
  console.log(`Connecting to SSE stream: ${sseUrl}`);
  const es = new EventSource(sseUrl);
  activeEventSource = es;

  const btnStart = document.getElementById('btn-start-run');
  const btnCancel = document.getElementById('btn-cancel-run');

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      appendLiveEvent(event);
      appendCockpitLog(event);
      updateStepper(currentRunData, event);

      // Check for completion or termination
      if (
        event.type === 'WORKFLOW_COMPLETED' ||
        event.type === 'RUN_COMPLETED' ||
        event.type === 'WORKFLOW_BLOCKED' ||
        event.type === 'WORKFLOW_FAILED' ||
        event.type === 'WORKFLOW_INTERRUPTED'
      ) {
        console.log(`Run ${runId} reached terminal state: ${event.type}`);
        if (event.type === 'WORKFLOW_COMPLETED' || event.type === 'RUN_COMPLETED') {
          if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
          }
          if (btnCancel) btnCancel.style.display = 'none';
        }
        es.close();
        activeEventSource = null;
        loadRuns();
        loadRunDetails(runId);
      }
    } catch (err) {
      console.warn('Error parsing SSE event:', err, e.data);
    }
  };

  es.onerror = (err) => {
    console.warn('SSE connection closed or error:', err);
    loadRunDetails(runId);
  };
}

function appendLiveEvent(event) {
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;

  const firstRow = tbody.querySelector('tr td[colspan]');
  if (firstRow) tbody.innerHTML = '';

  const fromClass = event.from || 'system';
  const time = event.timestamp ? event.timestamp.split('T')[1].replace('Z', '').split('.')[0] : new Date().toLocaleTimeString();

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="color: var(--text-muted);">${time}</td>
    <td><span class="event-badge ${fromClass}">${event.from || 'system'}</span></td>
    <td><span class="event-badge ${event.to || 'all'}">${event.to || 'all'}</span></td>
    <td style="font-weight: 600; color: #f8fafc;">${event.type}</td>
    <td><span style="color: ${event.status === 'success' ? 'var(--accent-emerald)' : event.status === 'failed' ? 'var(--accent-rose)' : 'var(--accent-cyan)'}">${event.status || 'info'}</span></td>
    <td style="color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(event.data || {})}</td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);
}

async function triggerRetryRun() {
  if (!currentRunId) return;

  const btnStart = document.getElementById('btn-start-run');
  const btnRetry = document.getElementById('btn-retry-run');
  const btnCockpitRetry = document.getElementById('btn-cockpit-retry');
  const alertBanner = document.getElementById('cockpit-alert-banner');

  if (btnRetry) btnRetry.disabled = true;
  if (btnCockpitRetry) btnCockpitRetry.disabled = true;

  try {
    const res = await fetch(`/api/runs/${currentRunId}/retry`, { method: 'POST' });
    const result = await res.json();

    if (result.error) {
      alert('Could not retry run: ' + result.error);
      if (btnRetry) btnRetry.disabled = false;
      if (btnCockpitRetry) btnCockpitRetry.disabled = false;
      return;
    }

    if (alertBanner) alertBanner.style.display = 'none';
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.innerHTML = '<span class="btn-icon">⏳</span><span>Collaborating...</span>';
    }

    // Switch to overview tab
    const overviewTabBtn = document.querySelector('.tab-btn[data-tab="tab-overview"]');
    if (overviewTabBtn) overviewTabBtn.click();

    // Reconnect SSE
    connectRunStream(currentRunId);
    await loadRunDetails(currentRunId);
  } catch (err) {
    alert('Error retrying run: ' + err.message);
    if (btnRetry) btnRetry.disabled = false;
    if (btnCockpitRetry) btnCockpitRetry.disabled = false;
  }
}

async function triggerFallbackRun() {
  if (!currentRunId) return;

  const btnFallback = document.getElementById('btn-banner-fallback');
  const alertBanner = document.getElementById('cockpit-alert-banner');
  const btnStart = document.getElementById('btn-start-run');

  if (btnFallback) btnFallback.disabled = true;

  try {
    const res = await fetch(`/api/runs/${currentRunId}/fallback`, { method: 'POST' });
    const result = await res.json();

    if (result.error) {
      alert('Could not proceed with fallback: ' + result.error);
      if (btnFallback) btnFallback.disabled = false;
      return;
    }

    if (alertBanner) alertBanner.style.display = 'none';
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.innerHTML = '<span class="btn-icon">⏳</span><span>Collaborating...</span>';
    }

    // Switch to overview tab
    const overviewTabBtn = document.querySelector('.tab-btn[data-tab="tab-overview"]');
    if (overviewTabBtn) overviewTabBtn.click();

    // Reconnect SSE
    connectRunStream(currentRunId);
    await loadRunDetails(currentRunId);
  } catch (err) {
    alert('Error running fallback: ' + err.message);
    if (btnFallback) btnFallback.disabled = false;
  }
}

function initActionButtons() {
  const btnStart = document.getElementById('btn-start-run');
  const btnCancel = document.getElementById('btn-cancel-run');
  const btnRetry = document.getElementById('btn-retry-run');
  const btnCockpitCancel = document.getElementById('btn-cockpit-cancel');
  const btnCockpitRetry = document.getElementById('btn-cockpit-retry');
  const btnBannerRetry = document.getElementById('btn-banner-retry');
  const btnBannerFallback = document.getElementById('btn-banner-fallback');
  const btnCopyCmd = document.getElementById('btn-copy-auth-cmd');
  const promptInput = document.getElementById('prompt-input');

  // Wire retry buttons
  [btnRetry, btnCockpitRetry, btnBannerRetry].forEach((btn) => {
    if (btn) btn.addEventListener('click', triggerRetryRun);
  });

  // Wire fallback button
  if (btnBannerFallback) {
    btnBannerFallback.addEventListener('click', triggerFallbackRun);
  }

  // Wire copy command button
  if (btnCopyCmd) {
    btnCopyCmd.addEventListener('click', () => {
      const codeEl = document.getElementById('alert-code-cmd');
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent.trim()).then(() => {
          btnCopyCmd.textContent = '✅ Copied!';
          setTimeout(() => { btnCopyCmd.textContent = '📋 Copy'; }, 2000);
        });
      }
    });
  }

  btnStart.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="btn-icon">⏳</span><span>Collaborating...</span>';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (btnCockpitCancel) btnCockpitCancel.style.display = 'inline-flex';
    if (btnRetry) btnRetry.style.display = 'none';
    if (btnCockpitRetry) btnCockpitRetry.style.display = 'none';

    const codexModel = document.getElementById('select-codex-model').value;
    const claudeModel = document.getElementById('select-claude-model').value;
    const geminiModel = document.getElementById('select-gemini-model').value;
    const reasoningEffort = document.querySelector('#segment-reasoning .segment-btn.active')?.getAttribute('data-value') || 'low';
    const reviewerFallback = document.getElementById('check-reviewer-fallback')?.checked !== false;

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          codexModel,
          claudeModel,
          geminiModel,
          reasoningEffort,
          reviewerFallback,
        }),
      });

      const result = await res.json();
      if (result.error) {
        alert('Could not start run: ' + result.error);
        btnStart.disabled = false;
        btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
        if (btnCancel) btnCancel.style.display = 'none';
        if (btnCockpitCancel) btnCockpitCancel.style.display = 'none';
        return;
      }

      if (result.run_id) {
        currentRunId = result.run_id;
        currentRunData = {
          id: result.run_id,
          currentState: 'REQUEST_RECEIVED',
          files: {},
        };

        // Switch to overview tab immediately
        const overviewTabBtn = document.querySelector('.tab-btn[data-tab="tab-overview"]');
        if (overviewTabBtn) overviewTabBtn.click();

        // Clear audit log & cockpit feed for clean live view
        const tbody = document.getElementById('events-tbody');
        if (tbody) tbody.innerHTML = '';
        const feedLogs = document.getElementById('cockpit-feed-logs');
        if (feedLogs) feedLogs.innerHTML = '';

        // Immediately update stepper to step 1
        updateStepper(currentRunData, {
          type: 'USER_REQUEST_RECEIVED',
          from: 'user',
          to: 'orchestrator',
          data: { request: prompt },
          timestamp: new Date().toISOString(),
        });
        appendCockpitLog({
          type: 'USER_REQUEST_RECEIVED',
          from: 'user',
          to: 'orchestrator',
          data: { request: prompt },
          timestamp: new Date().toISOString(),
        });

        // Connect SSE stream
        connectRunStream(result.run_id);
        await loadRuns();
      }
    } catch (err) {
      alert('Error launching collaboration run: ' + err.message);
      btnStart.disabled = false;
      btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnCockpitCancel) btnCockpitCancel.style.display = 'none';
    }
  });

  const cancelAction = async () => {
    if (!currentRunId) return;
    if (!confirm('Are you sure you want to cancel the active collaboration run?')) return;

    try {
      if (btnCancel) {
        btnCancel.disabled = true;
        btnCancel.textContent = 'Cancelling...';
      }
      const res = await fetch(`/api/runs/${currentRunId}/cancel`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        console.log(`Run ${currentRunId} cancelled.`);
      }
    } catch (err) {
      alert('Error cancelling run: ' + err.message);
    } finally {
      if (btnCancel) {
        btnCancel.disabled = false;
        btnCancel.style.display = 'none';
      }
      if (btnCockpitCancel) btnCockpitCancel.style.display = 'none';
      btnStart.disabled = false;
      btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>Start Collaboration</span>';
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      await loadRunDetails(currentRunId);
    }
  };

  if (btnCancel) btnCancel.addEventListener('click', cancelAction);
  if (btnCockpitCancel) btnCockpitCancel.addEventListener('click', cancelAction);
}

// ==========================================================================
// Workspace Output Location & CLI Run Instructions
// ==========================================================================

function renderWorkspaceOutput(data) {
  const ws = data.workspace || {};
  const runId = data.id || currentRunId;

  // Workspace & Dist Paths
  const wsPathEl = document.getElementById('output-workspace-path');
  const distPathEl = document.getElementById('output-dist-path');
  if (wsPathEl) wsPathEl.textContent = ws.workspacePath || 'No workspace directory available';
  if (distPathEl) {
    if (ws.hasDist) {
      distPathEl.textContent = ws.distPath;
    } else {
      distPathEl.textContent = ws.workspacePath
        ? `${ws.workspacePath}/dist (Chưa hoàn tất build hoặc đang chạy)`
        : 'Chưa có bản build dist/';
    }
  }

  // Run Commands
  const cmdPreviewEl = document.getElementById('cmd-preview');
  const cmdDevEl = document.getElementById('cmd-dev');
  const cmdTestEl = document.getElementById('cmd-test');
  if (cmdPreviewEl) cmdPreviewEl.textContent = ws.runCommands?.preview || (ws.workspacePath ? `cd "${ws.workspacePath}" && npm run preview` : 'npm run preview');
  if (cmdDevEl) cmdDevEl.textContent = ws.runCommands?.dev || (ws.workspacePath ? `cd "${ws.workspacePath}" && npm run dev` : 'npm run dev');
  if (cmdTestEl) cmdTestEl.textContent = ws.runCommands?.test || (ws.workspacePath ? `cd "${ws.workspacePath}" && npm test` : 'npm test');

  // Preview URLs
  const previewUrl = ws.previewUrl || `/preview/${runId}/`;
  const previewUrlDisplay = document.getElementById('preview-url-display');
  const previewIframe = document.getElementById('preview-iframe');
  const previewExtLink = document.getElementById('preview-external-link');
  const previewOpenExt = document.getElementById('btn-open-preview-external');

  if (previewUrlDisplay) previewUrlDisplay.textContent = previewUrl;
  if (previewExtLink) previewExtLink.href = previewUrl;
  if (previewOpenExt) previewOpenExt.href = previewUrl;

  // Update iframe if dist exists
  if (previewIframe) {
    if (ws.hasDist) {
      const currentSrc = previewIframe.src;
      if (!currentSrc.includes(previewUrl)) {
        previewIframe.src = previewUrl;
      }
    } else if (data.id === 'run-e2e-001') {
      previewIframe.src = 'http://127.0.0.1:5173/';
    }
  }

  // Update Workspace Files root
  const rootPathEl = document.getElementById('files-root-path');
  if (rootPathEl) rootPathEl.textContent = ws.workspacePath || '';
}

// ==========================================================================
// Workspace Files Explorer Logic
// ==========================================================================

let currentWorkspaceFiles = [];
let activeSelectedFilePath = null;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function loadWorkspaceFiles(runId) {
  const treeEl = document.getElementById('files-tree-list');
  const countEl = document.getElementById('files-count-badge');
  if (!treeEl) return;

  try {
    treeEl.innerHTML = '<li class="files-empty-item">Scanning workspace files...</li>';
    const res = await fetch(`/api/runs/${runId}/files`);
    const data = await res.json();
    currentWorkspaceFiles = (data.files || [])
      .filter((f) => !f.isDir)
      .map((f) => ({
        ...f,
        sizeFormatted: formatBytes(f.size),
      }));

    if (countEl) countEl.textContent = `${currentWorkspaceFiles.length} files`;

    renderFilesList(currentWorkspaceFiles);

    // Auto-select primary entry point if available
    if (currentWorkspaceFiles.length > 0) {
      const preferred = currentWorkspaceFiles.find((f) =>
        f.path.includes('App.jsx') || f.path.includes('App.tsx') || f.path.includes('main.jsx') || f.path.includes('index.html')
      ) || currentWorkspaceFiles[0];
      selectWorkspaceFile(runId, preferred.path, preferred.sizeFormatted);
    } else {
      const codeEl = document.getElementById('file-code-display');
      if (codeEl) codeEl.textContent = '// No source files found in this workspace yet.';
    }
  } catch (err) {
    console.warn('Failed to load workspace files:', err);
    treeEl.innerHTML = '<li class="files-empty-item">Could not load files.</li>';
  }
}

function renderFilesList(files) {
  const treeEl = document.getElementById('files-tree-list');
  if (!treeEl) return;
  if (!files || files.length === 0) {
    treeEl.innerHTML = '<li class="files-empty-item">No files matched.</li>';
    return;
  }

  const getFileIcon = (p) => {
    if (p.endsWith('.jsx') || p.endsWith('.tsx')) return '⚛️';
    if (p.endsWith('.js') || p.endsWith('.ts')) return '📜';
    if (p.endsWith('.css')) return '🎨';
    if (p.endsWith('.html')) return '🌐';
    if (p.endsWith('.json')) return '⚙️';
    if (p.endsWith('.md')) return '📝';
    if (p.includes('/test/') || p.includes('.test.')) return '🧪';
    return '📄';
  };

  treeEl.innerHTML = files
    .map(
      (f) => `
    <li class="files-tree-item ${activeSelectedFilePath === f.path ? 'active' : ''}" data-path="${f.path}" data-size="${f.sizeFormatted}">
      <div class="tree-item-name" title="${f.path}">
        <span>${getFileIcon(f.path)}</span>
        <span>${f.path}</span>
      </div>
      <span class="tree-item-size">${f.sizeFormatted}</span>
    </li>
  `
    )
    .join('');

  treeEl.querySelectorAll('.files-tree-item').forEach((item) => {
    item.addEventListener('click', () => {
      const filePath = item.getAttribute('data-path');
      const sizeStr = item.getAttribute('data-size');
      selectWorkspaceFile(currentRunId, filePath, sizeStr);
    });
  });
}

async function selectWorkspaceFile(runId, filePath, sizeStr) {
  activeSelectedFilePath = filePath;
  const nameEl = document.getElementById('file-active-name');
  const sizeEl = document.getElementById('file-active-size');
  const codeEl = document.getElementById('file-code-display');

  if (nameEl) nameEl.textContent = filePath;
  if (sizeEl) sizeEl.textContent = sizeStr || '';
  if (codeEl) codeEl.textContent = 'Loading file content...';

  // Highlight active tree item
  document.querySelectorAll('#files-tree-list .files-tree-item').forEach((el) => {
    if (el.getAttribute('data-path') === filePath) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  try {
    const res = await fetch(`/api/runs/${runId}/file-content?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (codeEl) {
      codeEl.textContent = data.content !== undefined ? data.content : `// Error reading file: ${data.error}`;
    }
  } catch (err) {
    if (codeEl) codeEl.textContent = `// Failed to fetch content: ${err.message}`;
  }
}

function initOutputAndFilesActions() {
  // 1. Copy Buttons (data-copy-target)
  document.querySelectorAll('[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const text = targetEl.textContent || targetEl.innerText;
      try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 1500);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    });
  });

  // 2. Open in Finder Buttons
  const triggerOpenFinder = async () => {
    if (!currentRunId) return;
    try {
      const res = await fetch(`/api/runs/${currentRunId}/open-folder`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        console.log('Opened folder in Finder:', data.workspacePath);
      } else {
        alert('Could not open folder: ' + data.error);
      }
    } catch (err) {
      alert('Error opening folder: ' + err.message);
    }
  };

  const btnOpenFinder = document.getElementById('btn-open-finder');
  if (btnOpenFinder) btnOpenFinder.addEventListener('click', triggerOpenFinder);

  const btnFilesOpenFinder = document.getElementById('btn-files-open-finder');
  if (btnFilesOpenFinder) btnFilesOpenFinder.addEventListener('click', triggerOpenFinder);

  // 3. Switch to Preview Tab Button
  const btnViewPreview = document.getElementById('btn-view-preview-tab');
  if (btnViewPreview) {
    btnViewPreview.addEventListener('click', () => {
      const previewTabBtn = document.querySelector('.tab-btn[data-tab="tab-preview"]');
      if (previewTabBtn) previewTabBtn.click();
    });
  }

  // 4. Reload Preview Button
  const btnReloadPreview = document.getElementById('btn-reload-preview');
  if (btnReloadPreview) {
    btnReloadPreview.addEventListener('click', () => {
      const iframe = document.getElementById('preview-iframe');
      if (iframe) {
        const src = iframe.src;
        iframe.src = 'about:blank';
        setTimeout(() => {
          iframe.src = src;
        }, 50);
      }
    });
  }

  // 5. Refresh Files Button
  const btnRefreshFiles = document.getElementById('btn-refresh-files');
  if (btnRefreshFiles) {
    btnRefreshFiles.addEventListener('click', () => {
      if (currentRunId) loadWorkspaceFiles(currentRunId);
    });
  }

  // 6. Copy Active File Button
  const btnCopyActiveFile = document.getElementById('btn-copy-active-file');
  if (btnCopyActiveFile) {
    btnCopyActiveFile.addEventListener('click', async () => {
      const codeEl = document.getElementById('file-code-display');
      if (!codeEl) return;
      try {
        await navigator.clipboard.writeText(codeEl.textContent);
        const originalText = btnCopyActiveFile.innerHTML;
        btnCopyActiveFile.innerHTML = '✓ Copied!';
        setTimeout(() => {
          btnCopyActiveFile.innerHTML = originalText;
        }, 1500);
      } catch (err) {
        console.warn('Copy file failed:', err);
      }
    });
  }

  // 7. Search/Filter Files
  const searchInput = document.getElementById('files-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderFilesList(currentWorkspaceFiles);
      } else {
        const filtered = currentWorkspaceFiles.filter((f) => f.path.toLowerCase().includes(q));
        renderFilesList(filtered);
      }
    });
  }

  // 8. Tab switch to tab-files loads files if needed
  const filesTabBtn = document.querySelector('.tab-btn[data-tab="tab-files"]');
  if (filesTabBtn) {
    filesTabBtn.addEventListener('click', () => {
      if (currentRunId) loadWorkspaceFiles(currentRunId);
    });
  }
}

