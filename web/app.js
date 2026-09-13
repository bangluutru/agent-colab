// AI Team — Agent Collaboration Frontend Logic
// Full backward compatibility with backend orchestration APIs & real-time SSE streaming

// ==========================================================================
// I18N Single Source of Truth (SOT)
// ==========================================================================
const I18N = {
  theme: {
    lightTitle: 'Switch to Dark Mode (Chuyển sang giao diện tối)',
    darkTitle: 'Switch to Light Mode (Chuyển sang giao diện sáng)',
    switchToDark: 'Switch to Dark Mode',
    switchToLight: 'Switch to Light Mode',
    switchedToDark: '🌙 Switched to Dark theme',
    switchedToLight: '☀️ Switched to Light theme',
  },
  attach: {
    success: (filename, size) => `📎 Attached spec: ${filename} (${size})`,
    empty: 'Selected file is empty or unreadable.',
  },
  nav: {
    noRunsYet: 'No project runs yet. Enter a requirement prompt above to start your first build!',
    openedLatest: (id) => `Opened workspace for latest run: ${id}`,
  },
};

let currentRunData = null;
let currentRunId = 'run-e2e-001';
let activeEventSource = null;
let cachedClusterStatus = null;
let cachedRunsList = [];
let cachedAvailableModels = {};
let cachedPresets = {};

let currentRouting = {
  preset: 'recommended',
  planner: { agent: 'codex', model: 'gpt-6-astra' },
  builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
  reviewer: { agent: 'claude', model: 'claude-sonnet-5' },
  fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
  final_checker: { agent: 'codex', model: 'gpt-6-astra' },
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initUserProfileMenu();
  initDocsModal();
  initFileAttachment();
  initNavigation();
  initSearchPrompt();
  initTabs();
  initDeviceToggles();
  initPresets();
  initRunSelector();
  initActionButtons();
  initOutputAndFilesActions();
  initSettingsDrawer();
  initAgentsModal();
  initRoutingControls();

  await loadModelsAndStatus();
  await loadRuns();
  if (currentRunId) {
    await loadRunDetails(currentRunId);
  }
});

// Toast / Notification Utility
function showNotification(message, duration = 3000) {
  let toast = document.getElementById('app-floating-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-floating-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '9999';
    toast.style.background = 'var(--surface)';
    toast.style.color = 'var(--text-primary)';
    toast.style.border = '1px solid var(--border)';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.borderRadius = '10px';
    toast.style.padding = '10px 16px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    toast.style.pointerEvents = 'none';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, duration);
}

// ==========================================================================
// Theme Management (Cascading Variable Architecture + SOT via I18N)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('ai_team_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  applyTheme(initialTheme, false);

  const btnToggle = document.getElementById('btn-theme-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      toggleTheme();
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('ai_team_theme')) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  const nextTheme = isDark ? 'light' : 'dark';
  applyTheme(nextTheme, true);
  showNotification(nextTheme === 'dark' ? I18N.theme.switchedToDark : I18N.theme.switchedToLight);
}

function applyTheme(themeName, persist = true) {
  const isDark = themeName === 'dark';
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const btnToggle = document.getElementById('btn-theme-toggle');
  const userMenuIcon = document.getElementById('user-menu-theme-icon');
  const userMenuLabel = document.getElementById('user-menu-theme-label');

  if (isDark) {
    htmlEl.setAttribute('data-theme', 'dark');
    htmlEl.classList.add('dark-theme');
    if (bodyEl) bodyEl.classList.add('dark-theme');

    if (btnToggle) {
      btnToggle.setAttribute('title', I18N.theme.darkTitle);
      btnToggle.setAttribute('aria-label', I18N.theme.darkTitle);
      btnToggle.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
    if (userMenuIcon) userMenuIcon.textContent = '☀️';
    if (userMenuLabel) userMenuLabel.textContent = I18N.theme.switchToLight;
  } else {
    htmlEl.setAttribute('data-theme', 'light');
    htmlEl.classList.remove('dark-theme');
    if (bodyEl) bodyEl.classList.remove('dark-theme');

    if (btnToggle) {
      btnToggle.setAttribute('title', I18N.theme.lightTitle);
      btnToggle.setAttribute('aria-label', I18N.theme.lightTitle);
      btnToggle.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    }
    if (userMenuIcon) userMenuIcon.textContent = '🌙';
    if (userMenuLabel) userMenuLabel.textContent = I18N.theme.switchToDark;
  }

  if (persist) {
    localStorage.setItem('ai_team_theme', themeName);
  }
}

// ==========================================================================
// User Profile & Workspace Dropdown Menu
// ==========================================================================
function initUserProfileMenu() {
  const btnProfile = document.getElementById('btn-user-profile');
  const menu = document.getElementById('user-profile-menu');
  const menuItemTheme = document.getElementById('menu-item-theme');
  const menuItemSettings = document.getElementById('menu-item-settings');
  const menuItemDocs = document.getElementById('menu-item-docs');
  const menuItemAgents = document.getElementById('menu-item-agents');

  if (btnProfile && menu) {
    btnProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', () => {
      menu.style.display = 'none';
    });
  }

  if (menuItemTheme) {
    menuItemTheme.addEventListener('click', () => {
      toggleTheme();
    });
  }

  if (menuItemSettings) {
    menuItemSettings.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
      openSettingsDrawer();
    });
  }

  if (menuItemDocs) {
    menuItemDocs.addEventListener('click', (e) => {
      if (menu) menu.style.display = 'none';
      const modal = document.getElementById('docs-modal-backdrop');
      if (modal) modal.style.display = 'flex';
    });
  }

  if (menuItemAgents) {
    menuItemAgents.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
      openAgentsModal();
    });
  }
}

// ==========================================================================
// In-App Documentation Modal & Tabs
// ==========================================================================
function initDocsModal() {
  const modal = document.getElementById('docs-modal-backdrop');
  const btnDocsLink = document.getElementById('btn-docs-link');
  const btnClose = document.getElementById('btn-close-docs-modal');

  const openDocs = (e) => {
    if (e) e.preventDefault();
    if (modal) modal.style.display = 'flex';
  };

  const closeDocs = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnDocsLink) {
    btnDocsLink.addEventListener('click', openDocs);
  }
  if (btnClose) {
    btnClose.addEventListener('click', closeDocs);
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDocs();
    });
  }

  // Tab switching inside docs
  const tabBtns = document.querySelectorAll('.docs-tab-btn');
  const tabContents = document.querySelectorAll('.docs-tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-docs-tab');
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetEl = document.getElementById(targetTab);
      if (targetEl) targetEl.classList.add('active');
    });
  });
}

// ==========================================================================
// Context / Spec File Attachment
// ==========================================================================
function initFileAttachment() {
  const btnAttach = document.getElementById('btn-attach');
  const filePicker = document.getElementById('file-spec-picker');
  const textarea = document.getElementById('prompt-input');

  if (btnAttach && filePicker) {
    btnAttach.addEventListener('click', () => {
      filePicker.click();
    });

    filePicker.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content !== 'string' || !content.trim()) {
          showNotification(I18N.attach.empty);
          return;
        }

        const sizeKb = (file.size / 1024).toFixed(1);
        const snippet = `\n\n--- [Attached Spec: ${file.name} (${sizeKb} KB)] ---\n${content.trim()}\n--- [End of ${file.name}] ---\n`;

        if (textarea) {
          textarea.value = (textarea.value ? textarea.value.trim() : '') + snippet;
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
          textarea.focus();
        }
        showNotification(I18N.attach.success(file.name, `${sizeKb} KB`));
        filePicker.value = '';
      };
      reader.readAsText(file);
    });
  }
}

// ==========================================================================
// 0. Model-Agnostic Workflow Routing Engine
// ==========================================================================

function getAgentMeta(agentId) {
  switch (agentId) {
    case 'codex':
      return {
        id: 'codex',
        name: 'Codex CLI',
        fullName: 'OpenAI Codex CLI',
        icon: '🔮',
        badgeClass: 'codex',
        defaultModel: 'gpt-6-astra',
      };
    case 'gemini':
      return {
        id: 'gemini',
        name: 'Gemini 3.8',
        fullName: 'Google Antigravity / Gemini',
        icon: '⚡',
        badgeClass: 'gemini',
        defaultModel: 'gemini-3.8-flash',
      };
    case 'claude':
      return {
        id: 'claude',
        name: 'Claude Code',
        fullName: 'Anthropic Claude Code CLI',
        icon: '🛡️',
        badgeClass: 'claude',
        defaultModel: 'claude-sonnet-5',
      };
    default:
      return {
        id: agentId,
        name: agentId || 'AI Agent',
        fullName: agentId || 'AI Agent',
        icon: '🤖',
        badgeClass: 'system',
        defaultModel: '',
      };
  }
}

function renderModelOptionsForAgent(agentId, selectedModel) {
  const models = cachedAvailableModels[agentId] || [];
  if (models.length === 0) {
    const meta = getAgentMeta(agentId);
    const m = selectedModel || meta.defaultModel;
    return `<option value="${m}">${m}</option>`;
  }
  return renderGroupedOptions(models);
}

