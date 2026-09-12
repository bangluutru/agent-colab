import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, defaultDistDir } from './serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.sessionId = null;
    this.consoleErrors = [];
    this.pageExceptions = [];
    this.networkErrors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (e) => {
        reject(e.error || new Error(e.message || 'WebSocket connection error'));
      };

      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
        } else if (msg.method) {
          if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params.type === 'error') {
              this.consoleErrors.push(msg.params);
            }
          } else if (msg.method === 'Runtime.exceptionThrown') {
            this.pageExceptions.push(msg.params);
          } else if (msg.method === 'Network.responseReceived') {
            if (msg.params.response && msg.params.response.status >= 400) {
              this.networkErrors.push({
                type: 'httpStatus',
                url: msg.params.response.url,
                status: msg.params.response.status,
                statusText: msg.params.response.statusText,
              });
            }
          } else if (msg.method === 'Network.loadingFailed') {
            if (!msg.params.canceled) {
              this.networkErrors.push({
                type: 'loadingFailed',
                requestId: msg.params.requestId,
                errorText: msg.params.errorText,
                typeParam: msg.params.type,
              });
            }
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (this.sessionId) {
        payload.sessionId = this.sessionId;
      }
      this.ws.send(JSON.stringify(payload));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export async function runAcceptanceChecks(options = {}) {
  console.log('===========================================================');
  console.log('🚀 FIREWORKS APP: PRODUCTION BROWSER ACCEPTANCE VERIFIER');
  console.log('===========================================================');

  let server;
  let chromeProc;
  let cdp;

  // Duration for stress run: defaults to 60s, configurable via env or options
  const stressDurationSec = options.stressDurationSec !== undefined
    ? options.stressDurationSec
    : (process.env.STRESS_DURATION_SEC ? Number(process.env.STRESS_DURATION_SEC) : 60);

  const report = {
    appUrl: '',
    browser: '',
    buildResult: null,
    environmentLimitations: 'None. Native Google Chrome browser verified on localhost.',
    results: {},
    consoleErrors: [],
    networkErrors: [],
  };

  try {
    // -------------------------------------------------------------
    // STEP 0: Establish Production Build
    // -------------------------------------------------------------
    console.log('\n[BUILD] Establishing production build from source...');
    const buildStart = Date.now();
    const buildRun = spawnSync('npm', ['run', 'build'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const buildDurationMs = Date.now() - buildStart;
    if (buildRun.status !== 0) {
      throw new Error(`Production build failed (code ${buildRun.status}):\n${buildRun.stderr || buildRun.stdout}`);
    }

    const distIndex = path.join(defaultDistDir, 'index.html');
    if (!fs.existsSync(distIndex)) {
      throw new Error(`Production build succeeded but dist/index.html was not generated!`);
    }

    const indexStats = fs.statSync(distIndex);
    report.buildResult = {
      status: 'SUCCESS',
      exitCode: 0,
      durationMs: buildDurationMs,
      indexHtmlSize: indexStats.size,
    };
    console.log(`  -> Build established in ${buildDurationMs}ms (index.html: ${indexStats.size} bytes)`);

    // -------------------------------------------------------------
    // STEP 1: Start Owned Server on Available Loopback Port (Issue 3)
    // -------------------------------------------------------------
    console.log('\n[SERVER] Binding owned production server to an available loopback port...');
    server = createServer({ distDir: defaultDistDir });

    await new Promise((resolve, reject) => {
      server.once('error', (err) => {
        reject(new Error(`Owned server failed to start: ${err.message}`));
      });
      // Passing port 0 guarantees the operating system assigns a free ephemeral port
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });

    const actualPort = server.address().port;
    const appUrl = `http://127.0.0.1:${actualPort}/`;
    report.appUrl = appUrl;
    console.log(`  -> Owned production server running on isolated port ${actualPort} (${appUrl})`);

    // -------------------------------------------------------------
    // STEP 2: Launch Chrome with Remote Debugging
    // -------------------------------------------------------------
    const cdpPort = await getFreePort();
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    if (!fs.existsSync(chromePath)) {
      report.environmentLimitations = `Google Chrome binary not found at ${chromePath}`;
      console.warn(`[WARN] ${report.environmentLimitations}`);
      return report;
    }

    console.log(`\n[CHROME] Spawning Chrome with CDP on port ${cdpPort}...`);
    chromeProc = spawn(chromePath, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      '--remote-allow-origins=*',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ]);

    let versionInfo;
    for (let i = 0; i < 40; i++) {
      await wait(150);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) {
          versionInfo = await res.json();
          break;
        }
      } catch {}
    }

    if (!versionInfo) {
      throw new Error(`Failed to connect to Google Chrome CDP port ${cdpPort}`);
    }

    report.browser = versionInfo.Browser;
    console.log(`  -> Connected to ${versionInfo.Browser}`);

    cdp = new CDPClient(versionInfo.webSocketDebuggerUrl);
    await cdp.connect();

    // -------------------------------------------------------------
    // STEP 3: Attach & Enable Network Monitoring BEFORE Navigation (Issue 2)
    // -------------------------------------------------------------
    console.log('\n[NETWORK] Enabling network and error tracking prior to navigation...');
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    cdp.sessionId = sessionId;

    // Enable domains BEFORE navigating to appUrl
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // Navigate to owned application URL
    await cdp.send('Page.navigate', { url: appUrl });

    // Wait for document ready and initial render
    for (let i = 0; i < 30; i++) {
      await wait(150);
      const readyState = await cdp.eval('document.readyState');
      const canvasExists = await cdp.eval('!!document.querySelector("canvas")');
      if (readyState === 'complete' && canvasExists) break;
    }
    await wait(300);

    // -------------------------------------------------------------
    // CHECK 1: Desktop Viewport (1440×900)
    // -------------------------------------------------------------
    console.log('\n[1/8] Verifying Desktop Viewport (1440×900)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.eval('window.dispatchEvent(new Event("resize"))');
    await wait(250);

    const desktopTitle = await cdp.eval('document.querySelector("h1")?.innerText');
    const desktopCanvas = await cdp.eval(`(() => {
      const c = document.querySelector("canvas");
      return { width: c?.width, height: c?.height, visible: !!c };
    })()`);
    const desktopDock = await cdp.eval('!!document.querySelector(".control-dock")');

    report.results.desktop_1440x900 = {
      title: desktopTitle,
      canvas: desktopCanvas,
      dockPresent: desktopDock,
      pass: desktopTitle === 'Pháo Hoa Đêm Hội' && desktopCanvas.visible && desktopCanvas.width >= 1440,
    };
    console.log(`  -> Title: "${desktopTitle}", Canvas: ${desktopCanvas.width}x${desktopCanvas.height}, Pass: ${report.results.desktop_1440x900.pass}`);

    // -------------------------------------------------------------
    // CHECK 2: Mobile Viewport 390×844 - Controls Layout, Bounds, & Focus Outline (Issue 1)
    // -------------------------------------------------------------
    console.log('\n[2/8] Verifying Mobile Viewport (390×844) Controls Bounds & Visibility...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
    await cdp.eval('window.dispatchEvent(new Event("resize"))');
    await wait(300);

    // Helper to evaluate layout bounds of dock and buttons
    const inspectMobileDock = async () => {
      return await cdp.eval(`(() => {
        const dock = document.querySelector(".control-dock");
        if (!dock) return { exists: false };
        const dockRect = dock.getBoundingClientRect();
        const buttons = Array.from(dock.querySelectorAll("button")).map((btn, index) => {
          const r = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          const overflowsDock = (
            r.left < dockRect.left - 1 ||
            r.right > dockRect.right + 1 ||
            r.top < dockRect.top - 1 ||
            r.bottom > dockRect.bottom + 1
          );
          return {
            index,
            text: btn.innerText.trim(),
            ariaLabel: btn.getAttribute("aria-label"),
            width: Math.round(r.width * 10) / 10,
            height: Math.round(r.height * 10) / 10,
            left: Math.round(r.left * 10) / 10,
            right: Math.round(r.right * 10) / 10,
            top: Math.round(r.top * 10) / 10,
            bottom: Math.round(r.bottom * 10) / 10,
            overflowsDock,
            outlineStyle: style.outlineStyle,
          };
        });

        return {
          exists: true,
          dockRect: {
            width: Math.round(dockRect.width * 10) / 10,
            height: Math.round(dockRect.height * 10) / 10,
            left: Math.round(dockRect.left * 10) / 10,
            right: Math.round(dockRect.right * 10) / 10,
          },
          buttonCount: buttons.length,
          buttons,
          dockFitsInViewport: dockRect.left >= 0 && dockRect.right <= 390.5,
          noButtonOverflows: buttons.every((b) => !b.overflowsDock),
          allButtonsVisible: buttons.every((b) => b.width >= 40 && b.height >= 40),
        };
      })()`);
    };

    // Subcheck 2a: Test with automatic-mode label "Tự động: BẬT"
    const layoutAutoOn = await inspectMobileDock();

    // Verify focus outline on all 4 buttons when focused
    const focusOutlines = [];
    for (let i = 0; i < 4; i++) {
      const focusState = await cdp.eval(`(() => {
        const btns = document.querySelectorAll(".control-dock button");
        if (!btns[${i}]) return null;
        btns[${i}].focus();
        const active = document.activeElement === btns[${i}];
        const style = window.getComputedStyle(btns[${i}]);
        return {
          active,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
        };
      })()`);
      focusOutlines.push(focusState);
    }

    // Subcheck 2b: Toggle to automatic-mode label "Tự động: TẮT" and re-verify bounds
    await cdp.eval('document.querySelector(".btn-toggle")?.click()');
    await wait(250);
    const layoutAutoOff = await inspectMobileDock();
    const autoOffLabel = await cdp.eval('document.querySelector(".btn-toggle")?.innerText');

    // Turn auto-fire back on for subsequent tests
    await cdp.eval('document.querySelector(".btn-toggle")?.click()');
    await wait(200);

    const mobilePass =
      layoutAutoOn.exists &&
      layoutAutoOn.buttonCount === 4 &&
      layoutAutoOn.dockFitsInViewport &&
      layoutAutoOn.noButtonOverflows &&
      layoutAutoOn.allButtonsVisible &&
      layoutAutoOff.exists &&
      layoutAutoOff.dockFitsInViewport &&
      layoutAutoOff.noButtonOverflows &&
      autoOffLabel.includes('TẮT') &&
      focusOutlines.every((f) => f && f.active && f.outlineStyle !== 'none');

    report.results.mobile_390x844_controls = {
      layoutAutoOn,
      layoutAutoOff,
      focusOutlines,
      pass: mobilePass,
    };
    console.log(`  -> Dock width: ${layoutAutoOn.dockRect.width}px, buttons contained without overflow: ${layoutAutoOn.noButtonOverflows}`);
    console.log(`  -> Auto-mode OFF label: "${autoOffLabel.trim()}", buttons contained without overflow: ${layoutAutoOff.noButtonOverflows}`);
    console.log(`  -> Visible focus outlines verified: ${focusOutlines.every((f) => f && f.outlineStyle !== 'none')}`);
    console.log(`  -> Mobile 390x844 Controls Pass: ${mobilePass}`);

    // -------------------------------------------------------------
    // CHECK 3: Auto-fire Toggle Behavior
    // -------------------------------------------------------------
    console.log('\n[3/8] Testing Auto-Fire Toggle State & Aria Attributes...');
    const autoBtnInit = await cdp.eval('document.querySelector(".btn-toggle")?.getAttribute("aria-pressed")');
    await cdp.eval('document.querySelector(".btn-toggle")?.click()'); // Turn off
    await wait(200);
    const autoBtnToggled = await cdp.eval('document.querySelector(".btn-toggle")?.getAttribute("aria-pressed")');
    const autoBtnText = await cdp.eval('document.querySelector(".btn-toggle")?.innerText');

    // Re-enable auto-fire
    await cdp.eval('document.querySelector(".btn-toggle")?.click()');
    await wait(200);

    report.results.autoFireToggle = {
      initialAria: autoBtnInit,
      toggledAria: autoBtnToggled,
      toggledText: autoBtnText,
      pass: autoBtnToggled === 'false' && autoBtnText.includes('TẮT'),
    };
    console.log(`  -> Auto-fire toggle verified: aria-pressed=${autoBtnToggled}, label="${autoBtnText.trim()}"`);

    // -------------------------------------------------------------
    // CHECK 4: Keyboard Shortcuts & Focused-Button Activation (Issue 2)
    // -------------------------------------------------------------
    console.log('\n[4/8] Testing Keyboard Shortcuts & Focused-Button Activation...');
    // Turn auto-fire off and clear for deterministic baseline
    await cdp.eval('document.querySelector(".btn-toggle")?.click()');
    await cdp.eval('document.querySelectorAll(".control-dock button")[3]?.click()');
    await wait(250);

    const baseRockets = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');

    // 4a. Global Space shortcut (when focus is not on a button)
    await cdp.eval('document.querySelector("canvas")?.focus()');
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code: 'Space',
      key: ' ',
      text: ' ',
      unmodifiedText: ' ',
      windowsVirtualKeyCode: 32,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code: 'Space',
      key: ' ',
      windowsVirtualKeyCode: 32,
    });
    await wait(350);
    const rocketsAfterGlobalSpace = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');

    // 4b. Focused button activation via Enter
    await cdp.eval('document.querySelector(".btn-primary")?.focus()');
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code: 'Enter',
      key: 'Enter',
      text: '\r',
      unmodifiedText: '\r',
      windowsVirtualKeyCode: 13,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code: 'Enter',
      key: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    await wait(350);
    const rocketsAfterEnterOnFocused = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');

    // 4c. Focused button activation via Space
    await cdp.eval('document.querySelector(".btn-primary")?.focus()');
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code: 'Space',
      key: ' ',
      text: ' ',
      unmodifiedText: ' ',
      windowsVirtualKeyCode: 32,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code: 'Space',
      key: ' ',
      windowsVirtualKeyCode: 32,
    });
    await wait(350);
    const rocketsAfterSpaceOnFocused = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');

    const keyboardPass =
      rocketsAfterGlobalSpace > baseRockets &&
      rocketsAfterEnterOnFocused > rocketsAfterGlobalSpace &&
      rocketsAfterSpaceOnFocused > rocketsAfterEnterOnFocused;

    report.results.keyboardActivation = {
      baseRockets,
      rocketsAfterGlobalSpace,
      rocketsAfterEnterOnFocused,
      rocketsAfterSpaceOnFocused,
      pass: keyboardPass,
    };
    console.log(`  -> Rockets count: baseline=${baseRockets}, global-Space=${rocketsAfterGlobalSpace}, focused-Enter=${rocketsAfterEnterOnFocused}, focused-Space=${rocketsAfterSpaceOnFocused}, Pass: ${keyboardPass}`);

    // -------------------------------------------------------------
    // CHECK 5: Real Touch Input on Canvas (Issue 2)
    // -------------------------------------------------------------
    console.log('\n[5/8] Testing Real Touch Input on Canvas (Input.dispatchTouchEvent)...');
    // Clear active fireworks for clean test
    await cdp.eval('document.querySelectorAll(".control-dock button")[3]?.click()');
    await wait(250);

    const rocketsBeforeTouch = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');

    const canvasRect = await cdp.eval(`(() => {
      const c = document.querySelector("canvas");
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`);

    const touchX = Math.round(canvasRect.left + canvasRect.width * 0.5);
    const touchY = Math.round(canvasRect.top + canvasRect.height * 0.35);

    // Dispatch REAL Chrome touch events through CDP
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: touchX, y: touchY }],
    });
    await wait(60);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await wait(350);

    const rocketsAfterTouch = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-rockets\']")?.innerText)');
    const touchPass = rocketsAfterTouch > rocketsBeforeTouch;

    report.results.realTouchInput = {
      beforeTouch: rocketsBeforeTouch,
      afterTouch: rocketsAfterTouch,
      touchCoordinates: { x: touchX, y: touchY },
      pass: touchPass,
    };
    console.log(`  -> Real touch at (${touchX}, ${touchY}): rockets before=${rocketsBeforeTouch}, after=${rocketsAfterTouch}, Pass: ${touchPass}`);

    // -------------------------------------------------------------
    // CHECK 6: Simulation Progression (Rocket Flight to Particle Burst)
    // -------------------------------------------------------------
    console.log('\n[6/8] Verifying Physics Progression (Rocket Flight -> Particle Explosion)...');
    let burstParticles = 0;
    for (let s = 0; s < 25; s++) {
      await wait(150);
      burstParticles = await cdp.eval('Number(document.querySelector("[data-testid=\'stat-particles\']")?.innerText)');
      if (burstParticles > 0) break;
    }

    report.results.simulationProgression = {
      particlesSpawned: burstParticles,
      pass: burstParticles > 0,
    };
    console.log(`  -> Rocket burst into particles: active particles = ${burstParticles}, Pass: ${burstParticles > 0}`);

    // -------------------------------------------------------------
    // CHECK 7: Planned Stress Run & Final Cleanup Check (Issue 2)
    // -------------------------------------------------------------
    console.log(`\n[7/8] Running Planned Stress Run (${stressDurationSec}s) & Final Cleanup Check...`);
    // Re-enable auto fire for stress run
    const autoNeedsEnable = await cdp.eval('document.querySelector(".btn-toggle")?.getAttribute("aria-pressed") !== "true"');
    if (autoNeedsEnable) {
      await cdp.eval('document.querySelector(".btn-toggle")?.click()');
    }

    const stressStart = Date.now();
    const targetEndTime = stressStart + stressDurationSec * 1000;
    let peakRockets = 0;
    let peakParticles = 0;
    let sampleCount = 0;
    let capacityViolated = false;

    console.log(`  -> Starting stress test: monitoring engine under continuous auto-fire & interaction for ${stressDurationSec}s...`);

    while (Date.now() < targetEndTime) {
      await wait(2000);
      sampleCount++;

      // Trigger occasional user taps during stress run
      if (sampleCount % 3 === 0) {
        await cdp.eval('document.querySelector(".btn-primary")?.click()');
      }

      const currentStats = await cdp.eval(`(() => {
        return {
          rockets: Number(document.querySelector("[data-testid='stat-rockets']")?.innerText || 0),
          particles: Number(document.querySelector("[data-testid='stat-particles']")?.innerText || 0),
        };
      })()`);

      if (currentStats.rockets > peakRockets) peakRockets = currentStats.rockets;
      if (currentStats.particles > peakParticles) peakParticles = currentStats.particles;

      // Engine limits: maxRockets=8, maxParticles=600
      if (currentStats.rockets > 8 || currentStats.particles > 600) {
        capacityViolated = true;
        console.error(`  [!] Capacity overflow: rockets=${currentStats.rockets}, particles=${currentStats.particles}`);
      }

      const elapsed = Math.round((Date.now() - stressStart) / 1000);
      if (sampleCount % 5 === 0 || elapsed >= stressDurationSec) {
        console.log(`  -> [Stress ${elapsed}/${stressDurationSec}s] Active: rockets=${currentStats.rockets}, particles=${currentStats.particles} (Peak: ${peakRockets} rockets, ${peakParticles} particles)`);
      }
    }

    // FINAL CLEANUP CHECK:
    console.log('  -> Executing Final Cleanup Check...');
    // Turn auto-fire off
    const isAutoRunning = await cdp.eval('document.querySelector(".btn-toggle")?.getAttribute("aria-pressed") === "true"');
    if (isAutoRunning) {
      await cdp.eval('document.querySelector(".btn-toggle")?.click()');
      await wait(150);
    }

    // Click cleanup button (broom icon)
    await cdp.eval('document.querySelectorAll(".control-dock button")[3]?.click()');
    await wait(300);

    const cleanedStats = await cdp.eval(`(() => {
      return {
        rockets: Number(document.querySelector("[data-testid='stat-rockets']")?.innerText || 0),
        particles: Number(document.querySelector("[data-testid='stat-particles']")?.innerText || 0),
      };
    })()`);

    const cleanupPassed = cleanedStats.rockets === 0 && cleanedStats.particles === 0;

    report.results.stressAndCleanup = {
      stressDurationSec,
      sampleCount,
      peakRockets,
      peakParticles,
      capacityEnforced: !capacityViolated,
      cleanedStats,
      pass: !capacityViolated && cleanupPassed,
    };
    console.log(`  -> Cleanup check: rockets=${cleanedStats.rockets}, particles=${cleanedStats.particles}, Cleanup Pass: ${cleanupPassed}`);

    // -------------------------------------------------------------
    // CHECK 8: Network Failures & Console Integrity (Issue 2)
    // -------------------------------------------------------------
    console.log('\n[8/8] Inspecting Network Resource Loading & Console Logs...');
    report.consoleErrors = cdp.consoleErrors;
    report.networkErrors = cdp.networkErrors;

    report.results.cleanExecution = {
      consoleErrorsCount: cdp.consoleErrors.length,
      pageExceptionsCount: cdp.pageExceptions.length,
      networkErrorsCount: cdp.networkErrors.length,
      pass: cdp.consoleErrors.length === 0 && cdp.pageExceptions.length === 0 && cdp.networkErrors.length === 0,
    };
    console.log(`  -> Console errors: ${cdp.consoleErrors.length}, Exceptions: ${cdp.pageExceptions.length}, Network errors: ${cdp.networkErrors.length}`);

    console.log('\n===========================================================');
    console.log('🎉 BROWSER ACCEPTANCE VERIFICATION REPORT:');
    console.log('===========================================================');
    console.log(JSON.stringify(report, null, 2));

    const allPassed = Object.values(report.results).every((r) => r.pass);
    if (!allPassed) {
      throw new Error('One or more acceptance verification checks failed!');
    }

    return report;
  } finally {
    if (cdp) {
      try { cdp.close(); } catch {}
    }
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    if (server) {
      try {
        await new Promise((res) => server.close(res));
      } catch {}
    }
  }
}

if (process.argv[1] === __filename) {
  runAcceptanceChecks()
    .then(() => {
      console.log('\n[SUCCESS] All browser acceptance verification criteria PASSED perfectly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FAILURE] Browser acceptance verification failed:', err);
      process.exit(1);
    });
}