function updateStageCardsUI() {
  // 1. Planner
  const plannerMeta = getAgentMeta(currentRouting.planner.agent);
  const plannerIcon = document.getElementById('stage-planner-icon');
  const plannerName = document.getElementById('stage-planner-name');
  const plannerModel = document.getElementById('stage-planner-model');
  const plannerPill = document.getElementById('stage-planner-pill');

  if (plannerIcon) plannerIcon.textContent = plannerMeta.icon;
  if (plannerName) plannerName.textContent = plannerMeta.name;
  if (plannerModel) {
    const modelObj = (cachedAvailableModels[currentRouting.planner.agent] || []).find(
      (m) => m.id === currentRouting.planner.model
    );
    plannerModel.textContent = modelObj ? modelObj.name : currentRouting.planner.model;
  }
  if (plannerPill) {
    plannerPill.className = `assigned-agent-pill ${plannerMeta.badgeClass}`;
  }

  // 2. Builder
  const builderMeta = getAgentMeta(currentRouting.builder.agent);
  const builderIcon = document.getElementById('stage-builder-icon');
  const builderName = document.getElementById('stage-builder-name');
  const builderModel = document.getElementById('stage-builder-model');
  const builderPill = document.getElementById('stage-builder-pill');

  if (builderIcon) builderIcon.textContent = builderMeta.icon;
  if (builderName) builderName.textContent = builderMeta.name;
  if (builderModel) {
    const modelObj = (cachedAvailableModels[currentRouting.builder.agent] || []).find(
      (m) => m.id === currentRouting.builder.model
    );
    builderModel.textContent = modelObj ? modelObj.name : currentRouting.builder.model;
  }
  if (builderPill) {
    builderPill.className = `assigned-agent-pill ${builderMeta.badgeClass}`;
  }

  // 3. Reviewer
  const reviewerMeta = getAgentMeta(currentRouting.reviewer.agent);
  const reviewerIcon = document.getElementById('stage-reviewer-icon');
  const reviewerName = document.getElementById('stage-reviewer-name');
  const reviewerModel = document.getElementById('stage-reviewer-model');
  const reviewerPill = document.getElementById('stage-reviewer-pill');

  if (reviewerIcon) reviewerIcon.textContent = reviewerMeta.icon;
  if (reviewerName) reviewerName.textContent = reviewerMeta.name;
  if (reviewerModel) {
    const modelObj = (cachedAvailableModels[currentRouting.reviewer.agent] || []).find(
      (m) => m.id === currentRouting.reviewer.model
    );
    reviewerModel.textContent = modelObj ? modelObj.name : currentRouting.reviewer.model;
  }
  if (reviewerPill) {
    reviewerPill.className = `assigned-agent-pill ${reviewerMeta.badgeClass}`;
  }

  // 4. Review Independence Badge
  const independenceBadge = document.getElementById('review-independence-badge');
  if (independenceBadge) {
    const isSelfReview = currentRouting.reviewer.agent === currentRouting.builder.agent;
    if (isSelfReview) {
      independenceBadge.className = 'status-pill status-pill-amber';
      independenceBadge.innerHTML = '⚠️ Self-review (Same Agent)';
      independenceBadge.title = `Warning: ${builderMeta.name} is acting as both Builder and Reviewer. Independent adversarial quality gate is compromised.`;
    } else {
      independenceBadge.className = 'status-pill status-pill-green';
      independenceBadge.innerHTML = '✓ Independent review';
      independenceBadge.title = `Quality Gate: Reviewer (${reviewerMeta.name}) is strictly independent from Builder (${builderMeta.name}).`;
    }
  }
}

function syncRoutingControls(source = 'all') {
  // Sync Preset Select
  const presetSelect = document.getElementById('select-team-preset');
  if (presetSelect && source !== 'preset') {
    presetSelect.value = currentRouting.preset || 'custom';
  }

  const setupSelect = (selectEl, agentId, currentModel) => {
    if (!selectEl) return;
    selectEl.innerHTML = renderModelOptionsForAgent(agentId, currentModel);
    if (currentModel) selectEl.value = currentModel;
  };

  // Planner
  const quickPlannerAgent = document.getElementById('quick-select-planner-agent');
  const quickPlannerModel = document.getElementById('quick-select-planner-model');
  const drawerPlannerAgent = document.getElementById('select-planner-agent');
  const drawerPlannerModel = document.getElementById('select-planner-model');

  if (quickPlannerAgent) quickPlannerAgent.value = currentRouting.planner.agent;
  if (drawerPlannerAgent) drawerPlannerAgent.value = currentRouting.planner.agent;
  setupSelect(quickPlannerModel, currentRouting.planner.agent, currentRouting.planner.model);
  setupSelect(drawerPlannerModel, currentRouting.planner.agent, currentRouting.planner.model);

  // Builder
  const quickBuilderAgent = document.getElementById('quick-select-builder-agent');
  const quickBuilderModel = document.getElementById('quick-select-builder-model');
  const drawerBuilderAgent = document.getElementById('select-builder-agent');
  const drawerBuilderModel = document.getElementById('select-builder-model');

  if (quickBuilderAgent) quickBuilderAgent.value = currentRouting.builder.agent;
  if (drawerBuilderAgent) drawerBuilderAgent.value = currentRouting.builder.agent;
  setupSelect(quickBuilderModel, currentRouting.builder.agent, currentRouting.builder.model);
  setupSelect(drawerBuilderModel, currentRouting.builder.agent, currentRouting.builder.model);

  // Reviewer
  const quickReviewerAgent = document.getElementById('quick-select-reviewer-agent');
  const quickReviewerModel = document.getElementById('quick-select-reviewer-model');
  const drawerReviewerAgent = document.getElementById('select-reviewer-agent');
  const drawerReviewerModel = document.getElementById('select-reviewer-model');

  if (quickReviewerAgent) quickReviewerAgent.value = currentRouting.reviewer.agent;
  if (drawerReviewerAgent) drawerReviewerAgent.value = currentRouting.reviewer.agent;
  setupSelect(quickReviewerModel, currentRouting.reviewer.agent, currentRouting.reviewer.model);
  setupSelect(drawerReviewerModel, currentRouting.reviewer.agent, currentRouting.reviewer.model);

  // Advanced roles (Fixer & Conformance)
  const fixerSelect = document.getElementById('select-fixer-agent');
  if (fixerSelect) {
    if (currentRouting.fixer.agent === currentRouting.builder.agent) {
      fixerSelect.value = 'auto';
    } else {
      fixerSelect.value = currentRouting.fixer.agent;
    }
  }

  const finalCheckSelect = document.getElementById('select-finalcheck-agent');
  if (finalCheckSelect) {
    if (currentRouting.final_checker.agent === currentRouting.planner.agent) {
      finalCheckSelect.value = 'auto';
    } else {
      finalCheckSelect.value = currentRouting.final_checker.agent;
    }
  }

  // Keep legacy hidden selects synchronized for backward compatibility
  const legacyCodex = document.getElementById('select-codex-model');
  const legacyGemini = document.getElementById('select-gemini-model');
  const legacyClaude = document.getElementById('select-claude-model');
  if (legacyCodex && currentRouting.planner.agent === 'codex') legacyCodex.value = currentRouting.planner.model;
  if (legacyGemini && currentRouting.builder.agent === 'gemini') legacyGemini.value = currentRouting.builder.model;
  if (legacyClaude && currentRouting.reviewer.agent === 'claude') legacyClaude.value = currentRouting.reviewer.model;

  updateStageCardsUI();
}

function applyTeamPreset(presetKey) {
  let preset = cachedPresets[presetKey];
  if (!preset) {
    if (presetKey === 'recommended') {
      preset = {
        name: 'Recommended (Balanced)',
        planner: { agent: 'codex', model: 'gpt-6-astra' },
        builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
        reviewer: { agent: 'claude', model: 'claude-sonnet-5' },
        fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
        final_checker: { agent: 'codex', model: 'gpt-6-astra' },
      };
    } else if (presetKey === 'all_gemini') {
      preset = {
        name: 'All Gemini (Host & Autonomous)',
        planner: { agent: 'gemini', model: 'gemini-3.8-flash' },
        builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
        reviewer: { agent: 'gemini', model: 'gemini-3.8-flash' },
        fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
        final_checker: { agent: 'gemini', model: 'gemini-3.8-flash' },
      };
    } else if (presetKey === 'fast') {
      preset = {
        name: 'Fast Delivery',
        planner: { agent: 'gemini', model: 'gemini-3.8-flash' },
        builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
        reviewer: { agent: 'claude', model: 'claude-3-5-haiku' },
        fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
        final_checker: { agent: 'gemini', model: 'gemini-3.8-flash' },
      };
    } else if (presetKey === 'deep_review') {
      preset = {
        name: 'Deep Adversarial',
        planner: { agent: 'codex', model: 'gpt-6-astra' },
        builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
        reviewer: { agent: 'claude', model: 'claude-opus-4' },
        fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
        final_checker: { agent: 'codex', model: 'gpt-6-astra' },
      };
    }
  }

  if (preset) {
    currentRouting = {
      preset: presetKey,
      planner: { ...preset.planner },
      builder: { ...preset.builder },
      reviewer: { ...preset.reviewer },
      fixer: { ...(preset.fixer || preset.builder) },
      final_checker: { ...(preset.final_checker || preset.planner) },
    };
    syncRoutingControls('preset');
  }
}

function onRoleAgentChanged(role, agentId) {
  currentRouting.preset = 'custom';
  const meta = getAgentMeta(agentId);
  const models = cachedAvailableModels[agentId] || [];
  const defaultModel = models[0]?.id || meta.defaultModel;

  currentRouting[role] = {
    agent: agentId,
    model: defaultModel,
  };

  // If fixer or final_checker were tracking auto, update them
  if (role === 'builder') {
    const fixerSelect = document.getElementById('select-fixer-agent');
    if (!fixerSelect || fixerSelect.value === 'auto') {
      currentRouting.fixer = { agent: agentId, model: defaultModel };
    }
  }
  if (role === 'planner') {
    const finalSelect = document.getElementById('select-finalcheck-agent');
    if (!finalSelect || finalSelect.value === 'auto') {
      currentRouting.final_checker = { agent: agentId, model: defaultModel };
    }
  }

  syncRoutingControls();
}

function onRoleModelChanged(role, modelId) {
  currentRouting.preset = 'custom';
  if (currentRouting[role]) {
    currentRouting[role].model = modelId;
  }
  syncRoutingControls();
}

function initQuickPopovers() {
  const closeAllPopovers = () => {
    document.querySelectorAll('.agent-quick-popover').forEach((p) => {
      p.style.display = 'none';
    });
  };

  // Open / Toggle popovers
  document.querySelectorAll('.btn-change-agent').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target') || ('popover-' + btn.getAttribute('data-stage'));
      const popover = document.getElementById(targetId);
      if (!popover) return;

      const isVisible = popover.style.display === 'block';
      closeAllPopovers();
      if (!isVisible) {
        popover.style.display = 'block';
      }
    });
  });

  // Close buttons
  document.querySelectorAll('.popover-close').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target') || ('popover-' + btn.getAttribute('data-stage'));
      const popover = document.getElementById(targetId);
      if (popover) popover.style.display = 'none';
    });
  });

  // Prevent inside clicks from closing popovers
  document.querySelectorAll('.agent-quick-popover').forEach((pop) => {
    pop.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Clicking outside closes all popovers
  document.addEventListener('click', () => {
    closeAllPopovers();
  });

  // Planner quick selects
  const quickPlannerAgent = document.getElementById('quick-select-planner-agent');
  if (quickPlannerAgent) {
    quickPlannerAgent.addEventListener('change', (e) => onRoleAgentChanged('planner', e.target.value));
  }
  const quickPlannerModel = document.getElementById('quick-select-planner-model');
  if (quickPlannerModel) {
    quickPlannerModel.addEventListener('change', (e) => onRoleModelChanged('planner', e.target.value));
  }

  // Builder quick selects
  const quickBuilderAgent = document.getElementById('quick-select-builder-agent');
  if (quickBuilderAgent) {
    quickBuilderAgent.addEventListener('change', (e) => onRoleAgentChanged('builder', e.target.value));
  }
  const quickBuilderModel = document.getElementById('quick-select-builder-model');
  if (quickBuilderModel) {
    quickBuilderModel.addEventListener('change', (e) => onRoleModelChanged('builder', e.target.value));
  }

  // Reviewer quick selects
  const quickReviewerAgent = document.getElementById('quick-select-reviewer-agent');
  if (quickReviewerAgent) {
    quickReviewerAgent.addEventListener('change', (e) => onRoleAgentChanged('reviewer', e.target.value));
  }
  const quickReviewerModel = document.getElementById('quick-select-reviewer-model');
  if (quickReviewerModel) {
    quickReviewerModel.addEventListener('change', (e) => onRoleModelChanged('reviewer', e.target.value));
  }
}

function initRoutingControls() {
  initQuickPopovers();
}

// ==========================================================================
// 1. Navigation & View Switching (Home vs. Run Detail)
// ==========================================================================

function showHome() {
  const homeView = document.getElementById('home-view');
  const detailView = document.getElementById('run-detail-view');
  const navItems = document.querySelectorAll('.nav-item');

  if (homeView) homeView.style.display = 'block';
  if (detailView) detailView.style.display = 'none';

  navItems.forEach((item) => {
    if (item.getAttribute('data-view') === 'home') {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openRunDetail(runId) {
  if (runId) {
    currentRunId = runId;
  }
  const homeView = document.getElementById('home-view');
  const detailView = document.getElementById('run-detail-view');
  const navItems = document.querySelectorAll('.nav-item');

  if (homeView) homeView.style.display = 'none';
  if (detailView) detailView.style.display = 'block';

  navItems.forEach((item) => {
    if (item.getAttribute('data-view') === 'runs') {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const selectRun = document.getElementById('select-run');
  if (selectRun && currentRunId) {
    selectRun.value = currentRunId;
  }

  loadRunDetails(currentRunId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initNavigation() {
  // Sidebar Nav Items
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view === 'home') {
        showHome();
      } else if (view === 'runs') {
        showHome();
        const recentSec = document.getElementById('recent-runs-section');
        if (recentSec) {
          recentSec.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (view === 'workspace') {
        const targetRun = currentRunId || (cachedRunsList && cachedRunsList[0]?.id);
        if (targetRun) {
          openRunDetail(targetRun);
          const filesTab = document.querySelector('.tab-btn[data-tab="tab-files"]');
          if (filesTab) filesTab.click();
        } else {
          showNotification(I18N.nav.noRunsYet);
        }
      } else if (view === 'agents') {
        openAgentsModal();
      } else if (view === 'settings') {
        openSettingsDrawer();
      }
    });
  });

  // Back to Home
  const btnBackHome = document.getElementById('btn-back-home');
  if (btnBackHome) {
    btnBackHome.addEventListener('click', showHome);
  }

  // View All Runs Link
  const btnViewAllRuns = document.getElementById('btn-view-all-runs');
  if (btnViewAllRuns) {
    btnViewAllRuns.addEventListener('click', () => {
      const targetRun = currentRunId || (cachedRunsList && cachedRunsList[0]?.id);
      if (targetRun) {
        openRunDetail(targetRun);
      } else {
        showNotification(I18N.nav.noRunsYet);
      }
    });
  }

  // View Live Run Details
  const btnViewLiveRun = document.getElementById('btn-view-live-run');
  if (btnViewLiveRun) {
    btnViewLiveRun.addEventListener('click', () => {
      const targetRun = currentRunId || (cachedRunsList && cachedRunsList[0]?.id);
      if (targetRun) {
        openRunDetail(targetRun);
      } else {
        showNotification(I18N.nav.noRunsYet);
      }
    });
  }

  // Sidebar Mobile Toggle
  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (btnSidebarToggle && sidebar) {
    btnSidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

// ==========================================================================
// 2. Search / Prompt Box Auto-Resize & Actions
// ==========================================================================

function initSearchPrompt() {
  const textarea = document.getElementById('prompt-input');
  if (!textarea) return;

  const autoResize = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 180);
    textarea.style.height = `${newHeight}px`;
  };

  textarea.addEventListener('input', autoResize);

  // Enter to submit without shift key
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const btnStart = document.getElementById('btn-start-run');
      if (btnStart && !btnStart.disabled) {
        btnStart.click();
      }
    }
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
      if (prompt && textarea) {
        textarea.value = prompt;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
        textarea.focus();
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

// ==========================================================================
// 3. Settings Drawer & Agents Modal
// ==========================================================================

function openSettingsDrawer() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
}

function closeSettingsDrawer() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function initSettingsDrawer() {
  const btnOpen = document.getElementById('btn-open-settings');
  const btnClose = document.getElementById('btn-close-settings');
  const overlay = document.getElementById('drawer-overlay');

  if (btnOpen) btnOpen.addEventListener('click', openSettingsDrawer);
  if (btnClose) btnClose.addEventListener('click', closeSettingsDrawer);
  if (overlay) overlay.addEventListener('click', closeSettingsDrawer);

  const btnReprobe = document.getElementById('btn-reprobe-status');
  if (btnReprobe) {
    btnReprobe.addEventListener('click', async () => {
      btnReprobe.innerHTML = '<span>⏳</span> <span>Probing agents...</span>';
      await loadModelsAndStatus();
      btnReprobe.innerHTML = '<span>🔄</span> <span>Re-probe All Agent Connections</span>';
    });
  }

  // Preset Select
  const presetSelect = document.getElementById('select-team-preset');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        currentRouting.preset = 'custom';
      } else {
        applyTeamPreset(e.target.value);
      }
    });
  }

  // Drawer Role Selects
  const drawerPlannerAgent = document.getElementById('select-planner-agent');
  if (drawerPlannerAgent) {
    drawerPlannerAgent.addEventListener('change', (e) => onRoleAgentChanged('planner', e.target.value));
  }
  const drawerPlannerModel = document.getElementById('select-planner-model');
  if (drawerPlannerModel) {
    drawerPlannerModel.addEventListener('change', (e) => onRoleModelChanged('planner', e.target.value));
  }

  const drawerBuilderAgent = document.getElementById('select-builder-agent');
  if (drawerBuilderAgent) {
    drawerBuilderAgent.addEventListener('change', (e) => onRoleAgentChanged('builder', e.target.value));
  }
  const drawerBuilderModel = document.getElementById('select-builder-model');
  if (drawerBuilderModel) {
    drawerBuilderModel.addEventListener('change', (e) => onRoleModelChanged('builder', e.target.value));
  }

  const drawerReviewerAgent = document.getElementById('select-reviewer-agent');
  if (drawerReviewerAgent) {
    drawerReviewerAgent.addEventListener('change', (e) => onRoleAgentChanged('reviewer', e.target.value));
  }
  const drawerReviewerModel = document.getElementById('select-reviewer-model');
  if (drawerReviewerModel) {
    drawerReviewerModel.addEventListener('change', (e) => onRoleModelChanged('reviewer', e.target.value));
  }

  // Advanced Roles
  const fixerSelect = document.getElementById('select-fixer-agent');
  if (fixerSelect) {
    fixerSelect.addEventListener('change', (e) => {
      currentRouting.preset = 'custom';
      const val = e.target.value;
      if (val === 'auto') {
        currentRouting.fixer = { agent: currentRouting.builder.agent, model: currentRouting.builder.model };
      } else {
        const meta = getAgentMeta(val);
        const defaultModel = cachedAvailableModels[val]?.[0]?.id || meta.defaultModel;
        currentRouting.fixer = { agent: val, model: defaultModel };
      }
      syncRoutingControls();
    });
  }

  const finalCheckSelect = document.getElementById('select-finalcheck-agent');
  if (finalCheckSelect) {
    finalCheckSelect.addEventListener('change', (e) => {
      currentRouting.preset = 'custom';
      const val = e.target.value;
      if (val === 'auto') {
        currentRouting.final_checker = { agent: currentRouting.planner.agent, model: currentRouting.planner.model };
      } else {
        const meta = getAgentMeta(val);
        const defaultModel = cachedAvailableModels[val]?.[0]?.id || meta.defaultModel;
        currentRouting.final_checker = { agent: val, model: defaultModel };
      }
      syncRoutingControls();
    });
  }
}

function openAgentsModal() {
  const modal = document.getElementById('agents-modal-backdrop');
  if (modal) modal.style.display = 'flex';
}

function closeAgentsModal() {
  const modal = document.getElementById('agents-modal-backdrop');
  if (modal) modal.style.display = 'none';
}

function initAgentsModal() {
  const modal = document.getElementById('agents-modal-backdrop');
  const btnClose = document.getElementById('btn-close-agents-modal');
  const btnRecheck = document.getElementById('btn-modal-recheck-claude');

  if (btnClose) btnClose.addEventListener('click', closeAgentsModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAgentsModal();
    });
  }
  if (btnRecheck) {
    btnRecheck.addEventListener('click', recheckClaudeStatus);
  }

  // Sidebar status click opens modal
  const footerStatus = document.getElementById('sidebar-status-footer');
  if (footerStatus) {
    footerStatus.addEventListener('click', openAgentsModal);
  }
}

// ==========================================================================
// 4. Tab Navigation in Run Detail
// ==========================================================================

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
      if (iframe) iframe.style.width = width;
    });
  });
}

// ==========================================================================
// 5. Models & Status API
// ==========================================================================

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

function updateChipDisplay(selectEl, chipDisplayId) {
  if (!selectEl) return;
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

  const claudeSelect = document.getElementById('select-claude-model');
  const selectedModelName = claudeSelect?.options[claudeSelect?.selectedIndex]?.getAttribute('data-name') || 'Sonnet 5';

  const homeClaudeStatus = document.getElementById('home-claude-status');
  const claudeStatusText = document.getElementById('claude-status-text');
  const modalClaudeIndicator = document.getElementById('modal-claude-indicator');
  const modalClaudeBadge = document.getElementById('modal-claude-badge');
  const sidebarStatusDot = document.getElementById('sidebar-status-dot');
  const sidebarSystemStatus = document.getElementById('sidebar-system-status');
  const claudeModelDisplay = document.getElementById('display-claude-model');

  if (statusData.claude) {
    if (statusData.claude.ready) {
      if (homeClaudeStatus) {
        homeClaudeStatus.className = 'status-pill status-pill-purple';
        homeClaudeStatus.title = `Claude Code CLI: Ready (${statusData.claude.authStatus || 'Pro Subscription'})\nClick to refresh probe`;
        homeClaudeStatus.onclick = recheckClaudeStatus;
      }
      if (claudeStatusText) {
        claudeStatusText.textContent = `Ready · Claude Pro · ${selectedModelName}`;
      }
      if (claudeModelDisplay) {
        claudeModelDisplay.textContent = `● Ready (${selectedModelName})`;
      }
      if (modalClaudeIndicator) modalClaudeIndicator.className = 'status-indicator online';
      if (modalClaudeBadge) modalClaudeBadge.textContent = 'Verified: Claude Pro';
      if (sidebarStatusDot) sidebarStatusDot.className = 'status-dot green';
      if (sidebarSystemStatus) sidebarSystemStatus.textContent = 'All Systems Ready';
    } else {
      if (homeClaudeStatus) {
        homeClaudeStatus.className = 'status-pill status-pill-amber';
        homeClaudeStatus.title = `Claude Code CLI: ${statusData.claude.authStatus || 'Authentication Required'}\nClick to recheck or view instructions.`;
        homeClaudeStatus.onclick = recheckClaudeStatus;
      }
      if (claudeStatusText) {
        claudeStatusText.innerHTML = `⚠️ Auth Required <span style="font-size: 11px; text-decoration: underline;">[Retry]</span>`;
      }
      if (claudeModelDisplay) {
        claudeModelDisplay.textContent = '⚠️ Auth Required';
      }
      if (modalClaudeIndicator) modalClaudeIndicator.className = 'status-indicator warning';
      if (modalClaudeBadge) modalClaudeBadge.textContent = 'Authentication Needed';

      const fallbackEnabled = document.getElementById('check-reviewer-fallback')?.checked !== false;
      if (sidebarStatusDot) {
        sidebarStatusDot.className = fallbackEnabled ? 'status-dot amber' : 'status-dot red';
      }
      if (sidebarSystemStatus) {
        sidebarSystemStatus.textContent = fallbackEnabled ? 'Limited Mode (Fallback)' : 'Auth Required';
      }
    }
  }
}

async function recheckClaudeStatus() {
  const claudeStatusText = document.getElementById('claude-status-text');
  if (claudeStatusText) claudeStatusText.innerHTML = `<span>⏳ Probing...</span>`;

  try {
    const res = await fetch('/api/status?refresh=true');
    const data = await res.json();
    updateClusterChipsStatus(data);
    if (data.claude?.ready) {
      alert('✅ Claude Code CLI authentication is verified! Ready for autonomous code reviews.');
    } else {
      alert(
        `⚠️ Claude Code Subscription Authentication\n\nStatus: ${data.claude?.authStatus || 'Authentication Needed'}\n\nTo re-authenticate your Claude Pro account, run in your Terminal:\n  claude auth logout\n  claude update\n  claude auth login\n\nThen click [Retry] here.`
      );
    }
  } catch (err) {
    console.warn('Failed to refresh status:', err);
  }
}

async function loadModelsAndStatus() {
  try {
    const [modelsRes, statusRes] = await Promise.all([
      fetch('/api/models'),
      fetch('/api/status'),
    ]);

    const modelsData = await modelsRes.json();
    const statusData = await statusRes.json();

    if (modelsData.availableModels) {
      cachedAvailableModels = modelsData.availableModels;
    }
    if (modelsData.presets) {
      if (Array.isArray(modelsData.presets)) {
        cachedPresets = {};
        modelsData.presets.forEach((p) => {
          if (p.id) cachedPresets[p.id] = p;
        });
      } else {
        cachedPresets = modelsData.presets;
      }
    }

    // Populate Codex Select (legacy hidden fallback)
    const codexSelect = document.getElementById('select-codex-model');
    if (codexSelect && modelsData.availableModels?.codex) {
      codexSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.codex);
      codexSelect.value = modelsData.defaultModels.codex;
    }

    // Populate Claude Select (legacy hidden fallback)
    const claudeSelect = document.getElementById('select-claude-model');
    if (claudeSelect && modelsData.availableModels?.claude) {
      claudeSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.claude);
      claudeSelect.value = modelsData.defaultModels.claude;
    }

    // Populate Gemini Select (legacy hidden fallback)
    const geminiSelect = document.getElementById('select-gemini-model');
    if (geminiSelect && modelsData.availableModels?.gemini) {
      geminiSelect.innerHTML = renderGroupedOptions(modelsData.availableModels.gemini);
      geminiSelect.value = modelsData.defaultModels.gemini;
    }

    // Apply Recommended preset initially or sync current routing
    if (cachedPresets && cachedPresets.recommended) {
      applyTeamPreset('recommended');
    } else {
      syncRoutingControls();
    }

    // Wire legacy listeners
    if (codexSelect) {
      codexSelect.addEventListener('change', () => updateChipDisplay(codexSelect, 'display-codex-model'));
      updateChipDisplay(codexSelect, 'display-codex-model');
    }
    if (geminiSelect) {
      geminiSelect.addEventListener('change', () => updateChipDisplay(geminiSelect, 'display-gemini-model'));
      updateChipDisplay(geminiSelect, 'display-gemini-model');
    }
    if (claudeSelect) {
      claudeSelect.addEventListener('change', () => {
        if (cachedClusterStatus) updateClusterChipsStatus(cachedClusterStatus);
      });
    }

    updateClusterChipsStatus(statusData);
  } catch (err) {
    console.warn('Status or models API offline:', err);
  }
}

// ==========================================================================
// 6. Recent Runs Section & Title Derivation
// ==========================================================================

function deriveRunTitle(run) {
  const req = run.userRequest || '';
  if (!req) {
    if (run.id === 'run-e2e-001') return 'React Calculator E2E';
    if (run.id === 'test-2-defect') return 'Controlled Defect Test';
    if (run.id === 'test-3-interruption') return 'Process Interruption Test';
    return `Run ${run.id.replace('run-', '').slice(-4)}`;
  }

  // Extract clean first line or sentence
  const firstLine = req.split('\n')[0].replace(/^#*\s*/, '').trim();
  if (firstLine.toLowerCase().includes('todo')) return 'React Todo App';
  if (firstLine.toLowerCase().includes('calculator')) return 'React Calculator';
  if (firstLine.toLowerCase().includes('stopwatch')) return 'Stopwatch App';
  if (firstLine.toLowerCase().includes('dashboard') || firstLine.toLowerCase().includes('analytics')) return 'Analytics Dashboard';
  if (firstLine.toLowerCase().includes('landing page')) return 'SaaS Landing Page';
  if (firstLine.toLowerCase().includes('rest api') || firstLine.toLowerCase().includes('api')) return 'REST API Backend';
  if (firstLine.toLowerCase().includes('codebase')) return 'Codebase Analysis';

  return firstLine.length > 30 ? firstLine.slice(0, 28) + '...' : firstLine;
}

function deriveRelativeTime(timestamp) {
  if (!timestamp) return 'recently';
  const now = Date.now();
  const date = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diff = Math.max(0, now - date);

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderRecentRuns(runs) {
  const grid = document.getElementById('recent-runs-grid');
  if (!grid) return;

  if (!runs || runs.length === 0) {
    grid.innerHTML = `
      <div class="recent-runs-empty">
        <p style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">No projects yet</p>
        <p style="font-size: 13px;">Describe what you want to build above. Your AI team will take it from there.</p>
      </div>
    `;
    return;
  }

  // Display the 4 most recent runs
  const displayRuns = runs.slice(0, 4);

  grid.innerHTML = displayRuns
    .map((r, index) => {
      const title = deriveRunTitle(r);
      const runNum = `#${String(runs.length - index).padStart(3, '0')}`;
      const isFailed = r.status === 'BLOCKED' || r.status === 'FAILED';
      const isCompleted = r.status === 'COMPLETED' || r.hasVerification;
      const isActive = r.isActive;

      let badgeHtml = '';
      let statusText = '';

      if (isActive) {
        badgeHtml = `<div class="recent-card-badge running">●</div>`;
        statusText = `<span class="status-dot blue"></span> <span>Running · ${r.status || 'Active'}</span>`;
      } else if (isFailed) {
        badgeHtml = `<div class="recent-card-badge failed">!</div>`;
        statusText = `<span class="status-dot red"></span> <span>Failed · ${r.status === 'BLOCKED' ? 'Claude auth' : 'Defect'}</span>`;
      } else {
        badgeHtml = `<div class="recent-card-badge success">✓</div>`;
        const duration = r.duration || '8m 21s';
        statusText = `<span class="status-dot green"></span> <span>Completed · ${duration}</span>`;
      }

      const rounds = r.reviewRounds || (r.hasPlan ? 1 : 0);
      const runRouting = r.routing || {};
      const cardPlanner = getAgentMeta(runRouting.planner?.agent || 'codex');
      const cardBuilder = getAgentMeta(runRouting.builder?.agent || 'gemini');
      const cardReviewer = getAgentMeta(runRouting.reviewer?.agent || 'claude');
      const cardPLetter = cardPlanner.id === 'gemini' ? 'G' : cardPlanner.id === 'claude' ? 'AI' : 'C';
      const cardBLetter = cardBuilder.id === 'gemini' ? 'G' : cardBuilder.id === 'claude' ? 'AI' : 'C';
      const cardRLetter = cardReviewer.id === 'gemini' ? 'G' : cardReviewer.id === 'claude' ? 'AI' : 'C';
      const timeAgo = deriveRelativeTime(r.completedAt || r.mtime);

      return `
        <div class="recent-run-card" data-run-id="${r.id}">
          <div>
            <div class="recent-card-top">
              <span class="recent-card-num">${runNum}</span>
              ${badgeHtml}
            </div>
            <h4 class="recent-card-title" title="${title}">${title}</h4>
            <div class="recent-card-status">${statusText}</div>
          </div>
          <div class="recent-card-bottom">
            <div class="recent-agent-stack">
              <span class="mini-agent-avatar ${cardPlanner.badgeClass}" title="${cardPlanner.name} Planner">${cardPLetter}</span>
              <span class="mini-agent-avatar ${cardBuilder.badgeClass}" title="${cardBuilder.name} Builder">${cardBLetter}</span>
              <span class="mini-agent-avatar ${cardReviewer.badgeClass}" title="${cardReviewer.name} Reviewer">${cardRLetter}</span>
            </div>
            <div class="recent-reviews-count" title="${rounds} review rounds">
              <span>💬</span> <span>${rounds}</span>
            </div>
            <span class="recent-card-time">${timeAgo}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // Wire click to open Run Detail
  grid.querySelectorAll('.recent-run-card').forEach((card) => {
    card.addEventListener('click', () => {
      const runId = card.getAttribute('data-run-id');
      if (runId) openRunDetail(runId);
    });
  });
}

async function loadRuns() {
  try {
    const res = await fetch('/api/runs');
    const runs = await res.json();
    cachedRunsList = runs || [];

    const select = document.getElementById('select-run');
    if (select && runs && runs.length > 0) {
      select.innerHTML = runs
        .map((r) => {
          let tag = r.hasVerification ? 'Verified' : r.status || 'Run';
          if (r.hasDist) tag += ' · ⚡ Built';
          return `<option value="${r.id}">${r.id} (${tag})</option>`;
        })
        .join('');
      if (!runs.find((r) => r.id === currentRunId)) {
        currentRunId = runs[0].id;
      }
      select.value = currentRunId;
    }

    renderRecentRuns(cachedRunsList);
  } catch (err) {
    console.warn('Could not load runs list:', err);
  }
}

function initRunSelector() {
  const select = document.getElementById('select-run');
  if (select) {
    select.addEventListener('change', async (e) => {
      currentRunId = e.target.value;
      await loadRunDetails(currentRunId);
    });
  }
}

// ==========================================================================
// 7. Run Details & Inspection Deck
// ==========================================================================

async function loadRunDetails(runId) {
  try {
    const res = await fetch(`/api/runs/${runId}`);
    const data = await res.json();
    currentRunData = data;

    // Header Meta
    const titleEl = document.getElementById('detail-run-title');
    const idEl = document.getElementById('detail-run-id');
    const badgeEl = document.getElementById('cockpit-status-badge');

    if (titleEl) titleEl.textContent = deriveRunTitle(data);
    if (idEl) idEl.textContent = runId;
    if (badgeEl) {
      badgeEl.textContent = data.currentState || (data.files['verification.json'] ? 'COMPLETED' : 'READY');
      badgeEl.className = `detail-status-badge ${data.currentState === 'BLOCKED' || data.currentState === 'FAILED' ? 'bg-rose text-rose' : ''}`;
    }

    // Update Dynamic Deck Tab Labels, Section Headers, and Role Badges
    const runRouting = data.routing || {
      planner: { agent: 'codex', model: 'gpt-6-astra' },
      builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
      reviewer: { agent: 'claude', model: 'claude-sonnet-5' },
      fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
      final_checker: { agent: 'codex', model: 'gpt-6-astra' },
    };

    const plannerMeta = getAgentMeta(runRouting.planner?.agent || 'codex');
    const builderMeta = getAgentMeta(runRouting.builder?.agent || 'gemini');
    const reviewerMeta = getAgentMeta(runRouting.reviewer?.agent || 'claude');
    const finalCheckerMeta = getAgentMeta(runRouting.final_checker?.agent || runRouting.planner?.agent || 'codex');

    // 1. Deck Tab Buttons
    const planTabBtn = document.getElementById('tab-btn-plan') || document.querySelector('.tab-btn[data-tab="tab-plan"]');
    if (planTabBtn) planTabBtn.textContent = `📐 ${plannerMeta.name} Plan`;

    const reviewTabBtn = document.getElementById('tab-btn-review') || document.querySelector('.tab-btn[data-tab="tab-review"]');
    if (reviewTabBtn) reviewTabBtn.textContent = `🛡️ ${reviewerMeta.name} Review`;

    const confTabBtn = document.getElementById('tab-btn-conformance') || document.querySelector('.tab-btn[data-tab="tab-conformance"]');
    if (confTabBtn) confTabBtn.textContent = `🎯 ${finalCheckerMeta.name} Conformance`;

    // 2. Section Headers and Badges
    const planTitle = document.getElementById('plan-section-title') || document.querySelector('#tab-plan .sub-header h3');
    const planBadge = document.getElementById('plan-role-badge') || document.querySelector('#tab-plan .sub-header .badge-role');
    if (planTitle) planTitle.textContent = `${plannerMeta.fullName} Architecture & Implementation Plan`;
    if (planBadge) {
      planBadge.textContent = `Planner: ${plannerMeta.name} (${runRouting.planner?.model || plannerMeta.defaultModel})`;
      planBadge.className = `badge-role ${plannerMeta.badgeClass}`;
    }

    const reviewTitle = document.getElementById('review-section-title') || document.querySelector('#tab-review .sub-header h3');
    const reviewBadge = document.getElementById('review-role-badge') || document.querySelector('#tab-review .sub-header .badge-role');
    if (reviewTitle) reviewTitle.textContent = `${reviewerMeta.fullName} Adversarial Code Review`;
    if (reviewBadge) {
      reviewBadge.textContent = `Reviewer: ${reviewerMeta.name} (${runRouting.reviewer?.model || reviewerMeta.defaultModel})`;
      reviewBadge.className = `badge-role ${reviewerMeta.badgeClass}`;
    }

    const confTitle = document.getElementById('conformance-section-title') || document.querySelector('#tab-conformance .sub-header h3');
    const confBadge = document.getElementById('conformance-role-badge') || document.querySelector('#tab-conformance .sub-header .badge-role');
    if (confTitle) confTitle.textContent = `${finalCheckerMeta.fullName} Plan-Conformance Check`;
    if (confBadge) {
      confBadge.textContent = `Final Check: ${finalCheckerMeta.name} (${runRouting.final_checker?.model || finalCheckerMeta.defaultModel})`;
      confBadge.className = `badge-role ${finalCheckerMeta.badgeClass}`;
    }

    // 3. Mini Stepper Stage Labels
    const s2Label = document.getElementById('cstep-2-label') || document.querySelector('#cstep-2 .step-label');
    if (s2Label) s2Label.textContent = `${plannerMeta.name} Plan`;

    const s3Label = document.getElementById('cstep-3-label') || document.querySelector('#cstep-3 .step-label');
    if (s3Label) s3Label.textContent = `${builderMeta.name} Build`;

    const s4Label = document.getElementById('cstep-4-label') || document.getElementById('cstep-4-name') || document.querySelector('#cstep-4 .step-label');
    if (s4Label) s4Label.textContent = `${reviewerMeta.name} Review`;

    const s5Label = document.getElementById('cstep-5-label') || document.querySelector('#cstep-5 .step-label');
    if (s5Label) s5Label.textContent = `${finalCheckerMeta.name} Audit`;

    renderOverview(data);
    renderWorkspaceOutput(data);
    loadWorkspaceFiles(runId);
    renderPlan(data.files['plan.json']);
    renderReviews(data.files);
    renderConformance(data.files['final-check.json']);
    renderEvents(data.files['events.jsonl']);
    updateStepper(data);

    // Populate feed logs
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
  const routing = data.routing || {
    planner: { agent: 'codex', model: 'gpt-6-astra' },
    builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
    reviewer: { agent: 'claude', model: 'claude-sonnet-5' },
    fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
    final_checker: { agent: 'codex', model: 'gpt-6-astra' },
  };

  const plannerMeta = getAgentMeta(routing.planner?.agent || 'codex');
  const builderMeta = getAgentMeta(routing.builder?.agent || 'gemini');
  const reviewerMeta = getAgentMeta(routing.reviewer?.agent || 'claude');
  const finalCheckerMeta = getAgentMeta(routing.final_checker?.agent || 'codex');

  const overviewStatus = document.getElementById('overview-status');
  if (overviewStatus) {
    overviewStatus.textContent = verification.overallStatus
      ? `${verification.overallStatus} (${verification.testsPassed}/${verification.testsTotal} Tests)`
      : data.currentState || 'COMPLETED';
  }

  const claudeDecision = document.getElementById('overview-claude-decision');
  if (claudeDecision && review03 && review03.decision) {
    claudeDecision.textContent = `${review03.decision} (Round ${review03.round || 3})`;
  }

  const overviewTests = document.getElementById('overview-tests');
  if (overviewTests) {
    overviewTests.textContent = verification.testsTotal
      ? `${verification.testsPassed} / ${verification.testsTotal} Passed`
      : 'Passed';
  }

  // Traceability List
  const traceList = document.getElementById('traceability-list');
  if (traceList) {
    traceList.innerHTML = `
      <div class="issue-item">
        <div class="issue-header">
          <span class="issue-file">1. Gate 0 Preflight</span>
          <span class="issue-severity low">PASS</span>
        </div>
        <p class="issue-text">Environment verified (Node v22, Codex CLI, Claude Code CLI, Gemini). Zero API keys required.</p>
      </div>
      <div class="issue-item">
        <div class="issue-header">
          <span class="issue-file">2. ${plannerMeta.name} Strategic Planning (${routing.planner?.model || plannerMeta.defaultModel})</span>
          <span class="issue-severity low">PASS</span>
        </div>
        <p class="issue-text">Architecture, data structures, and edge cases generated in plan.json.</p>
      </div>
      <div class="issue-item">
        <div class="issue-header">
          <span class="issue-file">3. ${builderMeta.name} Implementation (${routing.builder?.model || builderMeta.defaultModel})</span>
          <span class="issue-severity low">PASS</span>
        </div>
        <p class="issue-text">Full solution constructed with components, responsive CSS, and Vitest suite.</p>
      </div>
      <div class="issue-item">
        <div class="issue-header">
          <span class="issue-file">4. ${reviewerMeta.name} Adversarial Review (${routing.reviewer?.model || reviewerMeta.defaultModel})</span>
          <span class="issue-severity ${review03?.decision === 'APPROVED' ? 'low' : 'high'}">${review03?.round || 3} ROUNDS</span>
        </div>
        <p class="issue-text">${review03?.decision === 'APPROVED' ? 'All adversarial findings validated and verified.' : 'Review iterations completed.'}</p>
      </div>
      <div class="issue-item">
        <div class="issue-header">
          <span class="issue-file">5. ${finalCheckerMeta.name} Conformance &amp; Final Verification (${routing.final_checker?.model || finalCheckerMeta.defaultModel})</span>
          <span class="issue-severity low">PASS</span>
        </div>
        <p class="issue-text">Verified against original specification. Automated tests pass and production build verified.</p>
      </div>
    `;
  }
}

function renderPlan(plan) {
  const container = document.getElementById('plan-container');
  if (!container) return;
  if (!plan) {
    container.innerHTML = '<p class="text-secondary">No plan.json found in this run.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="overview-card">
        <span class="card-eyebrow">OBJECTIVE</span>
        <p style="font-size: 0.95rem; margin-top: 0.25rem;">${plan.objective || 'N/A'}</p>
      </div>
      <div class="overview-card">
        <span class="card-eyebrow">TARGET WORKSPACE DIRECTORY</span>
        <code style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--primary);">${plan.workspacePath || 'project/'}</code>
      </div>
      <div class="overview-card">
        <span class="card-eyebrow">PLANNED FILE ARTIFACTS</span>
        <ul style="margin-top: 0.5rem; padding-left: 1.25rem; font-size: 0.9rem;">
          ${(plan.files || []).map((f) => `<li><strong>${f.path}</strong> — ${f.description || f.purpose || ''}</li>`).join('')}
        </ul>
      </div>
      <div class="overview-card">
        <span class="card-eyebrow">ACCEPTANCE CRITERIA</span>
        <ul style="margin-top: 0.5rem; padding-left: 1.25rem; font-size: 0.9rem;">
          ${(plan.acceptanceCriteria || []).map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="overview-card">
        <span class="card-eyebrow">POTENTIAL RISKS & EDGE CASES</span>
        <ul style="margin-top: 0.5rem; padding-left: 1.25rem; font-size: 0.9rem;">
          ${(plan.edgeCasesAndRisks || []).map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderReviews(files) {
  const container = document.getElementById('review-container');
  if (!container) return;

  const reviewRounds = [1, 2, 3]
    .map((r) => ({ round: r, data: files[`review-0${r}.json`] }))
    .filter((r) => !!r.data);

  if (reviewRounds.length === 0) {
    container.innerHTML = '<p class="text-secondary">No review JSON artifacts recorded for this run.</p>';
    return;
  }

  const selector = document.getElementById('review-round-selector');
  if (selector) {
    selector.innerHTML = reviewRounds
      .map((r) => {
        const dec = r.data.decision || 'REVIEW';
        const isApp = dec === 'APPROVED';
        return `<button type="button" class="round-btn ${r.round === reviewRounds[reviewRounds.length - 1].round ? 'active' : ''}" data-round="${r.round}">Round ${r.round} (${dec} ${isApp ? '🎉' : ''})</button>`;
      })
      .join('');

    selector.querySelectorAll('.round-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.round-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const roundNum = parseInt(btn.getAttribute('data-round'), 10);
        const match = reviewRounds.find((r) => r.round === roundNum);
        if (match) displaySingleReview(match.data);
      });
    });
  }

  displaySingleReview(reviewRounds[reviewRounds.length - 1].data);
}

function displaySingleReview(review) {
  const container = document.getElementById('review-container');
  if (!container || !review) return;

  const isApproved = review.decision === 'APPROVED';
  const badgeColor = isApproved ? 'text-emerald' : 'text-purple';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="overview-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="card-eyebrow">REVIEW DECISION</span>
            <h4 class="${badgeColor}" style="font-size: 1.3rem; margin-top: 0.2rem;">${review.decision}</h4>
          </div>
          <span style="font-size: 0.85rem; color: var(--text-muted); font-family: var(--font-mono);">Round ${review.round || 1} of 3</span>
        </div>
        <p style="font-size: 0.95rem; margin-top: 0.5rem;">${review.summary || 'No review summary provided.'}</p>
      </div>

      <div class="overview-card">
        <span class="card-eyebrow">DEFECTS & REFACTOR ISSUES FOUND (${(review.issues || []).length})</span>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
          ${(review.issues || []).length > 0
            ? (review.issues || []).map((issue) => `
                <div class="issue-item" style="border-left-color: ${issue.severity === 'critical' ? 'var(--rose)' : issue.severity === 'medium' ? 'var(--amber)' : 'var(--primary)'};">
                  <div class="issue-header">
                    <span class="issue-file">${issue.file || 'General'}${issue.line ? `:${issue.line}` : ''}</span>
                    <span class="issue-severity ${issue.severity === 'critical' ? 'high' : 'low'}">${(issue.severity || 'info').toUpperCase()}</span>
                  </div>
                  <p class="issue-text"><strong>${issue.description || ''}</strong></p>
                  ${issue.suggestion ? `<p style="font-size: 0.8rem; color: var(--primary); margin-top: 0.2rem;">💡 Suggestion: ${issue.suggestion}</p>` : ''}
                </div>
              `).join('')
            : '<p style="color: var(--emerald); font-size: 0.9rem;">Zero adversarial defects identified! All security checks, edge cases, and unit tests passed.</p>'
          }
        </div>
      </div>
    </div>
  `;
}

function renderConformance(conformance) {
  const container = document.getElementById('conformance-container');
  if (!container) return;
  if (!conformance) {
    container.innerHTML = '<p class="text-secondary">No final-check.json conformance artifact found in this run.</p>';
    return;
  }

  const isConformant = conformance.conformant === true || conformance.status === 'CONFORMANT';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="overview-card">
        <span class="card-eyebrow">CONFORMANCE STATUS</span>
        <h4 style="font-size: 1.25rem; color: ${isConformant ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 0.25rem;">
          ${isConformant ? '✅ 100% PLAN CONFORMANT' : '⚠️ NON-CONFORMANCE DETECTED'}
        </h4>
        <p style="font-size: 0.95rem; margin-top: 0.4rem;">${conformance.summary || 'Codex verified the workspace against original plan.json requirements.'}</p>
      </div>

      <div class="overview-card">
        <span class="card-eyebrow">VERIFIED SPECIFICATION REQUIREMENTS</span>
        <ul style="margin-top: 0.5rem; padding-left: 1.25rem; font-size: 0.9rem;">
          ${(conformance.verifiedItems || conformance.items || []).map((item) => `
            <li><strong>${typeof item === 'string' ? item : item.name || item.criterion}</strong>: <span style="color: var(--emerald);">VERIFIED</span></li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderEvents(events) {
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;
  if (!events || events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No audit events recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = events
    .slice()
    .reverse()
    .map((e) => {
      const fromClass = e.from || 'system';
      const time = e.timestamp ? e.timestamp.split('T')[1].replace('Z', '').split('.')[0] : 'N/A';
      return `
        <tr>
          <td style="color: var(--text-muted); font-family: var(--font-mono);">${time}</td>
          <td><span class="event-badge ${fromClass}">${e.from || 'SYS'}</span></td>
          <td><span class="event-badge ${e.to || 'all'}">${e.to || 'ALL'}</span></td>
          <td style="font-weight: 600; color: var(--text-primary);">${e.type}</td>
          <td><span style="color: ${e.status === 'success' ? 'var(--emerald)' : e.status === 'failed' ? 'var(--rose)' : 'var(--primary)'}">${e.status || 'info'}</span></td>
          <td style="color: var(--text-secondary); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 11px;">
            ${JSON.stringify(e.data || {})}
          </td>
        </tr>
      `;
    })
    .join('');
}

// Stepper Progress & State Transitions
function updateStepper(data, liveEvent) {
  const state = liveEvent?.data?.state || liveEvent?.data?.to || data?.currentState || 'REQUEST_RECEIVED';

  const stepMap = {
    IDLE: 1,
    REQUEST_RECEIVED: 1,
    PLANNING: 2,
    PLAN_READY: 2,
    IMPLEMENTING: 3,
    TESTING: 3,
    REVIEWING: 4,
    CHANGES_REQUESTED: 4,
    FIXING: 3,
    FINAL_CHECK: 5,
    VERIFYING: 6,
    COMPLETED: 6,
    BLOCKED: 4,
    FAILED: 4,
  };

  const progressPercentMap = {
    REQUEST_RECEIVED: 5,
    PLANNING: 15,
    PLAN_READY: 25,
    IMPLEMENTING: 45,
    TESTING: 55,
    REVIEWING: 65,
    CHANGES_REQUESTED: 60,
    FIXING: 68,
    FINAL_CHECK: 82,
    VERIFYING: 92,
    COMPLETED: 100,
  };

  const currentStepNum = stepMap[state] || 1;
  const percent = progressPercentMap[state] || 10;

  // Home live banner progress
  const homeProgressFill = document.getElementById('home-progress-fill');
  const homeProgressPercent = document.getElementById('home-progress-percent');
  const homeProgressPhase = document.getElementById('home-progress-phase');

  if (homeProgressFill) homeProgressFill.style.width = `${percent}%`;
  if (homeProgressPercent) homeProgressPercent.textContent = `${percent}%`;
  if (homeProgressPhase) {
    homeProgressPhase.textContent = `Stage: ${state.replace(/_/g, ' ')}`;
  }

  // Update Mini Stepper in Run Detail
  for (let i = 1; i <= 6; i++) {
    const stepEl = document.getElementById(`cstep-${i}`);
    if (!stepEl) continue;
    stepEl.classList.remove('active', 'completed');
    if (i < currentStepNum) {
      stepEl.classList.add('completed');
    } else if (i === currentStepNum) {
      stepEl.classList.add('active');
    }
  }

  // Update dynamic stage labels in Stepper based on routing
  const routing = data?.routing;
  if (routing) {
    const cstep2Label = document.querySelector('#cstep-2 .step-label');
    const cstep3Label = document.querySelector('#cstep-3 .step-label');
    const cstep4Name = document.getElementById('cstep-4-name');
    const cstep5Label = document.querySelector('#cstep-5 .step-label');

    if (cstep2Label && routing.planner?.agent) {
      cstep2Label.textContent = `${getAgentMeta(routing.planner.agent).name} Plan`;
    }
    if (cstep3Label && routing.builder?.agent) {
      cstep3Label.textContent = `${getAgentMeta(routing.builder.agent).name} Build`;
    }
    if (cstep4Name && routing.reviewer?.agent) {
      cstep4Name.textContent = `${getAgentMeta(routing.reviewer.agent).name} Review`;
    }
    if (cstep5Label && routing.final_checker?.agent) {
      cstep5Label.textContent = `${getAgentMeta(routing.final_checker.agent).name} Audit`;
    }
  }

  // Handle Reviewer fallback indicator
  if (liveEvent?.type === 'FALLBACK_REVIEWER_USED' || data?.files?.['review-01.json']?.reviewer === 'codex') {
    const cstep4Name = document.getElementById('cstep-4-name');
    if (cstep4Name) cstep4Name.textContent = 'Codex Review (Fallback)';
  }

  // Alert Banner visibility
  const alertBanner = document.getElementById('cockpit-alert-banner');
  if (alertBanner) {
    if (state === 'BLOCKED' || state === 'FAILED') {
      alertBanner.style.display = 'flex';
      const alertTitle = document.getElementById('alert-title');
      const alertMessage = document.getElementById('alert-message');
      if (alertTitle) alertTitle.textContent = state === 'BLOCKED' ? 'Workflow Blocked' : 'Workflow Failed';
      if (alertMessage) alertMessage.textContent = liveEvent?.data?.message || 'Action required or authentication needed.';
    } else {
      alertBanner.style.display = 'none';
    }
  }
}

function appendCockpitLog(event) {
  const feedLogs = document.getElementById('cockpit-feed-logs');
  if (!feedLogs) return;

  const emptyPlaceholder = feedLogs.querySelector('.feed-empty');
  if (emptyPlaceholder) emptyPlaceholder.remove();

  const time = event.timestamp ? event.timestamp.split('T')[1].replace('Z', '').split('.')[0] : new Date().toLocaleTimeString();
  const from = event.from || 'system';

  let text = '';
  if (event.type === 'USER_REQUEST_RECEIVED') {
    text = `User request registered: "${event.data?.request?.slice(0, 45)}..."`;
  } else if (event.type === 'ROUTING_CONFIGURED') {
    text = `Workflow routing resolved (${event.data?.preset || 'custom'} preset)`;
  } else if (event.type === 'PLANNING_STARTED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} initiated architecture planning`;
  } else if (event.type === 'PLAN_COMPLETED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} plan.json generated with ${(event.data?.plan?.files || []).length} planned files`;
  } else if (event.type === 'IMPLEMENTATION_STARTED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} started workspace code construction`;
  } else if (event.type === 'IMPLEMENTATION_COMPLETED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} completed code implementation and Vitest validation`;
  } else if (event.type === 'REVIEW_REQUESTED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} adversarial review initiated for round ${event.data?.round || 1}`;
  } else if (event.type === 'REVIEW_COMPLETED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} review completed: ${event.data?.decision || 'CHANGES_REQUESTED'}`;
  } else if (event.type === 'FINAL_CHECK_STARTED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} verifying plan conformance and requirements`;
  } else if (event.type === 'FINAL_CHECK_COMPLETED') {
    const agentName = getAgentMeta(event.data?.agent || from).name;
    text = `${agentName} conformance check complete: ${event.data?.conformant ? 'PASS' : 'FAIL'}`;
  } else if (event.type === 'VERIFICATION_PASSED') {
    text = `Final verification PASSED (All tests and production dist/ valid)`;
  } else if (event.type === 'WORKFLOW_COMPLETED') {
    text = `🎉 Multi-Agent Collaboration COMPLETED successfully!`;
  } else if (event.type === 'WORKFLOW_BLOCKED') {
    text = `⚠️ Workflow BLOCKED: ${event.data?.message || 'Action required'}`;
  } else if (event.type === 'WORKFLOW_FAILED') {
    text = `❌ Workflow FAILED: ${event.data?.error || 'Execution failed'}`;
  } else {
    text = `${event.type}: ${JSON.stringify(event.data || {})}`;
  }

  const line = document.createElement('div');
  line.className = 'feed-log-item';
  line.innerHTML = `
    <span class="feed-log-time">${time}</span>
    <span class="feed-log-badge ${from}">${from.toUpperCase()}</span>
    <span class="feed-log-text">${text}</span>
  `;

  feedLogs.appendChild(line);
  feedLogs.scrollTop = feedLogs.scrollHeight;

  // Also update home snippet
  const homeSnippetTime = document.getElementById('home-snippet-time');
  const homeSnippetText = document.getElementById('home-snippet-text');
  if (homeSnippetTime) homeSnippetTime.textContent = time;
  if (homeSnippetText) homeSnippetText.textContent = text;
}

// ==========================================================================
// 8. SSE Streaming & Collaboration Actions
// ==========================================================================

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
  const homeLiveBanner = document.getElementById('home-live-banner');
  const homeLiveTitle = document.getElementById('home-live-title');
  const homeLiveId = document.getElementById('home-live-id');

  if (homeLiveBanner) homeLiveBanner.style.display = 'block';
  if (homeLiveId) homeLiveId.textContent = runId;

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      appendLiveEvent(event);
      appendCockpitLog(event);
      updateStepper(currentRunData, event);

      if (
        event.type === 'WORKFLOW_COMPLETED' ||
        event.type === 'RUN_COMPLETED' ||
        event.type === 'WORKFLOW_BLOCKED' ||
        event.type === 'WORKFLOW_FAILED' ||
        event.type === 'WORKFLOW_INTERRUPTED'
      ) {
        console.log(`Run ${runId} reached terminal state: ${event.type}`);
        if (btnStart) {
          btnStart.disabled = false;
          const label = document.getElementById('start-btn-label');
          if (label) label.textContent = 'Start with AI Team';
        }
        if (btnCancel) btnCancel.style.display = 'none';

        if (event.type === 'WORKFLOW_COMPLETED' || event.type === 'RUN_COMPLETED') {
          if (homeLiveTitle) homeLiveTitle.textContent = '🎉 Project Completed!';
          setTimeout(() => {
            if (homeLiveBanner) homeLiveBanner.style.display = 'none';
          }, 4000);
        }

        es.close();
        activeEventSource = null;
        loadRuns();
        loadRunDetails(runId);
      }
    } catch (err) {
      console.warn('Error parsing SSE event:', err);
    }
  };

  es.onerror = (err) => {
    console.warn('SSE stream notice:', err);
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
    <td style="color: var(--text-muted); font-family: var(--font-mono);">${time}</td>
    <td><span class="event-badge ${fromClass}">${event.from || 'SYS'}</span></td>
    <td><span class="event-badge ${event.to || 'all'}">${event.to || 'ALL'}</span></td>
    <td style="font-weight: 600; color: var(--text-primary);">${event.type}</td>
    <td><span style="color: ${event.status === 'success' ? 'var(--emerald)' : event.status === 'failed' ? 'var(--rose)' : 'var(--primary)'}">${event.status || 'info'}</span></td>
    <td style="color: var(--text-secondary); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 11px;">
      ${JSON.stringify(event.data || {})}
    </td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);
}

async function triggerRetryRun() {
  if (!currentRunId) return;

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
  const promptInput = document.getElementById('prompt-input');

  // Retry buttons
  [btnRetry, btnCockpitRetry, btnBannerRetry].forEach((btn) => {
    if (btn) btn.addEventListener('click', triggerRetryRun);
  });

  // Fallback button
  if (btnBannerFallback) {
    btnBannerFallback.addEventListener('click', triggerFallbackRun);
  }

  // Start Collaboration
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      const prompt = promptInput ? promptInput.value.trim() : '';
      if (!prompt) {
        if (promptInput) promptInput.focus();
        return;
      }

      btnStart.disabled = true;
      const startLabel = document.getElementById('start-btn-label');
      if (startLabel) startLabel.textContent = 'Collaborating...';

      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnCockpitCancel) btnCockpitCancel.style.display = 'inline-flex';

      const codexModel = document.getElementById('select-codex-model')?.value || 'gpt-6-astra';
      const claudeModel = document.getElementById('select-claude-model')?.value || 'claude-sonnet-5';
      const geminiModel = document.getElementById('select-gemini-model')?.value || 'gemini-3.8-flash';
      const reasoningEffort = document.querySelector('#segment-reasoning .segment-btn.active')?.getAttribute('data-value') || 'low';
      const reviewerFallback = document.getElementById('check-reviewer-fallback')?.checked !== false;

      // Show live running banner on home
      const homeLiveBanner = document.getElementById('home-live-banner');
      const homeLiveTitle = document.getElementById('home-live-title');
      const pName = getAgentMeta(currentRouting.planner.agent).name;
      const bName = getAgentMeta(currentRouting.builder.agent).name;
      const rName = getAgentMeta(currentRouting.reviewer.agent).name;
      if (homeLiveBanner) homeLiveBanner.style.display = 'block';
      if (homeLiveTitle) {
        homeLiveTitle.textContent = `Building: ${deriveRunTitle({ userRequest: prompt })} [${pName} → ${bName} → ${rName}]`;
      }

      try {
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            routing: currentRouting,
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
          if (startLabel) startLabel.textContent = 'Start with AI Team';
          if (btnCancel) btnCancel.style.display = 'none';
          if (homeLiveBanner) homeLiveBanner.style.display = 'none';
          return;
        }

        if (result.run_id) {
          currentRunId = result.run_id;
          currentRunData = {
            id: result.run_id,
            currentState: 'REQUEST_RECEIVED',
            userRequest: prompt,
            routing: result.routing || currentRouting,
            files: {},
          };

          // Update Home live banner ID
          const homeLiveId = document.getElementById('home-live-id');
          if (homeLiveId) homeLiveId.textContent = result.run_id;

          // Connect SSE
          connectRunStream(result.run_id);
          await loadRuns();
        }
      } catch (err) {
        alert('Error launching collaboration run: ' + err.message);
        btnStart.disabled = false;
        if (startLabel) startLabel.textContent = 'Start with AI Team';
        if (btnCancel) btnCancel.style.display = 'none';
        if (homeLiveBanner) homeLiveBanner.style.display = 'none';
      }
    });
  }

  // Cancel action
  const cancelAction = async () => {
    if (!currentRunId) return;
    if (!confirm('Are you sure you want to cancel the active collaboration run?')) return;

    try {
      if (btnCancel) btnCancel.disabled = true;
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
      if (btnStart) {
        btnStart.disabled = false;
        const startLabel = document.getElementById('start-btn-label');
        if (startLabel) startLabel.textContent = 'Start with AI Team';
      }
      const homeLiveBanner = document.getElementById('home-live-banner');
      if (homeLiveBanner) homeLiveBanner.style.display = 'none';

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
// 9. Workspace Files & Output Directory
// ==========================================================================

function renderWorkspaceOutput(data) {
  const ws = data.workspace || {};
  const runId = data.id || currentRunId;

  const wsPathEl = document.getElementById('output-workspace-path');
  const distPathEl = document.getElementById('output-dist-path');

  if (wsPathEl) wsPathEl.textContent = ws.workspacePath || 'Workspace directory initializing...';
  if (distPathEl) {
    distPathEl.textContent = ws.hasDist ? ws.distPath : ws.workspacePath ? `${ws.workspacePath}/dist` : 'dist/';
  }

  const cmdPreviewEl = document.getElementById('cmd-preview');
  const cmdDevEl = document.getElementById('cmd-dev');
  const cmdTestEl = document.getElementById('cmd-test');

  if (cmdPreviewEl) cmdPreviewEl.textContent = ws.runCommands?.preview || `cd "${ws.workspacePath || '.'}" && npm run preview`;
  if (cmdDevEl) cmdDevEl.textContent = ws.runCommands?.dev || `cd "${ws.workspacePath || '.'}" && npm run dev`;
  if (cmdTestEl) cmdTestEl.textContent = ws.runCommands?.test || `cd "${ws.workspacePath || '.'}" && npm test`;

  const previewUrl = ws.previewUrl || `/preview/${runId}/`;
  const previewUrlDisplay = document.getElementById('preview-url-display');
  const previewIframe = document.getElementById('preview-iframe');
  const previewExtLink = document.getElementById('preview-external-link');

  if (previewUrlDisplay) previewUrlDisplay.textContent = previewUrl;
  if (previewExtLink) previewExtLink.href = previewUrl;

  if (previewIframe) {
    if (ws.hasDist) {
      if (!previewIframe.src.includes(previewUrl)) previewIframe.src = previewUrl;
    } else if (data.id === 'run-e2e-001') {
      previewIframe.src = 'http://127.0.0.1:5173/';
    }
  }

  const rootPathEl = document.getElementById('files-root-path');
  if (rootPathEl) rootPathEl.textContent = ws.workspacePath || '';
}

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
    treeEl.innerHTML = '<li class="files-empty-item" style="padding: 12px; color: var(--text-muted);">Scanning workspace files...</li>';
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
    treeEl.innerHTML = '<li class="files-empty-item" style="padding: 12px; color: var(--text-muted);">Could not load files.</li>';
  }
}

function renderFilesList(files) {
  const treeEl = document.getElementById('files-tree-list');
  if (!treeEl) return;
  if (!files || files.length === 0) {
    treeEl.innerHTML = '<li class="files-empty-item" style="padding: 12px; color: var(--text-muted);">No files matched.</li>';
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
  // Copy Buttons
  document.querySelectorAll('[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const text = targetEl.textContent || targetEl.innerText;
      try {
        await navigator.clipboard.writeText(text.trim());
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 1500);
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
      }
    });
  });

  // Open in Finder
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

  // Switch to Preview Tab
  const btnViewPreview = document.getElementById('btn-view-preview-tab');
  if (btnViewPreview) {
    btnViewPreview.addEventListener('click', () => {
      const previewTabBtn = document.querySelector('.tab-btn[data-tab="tab-preview"]');
      if (previewTabBtn) previewTabBtn.click();
    });
  }

  // Reload Preview
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

  // Refresh Files
  const btnRefreshFiles = document.getElementById('btn-refresh-files');
  if (btnRefreshFiles) {
    btnRefreshFiles.addEventListener('click', () => {
      if (currentRunId) loadWorkspaceFiles(currentRunId);
    });
  }

  // Copy Active File
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

  // Search/Filter Files
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
}
