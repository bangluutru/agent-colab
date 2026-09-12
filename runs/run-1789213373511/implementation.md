# IMPLEMENTATION REPORT

## Summary
### Implementation Summary & Evidence

Đã hoàn thành xây dựng ứng dụng game **Flappy Bird** hoàn chỉnh trên nền tảng React + Vite + Canvas theo đúng kế hoạch triển khai đã được phê duyệt và đáp ứng toàn bộ các tiêu chí nghiệm thu (Acceptance Criteria).

---

### 1. Danh sách các file đã tạo và cấu hình

| File | Mục đích / Vai trò |
|---|---|
| [src/game/constants.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/constants.js) | Hằng số vật lý (trọng lực, lực nhảy, terminal velocity), kích thước logic canvas (360x600), hitbox padding và trạng thái game (`idle`, `playing`, `gameOver`). |
| [src/game/storage.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/storage.js) | Tầng lưu trữ điểm cao nhất an toàn với `localStorage`, tự động fallback về bộ nhớ đệm (memory cache) khi gặp lỗi quota hoặc trình duyệt vô hiệu hóa storage. |
| [src/game/collision.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/collision.js) | Hệ thống va chạm AABB (Axis-Aligned Bounding Box) cho chim, ống trên, ống dưới, trần màn hình và mặt đất với lề an toàn (hitbox margin). |
| [src/game/entities/bird.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/entities/bird.js) | Thực thể chim: tính toán trọng lực, vận tốc bay lên khi flap, góc quay nghiêng mượt theo vận tốc, chuyển động đập cánh và hiệu ứng nhấp nhô (bobbing) khi ở chế độ chờ (`idle`). |
| [src/game/entities/pipe-manager.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/entities/pipe-manager.js) | Quản lý sinh cặp ống ngẫu nhiên, đảm bảo khoảng hở (gap) an toàn để chim vượt qua, di chuyển sang trái, phát hiện ghi điểm một lần duy nhất và dọn dẹp ống khi ra khỏi màn hình. |
| [src/game/renderer.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/renderer.js) | Module vẽ Canvas 2D hoàn chỉnh: bầu trời gradient, mây parallax, vệt bóng thành phố phía xa, mặt đất cuộn liên tục, ống 3D retro có vành viền và chim Flappy Bird chi tiết (mắt, mỏ, cánh). |
| [src/game/game-engine.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/game/game-engine.js) | Động cơ game: điều phối vòng lặp `requestAnimationFrame`, kẹp giới hạn delta time (tối đa 0.1s chống dịch chuyển bất thường khi đổi tab), chuyển đổi trạng thái và dọn dẹp animation frame khi destroy. |
| [src/components/FlappyBirdGame.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/components/FlappyBirdGame.jsx) | React Component chính: tích hợp Canvas, hợp nhất input (Spacebar, Click, Touch) chống lặp lệnh (`e.repeat`), xử lý lớp phủ giao diện (Start screen, Game Over, nút Chơi lại) và hỗ trợ accessibility live region (`aria-live`). |
| [src/styles/flappy-bird.css](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/styles/flappy-bird.css) | Định kiểu responsive stage, tỉ lệ 360/600, `touch-action: none` chống cuộn trang khi chạm, hiệu ứng đổ bóng arcade và huy hiệu kỷ lục mới. |
| [src/styles/index.css](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/styles/index.css) | Thiết lập layout toàn cục và reset CSS. |
| [src/App.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/App.jsx) | Root component bao bọc FlappyBirdGame. |
| [src/main.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/src/main.jsx) | Entry point mount React vào `#root`. |
| [index.html](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/index.html) | Cập nhật viewport chống zoom ngoài ý muốn trên thiết bị di động và đặt tiêu đề trang `Flappy Bird`. |

---

### 2. Kiến trúc giải pháp (Architecture & Data Flow)

```
       +-------------------------------------------------------+
       |                  FlappyBirdGame.jsx                   |
       |  - Unified Input Handler (Space, Click, Pointer)      |
       |  - UI Overlays (Start Modal, Game Over, Scoreboard)   |
       |  - Accessibility Announcer (aria-live="polite")       |
       +---------------------------+---------------------------+
                                   | controls & hooks
                                   v
       +-------------------------------------------------------+
       |                    GameEngine.js                      |
       |  - State Machine: IDLE -> PLAYING -> GAME_OVER        |
       |  - Loop & Delta-Time Clamping (< 100ms)               |
       |  - Life-cycle: start(), flap(), restart(), destroy()  |
       +-------+-------------------+-------------------+-------+
               |                   |                   |
               v                   v                   v
        [Bird Entity]       [Pipe Manager]     [Collision System]
        - Gravity           - Spawn Interval   - AABB Hitbox
        - Terminal Vel      - Safe Gaps        - Ground & Ceiling
        - Angle Tilt        - Single Scoring   - Pipe Intersect
               |                   |                   |
               +-------------------+-------------------+
                                   |
                                   v
                         [Renderer & Storage]
                         - Canvas 2D Graphic Engine
                         - Safe LocalStorage Persistence
```

---

### 3. Xử lý các trường hợp biên (Edge Cases Guarded)

1. **Giữ phím Space hoặc bấm liên tục**: Sử dụng `if (e.repeat) return;` trong `keydown` listener nhằm ngăn việc giữ phím tự động spam đập cánh vô tận.
2. **Ngăn cuộn trang trên Mobile/Desktop**: Thiết lập `touch-action: none;` trên stage/canvas và gọi `e.preventDefault()` cho sự kiện phím Space / pointerdown.
3. **Chống click nhầm khi bấm nút Restart**: Dùng `e.stopPropagation()` ở các nút giao diện để click vào nút "Chơi lại" hay "Bắt đầu chơi" không kích hoạt thêm một cú nhảy ngoài ý muốn ngay trong frame kế tiếp.
4. **Tab trình duyệt bị ẩn (Background Tab)**: Kẹp giới hạn thời gian delta `Math.min(dt, 0.1)` trong hàm `update()`, loại bỏ tình trạng chim hoặc ống bị giật nhảy hàng nghìn pixel khi người chơi quay lại tab.
5. **Không nhân bản vòng lặp sau nhiều lần Restart**: Phương thức `startLoop()` và `destroy()` luôn huỷ triệt để `cancelAnimationFrame` trước khi khởi tạo vòng lặp mới.
6. **Lỗi lưu trữ LocalStorage**: Tự động bọc `try-catch` kiểm tra khả năng ghi; nếu trình duyệt bật chế độ ẩn danh nghiêm ngặt hoặc đầy quota, hệ thống tự chuyển sang bộ nhớ RAM mà không crash app.

---

### 4. Kết quả kiểm thử tự động (Test Verification)

Toàn bộ 7 bộ kiểm thử với 46 test cases kiểm tra từ tầng thực thể, vật lý, va chạm, tính điểm, storage cho đến UI component đều chạy và đạt kết quả 100% PASS:

- [tests/bird.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/bird.test.js) (7 tests): Khởi tạo chim, áp dụng trọng lực, kẹp terminal velocity, xoay góc theo hướng bay, bobbing khi idle.
- [tests/pipe-manager.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/pipe-manager.test.js) (7 tests): Sinh ống với khoảng cách an toàn, di chuyển, ghi điểm 1 lần duy nhất, dọn dẹp ống ngoài màn hình, reset sạch.
- [tests/collision.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/collision.test.js) (6 tests): Kiểm tra va chạm ống trên, ống dưới, trần màn hình, mặt đất và tính toán hitbox với biên an toàn.
- [tests/storage.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/storage.test.js) (7 tests): Lưu/đọc điểm cao, chống ghi đè điểm thấp hơn, lọc giá trị NaN/âm, fallback khi `setItem` bị chặn.
- [tests/game-engine.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/game-engine.test.js) (7 tests): Chuyển trạng thái (`idle` -> `playing` -> `gameOver`), cập nhật delta-time, kích hoạt callback kết thúc, dọn dẹp frame.
- [tests/renderer.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/renderer.test.js) (4 tests): Vẽ giao diện bầu trời, ống, chim, điểm số qua Canvas 2D không bị lỗi.
- [tests/flappy-bird.test.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789213373511/project/tests/flappy-bird.test.jsx) (8 tests): Render màn hình bắt đầu, bắt đầu bằng click / Spacebar, bỏ qua `repeat: true`, hiển thị Game Over và bấm Restart.

```
 RUN  v2.1.9 project

 ✓ tests/collision.test.js (6 tests)
 ✓ tests/pipe-manager.test.js (7 tests)
 ✓ tests/storage.test.js (7 tests)
 ✓ tests/bird.test.js (7 tests)
 ✓ tests/renderer.test.js (4 tests)
 ✓ tests/game-engine.test.js (7 tests)
 ✓ tests/flappy-bird.test.jsx (8 tests)

 Test Files  7 passed (7)
      Tests  46 passed (46)
   Duration  903ms
```

---

### 5. Kết quả Build Production

Lệnh `npm run build` thực thi thành công không có lỗi:
```
vite v5.4.21 building for production...
✓ 40 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.30 kB
dist/assets/index-CQ1-m7K_.css    3.91 kB │ gzip:  1.42 kB
dist/assets/index-CY9c4M8Y.js   155.70 kB │ gzip: 50.37 kB
✓ built in 360ms
```

Tuân thủ nghiêm ngặt quy tắc non-blocking execution (không giữ server chạy nền), toàn bộ mã nguồn và artifacts đã sẵn sàng để hệ thống chuyển tiếp sang bước review hoặc khởi chạy preview cho người dùng.


## Tests
```
Implementation finished. Awaiting verification tests.
```

## Diff
```diff
diff --git a/dist/assets/index-CQ1-m7K_.css b/dist/assets/index-CQ1-m7K_.css
new file mode 100644
index 0000000..3391750
--- /dev/null
+++ b/dist/assets/index-CQ1-m7K_.css
@@ -0,0 +1 @@
+.flappy-game-wrapper{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:100vh;padding:16px;box-sizing:border-box;background:linear-gradient(135deg,#1b2838,#101721);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#fff;user-select:none;-webkit-user-select:none}.flappy-screen-reader-announcer{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.flappy-game-stage{position:relative;width:100%;max-width:380px;aspect-ratio:360 / 600;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px #0009,0 0 0 4px #543847,0 0 0 8px #2b1f26;background-color:#4ec0ca;touch-action:none;cursor:pointer}.flappy-canvas{display:block;width:100%;height:100%;touch-action:none}.flappy-overlay{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background-color:#00000073;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);text-align:center;z-index:10;animation:fadeIn .25s ease-out}@keyframes fadeIn{0%{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}.flappy-title-main{font-size:2.4rem;font-weight:900;margin:0 0 8px;color:#ffd83d;text-shadow:-2px -2px 0 #543847,2px -2px 0 #543847,-2px 2px 0 #543847,2px 2px 0 #543847,0 6px 0 #cf7a00,0 9px 8px rgba(0,0,0,.6);letter-spacing:1px}.flappy-title-gameover{font-size:2.3rem;font-weight:900;margin:0 0 16px;color:#ff5252;text-shadow:-2px -2px 0 #543847,2px -2px 0 #543847,-2px 2px 0 #543847,2px 2px 0 #543847,0 5px 0 #9e1414,0 8px 8px rgba(0,0,0,.6);letter-spacing:1px}.flappy-card{width:100%;max-width:280px;background:#ded895;border:4px solid #543847;border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:inset 0 -4px #c2bb74,0 8px 16px #0006;color:#543847}.flappy-instruction-text{font-size:.95rem;line-height:1.45;color:#543847;font-weight:600;margin:0 0 12px}.flappy-controls-badge{display:flex;justify-content:center;gap:8px;margin-bottom:12px}.flappy-key-chip{background:#fff;border:2px solid #543847;border-radius:6px;padding:4px 10px;font-size:.8rem;font-weight:800;color:#543847;box-shadow:0 2px #543847}.flappy-score-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-weight:700;font-size:1.05rem;border-bottom:2px dashed #b9b16c}.flappy-score-row:last-child{border-bottom:none}.flappy-score-value{font-size:1.4rem;font-weight:900;color:#2b1f26}.flappy-new-record{display:inline-block;background:#ff5252;color:#fff;font-size:.75rem;font-weight:800;padding:3px 8px;border-radius:999px;margin-top:6px;animation:pulseBadge 1.2s infinite;box-shadow:0 2px 4px #ff525280}@keyframes pulseBadge{0%,to{transform:scale(1)}50%{transform:scale(1.08)}}.flappy-btn{background:linear-gradient(to bottom,#73bf2e,#5ba820);border:3px solid #543847;border-radius:10px;padding:12px 28px;font-size:1.15rem;font-weight:800;color:#fff;cursor:pointer;box-shadow:inset 0 2px #9de64e,0 5px #3a6b14,0 8px 12px #00000059;transition:all .1s ease;outline:none}.flappy-btn:hover{filter:brightness(1.05);transform:translateY(-2px);box-shadow:inset 0 2px #9de64e,0 7px #3a6b14,0 10px 14px #0006}.flappy-btn:active{transform:translateY(3px);box-shadow:inset 0 2px #9de64e,0 2px #3a6b14,0 4px 6px #0000004d}.flappy-btn:focus-visible{outline:3px solid #ffd83d;outline-offset:4px}.flappy-tap-hint{margin-top:14px;font-size:.85rem;color:#fff;opacity:.9;text-shadow:0 1px 3px rgba(0,0,0,.8)}.flappy-footer-info{margin-top:16px;font-size:.8rem;color:#7b8b9c;text-align:center}*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:100%;background-color:#101721;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;overflow-x:hidden}#root{min-height:100vh;display:flex;flex-direction:column}
diff --git a/dist/assets/index-CY9c4M8Y.js b/dist/assets/index-CY9c4M8Y.js
new file mode 100644
index 0000000..a52635d
--- /dev/null
+++ b/dist/assets/index-CY9c4M8Y.js
@@ -0,0 +1,40 @@
+(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))r(l);new MutationObserver(l=>{for(const i of l)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function n(l){const i={};return l.integrity&&(i.integrity=l.integrity),l.referrerPolicy&&(i.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?i.credentials="include":l.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(l){if(l.ep)return;l.ep=!0;const i=n(l);fetch(l.href,i)}})();function _f(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var ns={exports:{}},ll={},rs={exports:{}},x={};/**
+ * @license React
+ * react.production.min.js
+ *
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */var Jn=Symbol.for("react.element"),Cf=Symbol.for("react.portal"),Pf=Symbol.for("react.fragment"),Nf=Symbol.for("react.strict_mode"),Tf=Symbol.for("react.profiler"),Lf=Symbol.for("react.provider"),zf=Symbol.for("react.context"),Rf=Symbol.for("react.forward_ref"),xf=Symbol.for("react.suspense"),If=Symbol.for("react.memo"),Mf=Symbol.for("react.lazy"),Vo=Symbol.iterator;function Of(e){return e===null||typeof e!="object"?null:(e=Vo&&e[Vo]||e["@@iterator"],typeof e=="function"?e:null)}var ls={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},is=Object.assign,os={};function sn(e,t,n){this.props=e,this.context=t,this.refs=os,this.updater=n||ls}sn.prototype.isReactComponent={};sn.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};sn.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function us(){}us.prototype=sn.prototype;function Qi(e,t,n){this.props=e,this.context=t,this.refs=os,this.updater=n||ls}var Gi=Qi.prototype=new us;Gi.constructor=Qi;is(Gi,sn.prototype);Gi.isPureReactComponent=!0;var Wo=Array.isArray,ss=Object.prototype.hasOwnProperty,Yi={current:null},as={key:!0,ref:!0,__self:!0,__source:!0};function fs(e,t,n){var r,l={},i=null,o=null;if(t!=null)for(r in t.ref!==void 0&&(o=t.ref),t.key!==void 0&&(i=""+t.key),t)ss.call(t,r)&&!as.hasOwnProperty(r)&&(l[r]=t[r]);var u=arguments.length-2;if(u===1)l.children=n;else if(1<u){for(var s=Array(u),f=0;f<u;f++)s[f]=arguments[f+2];l.children=s}if(e&&e.defaultProps)for(r in u=e.defaultProps,u)l[r]===void 0&&(l[r]=u[r]);return{$$typeof:Jn,type:e,key:i,ref:o,props:l,_owner:Yi.current}}function Df(e,t){return{$$typeof:Jn,type:e.type,key:t,ref:e.ref,props:e.props,_owner:e._owner}}function Ki(e){return typeof e=="object"&&e!==null&&e.$$typeof===Jn}function jf(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var Qo=/\/+/g;function _l(e,t){return typeof e=="object"&&e!==null&&e.key!=null?jf(""+e.key):t.toString(36)}function Er(e,t,n,r,l){var i=typeof e;(i==="undefined"||i==="boolean")&&(e=null);var o=!1;if(e===null)o=!0;else switch(i){case"string":case"number":o=!0;break;case"object":switch(e.$$typeof){case Jn:case Cf:o=!0}}if(o)return o=e,l=l(o),e=r===""?"."+_l(o,0):r,Wo(l)?(n="",e!=null&&(n=e.replace(Qo,"$&/")+"/"),Er(l,t,n,"",function(f){return f})):l!=null&&(Ki(l)&&(l=Df(l,n+(!l.key||o&&o.key===l.key?"":(""+l.key).replace(Qo,"$&/")+"/")+e)),t.push(l)),1;if(o=0,r=r===""?".":r+":",Wo(e))for(var u=0;u<e.length;u++){i=e[u];var s=r+_l(i,u);o+=Er(i,t,n,s,l)}else if(s=Of(e),typeof s=="function")for(e=s.call(e),u=0;!(i=e.next()).done;)i=i.value,s=r+_l(i,u++),o+=Er(i,t,n,s,l);else if(i==="object")throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.");return o}function lr(e,t,n){if(e==null)return e;var r=[],l=0;return Er(e,r,"","",function(i){return t.call(n,i,l++)}),r}function Ff(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var se={current:null},_r={transition:null},Af={ReactCurrentDispatcher:se,ReactCurrentBatchConfig:_r,ReactCurrentOwner:Yi};function cs(){throw Error("act(...) is not supported in production builds of React.")}x.Children={map:lr,forEach:function(e,t,n){lr(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return lr(e,function(){t++}),t},toArray:function(e){return lr(e,function(t){return t})||[]},only:function(e){if(!Ki(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};x.Component=sn;x.Fragment=Pf;x.Profiler=Tf;x.PureComponent=Qi;x.StrictMode=Nf;x.Suspense=xf;x.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Af;x.act=cs;x.cloneElement=function(e,t,n){if(e==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var r=is({},e.props),l=e.key,i=e.ref,o=e._owner;if(t!=null){if(t.ref!==void 0&&(i=t.ref,o=Yi.current),t.key!==void 0&&(l=""+t.key),e.type&&e.type.defaultProps)var u=e.type.defaultProps;for(s in t)ss.call(t,s)&&!as.hasOwnProperty(s)&&(r[s]=t[s]===void 0&&u!==void 0?u[s]:t[s])}var s=arguments.length-2;if(s===1)r.children=n;else if(1<s){u=Array(s);for(var f=0;f<s;f++)u[f]=arguments[f+2];r.children=u}return{$$typeof:Jn,type:e.type,key:l,ref:i,props:r,_owner:o}};x.createContext=function(e){return e={$$typeof:zf,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},e.Provider={$$typeof:Lf,_context:e},e.Consumer=e};x.createElement=fs;x.createFactory=function(e){var t=fs.bind(null,e);return t.type=e,t};x.createRef=function(){return{current:null}};x.forwardRef=function(e){return{$$typeof:Rf,render:e}};x.isValidElement=Ki;x.lazy=function(e){return{$$typeof:Mf,_payload:{_status:-1,_result:e},_init:Ff}};x.memo=function(e,t){return{$$typeof:If,type:e,compare:t===void 0?null:t}};x.startTransition=function(e){var t=_r.transition;_r.transition={};try{e()}finally{_r.transition=t}};x.unstable_act=cs;x.useCallback=function(e,t){return se.current.useCallback(e,t)};x.useContext=function(e){return se.current.useContext(e)};x.useDebugValue=function(){};x.useDeferredValue=function(e){return se.current.useDeferredValue(e)};x.useEffect=function(e,t){return se.current.useEffect(e,t)};x.useId=function(){return se.current.useId()};x.useImperativeHandle=function(e,t,n){return se.current.useImperativeHandle(e,t,n)};x.useInsertionEffect=function(e,t){return se.current.useInsertionEffect(e,t)};x.useLayoutEffect=function(e,t){return se.current.useLayoutEffect(e,t)};x.useMemo=function(e,t){return se.current.useMemo(e,t)};x.useReducer=function(e,t,n){return se.current.useReducer(e,t,n)};x.useRef=function(e){return se.current.useRef(e)};x.useState=function(e){return se.current.useState(e)};x.useSyncExternalStore=function(e,t,n){return se.current.useSyncExternalStore(e,t,n)};x.useTransition=function(){return se.current.useTransition()};x.version="18.3.1";rs.exports=x;var fe=rs.exports;const Uf=_f(fe);/**
+ * @license React
+ * react-jsx-runtime.production.min.js
+ *
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */var Hf=fe,Bf=Symbol.for("react.element"),$f=Symbol.for("react.fragment"),Vf=Object.prototype.hasOwnProperty,Wf=Hf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,Qf={key:!0,ref:!0,__self:!0,__source:!0};function ds(e,t,n){var r,l={},i=null,o=null;n!==void 0&&(i=""+n),t.key!==void 0&&(i=""+t.key),t.ref!==void 0&&(o=t.ref);for(r in t)Vf.call(t,r)&&!Qf.hasOwnProperty(r)&&(l[r]=t[r]);if(e&&e.defaultProps)for(r in t=e.defaultProps,t)l[r]===void 0&&(l[r]=t[r]);return{$$typeof:Bf,type:e,key:i,ref:o,props:l,_owner:Wf.current}}ll.Fragment=$f;ll.jsx=ds;ll.jsxs=ds;ns.exports=ll;var R=ns.exports,Zl={},ps={exports:{}},ke={},hs={exports:{}},ms={};/**
+ * @license React
+ * scheduler.production.min.js
+ *
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */(function(e){function t(_,T){var z=_.length;_.push(T);e:for(;0<z;){var W=z-1>>>1,X=_[W];if(0<l(X,T))_[W]=T,_[z]=X,z=W;else break e}}function n(_){return _.length===0?null:_[0]}function r(_){if(_.length===0)return null;var T=_[0],z=_.pop();if(z!==T){_[0]=z;e:for(var W=0,X=_.length,nr=X>>>1;W<nr;){var wt=2*(W+1)-1,El=_[wt],St=wt+1,rr=_[St];if(0>l(El,z))St<X&&0>l(rr,El)?(_[W]=rr,_[St]=z,W=St):(_[W]=El,_[wt]=z,W=wt);else if(St<X&&0>l(rr,z))_[W]=rr,_[St]=z,W=St;else break e}}return T}function l(_,T){var z=_.sortIndex-T.sortIndex;return z!==0?z:_.id-T.id}if(typeof performance=="object"&&typeof performance.now=="function"){var i=performance;e.unstable_now=function(){return i.now()}}else{var o=Date,u=o.now();e.unstable_now=function(){return o.now()-u}}var s=[],f=[],m=1,h=null,p=3,w=!1,S=!1,v=!1,L=typeof setTimeout=="function"?setTimeout:null,c=typeof clearTimeout=="function"?clearTimeout:null,a=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function d(_){for(var T=n(f);T!==null;){if(T.callback===null)r(f);else if(T.startTime<=_)r(f),T.sortIndex=T.expirationTime,t(s,T);else break;T=n(f)}}function y(_){if(v=!1,d(_),!S)if(n(s)!==null)S=!0,Sl(E);else{var T=n(f);T!==null&&kl(y,T.startTime-_)}}function E(_,T){S=!1,v&&(v=!1,c(N),N=-1),w=!0;var z=p;try{for(d(T),h=n(s);h!==null&&(!(h.expirationTime>T)||_&&!ze());){var W=h.callback;if(typeof W=="function"){h.callback=null,p=h.priorityLevel;var X=W(h.expirationTime<=T);T=e.unstable_now(),typeof X=="function"?h.callback=X:h===n(s)&&r(s),d(T)}else r(s);h=n(s)}if(h!==null)var nr=!0;else{var wt=n(f);wt!==null&&kl(y,wt.startTime-T),nr=!1}return nr}finally{h=null,p=z,w=!1}}var C=!1,P=null,N=-1,V=5,I=-1;function ze(){return!(e.unstable_now()-I<V)}function cn(){if(P!==null){var _=e.unstable_now();I=_;var T=!0;try{T=P(!0,_)}finally{T?dn():(C=!1,P=null)}}else C=!1}var dn;if(typeof a=="function")dn=function(){a(cn)};else if(typeof MessageChannel<"u"){var $o=new MessageChannel,Ef=$o.port2;$o.port1.onmessage=cn,dn=function(){Ef.postMessage(null)}}else dn=function(){L(cn,0)};function Sl(_){P=_,C||(C=!0,dn())}function kl(_,T){N=L(function(){_(e.unstable_now())},T)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(_){_.callback=null},e.unstable_continueExecution=function(){S||w||(S=!0,Sl(E))},e.unstable_forceFrameRate=function(_){0>_||125<_?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):V=0<_?Math.floor(1e3/_):5},e.unstable_getCurrentPriorityLevel=function(){return p},e.unstable_getFirstCallbackNode=function(){return n(s)},e.unstable_next=function(_){switch(p){case 1:case 2:case 3:var T=3;break;default:T=p}var z=p;p=T;try{return _()}finally{p=z}},e.unstable_pauseExecution=function(){},e.unstable_requestPaint=function(){},e.unstable_runWithPriority=function(_,T){switch(_){case 1:case 2:case 3:case 4:case 5:break;default:_=3}var z=p;p=_;try{return T()}finally{p=z}},e.unstable_scheduleCallback=function(_,T,z){var W=e.unstable_now();switch(typeof z=="object"&&z!==null?(z=z.delay,z=typeof z=="number"&&0<z?W+z:W):z=W,_){case 1:var X=-1;break;case 2:X=250;break;case 5:X=1073741823;break;case 4:X=1e4;break;default:X=5e3}return X=z+X,_={id:m++,callback:T,priorityLevel:_,startTime:z,expirationTime:X,sortIndex:-1},z>W?(_.sortIndex=z,t(f,_),n(s)===null&&_===n(f)&&(v?(c(N),N=-1):v=!0,kl(y,z-W))):(_.sortIndex=X,t(s,_),S||w||(S=!0,Sl(E))),_},e.unstable_shouldYield=ze,e.unstable_wrapCallback=function(_){var T=p;return function(){var z=p;p=T;try{return _.apply(this,arguments)}finally{p=z}}}})(ms);hs.exports=ms;var Gf=hs.exports;/**
+ * @license React
+ * react-dom.production.min.js
+ *
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */var Yf=fe,Se=Gf;function g(e){for(var t="https://reactjs.org/docs/error-decoder.html?invariant="+e,n=1;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var vs=new Set,On={};function Mt(e,t){en(e,t),en(e+"Capture",t)}function en(e,t){for(On[e]=t,e=0;e<t.length;e++)vs.add(t[e])}var Ke=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Jl=Object.prototype.hasOwnProperty,Kf=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,Go={},Yo={};function Xf(e){return Jl.call(Yo,e)?!0:Jl.call(Go,e)?!1:Kf.test(e)?Yo[e]=!0:(Go[e]=!0,!1)}function Zf(e,t,n,r){if(n!==null&&n.type===0)return!1;switch(typeof t){case"function":case"symbol":return!0;case"boolean":return r?!1:n!==null?!n.acceptsBooleans:(e=e.toLowerCase().slice(0,5),e!=="data-"&&e!=="aria-");default:return!1}}function Jf(e,t,n,r){if(t===null||typeof t>"u"||Zf(e,t,n,r))return!0;if(r)return!1;if(n!==null)switch(n.type){case 3:return!t;case 4:return t===!1;case 5:return isNaN(t);case 6:return isNaN(t)||1>t}return!1}function ae(e,t,n,r,l,i,o){this.acceptsBooleans=t===2||t===3||t===4,this.attributeName=r,this.attributeNamespace=l,this.mustUseProperty=n,this.propertyName=e,this.type=t,this.sanitizeURL=i,this.removeEmptyString=o}var te={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e){te[e]=new ae(e,0,!1,e,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(e){var t=e[0];te[t]=new ae(t,1,!1,e[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(e){te[e]=new ae(e,2,!1,e.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(e){te[e]=new ae(e,2,!1,e,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e){te[e]=new ae(e,3,!1,e.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(e){te[e]=new ae(e,3,!0,e,null,!1,!1)});["capture","download"].forEach(function(e){te[e]=new ae(e,4,!1,e,null,!1,!1)});["cols","rows","size","span"].forEach(function(e){te[e]=new ae(e,6,!1,e,null,!1,!1)});["rowSpan","start"].forEach(function(e){te[e]=new ae(e,5,!1,e.toLowerCase(),null,!1,!1)});var Xi=/[\-:]([a-z])/g;function Zi(e){return e[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e){var t=e.replace(Xi,Zi);te[t]=new ae(t,1,!1,e,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e){var t=e.replace(Xi,Zi);te[t]=new ae(t,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(e){var t=e.replace(Xi,Zi);te[t]=new ae(t,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(e){te[e]=new ae(e,1,!1,e.toLowerCase(),null,!1,!1)});te.xlinkHref=new ae("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(e){te[e]=new ae(e,1,!1,e.toLowerCase(),null,!0,!0)});function Ji(e,t,n,r){var l=te.hasOwnProperty(t)?te[t]:null;(l!==null?l.type!==0:r||!(2<t.length)||t[0]!=="o"&&t[0]!=="O"||t[1]!=="n"&&t[1]!=="N")&&(Jf(t,n,l,r)&&(n=null),r||l===null?Xf(t)&&(n===null?e.removeAttribute(t):e.setAttribute(t,""+n)):l.mustUseProperty?e[l.propertyName]=n===null?l.type===3?!1:"":n:(t=l.attributeName,r=l.attributeNamespace,n===null?e.removeAttribute(t):(l=l.type,n=l===3||l===4&&n===!0?"":""+n,r?e.setAttributeNS(r,t,n):e.setAttribute(t,n))))}var qe=Yf.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,ir=Symbol.for("react.element"),jt=Symbol.for("react.portal"),Ft=Symbol.for("react.fragment"),qi=Symbol.for("react.strict_mode"),ql=Symbol.for("react.profiler"),ys=Symbol.for("react.provider"),gs=Symbol.for("react.context"),bi=Symbol.for("react.forward_ref"),bl=Symbol.for("react.suspense"),ei=Symbol.for("react.suspense_list"),eo=Symbol.for("react.memo"),et=Symbol.for("react.lazy"),ws=Symbol.for("react.offscreen"),Ko=Symbol.iterator;function pn(e){return e===null||typeof e!="object"?null:(e=Ko&&e[Ko]||e["@@iterator"],typeof e=="function"?e:null)}var B=Object.assign,Cl;function kn(e){if(Cl===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);Cl=t&&t[1]||""}return`
+`+Cl+e}var Pl=!1;function Nl(e,t){if(!e||Pl)return"";Pl=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(t)if(t=function(){throw Error()},Object.defineProperty(t.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(t,[])}catch(f){var r=f}Reflect.construct(e,[],t)}else{try{t.call()}catch(f){r=f}e.call(t.prototype)}else{try{throw Error()}catch(f){r=f}e()}}catch(f){if(f&&r&&typeof f.stack=="string"){for(var l=f.stack.split(`
+`),i=r.stack.split(`
+`),o=l.length-1,u=i.length-1;1<=o&&0<=u&&l[o]!==i[u];)u--;for(;1<=o&&0<=u;o--,u--)if(l[o]!==i[u]){if(o!==1||u!==1)do if(o--,u--,0>u||l[o]!==i[u]){var s=`
+`+l[o].replace(" at new "," at ");return e.displayName&&s.includes("<anonymous>")&&(s=s.replace("<anonymous>",e.displayName)),s}while(1<=o&&0<=u);break}}}finally{Pl=!1,Error.prepareStackTrace=n}return(e=e?e.displayName||e.name:"")?kn(e):""}function qf(e){switch(e.tag){case 5:return kn(e.type);case 16:return kn("Lazy");case 13:return kn("Suspense");case 19:return kn("SuspenseList");case 0:case 2:case 15:return e=Nl(e.type,!1),e;case 11:return e=Nl(e.type.render,!1),e;case 1:return e=Nl(e.type,!0),e;default:return""}}function ti(e){if(e==null)return null;if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case Ft:return"Fragment";case jt:return"Portal";case ql:return"Profiler";case qi:return"StrictMode";case bl:return"Suspense";case ei:return"SuspenseList"}if(typeof e=="object")switch(e.$$typeof){case gs:return(e.displayName||"Context")+".Consumer";case ys:return(e._context.displayName||"Context")+".Provider";case bi:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case eo:return t=e.displayName||null,t!==null?t:ti(e.type)||"Memo";case et:t=e._payload,e=e._init;try{return ti(e(t))}catch{}}return null}function bf(e){var t=e.type;switch(e.tag){case 24:return"Cache";case 9:return(t.displayName||"Context")+".Consumer";case 10:return(t._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return e=t.render,e=e.displayName||e.name||"",t.displayName||(e!==""?"ForwardRef("+e+")":"ForwardRef");case 7:return"Fragment";case 5:return t;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return ti(t);case 8:return t===qi?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof t=="function")return t.displayName||t.name||null;if(typeof t=="string")return t}return null}function ht(e){switch(typeof e){case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function Ss(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function ec(e){var t=Ss(e)?"checked":"value",n=Object.getOwnPropertyDescriptor(e.constructor.prototype,t),r=""+e[t];if(!e.hasOwnProperty(t)&&typeof n<"u"&&typeof n.get=="function"&&typeof n.set=="function"){var l=n.get,i=n.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return l.call(this)},set:function(o){r=""+o,i.call(this,o)}}),Object.defineProperty(e,t,{enumerable:n.enumerable}),{getValue:function(){return r},setValue:function(o){r=""+o},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function or(e){e._valueTracker||(e._valueTracker=ec(e))}function ks(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r="";return e&&(r=Ss(e)?e.checked?"true":"false":e.value),e=r,e!==n?(t.setValue(e),!0):!1}function Or(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}function ni(e,t){var n=t.checked;return B({},t,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:n??e._wrapperState.initialChecked})}function Xo(e,t){var n=t.defaultValue==null?"":t.defaultValue,r=t.checked!=null?t.checked:t.defaultChecked;n=ht(t.value!=null?t.value:n),e._wrapperState={initialChecked:r,initialValue:n,controlled:t.type==="checkbox"||t.type==="radio"?t.checked!=null:t.value!=null}}function Es(e,t){t=t.checked,t!=null&&Ji(e,"checked",t,!1)}function ri(e,t){Es(e,t);var n=ht(t.value),r=t.type;if(n!=null)r==="number"?(n===0&&e.value===""||e.value!=n)&&(e.value=""+n):e.value!==""+n&&(e.value=""+n);else if(r==="submit"||r==="reset"){e.removeAttribute("value");return}t.hasOwnProperty("value")?li(e,t.type,n):t.hasOwnProperty("defaultValue")&&li(e,t.type,ht(t.defaultValue)),t.checked==null&&t.defaultChecked!=null&&(e.defaultChecked=!!t.defaultChecked)}function Zo(e,t,n){if(t.hasOwnProperty("value")||t.hasOwnProperty("defaultValue")){var r=t.type;if(!(r!=="submit"&&r!=="reset"||t.value!==void 0&&t.value!==null))return;t=""+e._wrapperState.initialValue,n||t===e.value||(e.value=t),e.defaultValue=t}n=e.name,n!==""&&(e.name=""),e.defaultChecked=!!e._wrapperState.initialChecked,n!==""&&(e.name=n)}function li(e,t,n){(t!=="number"||Or(e.ownerDocument)!==e)&&(n==null?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+n&&(e.defaultValue=""+n))}var En=Array.isArray;function Kt(e,t,n,r){if(e=e.options,t){t={};for(var l=0;l<n.length;l++)t["$"+n[l]]=!0;for(n=0;n<e.length;n++)l=t.hasOwnProperty("$"+e[n].value),e[n].selected!==l&&(e[n].selected=l),l&&r&&(e[n].defaultSelected=!0)}else{for(n=""+ht(n),t=null,l=0;l<e.length;l++){if(e[l].value===n){e[l].selected=!0,r&&(e[l].defaultSelected=!0);return}t!==null||e[l].disabled||(t=e[l])}t!==null&&(t.selected=!0)}}function ii(e,t){if(t.dangerouslySetInnerHTML!=null)throw Error(g(91));return B({},t,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function Jo(e,t){var n=t.value;if(n==null){if(n=t.children,t=t.defaultValue,n!=null){if(t!=null)throw Error(g(92));if(En(n)){if(1<n.length)throw Error(g(93));n=n[0]}t=n}t==null&&(t=""),n=t}e._wrapperState={initialValue:ht(n)}}function _s(e,t){var n=ht(t.value),r=ht(t.defaultValue);n!=null&&(n=""+n,n!==e.value&&(e.value=n),t.defaultValue==null&&e.defaultValue!==n&&(e.defaultValue=n)),r!=null&&(e.defaultValue=""+r)}function qo(e){var t=e.textContent;t===e._wrapperState.initialValue&&t!==""&&t!==null&&(e.value=t)}function Cs(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function oi(e,t){return e==null||e==="http://www.w3.org/1999/xhtml"?Cs(t):e==="http://www.w3.org/2000/svg"&&t==="foreignObject"?"http://www.w3.org/1999/xhtml":e}var ur,Ps=function(e){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(t,n,r,l){MSApp.execUnsafeLocalFunction(function(){return e(t,n,r,l)})}:e}(function(e,t){if(e.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in e)e.innerHTML=t;else{for(ur=ur||document.createElement("div"),ur.innerHTML="<svg>"+t.valueOf().toString()+"</svg>",t=ur.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;t.firstChild;)e.appendChild(t.firstChild)}});function Dn(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var Pn={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},tc=["Webkit","ms","Moz","O"];Object.keys(Pn).forEach(function(e){tc.forEach(function(t){t=t+e.charAt(0).toUpperCase()+e.substring(1),Pn[t]=Pn[e]})});function Ns(e,t,n){return t==null||typeof t=="boolean"||t===""?"":n||typeof t!="number"||t===0||Pn.hasOwnProperty(e)&&Pn[e]?(""+t).trim():t+"px"}function Ts(e,t){e=e.style;for(var n in t)if(t.hasOwnProperty(n)){var r=n.indexOf("--")===0,l=Ns(n,t[n],r);n==="float"&&(n="cssFloat"),r?e.setProperty(n,l):e[n]=l}}var nc=B({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function ui(e,t){if(t){if(nc[e]&&(t.children!=null||t.dangerouslySetInnerHTML!=null))throw Error(g(137,e));if(t.dangerouslySetInnerHTML!=null){if(t.children!=null)throw Error(g(60));if(typeof t.dangerouslySetInnerHTML!="object"||!("__html"in t.dangerouslySetInnerHTML))throw Error(g(61))}if(t.style!=null&&typeof t.style!="object")throw Error(g(62))}}function si(e,t){if(e.indexOf("-")===-1)return typeof t.is=="string";switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var ai=null;function to(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var fi=null,Xt=null,Zt=null;function bo(e){if(e=er(e)){if(typeof fi!="function")throw Error(g(280));var t=e.stateNode;t&&(t=al(t),fi(e.stateNode,e.type,t))}}function Ls(e){Xt?Zt?Zt.push(e):Zt=[e]:Xt=e}function zs(){if(Xt){var e=Xt,t=Zt;if(Zt=Xt=null,bo(e),t)for(e=0;e<t.length;e++)bo(t[e])}}function Rs(e,t){return e(t)}function xs(){}var Tl=!1;function Is(e,t,n){if(Tl)return e(t,n);Tl=!0;try{return Rs(e,t,n)}finally{Tl=!1,(Xt!==null||Zt!==null)&&(xs(),zs())}}function jn(e,t){var n=e.stateNode;if(n===null)return null;var r=al(n);if(r===null)return null;n=r[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(e=e.type,r=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!r;break e;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(g(231,t,typeof n));return n}var ci=!1;if(Ke)try{var hn={};Object.defineProperty(hn,"passive",{get:function(){ci=!0}}),window.addEventListener("test",hn,hn),window.removeEventListener("test",hn,hn)}catch{ci=!1}function rc(e,t,n,r,l,i,o,u,s){var f=Array.prototype.slice.call(arguments,3);try{t.apply(n,f)}catch(m){this.onError(m)}}var Nn=!1,Dr=null,jr=!1,di=null,lc={onError:function(e){Nn=!0,Dr=e}};function ic(e,t,n,r,l,i,o,u,s){Nn=!1,Dr=null,rc.apply(lc,arguments)}function oc(e,t,n,r,l,i,o,u,s){if(ic.apply(this,arguments),Nn){if(Nn){var f=Dr;Nn=!1,Dr=null}else throw Error(g(198));jr||(jr=!0,di=f)}}function Ot(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,t.flags&4098&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function Ms(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function eu(e){if(Ot(e)!==e)throw Error(g(188))}function uc(e){var t=e.alternate;if(!t){if(t=Ot(e),t===null)throw Error(g(188));return t!==e?null:e}for(var n=e,r=t;;){var l=n.return;if(l===null)break;var i=l.alternate;if(i===null){if(r=l.return,r!==null){n=r;continue}break}if(l.child===i.child){for(i=l.child;i;){if(i===n)return eu(l),e;if(i===r)return eu(l),t;i=i.sibling}throw Error(g(188))}if(n.return!==r.return)n=l,r=i;else{for(var o=!1,u=l.child;u;){if(u===n){o=!0,n=l,r=i;break}if(u===r){o=!0,r=l,n=i;break}u=u.sibling}if(!o){for(u=i.child;u;){if(u===n){o=!0,n=i,r=l;break}if(u===r){o=!0,r=i,n=l;break}u=u.sibling}if(!o)throw Error(g(189))}}if(n.alternate!==r)throw Error(g(190))}if(n.tag!==3)throw Error(g(188));return n.stateNode.current===n?e:t}function Os(e){return e=uc(e),e!==null?Ds(e):null}function Ds(e){if(e.tag===5||e.tag===6)return e;for(e=e.child;e!==null;){var t=Ds(e);if(t!==null)return t;e=e.sibling}return null}var js=Se.unstable_scheduleCallback,tu=Se.unstable_cancelCallback,sc=Se.unstable_shouldYield,ac=Se.unstable_requestPaint,Q=Se.unstable_now,fc=Se.unstable_getCurrentPriorityLevel,no=Se.unstable_ImmediatePriority,Fs=Se.unstable_UserBlockingPriority,Fr=Se.unstable_NormalPriority,cc=Se.unstable_LowPriority,As=Se.unstable_IdlePriority,il=null,Be=null;function dc(e){if(Be&&typeof Be.onCommitFiberRoot=="function")try{Be.onCommitFiberRoot(il,e,void 0,(e.current.flags&128)===128)}catch{}}var Oe=Math.clz32?Math.clz32:mc,pc=Math.log,hc=Math.LN2;function mc(e){return e>>>=0,e===0?32:31-(pc(e)/hc|0)|0}var sr=64,ar=4194304;function _n(e){switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return e&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return e}}function Ar(e,t){var n=e.pendingLanes;if(n===0)return 0;var r=0,l=e.suspendedLanes,i=e.pingedLanes,o=n&268435455;if(o!==0){var u=o&~l;u!==0?r=_n(u):(i&=o,i!==0&&(r=_n(i)))}else o=n&~l,o!==0?r=_n(o):i!==0&&(r=_n(i));if(r===0)return 0;if(t!==0&&t!==r&&!(t&l)&&(l=r&-r,i=t&-t,l>=i||l===16&&(i&4194240)!==0))return t;if(r&4&&(r|=n&16),t=e.entangledLanes,t!==0)for(e=e.entanglements,t&=r;0<t;)n=31-Oe(t),l=1<<n,r|=e[n],t&=~l;return r}function vc(e,t){switch(e){case 1:case 2:case 4:return t+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function yc(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,l=e.expirationTimes,i=e.pendingLanes;0<i;){var o=31-Oe(i),u=1<<o,s=l[o];s===-1?(!(u&n)||u&r)&&(l[o]=vc(u,t)):s<=t&&(e.expiredLanes|=u),i&=~u}}function pi(e){return e=e.pendingLanes&-1073741825,e!==0?e:e&1073741824?1073741824:0}function Us(){var e=sr;return sr<<=1,!(sr&4194240)&&(sr=64),e}function Ll(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function qn(e,t,n){e.pendingLanes|=t,t!==536870912&&(e.suspendedLanes=0,e.pingedLanes=0),e=e.eventTimes,t=31-Oe(t),e[t]=n}function gc(e,t){var n=e.pendingLanes&~t;e.pendingLanes=t,e.suspendedLanes=0,e.pingedLanes=0,e.expiredLanes&=t,e.mutableReadLanes&=t,e.entangledLanes&=t,t=e.entanglements;var r=e.eventTimes;for(e=e.expirationTimes;0<n;){var l=31-Oe(n),i=1<<l;t[l]=0,r[l]=-1,e[l]=-1,n&=~i}}function ro(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-Oe(n),l=1<<r;l&t|e[r]&t&&(e[r]|=t),n&=~l}}var O=0;function Hs(e){return e&=-e,1<e?4<e?e&268435455?16:536870912:4:1}var Bs,lo,$s,Vs,Ws,hi=!1,fr=[],ot=null,ut=null,st=null,Fn=new Map,An=new Map,nt=[],wc="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function nu(e,t){switch(e){case"focusin":case"focusout":ot=null;break;case"dragenter":case"dragleave":ut=null;break;case"mouseover":case"mouseout":st=null;break;case"pointerover":case"pointerout":Fn.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":An.delete(t.pointerId)}}function mn(e,t,n,r,l,i){return e===null||e.nativeEvent!==i?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:i,targetContainers:[l]},t!==null&&(t=er(t),t!==null&&lo(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,l!==null&&t.indexOf(l)===-1&&t.push(l),e)}function Sc(e,t,n,r,l){switch(t){case"focusin":return ot=mn(ot,e,t,n,r,l),!0;case"dragenter":return ut=mn(ut,e,t,n,r,l),!0;case"mouseover":return st=mn(st,e,t,n,r,l),!0;case"pointerover":var i=l.pointerId;return Fn.set(i,mn(Fn.get(i)||null,e,t,n,r,l)),!0;case"gotpointercapture":return i=l.pointerId,An.set(i,mn(An.get(i)||null,e,t,n,r,l)),!0}return!1}function Qs(e){var t=_t(e.target);if(t!==null){var n=Ot(t);if(n!==null){if(t=n.tag,t===13){if(t=Ms(n),t!==null){e.blockedOn=t,Ws(e.priority,function(){$s(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Cr(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=mi(e.domEventName,e.eventSystemFlags,t[0],e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);ai=r,n.target.dispatchEvent(r),ai=null}else return t=er(n),t!==null&&lo(t),e.blockedOn=n,!1;t.shift()}return!0}function ru(e,t,n){Cr(e)&&n.delete(t)}function kc(){hi=!1,ot!==null&&Cr(ot)&&(ot=null),ut!==null&&Cr(ut)&&(ut=null),st!==null&&Cr(st)&&(st=null),Fn.forEach(ru),An.forEach(ru)}function vn(e,t){e.blockedOn===t&&(e.blockedOn=null,hi||(hi=!0,Se.unstable_scheduleCallback(Se.unstable_NormalPriority,kc)))}function Un(e){function t(l){return vn(l,e)}if(0<fr.length){vn(fr[0],e);for(var n=1;n<fr.length;n++){var r=fr[n];r.blockedOn===e&&(r.blockedOn=null)}}for(ot!==null&&vn(ot,e),ut!==null&&vn(ut,e),st!==null&&vn(st,e),Fn.forEach(t),An.forEach(t),n=0;n<nt.length;n++)r=nt[n],r.blockedOn===e&&(r.blockedOn=null);for(;0<nt.length&&(n=nt[0],n.blockedOn===null);)Qs(n),n.blockedOn===null&&nt.shift()}var Jt=qe.ReactCurrentBatchConfig,Ur=!0;function Ec(e,t,n,r){var l=O,i=Jt.transition;Jt.transition=null;try{O=1,io(e,t,n,r)}finally{O=l,Jt.transition=i}}function _c(e,t,n,r){var l=O,i=Jt.transition;Jt.transition=null;try{O=4,io(e,t,n,r)}finally{O=l,Jt.transition=i}}function io(e,t,n,r){if(Ur){var l=mi(e,t,n,r);if(l===null)Al(e,t,r,Hr,n),nu(e,r);else if(Sc(l,e,t,n,r))r.stopPropagation();else if(nu(e,r),t&4&&-1<wc.indexOf(e)){for(;l!==null;){var i=er(l);if(i!==null&&Bs(i),i=mi(e,t,n,r),i===null&&Al(e,t,r,Hr,n),i===l)break;l=i}l!==null&&r.stopPropagation()}else Al(e,t,r,null,n)}}var Hr=null;function mi(e,t,n,r){if(Hr=null,e=to(r),e=_t(e),e!==null)if(t=Ot(e),t===null)e=null;else if(n=t.tag,n===13){if(e=Ms(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null);return Hr=e,null}function Gs(e){switch(e){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(fc()){case no:return 1;case Fs:return 4;case Fr:case cc:return 16;case As:return 536870912;default:return 16}default:return 16}}var lt=null,oo=null,Pr=null;function Ys(){if(Pr)return Pr;var e,t=oo,n=t.length,r,l="value"in lt?lt.value:lt.textContent,i=l.length;for(e=0;e<n&&t[e]===l[e];e++);var o=n-e;for(r=1;r<=o&&t[n-r]===l[i-r];r++);return Pr=l.slice(e,1<r?1-r:void 0)}function Nr(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function cr(){return!0}function lu(){return!1}function Ee(e){function t(n,r,l,i,o){this._reactName=n,this._targetInst=l,this.type=r,this.nativeEvent=i,this.target=o,this.currentTarget=null;for(var u in e)e.hasOwnProperty(u)&&(n=e[u],this[u]=n?n(i):i[u]);return this.isDefaultPrevented=(i.defaultPrevented!=null?i.defaultPrevented:i.returnValue===!1)?cr:lu,this.isPropagationStopped=lu,this}return B(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=cr)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=cr)},persist:function(){},isPersistent:cr}),t}var an={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},uo=Ee(an),bn=B({},an,{view:0,detail:0}),Cc=Ee(bn),zl,Rl,yn,ol=B({},bn,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:so,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==yn&&(yn&&e.type==="mousemove"?(zl=e.screenX-yn.screenX,Rl=e.screenY-yn.screenY):Rl=zl=0,yn=e),zl)},movementY:function(e){return"movementY"in e?e.movementY:Rl}}),iu=Ee(ol),Pc=B({},ol,{dataTransfer:0}),Nc=Ee(Pc),Tc=B({},bn,{relatedTarget:0}),xl=Ee(Tc),Lc=B({},an,{animationName:0,elapsedTime:0,pseudoElement:0}),zc=Ee(Lc),Rc=B({},an,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),xc=Ee(Rc),Ic=B({},an,{data:0}),ou=Ee(Ic),Mc={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Oc={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Dc={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function jc(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Dc[e])?!!t[e]:!1}function so(){return jc}var Fc=B({},bn,{key:function(e){if(e.key){var t=Mc[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Nr(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Oc[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:so,charCode:function(e){return e.type==="keypress"?Nr(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Nr(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Ac=Ee(Fc),Uc=B({},ol,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),uu=Ee(Uc),Hc=B({},bn,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:so}),Bc=Ee(Hc),$c=B({},an,{propertyName:0,elapsedTime:0,pseudoElement:0}),Vc=Ee($c),Wc=B({},ol,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Qc=Ee(Wc),Gc=[9,13,27,32],ao=Ke&&"CompositionEvent"in window,Tn=null;Ke&&"documentMode"in document&&(Tn=document.documentMode);var Yc=Ke&&"TextEvent"in window&&!Tn,Ks=Ke&&(!ao||Tn&&8<Tn&&11>=Tn),su=" ",au=!1;function Xs(e,t){switch(e){case"keyup":return Gc.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Zs(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var At=!1;function Kc(e,t){switch(e){case"compositionend":return Zs(t);case"keypress":return t.which!==32?null:(au=!0,su);case"textInput":return e=t.data,e===su&&au?null:e;default:return null}}function Xc(e,t){if(At)return e==="compositionend"||!ao&&Xs(e,t)?(e=Ys(),Pr=oo=lt=null,At=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return Ks&&t.locale!=="ko"?null:t.data;default:return null}}var Zc={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function fu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!Zc[e.type]:t==="textarea"}function Js(e,t,n,r){Ls(r),t=Br(t,"onChange"),0<t.length&&(n=new uo("onChange","change",null,n,r),e.push({event:n,listeners:t}))}var Ln=null,Hn=null;function Jc(e){sa(e,0)}function ul(e){var t=Bt(e);if(ks(t))return e}function qc(e,t){if(e==="change")return t}var qs=!1;if(Ke){var Il;if(Ke){var Ml="oninput"in document;if(!Ml){var cu=document.createElement("div");cu.setAttribute("oninput","return;"),Ml=typeof cu.oninput=="function"}Il=Ml}else Il=!1;qs=Il&&(!document.documentMode||9<document.documentMode)}function du(){Ln&&(Ln.detachEvent("onpropertychange",bs),Hn=Ln=null)}function bs(e){if(e.propertyName==="value"&&ul(Hn)){var t=[];Js(t,Hn,e,to(e)),Is(Jc,t)}}function bc(e,t,n){e==="focusin"?(du(),Ln=t,Hn=n,Ln.attachEvent("onpropertychange",bs)):e==="focusout"&&du()}function ed(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return ul(Hn)}function td(e,t){if(e==="click")return ul(t)}function nd(e,t){if(e==="input"||e==="change")return ul(t)}function rd(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Fe=typeof Object.is=="function"?Object.is:rd;function Bn(e,t){if(Fe(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var l=n[r];if(!Jl.call(t,l)||!Fe(e[l],t[l]))return!1}return!0}function pu(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function hu(e,t){var n=pu(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=pu(n)}}function ea(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?ea(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function ta(){for(var e=window,t=Or();t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=Or(e.document)}return t}function fo(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}function ld(e){var t=ta(),n=e.focusedElem,r=e.selectionRange;if(t!==n&&n&&n.ownerDocument&&ea(n.ownerDocument.documentElement,n)){if(r!==null&&fo(n)){if(t=r.start,e=r.end,e===void 0&&(e=t),"selectionStart"in n)n.selectionStart=t,n.selectionEnd=Math.min(e,n.value.length);else if(e=(t=n.ownerDocument||document)&&t.defaultView||window,e.getSelection){e=e.getSelection();var l=n.textContent.length,i=Math.min(r.start,l);r=r.end===void 0?i:Math.min(r.end,l),!e.extend&&i>r&&(l=r,r=i,i=l),l=hu(n,i);var o=hu(n,r);l&&o&&(e.rangeCount!==1||e.anchorNode!==l.node||e.anchorOffset!==l.offset||e.focusNode!==o.node||e.focusOffset!==o.offset)&&(t=t.createRange(),t.setStart(l.node,l.offset),e.removeAllRanges(),i>r?(e.addRange(t),e.extend(o.node,o.offset)):(t.setEnd(o.node,o.offset),e.addRange(t)))}}for(t=[],e=n;e=e.parentNode;)e.nodeType===1&&t.push({element:e,left:e.scrollLeft,top:e.scrollTop});for(typeof n.focus=="function"&&n.focus(),n=0;n<t.length;n++)e=t[n],e.element.scrollLeft=e.left,e.element.scrollTop=e.top}}var id=Ke&&"documentMode"in document&&11>=document.documentMode,Ut=null,vi=null,zn=null,yi=!1;function mu(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;yi||Ut==null||Ut!==Or(r)||(r=Ut,"selectionStart"in r&&fo(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),zn&&Bn(zn,r)||(zn=r,r=Br(vi,"onSelect"),0<r.length&&(t=new uo("onSelect","select",null,t,n),e.push({event:t,listeners:r}),t.target=Ut)))}function dr(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var Ht={animationend:dr("Animation","AnimationEnd"),animationiteration:dr("Animation","AnimationIteration"),animationstart:dr("Animation","AnimationStart"),transitionend:dr("Transition","TransitionEnd")},Ol={},na={};Ke&&(na=document.createElement("div").style,"AnimationEvent"in window||(delete Ht.animationend.animation,delete Ht.animationiteration.animation,delete Ht.animationstart.animation),"TransitionEvent"in window||delete Ht.transitionend.transition);function sl(e){if(Ol[e])return Ol[e];if(!Ht[e])return e;var t=Ht[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in na)return Ol[e]=t[n];return e}var ra=sl("animationend"),la=sl("animationiteration"),ia=sl("animationstart"),oa=sl("transitionend"),ua=new Map,vu="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function vt(e,t){ua.set(e,t),Mt(t,[e])}for(var Dl=0;Dl<vu.length;Dl++){var jl=vu[Dl],od=jl.toLowerCase(),ud=jl[0].toUpperCase()+jl.slice(1);vt(od,"on"+ud)}vt(ra,"onAnimationEnd");vt(la,"onAnimationIteration");vt(ia,"onAnimationStart");vt("dblclick","onDoubleClick");vt("focusin","onFocus");vt("focusout","onBlur");vt(oa,"onTransitionEnd");en("onMouseEnter",["mouseout","mouseover"]);en("onMouseLeave",["mouseout","mouseover"]);en("onPointerEnter",["pointerout","pointerover"]);en("onPointerLeave",["pointerout","pointerover"]);Mt("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));Mt("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));Mt("onBeforeInput",["compositionend","keypress","textInput","paste"]);Mt("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));Mt("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));Mt("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Cn="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),sd=new Set("cancel close invalid load scroll toggle".split(" ").concat(Cn));function yu(e,t,n){var r=e.type||"unknown-event";e.currentTarget=n,oc(r,t,void 0,e),e.currentTarget=null}function sa(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var r=e[n],l=r.event;r=r.listeners;e:{var i=void 0;if(t)for(var o=r.length-1;0<=o;o--){var u=r[o],s=u.instance,f=u.currentTarget;if(u=u.listener,s!==i&&l.isPropagationStopped())break e;yu(l,u,f),i=s}else for(o=0;o<r.length;o++){if(u=r[o],s=u.instance,f=u.currentTarget,u=u.listener,s!==i&&l.isPropagationStopped())break e;yu(l,u,f),i=s}}}if(jr)throw e=di,jr=!1,di=null,e}function j(e,t){var n=t[Ei];n===void 0&&(n=t[Ei]=new Set);var r=e+"__bubble";n.has(r)||(aa(t,e,2,!1),n.add(r))}function Fl(e,t,n){var r=0;t&&(r|=4),aa(n,e,r,t)}var pr="_reactListening"+Math.random().toString(36).slice(2);function $n(e){if(!e[pr]){e[pr]=!0,vs.forEach(function(n){n!=="selectionchange"&&(sd.has(n)||Fl(n,!1,e),Fl(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[pr]||(t[pr]=!0,Fl("selectionchange",!1,t))}}function aa(e,t,n,r){switch(Gs(t)){case 1:var l=Ec;break;case 4:l=_c;break;default:l=io}n=l.bind(null,t,n,e),l=void 0,!ci||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(l=!0),r?l!==void 0?e.addEventListener(t,n,{capture:!0,passive:l}):e.addEventListener(t,n,!0):l!==void 0?e.addEventListener(t,n,{passive:l}):e.addEventListener(t,n,!1)}function Al(e,t,n,r,l){var i=r;if(!(t&1)&&!(t&2)&&r!==null)e:for(;;){if(r===null)return;var o=r.tag;if(o===3||o===4){var u=r.stateNode.containerInfo;if(u===l||u.nodeType===8&&u.parentNode===l)break;if(o===4)for(o=r.return;o!==null;){var s=o.tag;if((s===3||s===4)&&(s=o.stateNode.containerInfo,s===l||s.nodeType===8&&s.parentNode===l))return;o=o.return}for(;u!==null;){if(o=_t(u),o===null)return;if(s=o.tag,s===5||s===6){r=i=o;continue e}u=u.parentNode}}r=r.return}Is(function(){var f=i,m=to(n),h=[];e:{var p=ua.get(e);if(p!==void 0){var w=uo,S=e;switch(e){case"keypress":if(Nr(n)===0)break e;case"keydown":case"keyup":w=Ac;break;case"focusin":S="focus",w=xl;break;case"focusout":S="blur",w=xl;break;case"beforeblur":case"afterblur":w=xl;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":w=iu;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":w=Nc;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":w=Bc;break;case ra:case la:case ia:w=zc;break;case oa:w=Vc;break;case"scroll":w=Cc;break;case"wheel":w=Qc;break;case"copy":case"cut":case"paste":w=xc;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":w=uu}var v=(t&4)!==0,L=!v&&e==="scroll",c=v?p!==null?p+"Capture":null:p;v=[];for(var a=f,d;a!==null;){d=a;var y=d.stateNode;if(d.tag===5&&y!==null&&(d=y,c!==null&&(y=jn(a,c),y!=null&&v.push(Vn(a,y,d)))),L)break;a=a.return}0<v.length&&(p=new w(p,S,null,n,m),h.push({event:p,listeners:v}))}}if(!(t&7)){e:{if(p=e==="mouseover"||e==="pointerover",w=e==="mouseout"||e==="pointerout",p&&n!==ai&&(S=n.relatedTarget||n.fromElement)&&(_t(S)||S[Xe]))break e;if((w||p)&&(p=m.window===m?m:(p=m.ownerDocument)?p.defaultView||p.parentWindow:window,w?(S=n.relatedTarget||n.toElement,w=f,S=S?_t(S):null,S!==null&&(L=Ot(S),S!==L||S.tag!==5&&S.tag!==6)&&(S=null)):(w=null,S=f),w!==S)){if(v=iu,y="onMouseLeave",c="onMouseEnter",a="mouse",(e==="pointerout"||e==="pointerover")&&(v=uu,y="onPointerLeave",c="onPointerEnter",a="pointer"),L=w==null?p:Bt(w),d=S==null?p:Bt(S),p=new v(y,a+"leave",w,n,m),p.target=L,p.relatedTarget=d,y=null,_t(m)===f&&(v=new v(c,a+"enter",S,n,m),v.target=d,v.relatedTarget=L,y=v),L=y,w&&S)t:{for(v=w,c=S,a=0,d=v;d;d=Dt(d))a++;for(d=0,y=c;y;y=Dt(y))d++;for(;0<a-d;)v=Dt(v),a--;for(;0<d-a;)c=Dt(c),d--;for(;a--;){if(v===c||c!==null&&v===c.alternate)break t;v=Dt(v),c=Dt(c)}v=null}else v=null;w!==null&&gu(h,p,w,v,!1),S!==null&&L!==null&&gu(h,L,S,v,!0)}}e:{if(p=f?Bt(f):window,w=p.nodeName&&p.nodeName.toLowerCase(),w==="select"||w==="input"&&p.type==="file")var E=qc;else if(fu(p))if(qs)E=nd;else{E=ed;var C=bc}else(w=p.nodeName)&&w.toLowerCase()==="input"&&(p.type==="checkbox"||p.type==="radio")&&(E=td);if(E&&(E=E(e,f))){Js(h,E,n,m);break e}C&&C(e,p,f),e==="focusout"&&(C=p._wrapperState)&&C.controlled&&p.type==="number"&&li(p,"number",p.value)}switch(C=f?Bt(f):window,e){case"focusin":(fu(C)||C.contentEditable==="true")&&(Ut=C,vi=f,zn=null);break;case"focusout":zn=vi=Ut=null;break;case"mousedown":yi=!0;break;case"contextmenu":case"mouseup":case"dragend":yi=!1,mu(h,n,m);break;case"selectionchange":if(id)break;case"keydown":case"keyup":mu(h,n,m)}var P;if(ao)e:{switch(e){case"compositionstart":var N="onCompositionStart";break e;case"compositionend":N="onCompositionEnd";break e;case"compositionupdate":N="onCompositionUpdate";break e}N=void 0}else At?Xs(e,n)&&(N="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(N="onCompositionStart");N&&(Ks&&n.locale!=="ko"&&(At||N!=="onCompositionStart"?N==="onCompositionEnd"&&At&&(P=Ys()):(lt=m,oo="value"in lt?lt.value:lt.textContent,At=!0)),C=Br(f,N),0<C.length&&(N=new ou(N,e,null,n,m),h.push({event:N,listeners:C}),P?N.data=P:(P=Zs(n),P!==null&&(N.data=P)))),(P=Yc?Kc(e,n):Xc(e,n))&&(f=Br(f,"onBeforeInput"),0<f.length&&(m=new ou("onBeforeInput","beforeinput",null,n,m),h.push({event:m,listeners:f}),m.data=P))}sa(h,t)})}function Vn(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Br(e,t){for(var n=t+"Capture",r=[];e!==null;){var l=e,i=l.stateNode;l.tag===5&&i!==null&&(l=i,i=jn(e,n),i!=null&&r.unshift(Vn(e,i,l)),i=jn(e,t),i!=null&&r.push(Vn(e,i,l))),e=e.return}return r}function Dt(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5);return e||null}function gu(e,t,n,r,l){for(var i=t._reactName,o=[];n!==null&&n!==r;){var u=n,s=u.alternate,f=u.stateNode;if(s!==null&&s===r)break;u.tag===5&&f!==null&&(u=f,l?(s=jn(n,i),s!=null&&o.unshift(Vn(n,s,u))):l||(s=jn(n,i),s!=null&&o.push(Vn(n,s,u)))),n=n.return}o.length!==0&&e.push({event:t,listeners:o})}var ad=/\r\n?/g,fd=/\u0000|\uFFFD/g;function wu(e){return(typeof e=="string"?e:""+e).replace(ad,`
+`).replace(fd,"")}function hr(e,t,n){if(t=wu(t),wu(e)!==t&&n)throw Error(g(425))}function $r(){}var gi=null,wi=null;function Si(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var ki=typeof setTimeout=="function"?setTimeout:void 0,cd=typeof clearTimeout=="function"?clearTimeout:void 0,Su=typeof Promise=="function"?Promise:void 0,dd=typeof queueMicrotask=="function"?queueMicrotask:typeof Su<"u"?function(e){return Su.resolve(null).then(e).catch(pd)}:ki;function pd(e){setTimeout(function(){throw e})}function Ul(e,t){var n=t,r=0;do{var l=n.nextSibling;if(e.removeChild(n),l&&l.nodeType===8)if(n=l.data,n==="/$"){if(r===0){e.removeChild(l),Un(t);return}r--}else n!=="$"&&n!=="$?"&&n!=="$!"||r++;n=l}while(n);Un(t)}function at(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?")break;if(t==="/$")return null}}return e}function ku(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"){if(t===0)return e;t--}else n==="/$"&&t++}e=e.previousSibling}return null}var fn=Math.random().toString(36).slice(2),He="__reactFiber$"+fn,Wn="__reactProps$"+fn,Xe="__reactContainer$"+fn,Ei="__reactEvents$"+fn,hd="__reactListeners$"+fn,md="__reactHandles$"+fn;function _t(e){var t=e[He];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Xe]||n[He]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=ku(e);e!==null;){if(n=e[He])return n;e=ku(e)}return t}e=n,n=e.parentNode}return null}function er(e){return e=e[He]||e[Xe],!e||e.tag!==5&&e.tag!==6&&e.tag!==13&&e.tag!==3?null:e}function Bt(e){if(e.tag===5||e.tag===6)return e.stateNode;throw Error(g(33))}function al(e){return e[Wn]||null}var _i=[],$t=-1;function yt(e){return{current:e}}function F(e){0>$t||(e.current=_i[$t],_i[$t]=null,$t--)}function D(e,t){$t++,_i[$t]=e.current,e.current=t}var mt={},ie=yt(mt),he=yt(!1),Lt=mt;function tn(e,t){var n=e.type.contextTypes;if(!n)return mt;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===t)return r.__reactInternalMemoizedMaskedChildContext;var l={},i;for(i in n)l[i]=t[i];return r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=t,e.__reactInternalMemoizedMaskedChildContext=l),l}function me(e){return e=e.childContextTypes,e!=null}function Vr(){F(he),F(ie)}function Eu(e,t,n){if(ie.current!==mt)throw Error(g(168));D(ie,t),D(he,n)}function fa(e,t,n){var r=e.stateNode;if(t=t.childContextTypes,typeof r.getChildContext!="function")return n;r=r.getChildContext();for(var l in r)if(!(l in t))throw Error(g(108,bf(e)||"Unknown",l));return B({},n,r)}function Wr(e){return e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||mt,Lt=ie.current,D(ie,e),D(he,he.current),!0}function _u(e,t,n){var r=e.stateNode;if(!r)throw Error(g(169));n?(e=fa(e,t,Lt),r.__reactInternalMemoizedMergedChildContext=e,F(he),F(ie),D(ie,e)):F(he),D(he,n)}var We=null,fl=!1,Hl=!1;function ca(e){We===null?We=[e]:We.push(e)}function vd(e){fl=!0,ca(e)}function gt(){if(!Hl&&We!==null){Hl=!0;var e=0,t=O;try{var n=We;for(O=1;e<n.length;e++){var r=n[e];do r=r(!0);while(r!==null)}We=null,fl=!1}catch(l){throw We!==null&&(We=We.slice(e+1)),js(no,gt),l}finally{O=t,Hl=!1}}return null}var Vt=[],Wt=0,Qr=null,Gr=0,_e=[],Ce=0,zt=null,Qe=1,Ge="";function kt(e,t){Vt[Wt++]=Gr,Vt[Wt++]=Qr,Qr=e,Gr=t}function da(e,t,n){_e[Ce++]=Qe,_e[Ce++]=Ge,_e[Ce++]=zt,zt=e;var r=Qe;e=Ge;var l=32-Oe(r)-1;r&=~(1<<l),n+=1;var i=32-Oe(t)+l;if(30<i){var o=l-l%5;i=(r&(1<<o)-1).toString(32),r>>=o,l-=o,Qe=1<<32-Oe(t)+l|n<<l|r,Ge=i+e}else Qe=1<<i|n<<l|r,Ge=e}function co(e){e.return!==null&&(kt(e,1),da(e,1,0))}function po(e){for(;e===Qr;)Qr=Vt[--Wt],Vt[Wt]=null,Gr=Vt[--Wt],Vt[Wt]=null;for(;e===zt;)zt=_e[--Ce],_e[Ce]=null,Ge=_e[--Ce],_e[Ce]=null,Qe=_e[--Ce],_e[Ce]=null}var we=null,ge=null,A=!1,Me=null;function pa(e,t){var n=Pe(5,null,null,0);n.elementType="DELETED",n.stateNode=t,n.return=e,t=e.deletions,t===null?(e.deletions=[n],e.flags|=16):t.push(n)}function Cu(e,t){switch(e.tag){case 5:var n=e.type;return t=t.nodeType!==1||n.toLowerCase()!==t.nodeName.toLowerCase()?null:t,t!==null?(e.stateNode=t,we=e,ge=at(t.firstChild),!0):!1;case 6:return t=e.pendingProps===""||t.nodeType!==3?null:t,t!==null?(e.stateNode=t,we=e,ge=null,!0):!1;case 13:return t=t.nodeType!==8?null:t,t!==null?(n=zt!==null?{id:Qe,overflow:Ge}:null,e.memoizedState={dehydrated:t,treeContext:n,retryLane:1073741824},n=Pe(18,null,null,0),n.stateNode=t,n.return=e,e.child=n,we=e,ge=null,!0):!1;default:return!1}}function Ci(e){return(e.mode&1)!==0&&(e.flags&128)===0}function Pi(e){if(A){var t=ge;if(t){var n=t;if(!Cu(e,t)){if(Ci(e))throw Error(g(418));t=at(n.nextSibling);var r=we;t&&Cu(e,t)?pa(r,n):(e.flags=e.flags&-4097|2,A=!1,we=e)}}else{if(Ci(e))throw Error(g(418));e.flags=e.flags&-4097|2,A=!1,we=e}}}function Pu(e){for(e=e.return;e!==null&&e.tag!==5&&e.tag!==3&&e.tag!==13;)e=e.return;we=e}function mr(e){if(e!==we)return!1;if(!A)return Pu(e),A=!0,!1;var t;if((t=e.tag!==3)&&!(t=e.tag!==5)&&(t=e.type,t=t!=="head"&&t!=="body"&&!Si(e.type,e.memoizedProps)),t&&(t=ge)){if(Ci(e))throw ha(),Error(g(418));for(;t;)pa(e,t),t=at(t.nextSibling)}if(Pu(e),e.tag===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(g(317));e:{for(e=e.nextSibling,t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"){if(t===0){ge=at(e.nextSibling);break e}t--}else n!=="$"&&n!=="$!"&&n!=="$?"||t++}e=e.nextSibling}ge=null}}else ge=we?at(e.stateNode.nextSibling):null;return!0}function ha(){for(var e=ge;e;)e=at(e.nextSibling)}function nn(){ge=we=null,A=!1}function ho(e){Me===null?Me=[e]:Me.push(e)}var yd=qe.ReactCurrentBatchConfig;function gn(e,t,n){if(e=n.ref,e!==null&&typeof e!="function"&&typeof e!="object"){if(n._owner){if(n=n._owner,n){if(n.tag!==1)throw Error(g(309));var r=n.stateNode}if(!r)throw Error(g(147,e));var l=r,i=""+e;return t!==null&&t.ref!==null&&typeof t.ref=="function"&&t.ref._stringRef===i?t.ref:(t=function(o){var u=l.refs;o===null?delete u[i]:u[i]=o},t._stringRef=i,t)}if(typeof e!="string")throw Error(g(284));if(!n._owner)throw Error(g(290,e))}return e}function vr(e,t){throw e=Object.prototype.toString.call(t),Error(g(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e))}function Nu(e){var t=e._init;return t(e._payload)}function ma(e){function t(c,a){if(e){var d=c.deletions;d===null?(c.deletions=[a],c.flags|=16):d.push(a)}}function n(c,a){if(!e)return null;for(;a!==null;)t(c,a),a=a.sibling;return null}function r(c,a){for(c=new Map;a!==null;)a.key!==null?c.set(a.key,a):c.set(a.index,a),a=a.sibling;return c}function l(c,a){return c=pt(c,a),c.index=0,c.sibling=null,c}function i(c,a,d){return c.index=d,e?(d=c.alternate,d!==null?(d=d.index,d<a?(c.flags|=2,a):d):(c.flags|=2,a)):(c.flags|=1048576,a)}function o(c){return e&&c.alternate===null&&(c.flags|=2),c}function u(c,a,d,y){return a===null||a.tag!==6?(a=Yl(d,c.mode,y),a.return=c,a):(a=l(a,d),a.return=c,a)}function s(c,a,d,y){var E=d.type;return E===Ft?m(c,a,d.props.children,y,d.key):a!==null&&(a.elementType===E||typeof E=="object"&&E!==null&&E.$$typeof===et&&Nu(E)===a.type)?(y=l(a,d.props),y.ref=gn(c,a,d),y.return=c,y):(y=Mr(d.type,d.key,d.props,null,c.mode,y),y.ref=gn(c,a,d),y.return=c,y)}function f(c,a,d,y){return a===null||a.tag!==4||a.stateNode.containerInfo!==d.containerInfo||a.stateNode.implementation!==d.implementation?(a=Kl(d,c.mode,y),a.return=c,a):(a=l(a,d.children||[]),a.return=c,a)}function m(c,a,d,y,E){return a===null||a.tag!==7?(a=Tt(d,c.mode,y,E),a.return=c,a):(a=l(a,d),a.return=c,a)}function h(c,a,d){if(typeof a=="string"&&a!==""||typeof a=="number")return a=Yl(""+a,c.mode,d),a.return=c,a;if(typeof a=="object"&&a!==null){switch(a.$$typeof){case ir:return d=Mr(a.type,a.key,a.props,null,c.mode,d),d.ref=gn(c,null,a),d.return=c,d;case jt:return a=Kl(a,c.mode,d),a.return=c,a;case et:var y=a._init;return h(c,y(a._payload),d)}if(En(a)||pn(a))return a=Tt(a,c.mode,d,null),a.return=c,a;vr(c,a)}return null}function p(c,a,d,y){var E=a!==null?a.key:null;if(typeof d=="string"&&d!==""||typeof d=="number")return E!==null?null:u(c,a,""+d,y);if(typeof d=="object"&&d!==null){switch(d.$$typeof){case ir:return d.key===E?s(c,a,d,y):null;case jt:return d.key===E?f(c,a,d,y):null;case et:return E=d._init,p(c,a,E(d._payload),y)}if(En(d)||pn(d))return E!==null?null:m(c,a,d,y,null);vr(c,d)}return null}function w(c,a,d,y,E){if(typeof y=="string"&&y!==""||typeof y=="number")return c=c.get(d)||null,u(a,c,""+y,E);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case ir:return c=c.get(y.key===null?d:y.key)||null,s(a,c,y,E);case jt:return c=c.get(y.key===null?d:y.key)||null,f(a,c,y,E);case et:var C=y._init;return w(c,a,d,C(y._payload),E)}if(En(y)||pn(y))return c=c.get(d)||null,m(a,c,y,E,null);vr(a,y)}return null}function S(c,a,d,y){for(var E=null,C=null,P=a,N=a=0,V=null;P!==null&&N<d.length;N++){P.index>N?(V=P,P=null):V=P.sibling;var I=p(c,P,d[N],y);if(I===null){P===null&&(P=V);break}e&&P&&I.alternate===null&&t(c,P),a=i(I,a,N),C===null?E=I:C.sibling=I,C=I,P=V}if(N===d.length)return n(c,P),A&&kt(c,N),E;if(P===null){for(;N<d.length;N++)P=h(c,d[N],y),P!==null&&(a=i(P,a,N),C===null?E=P:C.sibling=P,C=P);return A&&kt(c,N),E}for(P=r(c,P);N<d.length;N++)V=w(P,c,N,d[N],y),V!==null&&(e&&V.alternate!==null&&P.delete(V.key===null?N:V.key),a=i(V,a,N),C===null?E=V:C.sibling=V,C=V);return e&&P.forEach(function(ze){return t(c,ze)}),A&&kt(c,N),E}function v(c,a,d,y){var E=pn(d);if(typeof E!="function")throw Error(g(150));if(d=E.call(d),d==null)throw Error(g(151));for(var C=E=null,P=a,N=a=0,V=null,I=d.next();P!==null&&!I.done;N++,I=d.next()){P.index>N?(V=P,P=null):V=P.sibling;var ze=p(c,P,I.value,y);if(ze===null){P===null&&(P=V);break}e&&P&&ze.alternate===null&&t(c,P),a=i(ze,a,N),C===null?E=ze:C.sibling=ze,C=ze,P=V}if(I.done)return n(c,P),A&&kt(c,N),E;if(P===null){for(;!I.done;N++,I=d.next())I=h(c,I.value,y),I!==null&&(a=i(I,a,N),C===null?E=I:C.sibling=I,C=I);return A&&kt(c,N),E}for(P=r(c,P);!I.done;N++,I=d.next())I=w(P,c,N,I.value,y),I!==null&&(e&&I.alternate!==null&&P.delete(I.key===null?N:I.key),a=i(I,a,N),C===null?E=I:C.sibling=I,C=I);return e&&P.forEach(function(cn){return t(c,cn)}),A&&kt(c,N),E}function L(c,a,d,y){if(typeof d=="object"&&d!==null&&d.type===Ft&&d.key===null&&(d=d.props.children),typeof d=="object"&&d!==null){switch(d.$$typeof){case ir:e:{for(var E=d.key,C=a;C!==null;){if(C.key===E){if(E=d.type,E===Ft){if(C.tag===7){n(c,C.sibling),a=l(C,d.props.children),a.return=c,c=a;break e}}else if(C.elementType===E||typeof E=="object"&&E!==null&&E.$$typeof===et&&Nu(E)===C.type){n(c,C.sibling),a=l(C,d.props),a.ref=gn(c,C,d),a.return=c,c=a;break e}n(c,C);break}else t(c,C);C=C.sibling}d.type===Ft?(a=Tt(d.props.children,c.mode,y,d.key),a.return=c,c=a):(y=Mr(d.type,d.key,d.props,null,c.mode,y),y.ref=gn(c,a,d),y.return=c,c=y)}return o(c);case jt:e:{for(C=d.key;a!==null;){if(a.key===C)if(a.tag===4&&a.stateNode.containerInfo===d.containerInfo&&a.stateNode.implementation===d.implementation){n(c,a.sibling),a=l(a,d.children||[]),a.return=c,c=a;break e}else{n(c,a);break}else t(c,a);a=a.sibling}a=Kl(d,c.mode,y),a.return=c,c=a}return o(c);case et:return C=d._init,L(c,a,C(d._payload),y)}if(En(d))return S(c,a,d,y);if(pn(d))return v(c,a,d,y);vr(c,d)}return typeof d=="string"&&d!==""||typeof d=="number"?(d=""+d,a!==null&&a.tag===6?(n(c,a.sibling),a=l(a,d),a.return=c,c=a):(n(c,a),a=Yl(d,c.mode,y),a.return=c,c=a),o(c)):n(c,a)}return L}var rn=ma(!0),va=ma(!1),Yr=yt(null),Kr=null,Qt=null,mo=null;function vo(){mo=Qt=Kr=null}function yo(e){var t=Yr.current;F(Yr),e._currentValue=t}function Ni(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,r!==null&&(r.childLanes|=t)):r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t),e===n)break;e=e.return}}function qt(e,t){Kr=e,mo=Qt=null,e=e.dependencies,e!==null&&e.firstContext!==null&&(e.lanes&t&&(pe=!0),e.firstContext=null)}function Te(e){var t=e._currentValue;if(mo!==e)if(e={context:e,memoizedValue:t,next:null},Qt===null){if(Kr===null)throw Error(g(308));Qt=e,Kr.dependencies={lanes:0,firstContext:e}}else Qt=Qt.next=e;return t}var Ct=null;function go(e){Ct===null?Ct=[e]:Ct.push(e)}function ya(e,t,n,r){var l=t.interleaved;return l===null?(n.next=n,go(t)):(n.next=l.next,l.next=n),t.interleaved=n,Ze(e,r)}function Ze(e,t){e.lanes|=t;var n=e.alternate;for(n!==null&&(n.lanes|=t),n=e,e=e.return;e!==null;)e.childLanes|=t,n=e.alternate,n!==null&&(n.childLanes|=t),n=e,e=e.return;return n.tag===3?n.stateNode:null}var tt=!1;function wo(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function ga(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function Ye(e,t){return{eventTime:e,lane:t,tag:0,payload:null,callback:null,next:null}}function ft(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,M&2){var l=r.pending;return l===null?t.next=t:(t.next=l.next,l.next=t),r.pending=t,Ze(e,n)}return l=r.interleaved,l===null?(t.next=t,go(r)):(t.next=l.next,l.next=t),r.interleaved=t,Ze(e,n)}function Tr(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194240)!==0)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,ro(e,n)}}function Tu(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var l=null,i=null;if(n=n.firstBaseUpdate,n!==null){do{var o={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};i===null?l=i=o:i=i.next=o,n=n.next}while(n!==null);i===null?l=i=t:i=i.next=t}else l=i=t;n={baseState:r.baseState,firstBaseUpdate:l,lastBaseUpdate:i,shared:r.shared,effects:r.effects},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}function Xr(e,t,n,r){var l=e.updateQueue;tt=!1;var i=l.firstBaseUpdate,o=l.lastBaseUpdate,u=l.shared.pending;if(u!==null){l.shared.pending=null;var s=u,f=s.next;s.next=null,o===null?i=f:o.next=f,o=s;var m=e.alternate;m!==null&&(m=m.updateQueue,u=m.lastBaseUpdate,u!==o&&(u===null?m.firstBaseUpdate=f:u.next=f,m.lastBaseUpdate=s))}if(i!==null){var h=l.baseState;o=0,m=f=s=null,u=i;do{var p=u.lane,w=u.eventTime;if((r&p)===p){m!==null&&(m=m.next={eventTime:w,lane:0,tag:u.tag,payload:u.payload,callback:u.callback,next:null});e:{var S=e,v=u;switch(p=t,w=n,v.tag){case 1:if(S=v.payload,typeof S=="function"){h=S.call(w,h,p);break e}h=S;break e;case 3:S.flags=S.flags&-65537|128;case 0:if(S=v.payload,p=typeof S=="function"?S.call(w,h,p):S,p==null)break e;h=B({},h,p);break e;case 2:tt=!0}}u.callback!==null&&u.lane!==0&&(e.flags|=64,p=l.effects,p===null?l.effects=[u]:p.push(u))}else w={eventTime:w,lane:p,tag:u.tag,payload:u.payload,callback:u.callback,next:null},m===null?(f=m=w,s=h):m=m.next=w,o|=p;if(u=u.next,u===null){if(u=l.shared.pending,u===null)break;p=u,u=p.next,p.next=null,l.lastBaseUpdate=p,l.shared.pending=null}}while(!0);if(m===null&&(s=h),l.baseState=s,l.firstBaseUpdate=f,l.lastBaseUpdate=m,t=l.shared.interleaved,t!==null){l=t;do o|=l.lane,l=l.next;while(l!==t)}else i===null&&(l.shared.lanes=0);xt|=o,e.lanes=o,e.memoizedState=h}}function Lu(e,t,n){if(e=t.effects,t.effects=null,e!==null)for(t=0;t<e.length;t++){var r=e[t],l=r.callback;if(l!==null){if(r.callback=null,r=n,typeof l!="function")throw Error(g(191,l));l.call(r)}}}var tr={},$e=yt(tr),Qn=yt(tr),Gn=yt(tr);function Pt(e){if(e===tr)throw Error(g(174));return e}function So(e,t){switch(D(Gn,t),D(Qn,e),D($e,tr),e=t.nodeType,e){case 9:case 11:t=(t=t.documentElement)?t.namespaceURI:oi(null,"");break;default:e=e===8?t.parentNode:t,t=e.namespaceURI||null,e=e.tagName,t=oi(t,e)}F($e),D($e,t)}function ln(){F($e),F(Qn),F(Gn)}function wa(e){Pt(Gn.current);var t=Pt($e.current),n=oi(t,e.type);t!==n&&(D(Qn,e),D($e,n))}function ko(e){Qn.current===e&&(F($e),F(Qn))}var U=yt(0);function Zr(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||n.data==="$?"||n.data==="$!"))return t}else if(t.tag===19&&t.memoizedProps.revealOrder!==void 0){if(t.flags&128)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Bl=[];function Eo(){for(var e=0;e<Bl.length;e++)Bl[e]._workInProgressVersionPrimary=null;Bl.length=0}var Lr=qe.ReactCurrentDispatcher,$l=qe.ReactCurrentBatchConfig,Rt=0,H=null,Y=null,J=null,Jr=!1,Rn=!1,Yn=0,gd=0;function ne(){throw Error(g(321))}function _o(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Fe(e[n],t[n]))return!1;return!0}function Co(e,t,n,r,l,i){if(Rt=i,H=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Lr.current=e===null||e.memoizedState===null?Ed:_d,e=n(r,l),Rn){i=0;do{if(Rn=!1,Yn=0,25<=i)throw Error(g(301));i+=1,J=Y=null,t.updateQueue=null,Lr.current=Cd,e=n(r,l)}while(Rn)}if(Lr.current=qr,t=Y!==null&&Y.next!==null,Rt=0,J=Y=H=null,Jr=!1,t)throw Error(g(300));return e}function Po(){var e=Yn!==0;return Yn=0,e}function Ue(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return J===null?H.memoizedState=J=e:J=J.next=e,J}function Le(){if(Y===null){var e=H.alternate;e=e!==null?e.memoizedState:null}else e=Y.next;var t=J===null?H.memoizedState:J.next;if(t!==null)J=t,Y=e;else{if(e===null)throw Error(g(310));Y=e,e={memoizedState:Y.memoizedState,baseState:Y.baseState,baseQueue:Y.baseQueue,queue:Y.queue,next:null},J===null?H.memoizedState=J=e:J=J.next=e}return J}function Kn(e,t){return typeof t=="function"?t(e):t}function Vl(e){var t=Le(),n=t.queue;if(n===null)throw Error(g(311));n.lastRenderedReducer=e;var r=Y,l=r.baseQueue,i=n.pending;if(i!==null){if(l!==null){var o=l.next;l.next=i.next,i.next=o}r.baseQueue=l=i,n.pending=null}if(l!==null){i=l.next,r=r.baseState;var u=o=null,s=null,f=i;do{var m=f.lane;if((Rt&m)===m)s!==null&&(s=s.next={lane:0,action:f.action,hasEagerState:f.hasEagerState,eagerState:f.eagerState,next:null}),r=f.hasEagerState?f.eagerState:e(r,f.action);else{var h={lane:m,action:f.action,hasEagerState:f.hasEagerState,eagerState:f.eagerState,next:null};s===null?(u=s=h,o=r):s=s.next=h,H.lanes|=m,xt|=m}f=f.next}while(f!==null&&f!==i);s===null?o=r:s.next=u,Fe(r,t.memoizedState)||(pe=!0),t.memoizedState=r,t.baseState=o,t.baseQueue=s,n.lastRenderedState=r}if(e=n.interleaved,e!==null){l=e;do i=l.lane,H.lanes|=i,xt|=i,l=l.next;while(l!==e)}else l===null&&(n.lanes=0);return[t.memoizedState,n.dispatch]}function Wl(e){var t=Le(),n=t.queue;if(n===null)throw Error(g(311));n.lastRenderedReducer=e;var r=n.dispatch,l=n.pending,i=t.memoizedState;if(l!==null){n.pending=null;var o=l=l.next;do i=e(i,o.action),o=o.next;while(o!==l);Fe(i,t.memoizedState)||(pe=!0),t.memoizedState=i,t.baseQueue===null&&(t.baseState=i),n.lastRenderedState=i}return[i,r]}function Sa(){}function ka(e,t){var n=H,r=Le(),l=t(),i=!Fe(r.memoizedState,l);if(i&&(r.memoizedState=l,pe=!0),r=r.queue,No(Ca.bind(null,n,r,e),[e]),r.getSnapshot!==t||i||J!==null&&J.memoizedState.tag&1){if(n.flags|=2048,Xn(9,_a.bind(null,n,r,l,t),void 0,null),q===null)throw Error(g(349));Rt&30||Ea(n,t,l)}return l}function Ea(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=H.updateQueue,t===null?(t={lastEffect:null,stores:null},H.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function _a(e,t,n,r){t.value=n,t.getSnapshot=r,Pa(t)&&Na(e)}function Ca(e,t,n){return n(function(){Pa(t)&&Na(e)})}function Pa(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Fe(e,n)}catch{return!0}}function Na(e){var t=Ze(e,1);t!==null&&De(t,e,1,-1)}function zu(e){var t=Ue();return typeof e=="function"&&(e=e()),t.memoizedState=t.baseState=e,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Kn,lastRenderedState:e},t.queue=e,e=e.dispatch=kd.bind(null,H,e),[t.memoizedState,e]}function Xn(e,t,n,r){return e={tag:e,create:t,destroy:n,deps:r,next:null},t=H.updateQueue,t===null?(t={lastEffect:null,stores:null},H.updateQueue=t,t.lastEffect=e.next=e):(n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e)),e}function Ta(){return Le().memoizedState}function zr(e,t,n,r){var l=Ue();H.flags|=e,l.memoizedState=Xn(1|t,n,void 0,r===void 0?null:r)}function cl(e,t,n,r){var l=Le();r=r===void 0?null:r;var i=void 0;if(Y!==null){var o=Y.memoizedState;if(i=o.destroy,r!==null&&_o(r,o.deps)){l.memoizedState=Xn(t,n,i,r);return}}H.flags|=e,l.memoizedState=Xn(1|t,n,i,r)}function Ru(e,t){return zr(8390656,8,e,t)}function No(e,t){return cl(2048,8,e,t)}function La(e,t){return cl(4,2,e,t)}function za(e,t){return cl(4,4,e,t)}function Ra(e,t){if(typeof t=="function")return e=e(),t(e),function(){t(null)};if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function xa(e,t,n){return n=n!=null?n.concat([e]):null,cl(4,4,Ra.bind(null,t,e),n)}function To(){}function Ia(e,t){var n=Le();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&_o(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function Ma(e,t){var n=Le();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&_o(t,r[1])?r[0]:(e=e(),n.memoizedState=[e,t],e)}function Oa(e,t,n){return Rt&21?(Fe(n,t)||(n=Us(),H.lanes|=n,xt|=n,e.baseState=!0),t):(e.baseState&&(e.baseState=!1,pe=!0),e.memoizedState=n)}function wd(e,t){var n=O;O=n!==0&&4>n?n:4,e(!0);var r=$l.transition;$l.transition={};try{e(!1),t()}finally{O=n,$l.transition=r}}function Da(){return Le().memoizedState}function Sd(e,t,n){var r=dt(e);if(n={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null},ja(e))Fa(t,n);else if(n=ya(e,t,n,r),n!==null){var l=ue();De(n,e,r,l),Aa(n,t,r)}}function kd(e,t,n){var r=dt(e),l={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null};if(ja(e))Fa(t,l);else{var i=e.alternate;if(e.lanes===0&&(i===null||i.lanes===0)&&(i=t.lastRenderedReducer,i!==null))try{var o=t.lastRenderedState,u=i(o,n);if(l.hasEagerState=!0,l.eagerState=u,Fe(u,o)){var s=t.interleaved;s===null?(l.next=l,go(t)):(l.next=s.next,s.next=l),t.interleaved=l;return}}catch{}finally{}n=ya(e,t,l,r),n!==null&&(l=ue(),De(n,e,r,l),Aa(n,t,r))}}function ja(e){var t=e.alternate;return e===H||t!==null&&t===H}function Fa(e,t){Rn=Jr=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function Aa(e,t,n){if(n&4194240){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,ro(e,n)}}var qr={readContext:Te,useCallback:ne,useContext:ne,useEffect:ne,useImperativeHandle:ne,useInsertionEffect:ne,useLayoutEffect:ne,useMemo:ne,useReducer:ne,useRef:ne,useState:ne,useDebugValue:ne,useDeferredValue:ne,useTransition:ne,useMutableSource:ne,useSyncExternalStore:ne,useId:ne,unstable_isNewReconciler:!1},Ed={readContext:Te,useCallback:function(e,t){return Ue().memoizedState=[e,t===void 0?null:t],e},useContext:Te,useEffect:Ru,useImperativeHandle:function(e,t,n){return n=n!=null?n.concat([e]):null,zr(4194308,4,Ra.bind(null,t,e),n)},useLayoutEffect:function(e,t){return zr(4194308,4,e,t)},useInsertionEffect:function(e,t){return zr(4,2,e,t)},useMemo:function(e,t){var n=Ue();return t=t===void 0?null:t,e=e(),n.memoizedState=[e,t],e},useReducer:function(e,t,n){var r=Ue();return t=n!==void 0?n(t):t,r.memoizedState=r.baseState=t,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:t},r.queue=e,e=e.dispatch=Sd.bind(null,H,e),[r.memoizedState,e]},useRef:function(e){var t=Ue();return e={current:e},t.memoizedState=e},useState:zu,useDebugValue:To,useDeferredValue:function(e){return Ue().memoizedState=e},useTransition:function(){var e=zu(!1),t=e[0];return e=wd.bind(null,e[1]),Ue().memoizedState=e,[t,e]},useMutableSource:function(){},useSyncExternalStore:function(e,t,n){var r=H,l=Ue();if(A){if(n===void 0)throw Error(g(407));n=n()}else{if(n=t(),q===null)throw Error(g(349));Rt&30||Ea(r,t,n)}l.memoizedState=n;var i={value:n,getSnapshot:t};return l.queue=i,Ru(Ca.bind(null,r,i,e),[e]),r.flags|=2048,Xn(9,_a.bind(null,r,i,n,t),void 0,null),n},useId:function(){var e=Ue(),t=q.identifierPrefix;if(A){var n=Ge,r=Qe;n=(r&~(1<<32-Oe(r)-1)).toString(32)+n,t=":"+t+"R"+n,n=Yn++,0<n&&(t+="H"+n.toString(32)),t+=":"}else n=gd++,t=":"+t+"r"+n.toString(32)+":";return e.memoizedState=t},unstable_isNewReconciler:!1},_d={readContext:Te,useCallback:Ia,useContext:Te,useEffect:No,useImperativeHandle:xa,useInsertionEffect:La,useLayoutEffect:za,useMemo:Ma,useReducer:Vl,useRef:Ta,useState:function(){return Vl(Kn)},useDebugValue:To,useDeferredValue:function(e){var t=Le();return Oa(t,Y.memoizedState,e)},useTransition:function(){var e=Vl(Kn)[0],t=Le().memoizedState;return[e,t]},useMutableSource:Sa,useSyncExternalStore:ka,useId:Da,unstable_isNewReconciler:!1},Cd={readContext:Te,useCallback:Ia,useContext:Te,useEffect:No,useImperativeHandle:xa,useInsertionEffect:La,useLayoutEffect:za,useMemo:Ma,useReducer:Wl,useRef:Ta,useState:function(){return Wl(Kn)},useDebugValue:To,useDeferredValue:function(e){var t=Le();return Y===null?t.memoizedState=e:Oa(t,Y.memoizedState,e)},useTransition:function(){var e=Wl(Kn)[0],t=Le().memoizedState;return[e,t]},useMutableSource:Sa,useSyncExternalStore:ka,useId:Da,unstable_isNewReconciler:!1};function xe(e,t){if(e&&e.defaultProps){t=B({},t),e=e.defaultProps;for(var n in e)t[n]===void 0&&(t[n]=e[n]);return t}return t}function Ti(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:B({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var dl={isMounted:function(e){return(e=e._reactInternals)?Ot(e)===e:!1},enqueueSetState:function(e,t,n){e=e._reactInternals;var r=ue(),l=dt(e),i=Ye(r,l);i.payload=t,n!=null&&(i.callback=n),t=ft(e,i,l),t!==null&&(De(t,e,l,r),Tr(t,e,l))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=ue(),l=dt(e),i=Ye(r,l);i.tag=1,i.payload=t,n!=null&&(i.callback=n),t=ft(e,i,l),t!==null&&(De(t,e,l,r),Tr(t,e,l))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=ue(),r=dt(e),l=Ye(n,r);l.tag=2,t!=null&&(l.callback=t),t=ft(e,l,r),t!==null&&(De(t,e,r,n),Tr(t,e,r))}};function xu(e,t,n,r,l,i,o){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(r,i,o):t.prototype&&t.prototype.isPureReactComponent?!Bn(n,r)||!Bn(l,i):!0}function Ua(e,t,n){var r=!1,l=mt,i=t.contextType;return typeof i=="object"&&i!==null?i=Te(i):(l=me(t)?Lt:ie.current,r=t.contextTypes,i=(r=r!=null)?tn(e,l):mt),t=new t(n,i),e.memoizedState=t.state!==null&&t.state!==void 0?t.state:null,t.updater=dl,e.stateNode=t,t._reactInternals=e,r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=l,e.__reactInternalMemoizedMaskedChildContext=i),t}function Iu(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&dl.enqueueReplaceState(t,t.state,null)}function Li(e,t,n,r){var l=e.stateNode;l.props=n,l.state=e.memoizedState,l.refs={},wo(e);var i=t.contextType;typeof i=="object"&&i!==null?l.context=Te(i):(i=me(t)?Lt:ie.current,l.context=tn(e,i)),l.state=e.memoizedState,i=t.getDerivedStateFromProps,typeof i=="function"&&(Ti(e,t,i,n),l.state=e.memoizedState),typeof t.getDerivedStateFromProps=="function"||typeof l.getSnapshotBeforeUpdate=="function"||typeof l.UNSAFE_componentWillMount!="function"&&typeof l.componentWillMount!="function"||(t=l.state,typeof l.componentWillMount=="function"&&l.componentWillMount(),typeof l.UNSAFE_componentWillMount=="function"&&l.UNSAFE_componentWillMount(),t!==l.state&&dl.enqueueReplaceState(l,l.state,null),Xr(e,n,l,r),l.state=e.memoizedState),typeof l.componentDidMount=="function"&&(e.flags|=4194308)}function on(e,t){try{var n="",r=t;do n+=qf(r),r=r.return;while(r);var l=n}catch(i){l=`
+Error generating stack: `+i.message+`
+`+i.stack}return{value:e,source:t,stack:l,digest:null}}function Ql(e,t,n){return{value:e,source:null,stack:n??null,digest:t??null}}function zi(e,t){try{console.error(t.value)}catch(n){setTimeout(function(){throw n})}}var Pd=typeof WeakMap=="function"?WeakMap:Map;function Ha(e,t,n){n=Ye(-1,n),n.tag=3,n.payload={element:null};var r=t.value;return n.callback=function(){el||(el=!0,Ui=r),zi(e,t)},n}function Ba(e,t,n){n=Ye(-1,n),n.tag=3;var r=e.type.getDerivedStateFromError;if(typeof r=="function"){var l=t.value;n.payload=function(){return r(l)},n.callback=function(){zi(e,t)}}var i=e.stateNode;return i!==null&&typeof i.componentDidCatch=="function"&&(n.callback=function(){zi(e,t),typeof r!="function"&&(ct===null?ct=new Set([this]):ct.add(this));var o=t.stack;this.componentDidCatch(t.value,{componentStack:o!==null?o:""})}),n}function Mu(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new Pd;var l=new Set;r.set(t,l)}else l=r.get(t),l===void 0&&(l=new Set,r.set(t,l));l.has(n)||(l.add(n),e=Ud.bind(null,e,t,n),t.then(e,e))}function Ou(e){do{var t;if((t=e.tag===13)&&(t=e.memoizedState,t=t!==null?t.dehydrated!==null:!0),t)return e;e=e.return}while(e!==null);return null}function Du(e,t,n,r,l){return e.mode&1?(e.flags|=65536,e.lanes=l,e):(e===t?e.flags|=65536:(e.flags|=128,n.flags|=131072,n.flags&=-52805,n.tag===1&&(n.alternate===null?n.tag=17:(t=Ye(-1,1),t.tag=2,ft(n,t,1))),n.lanes|=1),e)}var Nd=qe.ReactCurrentOwner,pe=!1;function oe(e,t,n,r){t.child=e===null?va(t,null,n,r):rn(t,e.child,n,r)}function ju(e,t,n,r,l){n=n.render;var i=t.ref;return qt(t,l),r=Co(e,t,n,r,i,l),n=Po(),e!==null&&!pe?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l,Je(e,t,l)):(A&&n&&co(t),t.flags|=1,oe(e,t,r,l),t.child)}function Fu(e,t,n,r,l){if(e===null){var i=n.type;return typeof i=="function"&&!Do(i)&&i.defaultProps===void 0&&n.compare===null&&n.defaultProps===void 0?(t.tag=15,t.type=i,$a(e,t,i,r,l)):(e=Mr(n.type,null,r,t,t.mode,l),e.ref=t.ref,e.return=t,t.child=e)}if(i=e.child,!(e.lanes&l)){var o=i.memoizedProps;if(n=n.compare,n=n!==null?n:Bn,n(o,r)&&e.ref===t.ref)return Je(e,t,l)}return t.flags|=1,e=pt(i,r),e.ref=t.ref,e.return=t,t.child=e}function $a(e,t,n,r,l){if(e!==null){var i=e.memoizedProps;if(Bn(i,r)&&e.ref===t.ref)if(pe=!1,t.pendingProps=r=i,(e.lanes&l)!==0)e.flags&131072&&(pe=!0);else return t.lanes=e.lanes,Je(e,t,l)}return Ri(e,t,n,r,l)}function Va(e,t,n){var r=t.pendingProps,l=r.children,i=e!==null?e.memoizedState:null;if(r.mode==="hidden")if(!(t.mode&1))t.memoizedState={baseLanes:0,cachePool:null,transitions:null},D(Yt,ye),ye|=n;else{if(!(n&1073741824))return e=i!==null?i.baseLanes|n:n,t.lanes=t.childLanes=1073741824,t.memoizedState={baseLanes:e,cachePool:null,transitions:null},t.updateQueue=null,D(Yt,ye),ye|=e,null;t.memoizedState={baseLanes:0,cachePool:null,transitions:null},r=i!==null?i.baseLanes:n,D(Yt,ye),ye|=r}else i!==null?(r=i.baseLanes|n,t.memoizedState=null):r=n,D(Yt,ye),ye|=r;return oe(e,t,l,n),t.child}function Wa(e,t){var n=t.ref;(e===null&&n!==null||e!==null&&e.ref!==n)&&(t.flags|=512,t.flags|=2097152)}function Ri(e,t,n,r,l){var i=me(n)?Lt:ie.current;return i=tn(t,i),qt(t,l),n=Co(e,t,n,r,i,l),r=Po(),e!==null&&!pe?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l,Je(e,t,l)):(A&&r&&co(t),t.flags|=1,oe(e,t,n,l),t.child)}function Au(e,t,n,r,l){if(me(n)){var i=!0;Wr(t)}else i=!1;if(qt(t,l),t.stateNode===null)Rr(e,t),Ua(t,n,r),Li(t,n,r,l),r=!0;else if(e===null){var o=t.stateNode,u=t.memoizedProps;o.props=u;var s=o.context,f=n.contextType;typeof f=="object"&&f!==null?f=Te(f):(f=me(n)?Lt:ie.current,f=tn(t,f));var m=n.getDerivedStateFromProps,h=typeof m=="function"||typeof o.getSnapshotBeforeUpdate=="function";h||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(u!==r||s!==f)&&Iu(t,o,r,f),tt=!1;var p=t.memoizedState;o.state=p,Xr(t,r,o,l),s=t.memoizedState,u!==r||p!==s||he.current||tt?(typeof m=="function"&&(Ti(t,n,m,r),s=t.memoizedState),(u=tt||xu(t,n,u,r,p,s,f))?(h||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount()),typeof o.componentDidMount=="function"&&(t.flags|=4194308)):(typeof o.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=s),o.props=r,o.state=s,o.context=f,r=u):(typeof o.componentDidMount=="function"&&(t.flags|=4194308),r=!1)}else{o=t.stateNode,ga(e,t),u=t.memoizedProps,f=t.type===t.elementType?u:xe(t.type,u),o.props=f,h=t.pendingProps,p=o.context,s=n.contextType,typeof s=="object"&&s!==null?s=Te(s):(s=me(n)?Lt:ie.current,s=tn(t,s));var w=n.getDerivedStateFromProps;(m=typeof w=="function"||typeof o.getSnapshotBeforeUpdate=="function")||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(u!==h||p!==s)&&Iu(t,o,r,s),tt=!1,p=t.memoizedState,o.state=p,Xr(t,r,o,l);var S=t.memoizedState;u!==h||p!==S||he.current||tt?(typeof w=="function"&&(Ti(t,n,w,r),S=t.memoizedState),(f=tt||xu(t,n,f,r,p,S,s)||!1)?(m||typeof o.UNSAFE_componentWillUpdate!="function"&&typeof o.componentWillUpdate!="function"||(typeof o.componentWillUpdate=="function"&&o.componentWillUpdate(r,S,s),typeof o.UNSAFE_componentWillUpdate=="function"&&o.UNSAFE_componentWillUpdate(r,S,s)),typeof o.componentDidUpdate=="function"&&(t.flags|=4),typeof o.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof o.componentDidUpdate!="function"||u===e.memoizedProps&&p===e.memoizedState||(t.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||u===e.memoizedProps&&p===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=S),o.props=r,o.state=S,o.context=s,r=f):(typeof o.componentDidUpdate!="function"||u===e.memoizedProps&&p===e.memoizedState||(t.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||u===e.memoizedProps&&p===e.memoizedState||(t.flags|=1024),r=!1)}return xi(e,t,n,r,i,l)}function xi(e,t,n,r,l,i){Wa(e,t);var o=(t.flags&128)!==0;if(!r&&!o)return l&&_u(t,n,!1),Je(e,t,i);r=t.stateNode,Nd.current=t;var u=o&&typeof n.getDerivedStateFromError!="function"?null:r.render();return t.flags|=1,e!==null&&o?(t.child=rn(t,e.child,null,i),t.child=rn(t,null,u,i)):oe(e,t,u,i),t.memoizedState=r.state,l&&_u(t,n,!0),t.child}function Qa(e){var t=e.stateNode;t.pendingContext?Eu(e,t.pendingContext,t.pendingContext!==t.context):t.context&&Eu(e,t.context,!1),So(e,t.containerInfo)}function Uu(e,t,n,r,l){return nn(),ho(l),t.flags|=256,oe(e,t,n,r),t.child}var Ii={dehydrated:null,treeContext:null,retryLane:0};function Mi(e){return{baseLanes:e,cachePool:null,transitions:null}}function Ga(e,t,n){var r=t.pendingProps,l=U.current,i=!1,o=(t.flags&128)!==0,u;if((u=o)||(u=e!==null&&e.memoizedState===null?!1:(l&2)!==0),u?(i=!0,t.flags&=-129):(e===null||e.memoizedState!==null)&&(l|=1),D(U,l&1),e===null)return Pi(t),e=t.memoizedState,e!==null&&(e=e.dehydrated,e!==null)?(t.mode&1?e.data==="$!"?t.lanes=8:t.lanes=1073741824:t.lanes=1,null):(o=r.children,e=r.fallback,i?(r=t.mode,i=t.child,o={mode:"hidden",children:o},!(r&1)&&i!==null?(i.childLanes=0,i.pendingProps=o):i=ml(o,r,0,null),e=Tt(e,r,n,null),i.return=t,e.return=t,i.sibling=e,t.child=i,t.child.memoizedState=Mi(n),t.memoizedState=Ii,e):Lo(t,o));if(l=e.memoizedState,l!==null&&(u=l.dehydrated,u!==null))return Td(e,t,o,r,u,l,n);if(i){i=r.fallback,o=t.mode,l=e.child,u=l.sibling;var s={mode:"hidden",children:r.children};return!(o&1)&&t.child!==l?(r=t.child,r.childLanes=0,r.pendingProps=s,t.deletions=null):(r=pt(l,s),r.subtreeFlags=l.subtreeFlags&14680064),u!==null?i=pt(u,i):(i=Tt(i,o,n,null),i.flags|=2),i.return=t,r.return=t,r.sibling=i,t.child=r,r=i,i=t.child,o=e.child.memoizedState,o=o===null?Mi(n):{baseLanes:o.baseLanes|n,cachePool:null,transitions:o.transitions},i.memoizedState=o,i.childLanes=e.childLanes&~n,t.memoizedState=Ii,r}return i=e.child,e=i.sibling,r=pt(i,{mode:"visible",children:r.children}),!(t.mode&1)&&(r.lanes=n),r.return=t,r.sibling=null,e!==null&&(n=t.deletions,n===null?(t.deletions=[e],t.flags|=16):n.push(e)),t.child=r,t.memoizedState=null,r}function Lo(e,t){return t=ml({mode:"visible",children:t},e.mode,0,null),t.return=e,e.child=t}function yr(e,t,n,r){return r!==null&&ho(r),rn(t,e.child,null,n),e=Lo(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function Td(e,t,n,r,l,i,o){if(n)return t.flags&256?(t.flags&=-257,r=Ql(Error(g(422))),yr(e,t,o,r)):t.memoizedState!==null?(t.child=e.child,t.flags|=128,null):(i=r.fallback,l=t.mode,r=ml({mode:"visible",children:r.children},l,0,null),i=Tt(i,l,o,null),i.flags|=2,r.return=t,i.return=t,r.sibling=i,t.child=r,t.mode&1&&rn(t,e.child,null,o),t.child.memoizedState=Mi(o),t.memoizedState=Ii,i);if(!(t.mode&1))return yr(e,t,o,null);if(l.data==="$!"){if(r=l.nextSibling&&l.nextSibling.dataset,r)var u=r.dgst;return r=u,i=Error(g(419)),r=Ql(i,r,void 0),yr(e,t,o,r)}if(u=(o&e.childLanes)!==0,pe||u){if(r=q,r!==null){switch(o&-o){case 4:l=2;break;case 16:l=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:l=32;break;case 536870912:l=268435456;break;default:l=0}l=l&(r.suspendedLanes|o)?0:l,l!==0&&l!==i.retryLane&&(i.retryLane=l,Ze(e,l),De(r,e,l,-1))}return Oo(),r=Ql(Error(g(421))),yr(e,t,o,r)}return l.data==="$?"?(t.flags|=128,t.child=e.child,t=Hd.bind(null,e),l._reactRetry=t,null):(e=i.treeContext,ge=at(l.nextSibling),we=t,A=!0,Me=null,e!==null&&(_e[Ce++]=Qe,_e[Ce++]=Ge,_e[Ce++]=zt,Qe=e.id,Ge=e.overflow,zt=t),t=Lo(t,r.children),t.flags|=4096,t)}function Hu(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),Ni(e.return,t,n)}function Gl(e,t,n,r,l){var i=e.memoizedState;i===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:l}:(i.isBackwards=t,i.rendering=null,i.renderingStartTime=0,i.last=r,i.tail=n,i.tailMode=l)}function Ya(e,t,n){var r=t.pendingProps,l=r.revealOrder,i=r.tail;if(oe(e,t,r.children,n),r=U.current,r&2)r=r&1|2,t.flags|=128;else{if(e!==null&&e.flags&128)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&Hu(e,n,t);else if(e.tag===19)Hu(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}r&=1}if(D(U,r),!(t.mode&1))t.memoizedState=null;else switch(l){case"forwards":for(n=t.child,l=null;n!==null;)e=n.alternate,e!==null&&Zr(e)===null&&(l=n),n=n.sibling;n=l,n===null?(l=t.child,t.child=null):(l=n.sibling,n.sibling=null),Gl(t,!1,l,n,i);break;case"backwards":for(n=null,l=t.child,t.child=null;l!==null;){if(e=l.alternate,e!==null&&Zr(e)===null){t.child=l;break}e=l.sibling,l.sibling=n,n=l,l=e}Gl(t,!0,n,null,i);break;case"together":Gl(t,!1,null,null,void 0);break;default:t.memoizedState=null}return t.child}function Rr(e,t){!(t.mode&1)&&e!==null&&(e.alternate=null,t.alternate=null,t.flags|=2)}function Je(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),xt|=t.lanes,!(n&t.childLanes))return null;if(e!==null&&t.child!==e.child)throw Error(g(153));if(t.child!==null){for(e=t.child,n=pt(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=pt(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Ld(e,t,n){switch(t.tag){case 3:Qa(t),nn();break;case 5:wa(t);break;case 1:me(t.type)&&Wr(t);break;case 4:So(t,t.stateNode.containerInfo);break;case 10:var r=t.type._context,l=t.memoizedProps.value;D(Yr,r._currentValue),r._currentValue=l;break;case 13:if(r=t.memoizedState,r!==null)return r.dehydrated!==null?(D(U,U.current&1),t.flags|=128,null):n&t.child.childLanes?Ga(e,t,n):(D(U,U.current&1),e=Je(e,t,n),e!==null?e.sibling:null);D(U,U.current&1);break;case 19:if(r=(n&t.childLanes)!==0,e.flags&128){if(r)return Ya(e,t,n);t.flags|=128}if(l=t.memoizedState,l!==null&&(l.rendering=null,l.tail=null,l.lastEffect=null),D(U,U.current),r)break;return null;case 22:case 23:return t.lanes=0,Va(e,t,n)}return Je(e,t,n)}var Ka,Oi,Xa,Za;Ka=function(e,t){for(var n=t.child;n!==null;){if(n.tag===5||n.tag===6)e.appendChild(n.stateNode);else if(n.tag!==4&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===t)break;for(;n.sibling===null;){if(n.return===null||n.return===t)return;n=n.return}n.sibling.return=n.return,n=n.sibling}};Oi=function(){};Xa=function(e,t,n,r){var l=e.memoizedProps;if(l!==r){e=t.stateNode,Pt($e.current);var i=null;switch(n){case"input":l=ni(e,l),r=ni(e,r),i=[];break;case"select":l=B({},l,{value:void 0}),r=B({},r,{value:void 0}),i=[];break;case"textarea":l=ii(e,l),r=ii(e,r),i=[];break;default:typeof l.onClick!="function"&&typeof r.onClick=="function"&&(e.onclick=$r)}ui(n,r);var o;n=null;for(f in l)if(!r.hasOwnProperty(f)&&l.hasOwnProperty(f)&&l[f]!=null)if(f==="style"){var u=l[f];for(o in u)u.hasOwnProperty(o)&&(n||(n={}),n[o]="")}else f!=="dangerouslySetInnerHTML"&&f!=="children"&&f!=="suppressContentEditableWarning"&&f!=="suppressHydrationWarning"&&f!=="autoFocus"&&(On.hasOwnProperty(f)?i||(i=[]):(i=i||[]).push(f,null));for(f in r){var s=r[f];if(u=l!=null?l[f]:void 0,r.hasOwnProperty(f)&&s!==u&&(s!=null||u!=null))if(f==="style")if(u){for(o in u)!u.hasOwnProperty(o)||s&&s.hasOwnProperty(o)||(n||(n={}),n[o]="");for(o in s)s.hasOwnProperty(o)&&u[o]!==s[o]&&(n||(n={}),n[o]=s[o])}else n||(i||(i=[]),i.push(f,n)),n=s;else f==="dangerouslySetInnerHTML"?(s=s?s.__html:void 0,u=u?u.__html:void 0,s!=null&&u!==s&&(i=i||[]).push(f,s)):f==="children"?typeof s!="string"&&typeof s!="number"||(i=i||[]).push(f,""+s):f!=="suppressContentEditableWarning"&&f!=="suppressHydrationWarning"&&(On.hasOwnProperty(f)?(s!=null&&f==="onScroll"&&j("scroll",e),i||u===s||(i=[])):(i=i||[]).push(f,s))}n&&(i=i||[]).push("style",n);var f=i;(t.updateQueue=f)&&(t.flags|=4)}};Za=function(e,t,n,r){n!==r&&(t.flags|=4)};function wn(e,t){if(!A)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null}}function re(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var l=e.child;l!==null;)n|=l.lanes|l.childLanes,r|=l.subtreeFlags&14680064,r|=l.flags&14680064,l.return=e,l=l.sibling;else for(l=e.child;l!==null;)n|=l.lanes|l.childLanes,r|=l.subtreeFlags,r|=l.flags,l.return=e,l=l.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function zd(e,t,n){var r=t.pendingProps;switch(po(t),t.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return re(t),null;case 1:return me(t.type)&&Vr(),re(t),null;case 3:return r=t.stateNode,ln(),F(he),F(ie),Eo(),r.pendingContext&&(r.context=r.pendingContext,r.pendingContext=null),(e===null||e.child===null)&&(mr(t)?t.flags|=4:e===null||e.memoizedState.isDehydrated&&!(t.flags&256)||(t.flags|=1024,Me!==null&&($i(Me),Me=null))),Oi(e,t),re(t),null;case 5:ko(t);var l=Pt(Gn.current);if(n=t.type,e!==null&&t.stateNode!=null)Xa(e,t,n,r,l),e.ref!==t.ref&&(t.flags|=512,t.flags|=2097152);else{if(!r){if(t.stateNode===null)throw Error(g(166));return re(t),null}if(e=Pt($e.current),mr(t)){r=t.stateNode,n=t.type;var i=t.memoizedProps;switch(r[He]=t,r[Wn]=i,e=(t.mode&1)!==0,n){case"dialog":j("cancel",r),j("close",r);break;case"iframe":case"object":case"embed":j("load",r);break;case"video":case"audio":for(l=0;l<Cn.length;l++)j(Cn[l],r);break;case"source":j("error",r);break;case"img":case"image":case"link":j("error",r),j("load",r);break;case"details":j("toggle",r);break;case"input":Xo(r,i),j("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!i.multiple},j("invalid",r);break;case"textarea":Jo(r,i),j("invalid",r)}ui(n,i),l=null;for(var o in i)if(i.hasOwnProperty(o)){var u=i[o];o==="children"?typeof u=="string"?r.textContent!==u&&(i.suppressHydrationWarning!==!0&&hr(r.textContent,u,e),l=["children",u]):typeof u=="number"&&r.textContent!==""+u&&(i.suppressHydrationWarning!==!0&&hr(r.textContent,u,e),l=["children",""+u]):On.hasOwnProperty(o)&&u!=null&&o==="onScroll"&&j("scroll",r)}switch(n){case"input":or(r),Zo(r,i,!0);break;case"textarea":or(r),qo(r);break;case"select":case"option":break;default:typeof i.onClick=="function"&&(r.onclick=$r)}r=l,t.updateQueue=r,r!==null&&(t.flags|=4)}else{o=l.nodeType===9?l:l.ownerDocument,e==="http://www.w3.org/1999/xhtml"&&(e=Cs(n)),e==="http://www.w3.org/1999/xhtml"?n==="script"?(e=o.createElement("div"),e.innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):typeof r.is=="string"?e=o.createElement(n,{is:r.is}):(e=o.createElement(n),n==="select"&&(o=e,r.multiple?o.multiple=!0:r.size&&(o.size=r.size))):e=o.createElementNS(e,n),e[He]=t,e[Wn]=r,Ka(e,t,!1,!1),t.stateNode=e;e:{switch(o=si(n,r),n){case"dialog":j("cancel",e),j("close",e),l=r;break;case"iframe":case"object":case"embed":j("load",e),l=r;break;case"video":case"audio":for(l=0;l<Cn.length;l++)j(Cn[l],e);l=r;break;case"source":j("error",e),l=r;break;case"img":case"image":case"link":j("error",e),j("load",e),l=r;break;case"details":j("toggle",e),l=r;break;case"input":Xo(e,r),l=ni(e,r),j("invalid",e);break;case"option":l=r;break;case"select":e._wrapperState={wasMultiple:!!r.multiple},l=B({},r,{value:void 0}),j("invalid",e);break;case"textarea":Jo(e,r),l=ii(e,r),j("invalid",e);break;default:l=r}ui(n,l),u=l;for(i in u)if(u.hasOwnProperty(i)){var s=u[i];i==="style"?Ts(e,s):i==="dangerouslySetInnerHTML"?(s=s?s.__html:void 0,s!=null&&Ps(e,s)):i==="children"?typeof s=="string"?(n!=="textarea"||s!=="")&&Dn(e,s):typeof s=="number"&&Dn(e,""+s):i!=="suppressContentEditableWarning"&&i!=="suppressHydrationWarning"&&i!=="autoFocus"&&(On.hasOwnProperty(i)?s!=null&&i==="onScroll"&&j("scroll",e):s!=null&&Ji(e,i,s,o))}switch(n){case"input":or(e),Zo(e,r,!1);break;case"textarea":or(e),qo(e);break;case"option":r.value!=null&&e.setAttribute("value",""+ht(r.value));break;case"select":e.multiple=!!r.multiple,i=r.value,i!=null?Kt(e,!!r.multiple,i,!1):r.defaultValue!=null&&Kt(e,!!r.multiple,r.defaultValue,!0);break;default:typeof l.onClick=="function"&&(e.onclick=$r)}switch(n){case"button":case"input":case"select":case"textarea":r=!!r.autoFocus;break e;case"img":r=!0;break e;default:r=!1}}r&&(t.flags|=4)}t.ref!==null&&(t.flags|=512,t.flags|=2097152)}return re(t),null;case 6:if(e&&t.stateNode!=null)Za(e,t,e.memoizedProps,r);else{if(typeof r!="string"&&t.stateNode===null)throw Error(g(166));if(n=Pt(Gn.current),Pt($e.current),mr(t)){if(r=t.stateNode,n=t.memoizedProps,r[He]=t,(i=r.nodeValue!==n)&&(e=we,e!==null))switch(e.tag){case 3:hr(r.nodeValue,n,(e.mode&1)!==0);break;case 5:e.memoizedProps.suppressHydrationWarning!==!0&&hr(r.nodeValue,n,(e.mode&1)!==0)}i&&(t.flags|=4)}else r=(n.nodeType===9?n:n.ownerDocument).createTextNode(r),r[He]=t,t.stateNode=r}return re(t),null;case 13:if(F(U),r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(A&&ge!==null&&t.mode&1&&!(t.flags&128))ha(),nn(),t.flags|=98560,i=!1;else if(i=mr(t),r!==null&&r.dehydrated!==null){if(e===null){if(!i)throw Error(g(318));if(i=t.memoizedState,i=i!==null?i.dehydrated:null,!i)throw Error(g(317));i[He]=t}else nn(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;re(t),i=!1}else Me!==null&&($i(Me),Me=null),i=!0;if(!i)return t.flags&65536?t:null}return t.flags&128?(t.lanes=n,t):(r=r!==null,r!==(e!==null&&e.memoizedState!==null)&&r&&(t.child.flags|=8192,t.mode&1&&(e===null||U.current&1?K===0&&(K=3):Oo())),t.updateQueue!==null&&(t.flags|=4),re(t),null);case 4:return ln(),Oi(e,t),e===null&&$n(t.stateNode.containerInfo),re(t),null;case 10:return yo(t.type._context),re(t),null;case 17:return me(t.type)&&Vr(),re(t),null;case 19:if(F(U),i=t.memoizedState,i===null)return re(t),null;if(r=(t.flags&128)!==0,o=i.rendering,o===null)if(r)wn(i,!1);else{if(K!==0||e!==null&&e.flags&128)for(e=t.child;e!==null;){if(o=Zr(e),o!==null){for(t.flags|=128,wn(i,!1),r=o.updateQueue,r!==null&&(t.updateQueue=r,t.flags|=4),t.subtreeFlags=0,r=n,n=t.child;n!==null;)i=n,e=r,i.flags&=14680066,o=i.alternate,o===null?(i.childLanes=0,i.lanes=e,i.child=null,i.subtreeFlags=0,i.memoizedProps=null,i.memoizedState=null,i.updateQueue=null,i.dependencies=null,i.stateNode=null):(i.childLanes=o.childLanes,i.lanes=o.lanes,i.child=o.child,i.subtreeFlags=0,i.deletions=null,i.memoizedProps=o.memoizedProps,i.memoizedState=o.memoizedState,i.updateQueue=o.updateQueue,i.type=o.type,e=o.dependencies,i.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext}),n=n.sibling;return D(U,U.current&1|2),t.child}e=e.sibling}i.tail!==null&&Q()>un&&(t.flags|=128,r=!0,wn(i,!1),t.lanes=4194304)}else{if(!r)if(e=Zr(o),e!==null){if(t.flags|=128,r=!0,n=e.updateQueue,n!==null&&(t.updateQueue=n,t.flags|=4),wn(i,!0),i.tail===null&&i.tailMode==="hidden"&&!o.alternate&&!A)return re(t),null}else 2*Q()-i.renderingStartTime>un&&n!==1073741824&&(t.flags|=128,r=!0,wn(i,!1),t.lanes=4194304);i.isBackwards?(o.sibling=t.child,t.child=o):(n=i.last,n!==null?n.sibling=o:t.child=o,i.last=o)}return i.tail!==null?(t=i.tail,i.rendering=t,i.tail=t.sibling,i.renderingStartTime=Q(),t.sibling=null,n=U.current,D(U,r?n&1|2:n&1),t):(re(t),null);case 22:case 23:return Mo(),r=t.memoizedState!==null,e!==null&&e.memoizedState!==null!==r&&(t.flags|=8192),r&&t.mode&1?ye&1073741824&&(re(t),t.subtreeFlags&6&&(t.flags|=8192)):re(t),null;case 24:return null;case 25:return null}throw Error(g(156,t.tag))}function Rd(e,t){switch(po(t),t.tag){case 1:return me(t.type)&&Vr(),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return ln(),F(he),F(ie),Eo(),e=t.flags,e&65536&&!(e&128)?(t.flags=e&-65537|128,t):null;case 5:return ko(t),null;case 13:if(F(U),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(g(340));nn()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return F(U),null;case 4:return ln(),null;case 10:return yo(t.type._context),null;case 22:case 23:return Mo(),null;case 24:return null;default:return null}}var gr=!1,le=!1,xd=typeof WeakSet=="function"?WeakSet:Set,k=null;function Gt(e,t){var n=e.ref;if(n!==null)if(typeof n=="function")try{n(null)}catch(r){$(e,t,r)}else n.current=null}function Di(e,t,n){try{n()}catch(r){$(e,t,r)}}var Bu=!1;function Id(e,t){if(gi=Ur,e=ta(),fo(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else e:{n=(n=e.ownerDocument)&&n.defaultView||window;var r=n.getSelection&&n.getSelection();if(r&&r.rangeCount!==0){n=r.anchorNode;var l=r.anchorOffset,i=r.focusNode;r=r.focusOffset;try{n.nodeType,i.nodeType}catch{n=null;break e}var o=0,u=-1,s=-1,f=0,m=0,h=e,p=null;t:for(;;){for(var w;h!==n||l!==0&&h.nodeType!==3||(u=o+l),h!==i||r!==0&&h.nodeType!==3||(s=o+r),h.nodeType===3&&(o+=h.nodeValue.length),(w=h.firstChild)!==null;)p=h,h=w;for(;;){if(h===e)break t;if(p===n&&++f===l&&(u=o),p===i&&++m===r&&(s=o),(w=h.nextSibling)!==null)break;h=p,p=h.parentNode}h=w}n=u===-1||s===-1?null:{start:u,end:s}}else n=null}n=n||{start:0,end:0}}else n=null;for(wi={focusedElem:e,selectionRange:n},Ur=!1,k=t;k!==null;)if(t=k,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,k=e;else for(;k!==null;){t=k;try{var S=t.alternate;if(t.flags&1024)switch(t.tag){case 0:case 11:case 15:break;case 1:if(S!==null){var v=S.memoizedProps,L=S.memoizedState,c=t.stateNode,a=c.getSnapshotBeforeUpdate(t.elementType===t.type?v:xe(t.type,v),L);c.__reactInternalSnapshotBeforeUpdate=a}break;case 3:var d=t.stateNode.containerInfo;d.nodeType===1?d.textContent="":d.nodeType===9&&d.documentElement&&d.removeChild(d.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(g(163))}}catch(y){$(t,t.return,y)}if(e=t.sibling,e!==null){e.return=t.return,k=e;break}k=t.return}return S=Bu,Bu=!1,S}function xn(e,t,n){var r=t.updateQueue;if(r=r!==null?r.lastEffect:null,r!==null){var l=r=r.next;do{if((l.tag&e)===e){var i=l.destroy;l.destroy=void 0,i!==void 0&&Di(t,n,i)}l=l.next}while(l!==r)}}function pl(e,t){if(t=t.updateQueue,t=t!==null?t.lastEffect:null,t!==null){var n=t=t.next;do{if((n.tag&e)===e){var r=n.create;n.destroy=r()}n=n.next}while(n!==t)}}function ji(e){var t=e.ref;if(t!==null){var n=e.stateNode;switch(e.tag){case 5:e=n;break;default:e=n}typeof t=="function"?t(e):t.current=e}}function Ja(e){var t=e.alternate;t!==null&&(e.alternate=null,Ja(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&(delete t[He],delete t[Wn],delete t[Ei],delete t[hd],delete t[md])),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}function qa(e){return e.tag===5||e.tag===3||e.tag===4}function $u(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||qa(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Fi(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.nodeType===8?n.parentNode.insertBefore(e,t):n.insertBefore(e,t):(n.nodeType===8?(t=n.parentNode,t.insertBefore(e,n)):(t=n,t.appendChild(e)),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=$r));else if(r!==4&&(e=e.child,e!==null))for(Fi(e,t,n),e=e.sibling;e!==null;)Fi(e,t,n),e=e.sibling}function Ai(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(r!==4&&(e=e.child,e!==null))for(Ai(e,t,n),e=e.sibling;e!==null;)Ai(e,t,n),e=e.sibling}var b=null,Ie=!1;function be(e,t,n){for(n=n.child;n!==null;)ba(e,t,n),n=n.sibling}function ba(e,t,n){if(Be&&typeof Be.onCommitFiberUnmount=="function")try{Be.onCommitFiberUnmount(il,n)}catch{}switch(n.tag){case 5:le||Gt(n,t);case 6:var r=b,l=Ie;b=null,be(e,t,n),b=r,Ie=l,b!==null&&(Ie?(e=b,n=n.stateNode,e.nodeType===8?e.parentNode.removeChild(n):e.removeChild(n)):b.removeChild(n.stateNode));break;case 18:b!==null&&(Ie?(e=b,n=n.stateNode,e.nodeType===8?Ul(e.parentNode,n):e.nodeType===1&&Ul(e,n),Un(e)):Ul(b,n.stateNode));break;case 4:r=b,l=Ie,b=n.stateNode.containerInfo,Ie=!0,be(e,t,n),b=r,Ie=l;break;case 0:case 11:case 14:case 15:if(!le&&(r=n.updateQueue,r!==null&&(r=r.lastEffect,r!==null))){l=r=r.next;do{var i=l,o=i.destroy;i=i.tag,o!==void 0&&(i&2||i&4)&&Di(n,t,o),l=l.next}while(l!==r)}be(e,t,n);break;case 1:if(!le&&(Gt(n,t),r=n.stateNode,typeof r.componentWillUnmount=="function"))try{r.props=n.memoizedProps,r.state=n.memoizedState,r.componentWillUnmount()}catch(u){$(n,t,u)}be(e,t,n);break;case 21:be(e,t,n);break;case 22:n.mode&1?(le=(r=le)||n.memoizedState!==null,be(e,t,n),le=r):be(e,t,n);break;default:be(e,t,n)}}function Vu(e){var t=e.updateQueue;if(t!==null){e.updateQueue=null;var n=e.stateNode;n===null&&(n=e.stateNode=new xd),t.forEach(function(r){var l=Bd.bind(null,e,r);n.has(r)||(n.add(r),r.then(l,l))})}}function Re(e,t){var n=t.deletions;if(n!==null)for(var r=0;r<n.length;r++){var l=n[r];try{var i=e,o=t,u=o;e:for(;u!==null;){switch(u.tag){case 5:b=u.stateNode,Ie=!1;break e;case 3:b=u.stateNode.containerInfo,Ie=!0;break e;case 4:b=u.stateNode.containerInfo,Ie=!0;break e}u=u.return}if(b===null)throw Error(g(160));ba(i,o,l),b=null,Ie=!1;var s=l.alternate;s!==null&&(s.return=null),l.return=null}catch(f){$(l,t,f)}}if(t.subtreeFlags&12854)for(t=t.child;t!==null;)ef(t,e),t=t.sibling}function ef(e,t){var n=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:if(Re(t,e),Ae(e),r&4){try{xn(3,e,e.return),pl(3,e)}catch(v){$(e,e.return,v)}try{xn(5,e,e.return)}catch(v){$(e,e.return,v)}}break;case 1:Re(t,e),Ae(e),r&512&&n!==null&&Gt(n,n.return);break;case 5:if(Re(t,e),Ae(e),r&512&&n!==null&&Gt(n,n.return),e.flags&32){var l=e.stateNode;try{Dn(l,"")}catch(v){$(e,e.return,v)}}if(r&4&&(l=e.stateNode,l!=null)){var i=e.memoizedProps,o=n!==null?n.memoizedProps:i,u=e.type,s=e.updateQueue;if(e.updateQueue=null,s!==null)try{u==="input"&&i.type==="radio"&&i.name!=null&&Es(l,i),si(u,o);var f=si(u,i);for(o=0;o<s.length;o+=2){var m=s[o],h=s[o+1];m==="style"?Ts(l,h):m==="dangerouslySetInnerHTML"?Ps(l,h):m==="children"?Dn(l,h):Ji(l,m,h,f)}switch(u){case"input":ri(l,i);break;case"textarea":_s(l,i);break;case"select":var p=l._wrapperState.wasMultiple;l._wrapperState.wasMultiple=!!i.multiple;var w=i.value;w!=null?Kt(l,!!i.multiple,w,!1):p!==!!i.multiple&&(i.defaultValue!=null?Kt(l,!!i.multiple,i.defaultValue,!0):Kt(l,!!i.multiple,i.multiple?[]:"",!1))}l[Wn]=i}catch(v){$(e,e.return,v)}}break;case 6:if(Re(t,e),Ae(e),r&4){if(e.stateNode===null)throw Error(g(162));l=e.stateNode,i=e.memoizedProps;try{l.nodeValue=i}catch(v){$(e,e.return,v)}}break;case 3:if(Re(t,e),Ae(e),r&4&&n!==null&&n.memoizedState.isDehydrated)try{Un(t.containerInfo)}catch(v){$(e,e.return,v)}break;case 4:Re(t,e),Ae(e);break;case 13:Re(t,e),Ae(e),l=e.child,l.flags&8192&&(i=l.memoizedState!==null,l.stateNode.isHidden=i,!i||l.alternate!==null&&l.alternate.memoizedState!==null||(xo=Q())),r&4&&Vu(e);break;case 22:if(m=n!==null&&n.memoizedState!==null,e.mode&1?(le=(f=le)||m,Re(t,e),le=f):Re(t,e),Ae(e),r&8192){if(f=e.memoizedState!==null,(e.stateNode.isHidden=f)&&!m&&e.mode&1)for(k=e,m=e.child;m!==null;){for(h=k=m;k!==null;){switch(p=k,w=p.child,p.tag){case 0:case 11:case 14:case 15:xn(4,p,p.return);break;case 1:Gt(p,p.return);var S=p.stateNode;if(typeof S.componentWillUnmount=="function"){r=p,n=p.return;try{t=r,S.props=t.memoizedProps,S.state=t.memoizedState,S.componentWillUnmount()}catch(v){$(r,n,v)}}break;case 5:Gt(p,p.return);break;case 22:if(p.memoizedState!==null){Qu(h);continue}}w!==null?(w.return=p,k=w):Qu(h)}m=m.sibling}e:for(m=null,h=e;;){if(h.tag===5){if(m===null){m=h;try{l=h.stateNode,f?(i=l.style,typeof i.setProperty=="function"?i.setProperty("display","none","important"):i.display="none"):(u=h.stateNode,s=h.memoizedProps.style,o=s!=null&&s.hasOwnProperty("display")?s.display:null,u.style.display=Ns("display",o))}catch(v){$(e,e.return,v)}}}else if(h.tag===6){if(m===null)try{h.stateNode.nodeValue=f?"":h.memoizedProps}catch(v){$(e,e.return,v)}}else if((h.tag!==22&&h.tag!==23||h.memoizedState===null||h===e)&&h.child!==null){h.child.return=h,h=h.child;continue}if(h===e)break e;for(;h.sibling===null;){if(h.return===null||h.return===e)break e;m===h&&(m=null),h=h.return}m===h&&(m=null),h.sibling.return=h.return,h=h.sibling}}break;case 19:Re(t,e),Ae(e),r&4&&Vu(e);break;case 21:break;default:Re(t,e),Ae(e)}}function Ae(e){var t=e.flags;if(t&2){try{e:{for(var n=e.return;n!==null;){if(qa(n)){var r=n;break e}n=n.return}throw Error(g(160))}switch(r.tag){case 5:var l=r.stateNode;r.flags&32&&(Dn(l,""),r.flags&=-33);var i=$u(e);Ai(e,i,l);break;case 3:case 4:var o=r.stateNode.containerInfo,u=$u(e);Fi(e,u,o);break;default:throw Error(g(161))}}catch(s){$(e,e.return,s)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Md(e,t,n){k=e,tf(e)}function tf(e,t,n){for(var r=(e.mode&1)!==0;k!==null;){var l=k,i=l.child;if(l.tag===22&&r){var o=l.memoizedState!==null||gr;if(!o){var u=l.alternate,s=u!==null&&u.memoizedState!==null||le;u=gr;var f=le;if(gr=o,(le=s)&&!f)for(k=l;k!==null;)o=k,s=o.child,o.tag===22&&o.memoizedState!==null?Gu(l):s!==null?(s.return=o,k=s):Gu(l);for(;i!==null;)k=i,tf(i),i=i.sibling;k=l,gr=u,le=f}Wu(e)}else l.subtreeFlags&8772&&i!==null?(i.return=l,k=i):Wu(e)}}function Wu(e){for(;k!==null;){var t=k;if(t.flags&8772){var n=t.alternate;try{if(t.flags&8772)switch(t.tag){case 0:case 11:case 15:le||pl(5,t);break;case 1:var r=t.stateNode;if(t.flags&4&&!le)if(n===null)r.componentDidMount();else{var l=t.elementType===t.type?n.memoizedProps:xe(t.type,n.memoizedProps);r.componentDidUpdate(l,n.memoizedState,r.__reactInternalSnapshotBeforeUpdate)}var i=t.updateQueue;i!==null&&Lu(t,i,r);break;case 3:var o=t.updateQueue;if(o!==null){if(n=null,t.child!==null)switch(t.child.tag){case 5:n=t.child.stateNode;break;case 1:n=t.child.stateNode}Lu(t,o,n)}break;case 5:var u=t.stateNode;if(n===null&&t.flags&4){n=u;var s=t.memoizedProps;switch(t.type){case"button":case"input":case"select":case"textarea":s.autoFocus&&n.focus();break;case"img":s.src&&(n.src=s.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(t.memoizedState===null){var f=t.alternate;if(f!==null){var m=f.memoizedState;if(m!==null){var h=m.dehydrated;h!==null&&Un(h)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(g(163))}le||t.flags&512&&ji(t)}catch(p){$(t,t.return,p)}}if(t===e){k=null;break}if(n=t.sibling,n!==null){n.return=t.return,k=n;break}k=t.return}}function Qu(e){for(;k!==null;){var t=k;if(t===e){k=null;break}var n=t.sibling;if(n!==null){n.return=t.return,k=n;break}k=t.return}}function Gu(e){for(;k!==null;){var t=k;try{switch(t.tag){case 0:case 11:case 15:var n=t.return;try{pl(4,t)}catch(s){$(t,n,s)}break;case 1:var r=t.stateNode;if(typeof r.componentDidMount=="function"){var l=t.return;try{r.componentDidMount()}catch(s){$(t,l,s)}}var i=t.return;try{ji(t)}catch(s){$(t,i,s)}break;case 5:var o=t.return;try{ji(t)}catch(s){$(t,o,s)}}}catch(s){$(t,t.return,s)}if(t===e){k=null;break}var u=t.sibling;if(u!==null){u.return=t.return,k=u;break}k=t.return}}var Od=Math.ceil,br=qe.ReactCurrentDispatcher,zo=qe.ReactCurrentOwner,Ne=qe.ReactCurrentBatchConfig,M=0,q=null,G=null,ee=0,ye=0,Yt=yt(0),K=0,Zn=null,xt=0,hl=0,Ro=0,In=null,ce=null,xo=0,un=1/0,Ve=null,el=!1,Ui=null,ct=null,wr=!1,it=null,tl=0,Mn=0,Hi=null,xr=-1,Ir=0;function ue(){return M&6?Q():xr!==-1?xr:xr=Q()}function dt(e){return e.mode&1?M&2&&ee!==0?ee&-ee:yd.transition!==null?(Ir===0&&(Ir=Us()),Ir):(e=O,e!==0||(e=window.event,e=e===void 0?16:Gs(e.type)),e):1}function De(e,t,n,r){if(50<Mn)throw Mn=0,Hi=null,Error(g(185));qn(e,n,r),(!(M&2)||e!==q)&&(e===q&&(!(M&2)&&(hl|=n),K===4&&rt(e,ee)),ve(e,r),n===1&&M===0&&!(t.mode&1)&&(un=Q()+500,fl&&gt()))}function ve(e,t){var n=e.callbackNode;yc(e,t);var r=Ar(e,e===q?ee:0);if(r===0)n!==null&&tu(n),e.callbackNode=null,e.callbackPriority=0;else if(t=r&-r,e.callbackPriority!==t){if(n!=null&&tu(n),t===1)e.tag===0?vd(Yu.bind(null,e)):ca(Yu.bind(null,e)),dd(function(){!(M&6)&&gt()}),n=null;else{switch(Hs(r)){case 1:n=no;break;case 4:n=Fs;break;case 16:n=Fr;break;case 536870912:n=As;break;default:n=Fr}n=ff(n,nf.bind(null,e))}e.callbackPriority=t,e.callbackNode=n}}function nf(e,t){if(xr=-1,Ir=0,M&6)throw Error(g(327));var n=e.callbackNode;if(bt()&&e.callbackNode!==n)return null;var r=Ar(e,e===q?ee:0);if(r===0)return null;if(r&30||r&e.expiredLanes||t)t=nl(e,r);else{t=r;var l=M;M|=2;var i=lf();(q!==e||ee!==t)&&(Ve=null,un=Q()+500,Nt(e,t));do try{Fd();break}catch(u){rf(e,u)}while(!0);vo(),br.current=i,M=l,G!==null?t=0:(q=null,ee=0,t=K)}if(t!==0){if(t===2&&(l=pi(e),l!==0&&(r=l,t=Bi(e,l))),t===1)throw n=Zn,Nt(e,0),rt(e,r),ve(e,Q()),n;if(t===6)rt(e,r);else{if(l=e.current.alternate,!(r&30)&&!Dd(l)&&(t=nl(e,r),t===2&&(i=pi(e),i!==0&&(r=i,t=Bi(e,i))),t===1))throw n=Zn,Nt(e,0),rt(e,r),ve(e,Q()),n;switch(e.finishedWork=l,e.finishedLanes=r,t){case 0:case 1:throw Error(g(345));case 2:Et(e,ce,Ve);break;case 3:if(rt(e,r),(r&130023424)===r&&(t=xo+500-Q(),10<t)){if(Ar(e,0)!==0)break;if(l=e.suspendedLanes,(l&r)!==r){ue(),e.pingedLanes|=e.suspendedLanes&l;break}e.timeoutHandle=ki(Et.bind(null,e,ce,Ve),t);break}Et(e,ce,Ve);break;case 4:if(rt(e,r),(r&4194240)===r)break;for(t=e.eventTimes,l=-1;0<r;){var o=31-Oe(r);i=1<<o,o=t[o],o>l&&(l=o),r&=~i}if(r=l,r=Q()-r,r=(120>r?120:480>r?480:1080>r?1080:1920>r?1920:3e3>r?3e3:4320>r?4320:1960*Od(r/1960))-r,10<r){e.timeoutHandle=ki(Et.bind(null,e,ce,Ve),r);break}Et(e,ce,Ve);break;case 5:Et(e,ce,Ve);break;default:throw Error(g(329))}}}return ve(e,Q()),e.callbackNode===n?nf.bind(null,e):null}function Bi(e,t){var n=In;return e.current.memoizedState.isDehydrated&&(Nt(e,t).flags|=256),e=nl(e,t),e!==2&&(t=ce,ce=n,t!==null&&$i(t)),e}function $i(e){ce===null?ce=e:ce.push.apply(ce,e)}function Dd(e){for(var t=e;;){if(t.flags&16384){var n=t.updateQueue;if(n!==null&&(n=n.stores,n!==null))for(var r=0;r<n.length;r++){var l=n[r],i=l.getSnapshot;l=l.value;try{if(!Fe(i(),l))return!1}catch{return!1}}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function rt(e,t){for(t&=~Ro,t&=~hl,e.suspendedLanes|=t,e.pingedLanes&=~t,e=e.expirationTimes;0<t;){var n=31-Oe(t),r=1<<n;e[n]=-1,t&=~r}}function Yu(e){if(M&6)throw Error(g(327));bt();var t=Ar(e,0);if(!(t&1))return ve(e,Q()),null;var n=nl(e,t);if(e.tag!==0&&n===2){var r=pi(e);r!==0&&(t=r,n=Bi(e,r))}if(n===1)throw n=Zn,Nt(e,0),rt(e,t),ve(e,Q()),n;if(n===6)throw Error(g(345));return e.finishedWork=e.current.alternate,e.finishedLanes=t,Et(e,ce,Ve),ve(e,Q()),null}function Io(e,t){var n=M;M|=1;try{return e(t)}finally{M=n,M===0&&(un=Q()+500,fl&&gt())}}function It(e){it!==null&&it.tag===0&&!(M&6)&&bt();var t=M;M|=1;var n=Ne.transition,r=O;try{if(Ne.transition=null,O=1,e)return e()}finally{O=r,Ne.transition=n,M=t,!(M&6)&&gt()}}function Mo(){ye=Yt.current,F(Yt)}function Nt(e,t){e.finishedWork=null,e.finishedLanes=0;var n=e.timeoutHandle;if(n!==-1&&(e.timeoutHandle=-1,cd(n)),G!==null)for(n=G.return;n!==null;){var r=n;switch(po(r),r.tag){case 1:r=r.type.childContextTypes,r!=null&&Vr();break;case 3:ln(),F(he),F(ie),Eo();break;case 5:ko(r);break;case 4:ln();break;case 13:F(U);break;case 19:F(U);break;case 10:yo(r.type._context);break;case 22:case 23:Mo()}n=n.return}if(q=e,G=e=pt(e.current,null),ee=ye=t,K=0,Zn=null,Ro=hl=xt=0,ce=In=null,Ct!==null){for(t=0;t<Ct.length;t++)if(n=Ct[t],r=n.interleaved,r!==null){n.interleaved=null;var l=r.next,i=n.pending;if(i!==null){var o=i.next;i.next=l,r.next=o}n.pending=r}Ct=null}return e}function rf(e,t){do{var n=G;try{if(vo(),Lr.current=qr,Jr){for(var r=H.memoizedState;r!==null;){var l=r.queue;l!==null&&(l.pending=null),r=r.next}Jr=!1}if(Rt=0,J=Y=H=null,Rn=!1,Yn=0,zo.current=null,n===null||n.return===null){K=1,Zn=t,G=null;break}e:{var i=e,o=n.return,u=n,s=t;if(t=ee,u.flags|=32768,s!==null&&typeof s=="object"&&typeof s.then=="function"){var f=s,m=u,h=m.tag;if(!(m.mode&1)&&(h===0||h===11||h===15)){var p=m.alternate;p?(m.updateQueue=p.updateQueue,m.memoizedState=p.memoizedState,m.lanes=p.lanes):(m.updateQueue=null,m.memoizedState=null)}var w=Ou(o);if(w!==null){w.flags&=-257,Du(w,o,u,i,t),w.mode&1&&Mu(i,f,t),t=w,s=f;var S=t.updateQueue;if(S===null){var v=new Set;v.add(s),t.updateQueue=v}else S.add(s);break e}else{if(!(t&1)){Mu(i,f,t),Oo();break e}s=Error(g(426))}}else if(A&&u.mode&1){var L=Ou(o);if(L!==null){!(L.flags&65536)&&(L.flags|=256),Du(L,o,u,i,t),ho(on(s,u));break e}}i=s=on(s,u),K!==4&&(K=2),In===null?In=[i]:In.push(i),i=o;do{switch(i.tag){case 3:i.flags|=65536,t&=-t,i.lanes|=t;var c=Ha(i,s,t);Tu(i,c);break e;case 1:u=s;var a=i.type,d=i.stateNode;if(!(i.flags&128)&&(typeof a.getDerivedStateFromError=="function"||d!==null&&typeof d.componentDidCatch=="function"&&(ct===null||!ct.has(d)))){i.flags|=65536,t&=-t,i.lanes|=t;var y=Ba(i,u,t);Tu(i,y);break e}}i=i.return}while(i!==null)}uf(n)}catch(E){t=E,G===n&&n!==null&&(G=n=n.return);continue}break}while(!0)}function lf(){var e=br.current;return br.current=qr,e===null?qr:e}function Oo(){(K===0||K===3||K===2)&&(K=4),q===null||!(xt&268435455)&&!(hl&268435455)||rt(q,ee)}function nl(e,t){var n=M;M|=2;var r=lf();(q!==e||ee!==t)&&(Ve=null,Nt(e,t));do try{jd();break}catch(l){rf(e,l)}while(!0);if(vo(),M=n,br.current=r,G!==null)throw Error(g(261));return q=null,ee=0,K}function jd(){for(;G!==null;)of(G)}function Fd(){for(;G!==null&&!sc();)of(G)}function of(e){var t=af(e.alternate,e,ye);e.memoizedProps=e.pendingProps,t===null?uf(e):G=t,zo.current=null}function uf(e){var t=e;do{var n=t.alternate;if(e=t.return,t.flags&32768){if(n=Rd(n,t),n!==null){n.flags&=32767,G=n;return}if(e!==null)e.flags|=32768,e.subtreeFlags=0,e.deletions=null;else{K=6,G=null;return}}else if(n=zd(n,t,ye),n!==null){G=n;return}if(t=t.sibling,t!==null){G=t;return}G=t=e}while(t!==null);K===0&&(K=5)}function Et(e,t,n){var r=O,l=Ne.transition;try{Ne.transition=null,O=1,Ad(e,t,n,r)}finally{Ne.transition=l,O=r}return null}function Ad(e,t,n,r){do bt();while(it!==null);if(M&6)throw Error(g(327));n=e.finishedWork;var l=e.finishedLanes;if(n===null)return null;if(e.finishedWork=null,e.finishedLanes=0,n===e.current)throw Error(g(177));e.callbackNode=null,e.callbackPriority=0;var i=n.lanes|n.childLanes;if(gc(e,i),e===q&&(G=q=null,ee=0),!(n.subtreeFlags&2064)&&!(n.flags&2064)||wr||(wr=!0,ff(Fr,function(){return bt(),null})),i=(n.flags&15990)!==0,n.subtreeFlags&15990||i){i=Ne.transition,Ne.transition=null;var o=O;O=1;var u=M;M|=4,zo.current=null,Id(e,n),ef(n,e),ld(wi),Ur=!!gi,wi=gi=null,e.current=n,Md(n),ac(),M=u,O=o,Ne.transition=i}else e.current=n;if(wr&&(wr=!1,it=e,tl=l),i=e.pendingLanes,i===0&&(ct=null),dc(n.stateNode),ve(e,Q()),t!==null)for(r=e.onRecoverableError,n=0;n<t.length;n++)l=t[n],r(l.value,{componentStack:l.stack,digest:l.digest});if(el)throw el=!1,e=Ui,Ui=null,e;return tl&1&&e.tag!==0&&bt(),i=e.pendingLanes,i&1?e===Hi?Mn++:(Mn=0,Hi=e):Mn=0,gt(),null}function bt(){if(it!==null){var e=Hs(tl),t=Ne.transition,n=O;try{if(Ne.transition=null,O=16>e?16:e,it===null)var r=!1;else{if(e=it,it=null,tl=0,M&6)throw Error(g(331));var l=M;for(M|=4,k=e.current;k!==null;){var i=k,o=i.child;if(k.flags&16){var u=i.deletions;if(u!==null){for(var s=0;s<u.length;s++){var f=u[s];for(k=f;k!==null;){var m=k;switch(m.tag){case 0:case 11:case 15:xn(8,m,i)}var h=m.child;if(h!==null)h.return=m,k=h;else for(;k!==null;){m=k;var p=m.sibling,w=m.return;if(Ja(m),m===f){k=null;break}if(p!==null){p.return=w,k=p;break}k=w}}}var S=i.alternate;if(S!==null){var v=S.child;if(v!==null){S.child=null;do{var L=v.sibling;v.sibling=null,v=L}while(v!==null)}}k=i}}if(i.subtreeFlags&2064&&o!==null)o.return=i,k=o;else e:for(;k!==null;){if(i=k,i.flags&2048)switch(i.tag){case 0:case 11:case 15:xn(9,i,i.return)}var c=i.sibling;if(c!==null){c.return=i.return,k=c;break e}k=i.return}}var a=e.current;for(k=a;k!==null;){o=k;var d=o.child;if(o.subtreeFlags&2064&&d!==null)d.return=o,k=d;else e:for(o=a;k!==null;){if(u=k,u.flags&2048)try{switch(u.tag){case 0:case 11:case 15:pl(9,u)}}catch(E){$(u,u.return,E)}if(u===o){k=null;break e}var y=u.sibling;if(y!==null){y.return=u.return,k=y;break e}k=u.return}}if(M=l,gt(),Be&&typeof Be.onPostCommitFiberRoot=="function")try{Be.onPostCommitFiberRoot(il,e)}catch{}r=!0}return r}finally{O=n,Ne.transition=t}}return!1}function Ku(e,t,n){t=on(n,t),t=Ha(e,t,1),e=ft(e,t,1),t=ue(),e!==null&&(qn(e,1,t),ve(e,t))}function $(e,t,n){if(e.tag===3)Ku(e,e,n);else for(;t!==null;){if(t.tag===3){Ku(t,e,n);break}else if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof r.componentDidCatch=="function"&&(ct===null||!ct.has(r))){e=on(n,e),e=Ba(t,e,1),t=ft(t,e,1),e=ue(),t!==null&&(qn(t,1,e),ve(t,e));break}}t=t.return}}function Ud(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),t=ue(),e.pingedLanes|=e.suspendedLanes&n,q===e&&(ee&n)===n&&(K===4||K===3&&(ee&130023424)===ee&&500>Q()-xo?Nt(e,0):Ro|=n),ve(e,t)}function sf(e,t){t===0&&(e.mode&1?(t=ar,ar<<=1,!(ar&130023424)&&(ar=4194304)):t=1);var n=ue();e=Ze(e,t),e!==null&&(qn(e,t,n),ve(e,n))}function Hd(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),sf(e,n)}function Bd(e,t){var n=0;switch(e.tag){case 13:var r=e.stateNode,l=e.memoizedState;l!==null&&(n=l.retryLane);break;case 19:r=e.stateNode;break;default:throw Error(g(314))}r!==null&&r.delete(t),sf(e,n)}var af;af=function(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps||he.current)pe=!0;else{if(!(e.lanes&n)&&!(t.flags&128))return pe=!1,Ld(e,t,n);pe=!!(e.flags&131072)}else pe=!1,A&&t.flags&1048576&&da(t,Gr,t.index);switch(t.lanes=0,t.tag){case 2:var r=t.type;Rr(e,t),e=t.pendingProps;var l=tn(t,ie.current);qt(t,n),l=Co(null,t,r,e,l,n);var i=Po();return t.flags|=1,typeof l=="object"&&l!==null&&typeof l.render=="function"&&l.$$typeof===void 0?(t.tag=1,t.memoizedState=null,t.updateQueue=null,me(r)?(i=!0,Wr(t)):i=!1,t.memoizedState=l.state!==null&&l.state!==void 0?l.state:null,wo(t),l.updater=dl,t.stateNode=l,l._reactInternals=t,Li(t,r,e,n),t=xi(null,t,r,!0,i,n)):(t.tag=0,A&&i&&co(t),oe(null,t,l,n),t=t.child),t;case 16:r=t.elementType;e:{switch(Rr(e,t),e=t.pendingProps,l=r._init,r=l(r._payload),t.type=r,l=t.tag=Vd(r),e=xe(r,e),l){case 0:t=Ri(null,t,r,e,n);break e;case 1:t=Au(null,t,r,e,n);break e;case 11:t=ju(null,t,r,e,n);break e;case 14:t=Fu(null,t,r,xe(r.type,e),n);break e}throw Error(g(306,r,""))}return t;case 0:return r=t.type,l=t.pendingProps,l=t.elementType===r?l:xe(r,l),Ri(e,t,r,l,n);case 1:return r=t.type,l=t.pendingProps,l=t.elementType===r?l:xe(r,l),Au(e,t,r,l,n);case 3:e:{if(Qa(t),e===null)throw Error(g(387));r=t.pendingProps,i=t.memoizedState,l=i.element,ga(e,t),Xr(t,r,null,n);var o=t.memoizedState;if(r=o.element,i.isDehydrated)if(i={element:r,isDehydrated:!1,cache:o.cache,pendingSuspenseBoundaries:o.pendingSuspenseBoundaries,transitions:o.transitions},t.updateQueue.baseState=i,t.memoizedState=i,t.flags&256){l=on(Error(g(423)),t),t=Uu(e,t,r,n,l);break e}else if(r!==l){l=on(Error(g(424)),t),t=Uu(e,t,r,n,l);break e}else for(ge=at(t.stateNode.containerInfo.firstChild),we=t,A=!0,Me=null,n=va(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling;else{if(nn(),r===l){t=Je(e,t,n);break e}oe(e,t,r,n)}t=t.child}return t;case 5:return wa(t),e===null&&Pi(t),r=t.type,l=t.pendingProps,i=e!==null?e.memoizedProps:null,o=l.children,Si(r,l)?o=null:i!==null&&Si(r,i)&&(t.flags|=32),Wa(e,t),oe(e,t,o,n),t.child;case 6:return e===null&&Pi(t),null;case 13:return Ga(e,t,n);case 4:return So(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=rn(t,null,r,n):oe(e,t,r,n),t.child;case 11:return r=t.type,l=t.pendingProps,l=t.elementType===r?l:xe(r,l),ju(e,t,r,l,n);case 7:return oe(e,t,t.pendingProps,n),t.child;case 8:return oe(e,t,t.pendingProps.children,n),t.child;case 12:return oe(e,t,t.pendingProps.children,n),t.child;case 10:e:{if(r=t.type._context,l=t.pendingProps,i=t.memoizedProps,o=l.value,D(Yr,r._currentValue),r._currentValue=o,i!==null)if(Fe(i.value,o)){if(i.children===l.children&&!he.current){t=Je(e,t,n);break e}}else for(i=t.child,i!==null&&(i.return=t);i!==null;){var u=i.dependencies;if(u!==null){o=i.child;for(var s=u.firstContext;s!==null;){if(s.context===r){if(i.tag===1){s=Ye(-1,n&-n),s.tag=2;var f=i.updateQueue;if(f!==null){f=f.shared;var m=f.pending;m===null?s.next=s:(s.next=m.next,m.next=s),f.pending=s}}i.lanes|=n,s=i.alternate,s!==null&&(s.lanes|=n),Ni(i.return,n,t),u.lanes|=n;break}s=s.next}}else if(i.tag===10)o=i.type===t.type?null:i.child;else if(i.tag===18){if(o=i.return,o===null)throw Error(g(341));o.lanes|=n,u=o.alternate,u!==null&&(u.lanes|=n),Ni(o,n,t),o=i.sibling}else o=i.child;if(o!==null)o.return=i;else for(o=i;o!==null;){if(o===t){o=null;break}if(i=o.sibling,i!==null){i.return=o.return,o=i;break}o=o.return}i=o}oe(e,t,l.children,n),t=t.child}return t;case 9:return l=t.type,r=t.pendingProps.children,qt(t,n),l=Te(l),r=r(l),t.flags|=1,oe(e,t,r,n),t.child;case 14:return r=t.type,l=xe(r,t.pendingProps),l=xe(r.type,l),Fu(e,t,r,l,n);case 15:return $a(e,t,t.type,t.pendingProps,n);case 17:return r=t.type,l=t.pendingProps,l=t.elementType===r?l:xe(r,l),Rr(e,t),t.tag=1,me(r)?(e=!0,Wr(t)):e=!1,qt(t,n),Ua(t,r,l),Li(t,r,l,n),xi(null,t,r,!0,e,n);case 19:return Ya(e,t,n);case 22:return Va(e,t,n)}throw Error(g(156,t.tag))};function ff(e,t){return js(e,t)}function $d(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Pe(e,t,n,r){return new $d(e,t,n,r)}function Do(e){return e=e.prototype,!(!e||!e.isReactComponent)}function Vd(e){if(typeof e=="function")return Do(e)?1:0;if(e!=null){if(e=e.$$typeof,e===bi)return 11;if(e===eo)return 14}return 2}function pt(e,t){var n=e.alternate;return n===null?(n=Pe(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&14680064,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n}function Mr(e,t,n,r,l,i){var o=2;if(r=e,typeof e=="function")Do(e)&&(o=1);else if(typeof e=="string")o=5;else e:switch(e){case Ft:return Tt(n.children,l,i,t);case qi:o=8,l|=8;break;case ql:return e=Pe(12,n,t,l|2),e.elementType=ql,e.lanes=i,e;case bl:return e=Pe(13,n,t,l),e.elementType=bl,e.lanes=i,e;case ei:return e=Pe(19,n,t,l),e.elementType=ei,e.lanes=i,e;case ws:return ml(n,l,i,t);default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case ys:o=10;break e;case gs:o=9;break e;case bi:o=11;break e;case eo:o=14;break e;case et:o=16,r=null;break e}throw Error(g(130,e==null?e:typeof e,""))}return t=Pe(o,n,t,l),t.elementType=e,t.type=r,t.lanes=i,t}function Tt(e,t,n,r){return e=Pe(7,e,r,t),e.lanes=n,e}function ml(e,t,n,r){return e=Pe(22,e,r,t),e.elementType=ws,e.lanes=n,e.stateNode={isHidden:!1},e}function Yl(e,t,n){return e=Pe(6,e,null,t),e.lanes=n,e}function Kl(e,t,n){return t=Pe(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}function Wd(e,t,n,r,l){this.tag=t,this.containerInfo=e,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=Ll(0),this.expirationTimes=Ll(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Ll(0),this.identifierPrefix=r,this.onRecoverableError=l,this.mutableSourceEagerHydrationData=null}function jo(e,t,n,r,l,i,o,u,s){return e=new Wd(e,t,n,u,s),t===1?(t=1,i===!0&&(t|=8)):t=0,i=Pe(3,null,null,t),e.current=i,i.stateNode=e,i.memoizedState={element:r,isDehydrated:n,cache:null,transitions:null,pendingSuspenseBoundaries:null},wo(i),e}function Qd(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:jt,key:r==null?null:""+r,children:e,containerInfo:t,implementation:n}}function cf(e){if(!e)return mt;e=e._reactInternals;e:{if(Ot(e)!==e||e.tag!==1)throw Error(g(170));var t=e;do{switch(t.tag){case 3:t=t.stateNode.context;break e;case 1:if(me(t.type)){t=t.stateNode.__reactInternalMemoizedMergedChildContext;break e}}t=t.return}while(t!==null);throw Error(g(171))}if(e.tag===1){var n=e.type;if(me(n))return fa(e,n,t)}return t}function df(e,t,n,r,l,i,o,u,s){return e=jo(n,r,!0,e,l,i,o,u,s),e.context=cf(null),n=e.current,r=ue(),l=dt(n),i=Ye(r,l),i.callback=t??null,ft(n,i,l),e.current.lanes=l,qn(e,l,r),ve(e,r),e}function vl(e,t,n,r){var l=t.current,i=ue(),o=dt(l);return n=cf(n),t.context===null?t.context=n:t.pendingContext=n,t=Ye(i,o),t.payload={element:e},r=r===void 0?null:r,r!==null&&(t.callback=r),e=ft(l,t,o),e!==null&&(De(e,l,o,i),Tr(e,l,o)),o}function rl(e){if(e=e.current,!e.child)return null;switch(e.child.tag){case 5:return e.child.stateNode;default:return e.child.stateNode}}function Xu(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function Fo(e,t){Xu(e,t),(e=e.alternate)&&Xu(e,t)}function Gd(){return null}var pf=typeof reportError=="function"?reportError:function(e){console.error(e)};function Ao(e){this._internalRoot=e}yl.prototype.render=Ao.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(g(409));vl(e,t,null,null)};yl.prototype.unmount=Ao.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;It(function(){vl(null,e,null,null)}),t[Xe]=null}};function yl(e){this._internalRoot=e}yl.prototype.unstable_scheduleHydration=function(e){if(e){var t=Vs();e={blockedOn:null,target:e,priority:t};for(var n=0;n<nt.length&&t!==0&&t<nt[n].priority;n++);nt.splice(n,0,e),n===0&&Qs(e)}};function Uo(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function gl(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11&&(e.nodeType!==8||e.nodeValue!==" react-mount-point-unstable "))}function Zu(){}function Yd(e,t,n,r,l){if(l){if(typeof r=="function"){var i=r;r=function(){var f=rl(o);i.call(f)}}var o=df(t,r,e,0,null,!1,!1,"",Zu);return e._reactRootContainer=o,e[Xe]=o.current,$n(e.nodeType===8?e.parentNode:e),It(),o}for(;l=e.lastChild;)e.removeChild(l);if(typeof r=="function"){var u=r;r=function(){var f=rl(s);u.call(f)}}var s=jo(e,0,!1,null,null,!1,!1,"",Zu);return e._reactRootContainer=s,e[Xe]=s.current,$n(e.nodeType===8?e.parentNode:e),It(function(){vl(t,s,n,r)}),s}function wl(e,t,n,r,l){var i=n._reactRootContainer;if(i){var o=i;if(typeof l=="function"){var u=l;l=function(){var s=rl(o);u.call(s)}}vl(t,o,e,l)}else o=Yd(n,t,e,l,r);return rl(o)}Bs=function(e){switch(e.tag){case 3:var t=e.stateNode;if(t.current.memoizedState.isDehydrated){var n=_n(t.pendingLanes);n!==0&&(ro(t,n|1),ve(t,Q()),!(M&6)&&(un=Q()+500,gt()))}break;case 13:It(function(){var r=Ze(e,1);if(r!==null){var l=ue();De(r,e,1,l)}}),Fo(e,1)}};lo=function(e){if(e.tag===13){var t=Ze(e,134217728);if(t!==null){var n=ue();De(t,e,134217728,n)}Fo(e,134217728)}};$s=function(e){if(e.tag===13){var t=dt(e),n=Ze(e,t);if(n!==null){var r=ue();De(n,e,t,r)}Fo(e,t)}};Vs=function(){return O};Ws=function(e,t){var n=O;try{return O=e,t()}finally{O=n}};fi=function(e,t,n){switch(t){case"input":if(ri(e,n),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+t)+'][type="radio"]'),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var l=al(r);if(!l)throw Error(g(90));ks(r),ri(r,l)}}}break;case"textarea":_s(e,n);break;case"select":t=n.value,t!=null&&Kt(e,!!n.multiple,t,!1)}};Rs=Io;xs=It;var Kd={usingClientEntryPoint:!1,Events:[er,Bt,al,Ls,zs,Io]},Sn={findFiberByHostInstance:_t,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},Xd={bundleType:Sn.bundleType,version:Sn.version,rendererPackageName:Sn.rendererPackageName,rendererConfig:Sn.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:qe.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){return e=Os(e),e===null?null:e.stateNode},findFiberByHostInstance:Sn.findFiberByHostInstance||Gd,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Sr=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Sr.isDisabled&&Sr.supportsFiber)try{il=Sr.inject(Xd),Be=Sr}catch{}}ke.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Kd;ke.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!Uo(t))throw Error(g(200));return Qd(e,t,null,n)};ke.createRoot=function(e,t){if(!Uo(e))throw Error(g(299));var n=!1,r="",l=pf;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onRecoverableError!==void 0&&(l=t.onRecoverableError)),t=jo(e,1,!1,null,null,n,!1,r,l),e[Xe]=t.current,$n(e.nodeType===8?e.parentNode:e),new Ao(t)};ke.findDOMNode=function(e){if(e==null)return null;if(e.nodeType===1)return e;var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(g(188)):(e=Object.keys(e).join(","),Error(g(268,e)));return e=Os(t),e=e===null?null:e.stateNode,e};ke.flushSync=function(e){return It(e)};ke.hydrate=function(e,t,n){if(!gl(t))throw Error(g(200));return wl(null,e,t,!0,n)};ke.hydrateRoot=function(e,t,n){if(!Uo(e))throw Error(g(405));var r=n!=null&&n.hydratedSources||null,l=!1,i="",o=pf;if(n!=null&&(n.unstable_strictMode===!0&&(l=!0),n.identifierPrefix!==void 0&&(i=n.identifierPrefix),n.onRecoverableError!==void 0&&(o=n.onRecoverableError)),t=df(t,null,e,1,n??null,l,!1,i,o),e[Xe]=t.current,$n(e),r)for(e=0;e<r.length;e++)n=r[e],l=n._getVersion,l=l(n._source),t.mutableSourceEagerHydrationData==null?t.mutableSourceEagerHydrationData=[n,l]:t.mutableSourceEagerHydrationData.push(n,l);return new yl(t)};ke.render=function(e,t,n){if(!gl(t))throw Error(g(200));return wl(null,e,t,!1,n)};ke.unmountComponentAtNode=function(e){if(!gl(e))throw Error(g(40));return e._reactRootContainer?(It(function(){wl(null,null,e,!1,function(){e._reactRootContainer=null,e[Xe]=null})}),!0):!1};ke.unstable_batchedUpdates=Io;ke.unstable_renderSubtreeIntoContainer=function(e,t,n,r){if(!gl(n))throw Error(g(200));if(e==null||e._reactInternals===void 0)throw Error(g(38));return wl(e,t,n,!1,r)};ke.version="18.3.1-next-f1338f8080-20240426";function hf(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(hf)}catch(e){console.error(e)}}hf(),ps.exports=ke;var Zd=ps.exports,Ju=Zd;Zl.createRoot=Ju.createRoot,Zl.hydrateRoot=Ju.hydrateRoot;const de=360,Ho=600,mf=80,je=Ho-mf,Jd=980,qd=-330,kr=500,bd=34,ep=24,tp=80,vf=250,np=52,yf=135,Vi=140,rp=1.75,Wi=60,lp=je-yf-Wi,ip={top:3,bottom:3,left:4,right:4},gf="flappy_bird_high_score",Z={IDLE:"idle",PLAYING:"playing",GAME_OVER:"gameOver"};function op(e=tp,t=vf){return{x:e,y:t,width:bd,height:ep,velocity:0,gravity:Jd,flapStrength:qd,rotation:0,wingPhase:0,idleTimer:0}}function qu(e){e.velocity=e.flapStrength}function Xl(e,t,n="playing"){if(n==="idle"){e.idleTimer+=t*3.5,e.y=vf+Math.sin(e.idleTimer)*7,e.velocity=0,e.rotation=0,e.wingPhase+=t*8;return}if(n==="playing"){e.velocity+=e.gravity*t,e.velocity>kr&&(e.velocity=kr),e.y+=e.velocity*t,e.velocity<100?e.wingPhase+=t*12:e.wingPhase+=t*3,e.velocity<0?e.rotation=Math.max(-.45,e.rotation-t*6):e.rotation=Math.min(1.3,e.rotation+t*4.5);return}n==="gameOver"&&(e.y+e.height<je&&(e.velocity+=e.gravity*t,e.velocity>kr&&(e.velocity=kr),e.y+=e.velocity*t,e.y+e.height>je&&(e.y=je-e.height,e.velocity=0)),e.rotation=Math.min(1.4,e.rotation+t*8))}function up(){return{pipes:[],spawnTimer:0,spawnInterval:rp,speed:Vi,nextId:1}}function sp(e,t=null){const n=t!==null?t:Math.floor(Wi+Math.random()*(lp-Wi)),r={id:e.nextId++,x:de,width:np,topHeight:n,gap:yf,passed:!1};return e.pipes.push(r),r}function ap(e,t,n){let r=0;e.spawnTimer+=t,e.spawnTimer>=e.spawnInterval&&(e.spawnTimer-=e.spawnInterval,sp(e));for(let l=0;l<e.pipes.length;l++){const i=e.pipes[l];i.x-=e.speed*t,!i.passed&&n>i.x+i.width&&(i.passed=!0,r+=1)}return e.pipes=e.pipes.filter(l=>l.x+l.width>0),{pointsAwarded:r}}function Bo(e){const t=ip;return{x:e.x+t.left,y:e.y+t.top,width:Math.max(1,e.width-(t.left+t.right)),height:Math.max(1,e.height-(t.top+t.bottom))}}function bu(e,t){return e.x<t.x+t.width&&e.x+e.width>t.x&&e.y<t.y+t.height&&e.y+e.height>t.y}function fp(e){const t=Bo(e);return t.y+t.height>=je}function cp(e){return Bo(e).y<=0}function dp(e,t){const n=Bo(e),r={x:t.x,y:0,width:t.width,height:t.topHeight};if(bu(n,r))return!0;const l=t.topHeight+t.gap,i={x:t.x,y:l,width:t.width,height:Math.max(0,je-l)};return bu(n,i)}function pp(e,t=[]){if(fp(e))return{collided:!0,reason:"ground"};if(cp(e))return{collided:!0,reason:"ceiling"};for(const n of t)if(dp(e,n))return{collided:!0,reason:"pipe",pipeId:n.id};return{collided:!1,reason:null}}const hp=[{x:40,y:80,scale:1.1},{x:180,y:120,scale:.8},{x:300,y:60,scale:1.2}];function mp(e,t,n,r=1){e.save(),e.translate(t,n),e.scale(r,r),e.fillStyle="rgba(255, 255, 255, 0.75)",e.beginPath(),e.arc(0,0,18,0,Math.PI*2),e.arc(15,-6,22,0,Math.PI*2),e.arc(32,0,16,0,Math.PI*2),e.arc(44,4,12,0,Math.PI*2),e.fill(),e.restore()}function vp(e){const t=je;e.fillStyle="#c5ebed",e.beginPath(),e.moveTo(0,t),e.lineTo(0,t-45),e.lineTo(35,t-45),e.lineTo(45,t-70),e.lineTo(80,t-70),e.lineTo(95,t-50),e.lineTo(130,t-50),e.lineTo(145,t-85),e.lineTo(185,t-85),e.lineTo(200,t-40),e.lineTo(240,t-40),e.lineTo(255,t-65),e.lineTo(290,t-65),e.lineTo(310,t-45),e.lineTo(360,t-45),e.lineTo(360,t),e.closePath(),e.fill()}function yp(e,t){const n=je,r=mf;e.fillStyle="#ded895",e.fillRect(0,n,de,r),e.fillStyle="#cbb86b",e.fillRect(0,n+14,de,4),e.fillStyle="#73bf2e",e.fillRect(0,n,de,14),e.fillStyle="#9de64e",e.fillRect(0,n,de,3),e.fillStyle="#5ba820";const l=16,i=-(t%l+l);for(let o=i;o<de+l;o+=l)e.beginPath(),e.moveTo(o,n+14),e.lineTo(o+6,n),e.lineTo(o+10,n),e.lineTo(o+4,n+14),e.closePath(),e.fill();e.strokeStyle="#543847",e.lineWidth=2.5,e.beginPath(),e.moveTo(0,n),e.lineTo(de,n),e.stroke()}function gp(e,t){const{x:n,width:r,topHeight:l,gap:i}=t,o=24,u=3,s="#73bf2e",f="#9de64e",m="#558022",h="#2b440f";e.fillStyle=s,e.fillRect(n,0,r,l),e.fillStyle=f,e.fillRect(n+4,0,5,l),e.fillStyle=m,e.fillRect(n+r-9,0,7,l),e.strokeStyle=h,e.lineWidth=2,e.strokeRect(n,-2,r,l+2);const p=l-o;e.fillStyle=s,e.fillRect(n-u,p,r+u*2,o),e.fillStyle=f,e.fillRect(n-u+4,p,6,o),e.fillStyle=m,e.fillRect(n+r+u-10,p,8,o),e.strokeStyle=h,e.strokeRect(n-u,p,r+u*2,o);const w=l+i,S=Math.max(0,je-w);e.fillStyle=s,e.fillRect(n,w,r,S),e.fillStyle=f,e.fillRect(n+4,w,5,S),e.fillStyle=m,e.fillRect(n+r-9,w,7,S),e.strokeStyle=h,e.strokeRect(n,w,r,S),e.fillStyle=s,e.fillRect(n-u,w,r+u*2,o),e.fillStyle=f,e.fillRect(n-u+4,w,6,o),e.fillStyle=m,e.fillRect(n+r+u-10,w,8,o),e.strokeStyle=h,e.strokeRect(n-u,w,r+u*2,o)}function wp(e,t){e.save();const n=t.x+t.width/2,r=t.y+t.height/2;e.translate(n,r),e.rotate(t.rotation);const l=t.width,i=t.height;e.beginPath(),e.ellipse(0,0,l/2,i/2,0,0,Math.PI*2),e.fillStyle="#f8d030",e.fill(),e.lineWidth=2,e.strokeStyle="#543847",e.stroke(),e.beginPath(),e.ellipse(-2,3,l/2-4,i/2-5,0,0,Math.PI*2),e.fillStyle="#fbe87b",e.fill();const o=Math.sin(t.wingPhase)*6;e.beginPath(),e.ellipse(-6,o,8,5,-.2,0,Math.PI*2),e.fillStyle="#f4bc1c",e.fill(),e.strokeStyle="#543847",e.lineWidth=1.8,e.stroke();const u=6,s=-4;e.beginPath(),e.arc(u,s,5.5,0,Math.PI*2),e.fillStyle="#ffffff",e.fill(),e.strokeStyle="#543847",e.lineWidth=1.8,e.stroke(),e.beginPath(),e.arc(u+1.5,s,2.5,0,Math.PI*2),e.fillStyle="#000000",e.fill(),e.beginPath(),e.arc(u+2,s-1,1,0,Math.PI*2),e.fillStyle="#ffffff",e.fill(),e.beginPath(),e.moveTo(l/2-2,-1),e.lineTo(l/2+8,2),e.lineTo(l/2-2,5),e.closePath(),e.fillStyle="#f75c2f",e.fill(),e.strokeStyle="#543847",e.lineWidth=1.8,e.stroke(),e.beginPath(),e.arc(2,4,3,0,Math.PI*2),e.fillStyle="rgba(247, 92, 47, 0.4)",e.fill(),e.restore()}function Sp(e,t){const n=t.toString();e.save(),e.font='900 42px "Impact", "Arial Black", sans-serif',e.textAlign="center",e.textBaseline="top",e.lineWidth=6,e.strokeStyle="#000000",e.strokeText(n,de/2,45),e.fillStyle="#ffffff",e.fillText(n,de/2,45),e.restore()}function kp(e,t){if(!e)return;const{bird:n,pipeManager:r,score:l,status:i,groundOffset:o,cloudOffset:u=0}=t;e.clearRect(0,0,de,Ho);const s=e.createLinearGradient(0,0,0,je);s.addColorStop(0,"#4ec0ca"),s.addColorStop(.75,"#76d6dd"),s.addColorStop(1,"#a4e8ee"),e.fillStyle=s,e.fillRect(0,0,de,je),hp.forEach(f=>{const m=(f.x-u*.2)%(de+80),h=m<-50?m+de+100:m;mp(e,h,f.y,f.scale)}),vp(e),r&&r.pipes&&r.pipes.forEach(f=>gp(e,f)),yp(e,o||0),n&&wp(e,n),i==="playing"&&Sp(e,l)}let wf=0;function Sf(){try{if(typeof window>"u"||!window.localStorage)return!1;const e="__storage_test__";return window.localStorage.setItem(e,"1"),window.localStorage.removeItem(e),!0}catch{return!1}}function kf(){if(Sf())try{const e=window.localStorage.getItem(gf);if(e!==null){const t=parseInt(e,10);if(!isNaN(t)&&t>=0)return t}}catch{}return wf}function es(e){const t=typeof e=="number"&&!isNaN(e)?Math.max(0,Math.floor(e)):0,n=kf();if(t>n){if(Sf())try{window.localStorage.setItem(gf,t.toString())}catch{}return wf=t,t}return n}class Ep{constructor(t,n={}){this.canvas=t,this.ctx=t&&typeof t.getContext=="function"?t.getContext("2d"):null,this.onStateChange=n.onStateChange||(()=>{}),this.onScore=n.onScore||(()=>{}),this.onGameOver=n.onGameOver||(()=>{}),this.animationFrameId=null,this.lastTime=null,this.isRunning=!1,this.highScore=kf(),this.isNewHighScore=!1,this.init()}init(){this.status=Z.IDLE,this.score=0,this.isNewHighScore=!1,this.bird=op(),this.pipeManager=up(),this.groundOffset=0,this.cloudOffset=0,this.notifyState()}notifyState(){this.onStateChange({status:this.status,score:this.score,highScore:this.highScore,isNewHighScore:this.isNewHighScore})}start(){this.status===Z.IDLE&&(this.status=Z.PLAYING,qu(this.bird),this.notifyState())}flap(){this.status===Z.IDLE?this.start():this.status===Z.PLAYING&&qu(this.bird)}restart(){this.init(),this.render()}update(t){const n=Math.min(Math.max(0,t),.1);if(this.status===Z.IDLE){Xl(this.bird,n,Z.IDLE),this.groundOffset+=Vi*n*.7,this.cloudOffset+=15*n;return}if(this.status===Z.PLAYING){Xl(this.bird,n,Z.PLAYING);const{pointsAwarded:r}=ap(this.pipeManager,n,this.bird.x);r>0&&(this.score+=r,this.score>this.highScore&&(this.highScore=this.score,this.isNewHighScore=!0,es(this.highScore)),this.onScore(this.score),this.notifyState()),this.groundOffset+=Vi*n,this.cloudOffset+=20*n,pp(this.bird,this.pipeManager.pipes).collided&&this.handleGameOver();return}this.status===Z.GAME_OVER&&Xl(this.bird,n,Z.GAME_OVER)}handleGameOver(){this.status=Z.GAME_OVER;const t=this.highScore;this.score>t&&(this.isNewHighScore=!0);const n=es(this.score);this.highScore=n,this.notifyState(),this.onGameOver(this.score,this.highScore,this.isNewHighScore)}render(){this.ctx&&kp(this.ctx,{bird:this.bird,pipeManager:this.pipeManager,score:this.score,status:this.status,groundOffset:this.groundOffset,cloudOffset:this.cloudOffset})}loop(t){if(!this.isRunning)return;this.lastTime===null&&(this.lastTime=t);const n=(t-this.lastTime)/1e3;this.lastTime=t,this.update(n),this.render(),this.animationFrameId=requestAnimationFrame(r=>this.loop(r))}startLoop(){this.stopLoop(),this.isRunning=!0,this.lastTime=null,this.animationFrameId=requestAnimationFrame(t=>this.loop(t))}stopLoop(){this.isRunning=!1,this.animationFrameId!==null&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null),this.lastTime=null}destroy(){this.stopLoop(),this.canvas=null,this.ctx=null}}function _p({onEngineReady:e}={}){const t=fe.useRef(null),n=fe.useRef(null),r=fe.useRef(null),[l,i]=fe.useState({status:Z.IDLE,score:0,highScore:0,isNewHighScore:!1}),[o,u]=fe.useState(""),s=fe.useCallback(v=>{i(L=>({...L,...v}))},[]),f=fe.useCallback(v=>{},[]),m=fe.useCallback((v,L,c)=>{u(c?`Kỷ lục mới! Bạn đạt ${v} điểm. Điểm cao nhất hiện tại: ${L}.`:`Trò chơi kết thúc! Bạn đạt ${v} điểm. Điểm cao nhất: ${L}.`)},[]);fe.useEffect(()=>{const v=t.current;if(!v)return;const L=new Ep(v,{onStateChange:s,onScore:f,onGameOver:m});return n.current=L,typeof e=="function"&&e(L),L.startLoop(),()=>{L.destroy(),n.current=null}},[s,f,m]);const h=fe.useCallback(()=>{if(!n.current)return;const v=n.current.status;v===Z.IDLE?(u("Trò chơi bắt đầu. Chúc bạn bay may mắn!"),n.current.start()):v===Z.PLAYING&&n.current.flap()},[]);fe.useEffect(()=>{const v=L=>{if(L.code==="Space"||L.key===" "){if(L.repeat)return;L.preventDefault(),n.current&&n.current.status===Z.GAME_OVER?w():h()}};return window.addEventListener("keydown",v,{passive:!1}),()=>{window.removeEventListener("keydown",v)}},[h]);const p=v=>{v.target.tagName!=="BUTTON"&&(v.preventDefault(),h())},w=v=>{v&&(v.stopPropagation(),v.preventDefault()),n.current&&(n.current.restart(),u("Đã khởi động lại trò chơi."))},S=v=>{v&&(v.stopPropagation(),v.preventDefault()),h()};return R.jsxs("div",{className:"flappy-game-wrapper",children:[R.jsx("div",{className:"flappy-screen-reader-announcer","aria-live":"polite",role:"status",children:o}),R.jsxs("div",{ref:r,className:"flappy-game-stage",onPointerDown:p,role:"region","aria-label":"Khu vực chơi game Flappy Bird",tabIndex:0,children:[R.jsx("canvas",{ref:t,className:"flappy-canvas",width:de,height:Ho,"aria-hidden":"true"}),l.status===Z.IDLE&&R.jsxs("div",{className:"flappy-overlay","data-testid":"start-screen",children:[R.jsx("h1",{className:"flappy-title-main",children:"FLAPPY BIRD"}),R.jsxs("div",{className:"flappy-card",children:[R.jsx("p",{className:"flappy-instruction-text",children:"Điều khiển chú chim bay qua khoảng trống giữa các cặp ống. Mỗi cặp ống vượt qua nhận 1 điểm!"}),R.jsxs("div",{className:"flappy-controls-badge",children:[R.jsx("span",{className:"flappy-key-chip",children:"Phím Space"}),R.jsx("span",{className:"flappy-key-chip",children:"Click"}),R.jsx("span",{className:"flappy-key-chip",children:"Chạm màn hình"})]}),R.jsxs("div",{className:"flappy-score-row",children:[R.jsx("span",{children:"Điểm cao nhất:"}),R.jsx("span",{className:"flappy-score-value","data-testid":"idle-highscore",children:l.highScore})]})]}),R.jsx("button",{className:"flappy-btn",onClick:S,"aria-label":"Bắt đầu chơi Flappy Bird","data-testid":"start-button",type:"button",children:"Bắt đầu chơi"}),R.jsxs("div",{className:"flappy-tap-hint",children:["Hoặc nhấn ",R.jsx("strong",{children:"Space"})," / ",R.jsx("strong",{children:"Chạm màn hình"})," để bay ngay"]})]}),l.status===Z.GAME_OVER&&R.jsxs("div",{className:"flappy-overlay","data-testid":"game-over-screen",children:[R.jsx("h2",{className:"flappy-title-gameover",children:"GAME OVER"}),R.jsxs("div",{className:"flappy-card",children:[R.jsxs("div",{className:"flappy-score-row",children:[R.jsx("span",{children:"Điểm của bạn:"}),R.jsx("span",{className:"flappy-score-value","data-testid":"final-score",children:l.score})]}),R.jsxs("div",{className:"flappy-score-row",children:[R.jsx("span",{children:"Điểm cao nhất:"}),R.jsx("span",{className:"flappy-score-value","data-testid":"best-score",children:l.highScore})]}),l.isNewHighScore&&R.jsx("div",{children:R.jsx("span",{className:"flappy-new-record","data-testid":"new-record-badge",children:"★ KỶ LỤC MỚI! ★"})})]}),R.jsx("button",{className:"flappy-btn",onClick:w,"aria-label":"Chơi lại ván mới","data-testid":"restart-button",type:"button",autoFocus:!0,children:"Chơi lại"}),R.jsxs("div",{className:"flappy-tap-hint",children:["Hoặc nhấn ",R.jsx("strong",{children:"Space"})," để chơi lại"]})]})]}),R.jsx("div",{className:"flappy-footer-info",children:"Flappy Bird Web Edition • Sử dụng Space, Chuột hoặc Màn hình cảm ứng"})]})}function Cp(){return R.jsx("main",{children:R.jsx(_p,{})})}const ts=document.getElementById("root");ts&&Zl.createRoot(ts).render(R.jsx(Uf.StrictMode,{children:R.jsx(Cp,{})}));
diff --git a/dist/index.html b/dist/index.html
new file mode 100644
index 0000000..6f434b8
--- /dev/null
+++ b/dist/index.html
@@ -0,0 +1,13 @@
+<!DOCTYPE html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
+    <title>Flappy Bird</title>
+    <script type="module" crossorigin src="/assets/index-CY9c4M8Y.js"></script>
+    <link rel="stylesheet" crossorigin href="/assets/index-CQ1-m7K_.css">
+  </head>
+  <body>
+    <div id="root"></div>
+  </body>
+</html>
diff --git a/index.html b/index.html
index da9310d..bc60b08 100644
--- a/index.html
+++ b/index.html
@@ -2,8 +2,8 @@
 <html lang="en">
   <head>
     <meta charset="UTF-8" />
-    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <title>autonomous-app</title>
+    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
+    <title>Flappy Bird</title>
   </head>
   <body>
     <div id="root"></div>
diff --git a/src/App.jsx b/src/App.jsx
new file mode 100644
index 0000000..527c9d8
--- /dev/null
+++ b/src/App.jsx
@@ -0,0 +1,13 @@
+import React from 'react';
+import FlappyBirdGame from './components/FlappyBirdGame.jsx';
+import './styles/index.css';
+
+export function App() {
+  return (
+    <main>
+      <FlappyBirdGame />
+    </main>
+  );
+}
+
+export default App;
diff --git a/src/components/FlappyBirdGame.jsx b/src/components/FlappyBirdGame.jsx
new file mode 100644
index 0000000..797d955
--- /dev/null
+++ b/src/components/FlappyBirdGame.jsx
@@ -0,0 +1,256 @@
+import React, { useEffect, useRef, useState, useCallback } from 'react';
+import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_STATUS } from '../game/constants.js';
+import { GameEngine } from '../game/game-engine.js';
+import '../styles/flappy-bird.css';
+
+export function FlappyBirdGame({ onEngineReady } = {}) {
+  const canvasRef = useRef(null);
+  const engineRef = useRef(null);
+  const stageRef = useRef(null);
+
+  const [gameState, setGameState] = useState({
+    status: GAME_STATUS.IDLE,
+    score: 0,
+    highScore: 0,
+    isNewHighScore: false,
+  });
+
+  const [announcement, setAnnouncement] = useState('');
+
+  // Handle game state changes from engine
+  const handleStateChange = useCallback((state) => {
+    setGameState((prev) => ({
+      ...prev,
+      ...state,
+    }));
+  }, []);
+
+  const handleScore = useCallback((newScore) => {
+    // Score update
+  }, []);
+
+  const handleGameOver = useCallback((finalScore, bestScore, isNew) => {
+    if (isNew) {
+      setAnnouncement(
+        `Kỷ lục mới! Bạn đạt ${finalScore} điểm. Điểm cao nhất hiện tại: ${bestScore}.`
+      );
+    } else {
+      setAnnouncement(
+        `Trò chơi kết thúc! Bạn đạt ${finalScore} điểm. Điểm cao nhất: ${bestScore}.`
+      );
+    }
+  }, []);
+
+  // Initialize engine on mount
+  useEffect(() => {
+    const canvas = canvasRef.current;
+    if (!canvas) return;
+
+    const engine = new GameEngine(canvas, {
+      onStateChange: handleStateChange,
+      onScore: handleScore,
+      onGameOver: handleGameOver,
+    });
+
+    engineRef.current = engine;
+    if (typeof onEngineReady === 'function') {
+      onEngineReady(engine);
+    }
+    engine.startLoop();
+
+    return () => {
+      engine.destroy();
+      engineRef.current = null;
+    };
+  }, [handleStateChange, handleScore, handleGameOver]);
+
+  // Unified flap action
+  const triggerFlap = useCallback(() => {
+    if (!engineRef.current) return;
+    const currentStatus = engineRef.current.status;
+
+    if (currentStatus === GAME_STATUS.IDLE) {
+      setAnnouncement('Trò chơi bắt đầu. Chúc bạn bay may mắn!');
+      engineRef.current.start();
+    } else if (currentStatus === GAME_STATUS.PLAYING) {
+      engineRef.current.flap();
+    }
+  }, []);
+
+  // Keyboard handler for Spacebar
+  useEffect(() => {
+    const handleKeyDown = (e) => {
+      // Space key triggers flap
+      if (e.code === 'Space' || e.key === ' ') {
+        // Prevent continuous flapping on key hold
+        if (e.repeat) return;
+
+        // Prevent page scrolling on Space
+        e.preventDefault();
+
+        // If game over, pressing Space restarts cleanly
+        if (engineRef.current && engineRef.current.status === GAME_STATUS.GAME_OVER) {
+          handleRestart();
+        } else {
+          triggerFlap();
+        }
+      }
+    };
+
+    window.addEventListener('keydown', handleKeyDown, { passive: false });
+    return () => {
+      window.removeEventListener('keydown', handleKeyDown);
+    };
+  }, [triggerFlap]);
+
+  // Handle stage click / pointerdown
+  const handleStagePointerDown = (e) => {
+    // Only flap if click was on the stage, not an interactive button
+    if (e.target.tagName === 'BUTTON') return;
+    e.preventDefault();
+    triggerFlap();
+  };
+
+  // Handle Restart
+  const handleRestart = (e) => {
+    if (e) {
+      e.stopPropagation();
+      e.preventDefault();
+    }
+    if (engineRef.current) {
+      engineRef.current.restart();
+      setAnnouncement('Đã khởi động lại trò chơi.');
+    }
+  };
+
+  // Handle Start from Button
+  const handleStartButton = (e) => {
+    if (e) {
+      e.stopPropagation();
+      e.preventDefault();
+    }
+    triggerFlap();
+  };
+
+  return (
+    <div className="flappy-game-wrapper">
+      {/* Screen Reader Live Region for Accessibility */}
+      <div
+        className="flappy-screen-reader-announcer"
+        aria-live="polite"
+        role="status"
+      >
+        {announcement}
+      </div>
+
+      {/* Main Game Stage */}
+      <div
+        ref={stageRef}
+        className="flappy-game-stage"
+        onPointerDown={handleStagePointerDown}
+        role="region"
+        aria-label="Khu vực chơi game Flappy Bird"
+        tabIndex={0}
+      >
+        <canvas
+          ref={canvasRef}
+          className="flappy-canvas"
+          width={CANVAS_WIDTH}
+          height={CANVAS_HEIGHT}
+          aria-hidden="true"
+        />
+
+        {/* Start / Idle Screen Overlay */}
+        {gameState.status === GAME_STATUS.IDLE && (
+          <div className="flappy-overlay" data-testid="start-screen">
+            <h1 className="flappy-title-main">FLAPPY BIRD</h1>
+
+            <div className="flappy-card">
+              <p className="flappy-instruction-text">
+                Điều khiển chú chim bay qua khoảng trống giữa các cặp ống. Mỗi cặp ống vượt qua nhận 1 điểm!
+              </p>
+
+              <div className="flappy-controls-badge">
+                <span className="flappy-key-chip">Phím Space</span>
+                <span className="flappy-key-chip">Click</span>
+                <span className="flappy-key-chip">Chạm màn hình</span>
+              </div>
+
+              <div className="flappy-score-row">
+                <span>Điểm cao nhất:</span>
+                <span className="flappy-score-value" data-testid="idle-highscore">
+                  {gameState.highScore}
+                </span>
+              </div>
+            </div>
+
+            <button
+              className="flappy-btn"
+              onClick={handleStartButton}
+              aria-label="Bắt đầu chơi Flappy Bird"
+              data-testid="start-button"
+              type="button"
+            >
+              Bắt đầu chơi
+            </button>
+
+            <div className="flappy-tap-hint">
+              Hoặc nhấn <strong>Space</strong> / <strong>Chạm màn hình</strong> để bay ngay
+            </div>
+          </div>
+        )}
+
+        {/* Game Over Screen Overlay */}
+        {gameState.status === GAME_STATUS.GAME_OVER && (
+          <div className="flappy-overlay" data-testid="game-over-screen">
+            <h2 className="flappy-title-gameover">GAME OVER</h2>
+
+            <div className="flappy-card">
+              <div className="flappy-score-row">
+                <span>Điểm của bạn:</span>
+                <span className="flappy-score-value" data-testid="final-score">
+                  {gameState.score}
+                </span>
+              </div>
+
+              <div className="flappy-score-row">
+                <span>Điểm cao nhất:</span>
+                <span className="flappy-score-value" data-testid="best-score">
+                  {gameState.highScore}
+                </span>
+              </div>
+
+              {gameState.isNewHighScore && (
+                <div>
+                  <span className="flappy-new-record" data-testid="new-record-badge">
+                    ★ KỶ LỤC MỚI! ★
+                  </span>
+                </div>
+              )}
+            </div>
+
+            <button
+              className="flappy-btn"
+              onClick={handleRestart}
+              aria-label="Chơi lại ván mới"
+              data-testid="restart-button"
+              type="button"
+              autoFocus
+            >
+              Chơi lại
+            </button>
+
+            <div className="flappy-tap-hint">
+              Hoặc nhấn <strong>Space</strong> để chơi lại
+            </div>
+          </div>
+        )}
+      </div>
+
+      <div className="flappy-footer-info">
+        Flappy Bird Web Edition • Sử dụng Space, Chuột hoặc Màn hình cảm ứng
+      </div>
+    </div>
+  );
+}
+export default FlappyBirdGame;
diff --git a/src/game/collision.js b/src/game/collision.js
new file mode 100644
index 0000000..a93ce5a
--- /dev/null
+++ b/src/game/collision.js
@@ -0,0 +1,97 @@
+import {
+  PLAYABLE_HEIGHT,
+  BIRD_HITBOX_PADDING,
+} from './constants.js';
+
+/**
+ * Computes the effective collision hitbox for the bird with safety insets
+ */
+export function getBirdHitbox(bird) {
+  const padding = BIRD_HITBOX_PADDING;
+  return {
+    x: bird.x + padding.left,
+    y: bird.y + padding.top,
+    width: Math.max(1, bird.width - (padding.left + padding.right)),
+    height: Math.max(1, bird.height - (padding.top + padding.bottom)),
+  };
+}
+
+/**
+ * Checks whether two 2D axis-aligned bounding boxes intersect
+ */
+export function rectsIntersect(r1, r2) {
+  return (
+    r1.x < r2.x + r2.width &&
+    r1.x + r1.width > r2.x &&
+    r1.y < r2.y + r2.height &&
+    r1.y + r1.height > r2.y
+  );
+}
+
+/**
+ * Checks if the bird has collided with the ground (bottom boundary of playable area)
+ */
+export function checkGroundCollision(bird) {
+  const hitbox = getBirdHitbox(bird);
+  return hitbox.y + hitbox.height >= PLAYABLE_HEIGHT;
+}
+
+/**
+ * Checks if the bird has collided with the ceiling (top boundary of canvas)
+ */
+export function checkCeilingCollision(bird) {
+  const hitbox = getBirdHitbox(bird);
+  return hitbox.y <= 0;
+}
+
+/**
+ * Checks if the bird collides with a single pipe pair (top pipe or bottom pipe)
+ */
+export function checkPipeCollision(bird, pipe) {
+  const birdBox = getBirdHitbox(bird);
+
+  // Top pipe rectangle: from y = 0 to y = pipe.topHeight
+  const topPipeRect = {
+    x: pipe.x,
+    y: 0,
+    width: pipe.width,
+    height: pipe.topHeight,
+  };
+
+  if (rectsIntersect(birdBox, topPipeRect)) {
+    return true;
+  }
+
+  // Bottom pipe rectangle: from y = pipe.topHeight + pipe.gap to PLAYABLE_HEIGHT
+  const bottomPipeY = pipe.topHeight + pipe.gap;
+  const bottomPipeRect = {
+    x: pipe.x,
+    y: bottomPipeY,
+    width: pipe.width,
+    height: Math.max(0, PLAYABLE_HEIGHT - bottomPipeY),
+  };
+
+  return rectsIntersect(birdBox, bottomPipeRect);
+}
+
+/**
+ * Checks if bird collides with ceiling, ground, or any active pipes.
+ * Returns an object with collision status and details.
+ */
+export function checkAnyCollision(bird, pipes = []) {
+  if (checkGroundCollision(bird)) {
+    return { collided: true, reason: 'ground' };
+  }
+
+  if (checkCeilingCollision(bird)) {
+    return { collided: true, reason: 'ceiling' };
+  }
+
+  for (const pipe of pipes) {
+    if (checkPipeCollision(bird, pipe)) {
+      return { collided: true, reason: 'pipe', pipeId: pipe.id };
+    }
+  }
+
+  return { collided: false, reason: null };
+}
diff --git a/src/game/constants.js b/src/game/constants.js
new file mode 100644
index 0000000..1621b21
--- /dev/null
+++ b/src/game/constants.js
@@ -0,0 +1,36 @@
+export const CANVAS_WIDTH = 360;
+export const CANVAS_HEIGHT = 600;
+export const GROUND_HEIGHT = 80;
+export const PLAYABLE_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT; // 520
+
+export const GRAVITY = 980; // px/s^2
+export const FLAP_STRENGTH = -330; // px/s upward burst
+export const MAX_FALL_SPEED = 500; // px/s terminal velocity
+
+export const BIRD_WIDTH = 34;
+export const BIRD_HEIGHT = 24;
+export const BIRD_INITIAL_X = 80;
+export const BIRD_INITIAL_Y = 250;
+
+export const PIPE_WIDTH = 52;
+export const PIPE_GAP = 135;
+export const PIPE_SPEED = 140; // px/s
+export const PIPE_SPAWN_INTERVAL = 1.75; // seconds
+export const MIN_PIPE_HEIGHT = 60;
+export const MAX_PIPE_HEIGHT = PLAYABLE_HEIGHT - PIPE_GAP - MIN_PIPE_HEIGHT; // 325
+
+// Hitbox insets to ensure fair collision feel
+export const BIRD_HITBOX_PADDING = {
+  top: 3,
+  bottom: 3,
+  left: 4,
+  right: 4,
+};
+
+export const STORAGE_KEY = 'flappy_bird_high_score';
+
+export const GAME_STATUS = {
+  IDLE: 'idle',
+  PLAYING: 'playing',
+  GAME_OVER: 'gameOver',
+};
diff --git a/src/game/entities/bird.js b/src/game/entities/bird.js
new file mode 100644
index 0000000..6b54a4c
--- /dev/null
+++ b/src/game/entities/bird.js
@@ -0,0 +1,99 @@
+import {
+  BIRD_WIDTH,
+  BIRD_HEIGHT,
+  BIRD_INITIAL_X,
+  BIRD_INITIAL_Y,
+  GRAVITY,
+  FLAP_STRENGTH,
+  MAX_FALL_SPEED,
+  PLAYABLE_HEIGHT,
+} from '../constants.js';
+
+/**
+ * Creates a fresh bird instance
+ */
+export function createBird(initialX = BIRD_INITIAL_X, initialY = BIRD_INITIAL_Y) {
+  return {
+    x: initialX,
+    y: initialY,
+    width: BIRD_WIDTH,
+    height: BIRD_HEIGHT,
+    velocity: 0,
+    gravity: GRAVITY,
+    flapStrength: FLAP_STRENGTH,
+    rotation: 0, // In radians
+    wingPhase: 0, // For flapping animation
+    idleTimer: 0,
+  };
+}
+
+/**
+ * Applies an upward impulse to the bird
+ */
+export function flapBird(bird) {
+  bird.velocity = bird.flapStrength;
+}
+
+/**
+ * Updates bird physics and animation for one frame
+ * @param {Object} bird - Bird state
+ * @param {number} dt - Delta time in seconds
+ * @param {string} status - 'idle' | 'playing' | 'gameOver'
+ */
+export function updateBird(bird, dt, status = 'playing') {
+  if (status === 'idle') {
+    // Gentle sine wave bobbing in idle mode
+    bird.idleTimer += dt * 3.5;
+    bird.y = BIRD_INITIAL_Y + Math.sin(bird.idleTimer) * 7;
+    bird.velocity = 0;
+    bird.rotation = 0;
+    bird.wingPhase += dt * 8;
+    return;
+  }
+
+  if (status === 'playing') {
+    // Apply gravity
+    bird.velocity += bird.gravity * dt;
+    if (bird.velocity > MAX_FALL_SPEED) {
+      bird.velocity = MAX_FALL_SPEED;
+    }
+
+    bird.y += bird.velocity * dt;
+
+    // Wing flapping animation: faster when ascending or hovering
+    if (bird.velocity < 100) {
+      bird.wingPhase += dt * 12;
+    } else {
+      bird.wingPhase += dt * 3;
+    }
+
+    // Dynamic rotation based on velocity
+    if (bird.velocity < 0) {
+      // Tilting up (-25 degrees max)
+      const targetRotation = -0.45;
+      bird.rotation = Math.max(targetRotation, bird.rotation - dt * 6);
+    } else {
+      // Tilting down towards ground (+75 degrees max)
+      const targetRotation = 1.3;
+      bird.rotation = Math.min(targetRotation, bird.rotation + dt * 4.5);
+    }
+    return;
+  }
+
+  if (status === 'gameOver') {
+    // If not on ground, bird falls to the ground
+    if (bird.y + bird.height < PLAYABLE_HEIGHT) {
+      bird.velocity += bird.gravity * dt;
+      if (bird.velocity > MAX_FALL_SPEED) {
+        bird.velocity = MAX_FALL_SPEED;
+      }
+      bird.y += bird.velocity * dt;
+      if (bird.y + bird.height > PLAYABLE_HEIGHT) {
+        bird.y = PLAYABLE_HEIGHT - bird.height;
+        bird.velocity = 0;
+      }
+    }
+    // Point nose down quickly on death
+    bird.rotation = Math.min(1.4, bird.rotation + dt * 8);
+  }
+}
diff --git a/src/game/entities/pipe-manager.js b/src/game/entities/pipe-manager.js
new file mode 100644
index 0000000..b1e1425
--- /dev/null
+++ b/src/game/entities/pipe-manager.js
@@ -0,0 +1,90 @@
+import {
+  CANVAS_WIDTH,
+  PIPE_WIDTH,
+  PIPE_GAP,
+  PIPE_SPEED,
+  PIPE_SPAWN_INTERVAL,
+  MIN_PIPE_HEIGHT,
+  MAX_PIPE_HEIGHT,
+} from '../constants.js';
+
+/**
+ * Creates a new pipe manager instance
+ */
+export function createPipeManager() {
+  return {
+    pipes: [],
+    spawnTimer: 0,
+    spawnInterval: PIPE_SPAWN_INTERVAL,
+    speed: PIPE_SPEED,
+    nextId: 1,
+  };
+}
+
+/**
+ * Creates and spawns a single pipe pair at the right edge of the screen
+ */
+export function spawnPipe(manager, customTopHeight = null) {
+  const topHeight =
+    customTopHeight !== null
+      ? customTopHeight
+      : Math.floor(
+          MIN_PIPE_HEIGHT + Math.random() * (MAX_PIPE_HEIGHT - MIN_PIPE_HEIGHT)
+        );
+
+  const pipe = {
+    id: manager.nextId++,
+    x: CANVAS_WIDTH,
+    width: PIPE_WIDTH,
+    topHeight,
+    gap: PIPE_GAP,
+    passed: false,
+  };
+
+  manager.pipes.push(pipe);
+  return pipe;
+}
+
+/**
+ * Updates all pipes: moves them, spawns new ones, detects scoring, and prunes offscreen ones.
+ * @param {Object} manager - Pipe manager
+ * @param {number} dt - Delta time in seconds
+ * @param {number} birdX - Current bird horizontal position for scoring check
+ * @returns {{ pointsAwarded: number }}
+ */
+export function updatePipes(manager, dt, birdX) {
+  let pointsAwarded = 0;
+
+  // Advance spawn timer
+  manager.spawnTimer += dt;
+  if (manager.spawnTimer >= manager.spawnInterval) {
+    manager.spawnTimer -= manager.spawnInterval;
+    spawnPipe(manager);
+  }
+
+  // Move each pipe and check scoring
+  for (let i = 0; i < manager.pipes.length; i++) {
+    const pipe = manager.pipes[i];
+    pipe.x -= manager.speed * dt;
+
+    // Award point when the bird's left/center edge successfully clears the pipe's right edge
+    if (!pipe.passed && birdX > pipe.x + pipe.width) {
+      pipe.passed = true;
+      pointsAwarded += 1;
+    }
+  }
+
+  // Prune pipes that have fully moved past the left screen edge
+  manager.pipes = manager.pipes.filter((pipe) => pipe.x + pipe.width > 0);
+
+  return { pointsAwarded };
+}
+
+/**
+ * Clears all active pipes and resets timers
+ */
+export function resetPipes(manager) {
+  manager.pipes = [];
+  manager.spawnTimer = 0;
+  manager.nextId = 1;
+}
diff --git a/src/game/game-engine.js b/src/game/game-engine.js
new file mode 100644
index 0000000..14cb750
--- /dev/null
+++ b/src/game/game-engine.js
@@ -0,0 +1,186 @@
+import {
+  PIPE_SPEED,
+  GAME_STATUS,
+} from './constants.js';
+import { createBird, flapBird, updateBird } from './entities/bird.js';
+import {
+  createPipeManager,
+  updatePipes,
+  resetPipes,
+} from './entities/pipe-manager.js';
+import { checkAnyCollision } from './collision.js';
+import { renderGame } from './renderer.js';
+import { getHighScore, saveHighScore } from './storage.js';
+
+export class GameEngine {
+  constructor(canvas, callbacks = {}) {
+    this.canvas = canvas;
+    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
+
+    this.onStateChange = callbacks.onStateChange || (() => {});
+    this.onScore = callbacks.onScore || (() => {});
+    this.onGameOver = callbacks.onGameOver || (() => {});
+
+    this.animationFrameId = null;
+    this.lastTime = null;
+    this.isRunning = false;
+
+    this.highScore = getHighScore();
+    this.isNewHighScore = false;
+    this.init();
+  }
+
+  init() {
+    this.status = GAME_STATUS.IDLE;
+    this.score = 0;
+    this.isNewHighScore = false;
+    this.bird = createBird();
+    this.pipeManager = createPipeManager();
+    this.groundOffset = 0;
+    this.cloudOffset = 0;
+    this.notifyState();
+  }
+
+  notifyState() {
+    this.onStateChange({
+      status: this.status,
+      score: this.score,
+      highScore: this.highScore,
+      isNewHighScore: this.isNewHighScore,
+    });
+  }
+
+  start() {
+    if (this.status === GAME_STATUS.IDLE) {
+      this.status = GAME_STATUS.PLAYING;
+      flapBird(this.bird);
+      this.notifyState();
+    }
+  }
+
+  flap() {
+    if (this.status === GAME_STATUS.IDLE) {
+      this.start();
+    } else if (this.status === GAME_STATUS.PLAYING) {
+      flapBird(this.bird);
+    }
+    // If gameOver, flap is disabled until restart() is called
+  }
+
+  restart() {
+    this.init();
+    this.render();
+  }
+
+  update(dt) {
+    // Cap dt to 0.1s to prevent position teleports when switching tabs
+    const clampedDt = Math.min(Math.max(0, dt), 0.1);
+
+    if (this.status === GAME_STATUS.IDLE) {
+      updateBird(this.bird, clampedDt, GAME_STATUS.IDLE);
+      this.groundOffset += PIPE_SPEED * clampedDt * 0.7;
+      this.cloudOffset += 15 * clampedDt;
+      return;
+    }
+
+    if (this.status === GAME_STATUS.PLAYING) {
+      // 1. Update bird
+      updateBird(this.bird, clampedDt, GAME_STATUS.PLAYING);
+
+      // 2. Update pipes and check scoring
+      const { pointsAwarded } = updatePipes(
+        this.pipeManager,
+        clampedDt,
+        this.bird.x
+      );
+
+      if (pointsAwarded > 0) {
+        this.score += pointsAwarded;
+        if (this.score > this.highScore) {
+          this.highScore = this.score;
+          this.isNewHighScore = true;
+          saveHighScore(this.highScore);
+        }
+        this.onScore(this.score);
+        this.notifyState();
+      }
+
+      // 3. Move backgrounds
+      this.groundOffset += PIPE_SPEED * clampedDt;
+      this.cloudOffset += 20 * clampedDt;
+
+      // 4. Check collisions
+      const collision = checkAnyCollision(this.bird, this.pipeManager.pipes);
+      if (collision.collided) {
+        this.handleGameOver();
+      }
+      return;
+    }
+
+    if (this.status === GAME_STATUS.GAME_OVER) {
+      updateBird(this.bird, clampedDt, GAME_STATUS.GAME_OVER);
+    }
+  }
+
+  handleGameOver() {
+    this.status = GAME_STATUS.GAME_OVER;
+    const previousBest = this.highScore;
+    if (this.score > previousBest) {
+      this.isNewHighScore = true;
+    }
+    const currentBest = saveHighScore(this.score);
+    this.highScore = currentBest;
+    this.notifyState();
+    this.onGameOver(this.score, this.highScore, this.isNewHighScore);
+  }
+
+  render() {
+    if (!this.ctx) return;
+    renderGame(this.ctx, {
+      bird: this.bird,
+      pipeManager: this.pipeManager,
+      score: this.score,
+      status: this.status,
+      groundOffset: this.groundOffset,
+      cloudOffset: this.cloudOffset,
+    });
+  }
+
+  loop(currentTime) {
+    if (!this.isRunning) return;
+
+    if (this.lastTime === null) {
+      this.lastTime = currentTime;
+    }
+
+    const dt = (currentTime - this.lastTime) / 1000;
+    this.lastTime = currentTime;
+
+    this.update(dt);
+    this.render();
+
+    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
+  }
+
+  startLoop() {
+    this.stopLoop();
+    this.isRunning = true;
+    this.lastTime = null;
+    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
+  }
+
+  stopLoop() {
+    this.isRunning = false;
+    if (this.animationFrameId !== null) {
+      cancelAnimationFrame(this.animationFrameId);
+      this.animationFrameId = null;
+    }
+    this.lastTime = null;
+  }
+
+  destroy() {
+    this.stopLoop();
+    this.canvas = null;
+    this.ctx = null;
+  }
+}
diff --git a/src/game/renderer.js b/src/game/renderer.js
new file mode 100644
index 0000000..fef60ff
--- /dev/null
+++ b/src/game/renderer.js
@@ -0,0 +1,342 @@
+import {
+  CANVAS_WIDTH,
+  CANVAS_HEIGHT,
+  GROUND_HEIGHT,
+  PLAYABLE_HEIGHT,
+} from './constants.js';
+
+/**
+ * Procedural background clouds definition
+ */
+const CLOUDS = [
+  { x: 40, y: 80, scale: 1.1 },
+  { x: 180, y: 120, scale: 0.8 },
+  { x: 300, y: 60, scale: 1.2 },
+];
+
+/**
+ * Draws a fluffy cloud
+ */
+function drawCloud(ctx, x, y, scale = 1) {
+  ctx.save();
+  ctx.translate(x, y);
+  ctx.scale(scale, scale);
+  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
+
+  ctx.beginPath();
+  ctx.arc(0, 0, 18, 0, Math.PI * 2);
+  ctx.arc(15, -6, 22, 0, Math.PI * 2);
+  ctx.arc(32, 0, 16, 0, Math.PI * 2);
+  ctx.arc(44, 4, 12, 0, Math.PI * 2);
+  ctx.fill();
+
+  ctx.restore();
+}
+
+/**
+ * Draws distant city / hill silhouettes
+ */
+function drawCityScape(ctx) {
+  const baseY = PLAYABLE_HEIGHT;
+  ctx.fillStyle = '#c5ebed';
+
+  // Soft distant silhouettes
+  ctx.beginPath();
+  ctx.moveTo(0, baseY);
+  ctx.lineTo(0, baseY - 45);
+  ctx.lineTo(35, baseY - 45);
+  ctx.lineTo(45, baseY - 70);
+  ctx.lineTo(80, baseY - 70);
+  ctx.lineTo(95, baseY - 50);
+  ctx.lineTo(130, baseY - 50);
+  ctx.lineTo(145, baseY - 85);
+  ctx.lineTo(185, baseY - 85);
+  ctx.lineTo(200, baseY - 40);
+  ctx.lineTo(240, baseY - 40);
+  ctx.lineTo(255, baseY - 65);
+  ctx.lineTo(290, baseY - 65);
+  ctx.lineTo(310, baseY - 45);
+  ctx.lineTo(360, baseY - 45);
+  ctx.lineTo(360, baseY);
+  ctx.closePath();
+  ctx.fill();
+}
+
+/**
+ * Draws the scrolling ground with grass and dirt pattern
+ */
+function drawGround(ctx, groundOffset) {
+  const groundY = PLAYABLE_HEIGHT;
+  const groundHeight = GROUND_HEIGHT;
+
+  // Dirt base
+  ctx.fillStyle = '#ded895';
+  ctx.fillRect(0, groundY, CANVAS_WIDTH, groundHeight);
+
+  // Dark line separating grass from dirt
+  ctx.fillStyle = '#cbb86b';
+  ctx.fillRect(0, groundY + 14, CANVAS_WIDTH, 4);
+
+  // Grass top band
+  ctx.fillStyle = '#73bf2e';
+  ctx.fillRect(0, groundY, CANVAS_WIDTH, 14);
+
+  // Grass highlight top border
+  ctx.fillStyle = '#9de64e';
+  ctx.fillRect(0, groundY, CANVAS_WIDTH, 3);
+
+  // Moving grass stripes for speed illusion
+  ctx.fillStyle = '#5ba820';
+  const stripeSpacing = 16;
+  const startX = -((groundOffset % stripeSpacing) + stripeSpacing);
+
+  for (let x = startX; x < CANVAS_WIDTH + stripeSpacing; x += stripeSpacing) {
+    ctx.beginPath();
+    ctx.moveTo(x, groundY + 14);
+    ctx.lineTo(x + 6, groundY);
+    ctx.lineTo(x + 10, groundY);
+    ctx.lineTo(x + 4, groundY + 14);
+    ctx.closePath();
+    ctx.fill();
+  }
+
+  // Ground border line
+  ctx.strokeStyle = '#543847';
+  ctx.lineWidth = 2.5;
+  ctx.beginPath();
+  ctx.moveTo(0, groundY);
+  ctx.lineTo(CANVAS_WIDTH, groundY);
+  ctx.stroke();
+}
+
+/**
+ * Draws a single pipe pair (top and bottom with 3D-effect collars and highlight stripes)
+ */
+function drawPipePair(ctx, pipe) {
+  const { x, width, topHeight, gap } = pipe;
+  const collarHeight = 24;
+  const collarLip = 3; // protruding on left & right
+
+  const pipeGreen = '#73bf2e';
+  const pipeHighlight = '#9de64e';
+  const pipeShadow = '#558022';
+  const pipeOutline = '#2b440f';
+
+  // --- TOP PIPE ---
+  // Pipe body
+  ctx.fillStyle = pipeGreen;
+  ctx.fillRect(x, 0, width, topHeight);
+
+  // Highlight stripe (left)
+  ctx.fillStyle = pipeHighlight;
+  ctx.fillRect(x + 4, 0, 5, topHeight);
+
+  // Shadow stripe (right)
+  ctx.fillStyle = pipeShadow;
+  ctx.fillRect(x + width - 9, 0, 7, topHeight);
+
+  // Top pipe outline
+  ctx.strokeStyle = pipeOutline;
+  ctx.lineWidth = 2;
+  ctx.strokeRect(x, -2, width, topHeight + 2);
+
+  // Top pipe collar (at the bottom of top pipe)
+  const topCollarY = topHeight - collarHeight;
+  ctx.fillStyle = pipeGreen;
+  ctx.fillRect(x - collarLip, topCollarY, width + collarLip * 2, collarHeight);
+
+  ctx.fillStyle = pipeHighlight;
+  ctx.fillRect(x - collarLip + 4, topCollarY, 6, collarHeight);
+
+  ctx.fillStyle = pipeShadow;
+  ctx.fillRect(x + width + collarLip - 10, topCollarY, 8, collarHeight);
+
+  ctx.strokeStyle = pipeOutline;
+  ctx.strokeRect(x - collarLip, topCollarY, width + collarLip * 2, collarHeight);
+
+  // --- BOTTOM PIPE ---
+  const bottomPipeY = topHeight + gap;
+  const bottomPipeHeight = Math.max(0, PLAYABLE_HEIGHT - bottomPipeY);
+
+  // Bottom pipe body
+  ctx.fillStyle = pipeGreen;
+  ctx.fillRect(x, bottomPipeY, width, bottomPipeHeight);
+
+  // Highlight stripe
+  ctx.fillStyle = pipeHighlight;
+  ctx.fillRect(x + 4, bottomPipeY, 5, bottomPipeHeight);
+
+  // Shadow stripe
+  ctx.fillStyle = pipeShadow;
+  ctx.fillRect(x + width - 9, bottomPipeY, 7, bottomPipeHeight);
+
+  // Outline
+  ctx.strokeStyle = pipeOutline;
+  ctx.strokeRect(x, bottomPipeY, width, bottomPipeHeight);
+
+  // Bottom pipe collar (at the top of bottom pipe)
+  ctx.fillStyle = pipeGreen;
+  ctx.fillRect(x - collarLip, bottomPipeY, width + collarLip * 2, collarHeight);
+
+  ctx.fillStyle = pipeHighlight;
+  ctx.fillRect(x - collarLip + 4, bottomPipeY, 6, collarHeight);
+
+  ctx.fillStyle = pipeShadow;
+  ctx.fillRect(x + width + collarLip - 10, bottomPipeY, 8, collarHeight);
+
+  ctx.strokeStyle = pipeOutline;
+  ctx.strokeRect(x - collarLip, bottomPipeY, width + collarLip * 2, collarHeight);
+}
+
+/**
+ * Draws the Flappy Bird with rotation, flapping wing, eye, and beak
+ */
+function drawBird(ctx, bird) {
+  ctx.save();
+
+  const centerX = bird.x + bird.width / 2;
+  const centerY = bird.y + bird.height / 2;
+
+  ctx.translate(centerX, centerY);
+  ctx.rotate(bird.rotation);
+
+  const bw = bird.width;
+  const bh = bird.height;
+
+  // Bird body (yellow-orange gradient oval)
+  ctx.beginPath();
+  ctx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
+  ctx.fillStyle = '#f8d030';
+  ctx.fill();
+  ctx.lineWidth = 2;
+  ctx.strokeStyle = '#543847';
+  ctx.stroke();
+
+  // Belly highlight (lighter yellow)
+  ctx.beginPath();
+  ctx.ellipse(-2, 3, bw / 2 - 4, bh / 2 - 5, 0, 0, Math.PI * 2);
+  ctx.fillStyle = '#fbe87b';
+  ctx.fill();
+
+  // Flapping Wing
+  const wingFlapOffset = Math.sin(bird.wingPhase) * 6;
+  ctx.beginPath();
+  ctx.ellipse(-6, wingFlapOffset, 8, 5, -0.2, 0, Math.PI * 2);
+  ctx.fillStyle = '#f4bc1c';
+  ctx.fill();
+  ctx.strokeStyle = '#543847';
+  ctx.lineWidth = 1.8;
+  ctx.stroke();
+
+  // Eye (white circle)
+  const eyeX = 6;
+  const eyeY = -4;
+  ctx.beginPath();
+  ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
+  ctx.fillStyle = '#ffffff';
+  ctx.fill();
+  ctx.strokeStyle = '#543847';
+  ctx.lineWidth = 1.8;
+  ctx.stroke();
+
+  // Pupil (black circle with white reflection)
+  ctx.beginPath();
+  ctx.arc(eyeX + 1.5, eyeY, 2.5, 0, Math.PI * 2);
+  ctx.fillStyle = '#000000';
+  ctx.fill();
+
+  ctx.beginPath();
+  ctx.arc(eyeX + 2, eyeY - 1, 1, 0, Math.PI * 2);
+  ctx.fillStyle = '#ffffff';
+  ctx.fill();
+
+  // Beak (orange-red)
+  ctx.beginPath();
+  ctx.moveTo(bw / 2 - 2, -1);
+  ctx.lineTo(bw / 2 + 8, 2);
+  ctx.lineTo(bw / 2 - 2, 5);
+  ctx.closePath();
+  ctx.fillStyle = '#f75c2f';
+  ctx.fill();
+  ctx.strokeStyle = '#543847';
+  ctx.lineWidth = 1.8;
+  ctx.stroke();
+
+  // Cheek blush
+  ctx.beginPath();
+  ctx.arc(2, 4, 3, 0, Math.PI * 2);
+  ctx.fillStyle = 'rgba(247, 92, 47, 0.4)';
+  ctx.fill();
+
+  ctx.restore();
+}
+
+/**
+ * Draws the prominent score in arcade style during play
+ */
+function drawInGameScore(ctx, score) {
+  const text = score.toString();
+  ctx.save();
+  ctx.font = '900 42px "Impact", "Arial Black", sans-serif';
+  ctx.textAlign = 'center';
+  ctx.textBaseline = 'top';
+
+  // Outer shadow/stroke
+  ctx.lineWidth = 6;
+  ctx.strokeStyle = '#000000';
+  ctx.strokeText(text, CANVAS_WIDTH / 2, 45);
+
+  // Inner fill
+  ctx.fillStyle = '#ffffff';
+  ctx.fillText(text, CANVAS_WIDTH / 2, 45);
+
+  ctx.restore();
+}
+
+/**
+ * Primary render function called on every frame
+ */
+export function renderGame(ctx, state) {
+  if (!ctx) return;
+
+  const { bird, pipeManager, score, status, groundOffset, cloudOffset = 0 } = state;
+
+  // Clear canvas
+  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
+
+  // Sky gradient
+  const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_HEIGHT);
+  skyGrad.addColorStop(0, '#4ec0ca');
+  skyGrad.addColorStop(0.75, '#76d6dd');
+  skyGrad.addColorStop(1, '#a4e8ee');
+  ctx.fillStyle = skyGrad;
+  ctx.fillRect(0, 0, CANVAS_WIDTH, PLAYABLE_HEIGHT);
+
+  // Background clouds with parallax
+  CLOUDS.forEach((c) => {
+    const cx = (c.x - cloudOffset * 0.2) % (CANVAS_WIDTH + 80);
+    const wrappedX = cx < -50 ? cx + CANVAS_WIDTH + 100 : cx;
+    drawCloud(ctx, wrappedX, c.y, c.scale);
+  });
+
+  // Distant city silhouette
+  drawCityScape(ctx);
+
+  // Draw active pipes
+  if (pipeManager && pipeManager.pipes) {
+    pipeManager.pipes.forEach((pipe) => drawPipePair(ctx, pipe));
+  }
+
+  // Draw scrolling ground
+  drawGround(ctx, groundOffset || 0);
+
+  // Draw bird
+  if (bird) {
+    drawBird(ctx, bird);
+  }
+
+  // Draw score overlay if playing
+  if (status === 'playing') {
+    drawInGameScore(ctx, score);
+  }
+}
diff --git a/src/game/storage.js b/src/game/storage.js
new file mode 100644
index 0000000..4673b1d
--- /dev/null
+++ b/src/game/storage.js
@@ -0,0 +1,79 @@
+import { STORAGE_KEY } from './constants.js';
+
+let memoryFallbackScore = 0;
+
+/**
+ * Checks if localStorage is accessible
+ */
+function isLocalStorageAvailable() {
+  try {
+    if (typeof window === 'undefined' || !window.localStorage) {
+      return false;
+    }
+    const testKey = '__storage_test__';
+    window.localStorage.setItem(testKey, '1');
+    window.localStorage.removeItem(testKey);
+    return true;
+  } catch {
+    return false;
+  }
+}
+
+/**
+ * Safely retrieve the high score.
+ * Returns 0 if no score saved or if storage is corrupted/unavailable.
+ */
+export function getHighScore() {
+  if (isLocalStorageAvailable()) {
+    try {
+      const stored = window.localStorage.getItem(STORAGE_KEY);
+      if (stored !== null) {
+        const parsed = parseInt(stored, 10);
+        if (!isNaN(parsed) && parsed >= 0) {
+          return parsed;
+        }
+      }
+    } catch {
+      // Fallback to memory
+    }
+  }
+  return memoryFallbackScore;
+}
+
+/**
+ * Safely save a new high score.
+ * Only updates if newScore is greater than the current high score.
+ * Returns the current high score.
+ */
+export function saveHighScore(newScore) {
+  const numericScore = typeof newScore === 'number' && !isNaN(newScore) ? Math.max(0, Math.floor(newScore)) : 0;
+  const currentBest = getHighScore();
+
+  if (numericScore > currentBest) {
+    if (isLocalStorageAvailable()) {
+      try {
+        window.localStorage.setItem(STORAGE_KEY, numericScore.toString());
+      } catch {
+        // Fallback to memory
+      }
+    }
+    memoryFallbackScore = numericScore;
+    return numericScore;
+  }
+
+  return currentBest;
+}
+
+/**
+ * Reset stored high score (primarily for test resets)
+ */
+export function resetHighScore() {
+  memoryFallbackScore = 0;
+  if (isLocalStorageAvailable()) {
+    try {
+      window.localStorage.removeItem(STORAGE_KEY);
+    } catch {
+      // Ignore
+    }
+  }
+}
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000..92f1fa7
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,12 @@
+import React from 'react';
+import ReactDOM from 'react-dom/client';
+import App from './App.jsx';
+
+const rootElement = document.getElementById('root');
+if (rootElement) {
+  ReactDOM.createRoot(rootElement).render(
+    <React.StrictMode>
+      <App />
+    </React.StrictMode>
+  );
+}
diff --git a/src/styles/flappy-bird.css b/src/styles/flappy-bird.css
new file mode 100644
index 0000000..f3fb222
--- /dev/null
+++ b/src/styles/flappy-bird.css
@@ -0,0 +1,256 @@
+/* Flappy Bird Game Styles */
+
+.flappy-game-wrapper {
+  position: relative;
+  display: flex;
+  flex-direction: column;
+  align-items: center;
+  justify-content: center;
+  width: 100%;
+  min-height: 100vh;
+  padding: 16px;
+  box-sizing: border-box;
+  background: linear-gradient(135deg, #1b2838 0%, #101721 100%);
+  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
+  color: #ffffff;
+  user-select: none;
+  -webkit-user-select: none;
+}
+
+.flappy-screen-reader-announcer {
+  position: absolute;
+  width: 1px;
+  height: 1px;
+  padding: 0;
+  margin: -1px;
+  overflow: hidden;
+  clip: rect(0, 0, 0, 0);
+  white-space: nowrap;
+  border: 0;
+}
+
+.flappy-game-stage {
+  position: relative;
+  width: 100%;
+  max-width: 380px;
+  aspect-ratio: 360 / 600;
+  border-radius: 16px;
+  overflow: hidden;
+  box-shadow:
+    0 20px 40px rgba(0, 0, 0, 0.6),
+    0 0 0 4px #543847,
+    0 0 0 8px #2b1f26;
+  background-color: #4ec0ca;
+  touch-action: none;
+  cursor: pointer;
+}
+
+.flappy-canvas {
+  display: block;
+  width: 100%;
+  height: 100%;
+  touch-action: none;
+}
+
+/* UI Overlays */
+.flappy-overlay {
+  position: absolute;
+  top: 0;
+  left: 0;
+  right: 0;
+  bottom: 0;
+  display: flex;
+  flex-direction: column;
+  align-items: center;
+  justify-content: center;
+  padding: 24px;
+  box-sizing: border-box;
+  background-color: rgba(0, 0, 0, 0.45);
+  backdrop-filter: blur(2px);
+  -webkit-backdrop-filter: blur(2px);
+  text-align: center;
+  z-index: 10;
+  animation: fadeIn 0.25s ease-out;
+}
+
+@keyframes fadeIn {
+  from {
+    opacity: 0;
+    transform: scale(0.96);
+  }
+  to {
+    opacity: 1;
+    transform: scale(1);
+  }
+}
+
+/* Titles */
+.flappy-title-main {
+  font-size: 2.4rem;
+  font-weight: 900;
+  margin: 0 0 8px 0;
+  color: #ffd83d;
+  text-shadow:
+    -2px -2px 0 #543847,
+    2px -2px 0 #543847,
+    -2px 2px 0 #543847,
+    2px 2px 0 #543847,
+    0 6px 0 #cf7a00,
+    0 9px 8px rgba(0, 0, 0, 0.6);
+  letter-spacing: 1px;
+}
+
+.flappy-title-gameover {
+  font-size: 2.3rem;
+  font-weight: 900;
+  margin: 0 0 16px 0;
+  color: #ff5252;
+  text-shadow:
+    -2px -2px 0 #543847,
+    2px -2px 0 #543847,
+    -2px 2px 0 #543847,
+    2px 2px 0 #543847,
+    0 5px 0 #9e1414,
+    0 8px 8px rgba(0, 0, 0, 0.6);
+  letter-spacing: 1px;
+}
+
+/* Cards & Modals */
+.flappy-card {
+  width: 100%;
+  max-width: 280px;
+  background: #ded895;
+  border: 4px solid #543847;
+  border-radius: 12px;
+  padding: 16px;
+  margin-bottom: 20px;
+  box-shadow:
+    inset 0 -4px 0 #c2bb74,
+    0 8px 16px rgba(0, 0, 0, 0.4);
+  color: #543847;
+}
+
+.flappy-instruction-text {
+  font-size: 0.95rem;
+  line-height: 1.45;
+  color: #543847;
+  font-weight: 600;
+  margin: 0 0 12px 0;
+}
+
+.flappy-controls-badge {
+  display: flex;
+  justify-content: center;
+  gap: 8px;
+  margin-bottom: 12px;
+}
+
+.flappy-key-chip {
+  background: #ffffff;
+  border: 2px solid #543847;
+  border-radius: 6px;
+  padding: 4px 10px;
+  font-size: 0.8rem;
+  font-weight: 800;
+  color: #543847;
+  box-shadow: 0 2px 0 #543847;
+}
+
+.flappy-score-row {
+  display: flex;
+  justify-content: space-between;
+  align-items: center;
+  padding: 8px 12px;
+  font-weight: 700;
+  font-size: 1.05rem;
+  border-bottom: 2px dashed #b9b16c;
+}
+
+.flappy-score-row:last-child {
+  border-bottom: none;
+}
+
+.flappy-score-value {
+  font-size: 1.4rem;
+  font-weight: 900;
+  color: #2b1f26;
+}
+
+.flappy-new-record {
+  display: inline-block;
+  background: #ff5252;
+  color: #ffffff;
+  font-size: 0.75rem;
+  font-weight: 800;
+  padding: 3px 8px;
+  border-radius: 999px;
+  margin-top: 6px;
+  animation: pulseBadge 1.2s infinite;
+  box-shadow: 0 2px 4px rgba(255, 82, 82, 0.5);
+}
+
+@keyframes pulseBadge {
+  0%, 100% {
+    transform: scale(1);
+  }
+  50% {
+    transform: scale(1.08);
+  }
+}
+
+/* Buttons */
+.flappy-btn {
+  background: linear-gradient(to bottom, #73bf2e 0%, #5ba820 100%);
+  border: 3px solid #543847;
+  border-radius: 10px;
+  padding: 12px 28px;
+  font-size: 1.15rem;
+  font-weight: 800;
+  color: #ffffff;
+  cursor: pointer;
+  box-shadow:
+    inset 0 2px 0 #9de64e,
+    0 5px 0 #3a6b14,
+    0 8px 12px rgba(0, 0, 0, 0.35);
+  transition: all 0.1s ease;
+  outline: none;
+}
+
+.flappy-btn:hover {
+  filter: brightness(1.05);
+  transform: translateY(-2px);
+  box-shadow:
+    inset 0 2px 0 #9de64e,
+    0 7px 0 #3a6b14,
+    0 10px 14px rgba(0, 0, 0, 0.4);
+}
+
+.flappy-btn:active {
+  transform: translateY(3px);
+  box-shadow:
+    inset 0 2px 0 #9de64e,
+    0 2px 0 #3a6b14,
+    0 4px 6px rgba(0, 0, 0, 0.3);
+}
+
+.flappy-btn:focus-visible {
+  outline: 3px solid #ffd83d;
+  outline-offset: 4px;
+}
+
+/* In-game quick hint */
+.flappy-tap-hint {
+  margin-top: 14px;
+  font-size: 0.85rem;
+  color: #ffffff;
+  opacity: 0.9;
+  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
+}
+
+/* Footer / credits */
+.flappy-footer-info {
+  margin-top: 16px;
+  font-size: 0.8rem;
+  color: #7b8b9c;
+  text-align: center;
+}
diff --git a/src/styles/index.css b/src/styles/index.css
new file mode 100644
index 0000000..5f52147
--- /dev/null
+++ b/src/styles/index.css
@@ -0,0 +1,20 @@
+/* Base Global Styles */
+* {
+  box-sizing: border-box;
+}
+
+html, body {
+  margin: 0;
+  padding: 0;
+  width: 100%;
+  height: 100%;
+  background-color: #101721;
+  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
+  overflow-x: hidden;
+}
+
+#root {
+  min-height: 100vh;
+  display: flex;
+  flex-direction: column;
+}
diff --git a/tests/bird.test.js b/tests/bird.test.js
new file mode 100644
index 0000000..c428d1f
--- /dev/null
+++ b/tests/bird.test.js
@@ -0,0 +1,76 @@
+import { describe, it, expect } from 'vitest';
+import {
+  createBird,
+  flapBird,
+  updateBird,
+} from '../src/game/entities/bird.js';
+import {
+  BIRD_INITIAL_X,
+  BIRD_INITIAL_Y,
+  FLAP_STRENGTH,
+  MAX_FALL_SPEED,
+  PLAYABLE_HEIGHT,
+  BIRD_HEIGHT,
+} from '../src/game/constants.js';
+
+describe('Bird Entity', () => {
+  it('creates bird with correct initial values', () => {
+    const bird = createBird();
+    expect(bird.x).toBe(BIRD_INITIAL_X);
+    expect(bird.y).toBe(BIRD_INITIAL_Y);
+    expect(bird.velocity).toBe(0);
+    expect(bird.rotation).toBe(0);
+  });
+
+  it('flaps and sets upward velocity', () => {
+    const bird = createBird();
+    flapBird(bird);
+    expect(bird.velocity).toBe(FLAP_STRENGTH);
+  });
+
+  it('updates position with idle bobbing when status is idle', () => {
+    const bird = createBird();
+    const initialY = bird.y;
+    updateBird(bird, 0.1, 'idle');
+    expect(bird.velocity).toBe(0);
+    expect(bird.rotation).toBe(0);
+    // Y changes according to sine wave bobbing
+    expect(bird.y).not.toBe(initialY);
+  });
+
+  it('applies gravity and updates position when status is playing', () => {
+    const bird = createBird();
+    const initialY = bird.y;
+    updateBird(bird, 0.1, 'playing');
+
+    // Gravity should have increased velocity
+    expect(bird.velocity).toBeGreaterThan(0);
+    expect(bird.y).toBeGreaterThan(initialY);
+  });
+
+  it('clamps velocity to MAX_FALL_SPEED', () => {
+    const bird = createBird();
+    // Simulate long fall
+    updateBird(bird, 1.0, 'playing');
+    expect(bird.velocity).toBeLessThanOrEqual(MAX_FALL_SPEED);
+  });
+
+  it('tilts upward after flap and downward during fall', () => {
+    const bird = createBird();
+    flapBird(bird); // Negative velocity (moving up)
+    updateBird(bird, 0.05, 'playing');
+    expect(bird.rotation).toBeLessThan(0);
+
+    // Fall downward
+    bird.velocity = 300;
+    updateBird(bird, 0.2, 'playing');
+    expect(bird.rotation).toBeGreaterThan(0);
+  });
+
+  it('falls to ground in gameOver status and stops at playable bottom', () => {
+    const bird = createBird(80, PLAYABLE_HEIGHT - 30);
+    updateBird(bird, 0.5, 'gameOver');
+    expect(bird.y + BIRD_HEIGHT).toBe(PLAYABLE_HEIGHT);
+    expect(bird.velocity).toBe(0);
+  });
+});
diff --git a/tests/collision.test.js b/tests/collision.test.js
new file mode 100644
index 0000000..223f737
--- /dev/null
+++ b/tests/collision.test.js
@@ -0,0 +1,123 @@
+import { describe, it, expect } from 'vitest';
+import {
+  getBirdHitbox,
+  rectsIntersect,
+  checkGroundCollision,
+  checkCeilingCollision,
+  checkPipeCollision,
+  checkAnyCollision,
+} from '../src/game/collision.js';
+import {
+  BIRD_WIDTH,
+  BIRD_HEIGHT,
+  PLAYABLE_HEIGHT,
+  PIPE_WIDTH,
+  PIPE_GAP,
+} from '../src/game/constants.js';
+
+describe('Collision System', () => {
+  it('calculates bird hitbox with correct padding', () => {
+    const bird = { x: 50, y: 100, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    const hitbox = getBirdHitbox(bird);
+
+    expect(hitbox.x).toBeGreaterThan(bird.x);
+    expect(hitbox.y).toBeGreaterThan(bird.y);
+    expect(hitbox.width).toBeLessThan(bird.width);
+    expect(hitbox.height).toBeLessThan(bird.height);
+  });
+
+  it('correctly checks AABB intersection', () => {
+    const r1 = { x: 10, y: 10, width: 20, height: 20 };
+    const r2 = { x: 20, y: 20, width: 20, height: 20 };
+    const r3 = { x: 50, y: 50, width: 20, height: 20 };
+
+    expect(rectsIntersect(r1, r2)).toBe(true);
+    expect(rectsIntersect(r1, r3)).toBe(false);
+  });
+
+  it('detects ground collision when bird reaches PLAYABLE_HEIGHT', () => {
+    const safeBird = { x: 80, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    expect(checkGroundCollision(safeBird)).toBe(false);
+
+    const groundBird = {
+      x: 80,
+      y: PLAYABLE_HEIGHT - BIRD_HEIGHT + 5,
+      width: BIRD_WIDTH,
+      height: BIRD_HEIGHT,
+    };
+    expect(checkGroundCollision(groundBird)).toBe(true);
+  });
+
+  it('detects ceiling collision when bird hits top of screen', () => {
+    const safeBird = { x: 80, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    expect(checkCeilingCollision(safeBird)).toBe(false);
+
+    const ceilingBird = {
+      x: 80,
+      y: -5,
+      width: BIRD_WIDTH,
+      height: BIRD_HEIGHT,
+    };
+    expect(checkCeilingCollision(ceilingBird)).toBe(true);
+  });
+
+  it('detects pipe collision correctly with top and bottom pipes', () => {
+    const pipe = {
+      id: 1,
+      x: 80,
+      width: PIPE_WIDTH, // 52
+      topHeight: 150,
+      gap: PIPE_GAP, // 135 -> gap is between 150 and 285
+    };
+
+    // Case 1: Bird right inside the gap -> SAFE
+    const safeBird = {
+      x: 85,
+      y: 200, // Gap is [150, 285], bird height 24 fits comfortably [203, 227]
+      width: BIRD_WIDTH,
+      height: BIRD_HEIGHT,
+    };
+    expect(checkPipeCollision(safeBird, pipe)).toBe(false);
+
+    // Case 2: Bird hitting top pipe
+    const hitTopBird = {
+      x: 85,
+      y: 100, // Inside top pipe [0, 150]
+      width: BIRD_WIDTH,
+      height: BIRD_HEIGHT,
+    };
+    expect(checkPipeCollision(hitTopBird, pipe)).toBe(true);
+
+    // Case 3: Bird hitting bottom pipe
+    const hitBottomBird = {
+      x: 85,
+      y: 320, // Below gap start 285
+      width: BIRD_WIDTH,
+      height: BIRD_HEIGHT,
+    };
+    expect(checkPipeCollision(hitBottomBird, pipe)).toBe(true);
+  });
+
+  it('checkAnyCollision returns accurate reason for collision', () => {
+    const pipes = [
+      { id: 42, x: 80, width: PIPE_WIDTH, topHeight: 150, gap: PIPE_GAP },
+    ];
+
+    // Safe
+    const safeBird = { x: 85, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    expect(checkAnyCollision(safeBird, pipes).collided).toBe(false);
+
+    // Ground
+    const groundBird = { x: 85, y: PLAYABLE_HEIGHT, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    const groundRes = checkAnyCollision(groundBird, pipes);
+    expect(groundRes.collided).toBe(true);
+    expect(groundRes.reason).toBe('ground');
+
+    // Pipe
+    const pipeBird = { x: 85, y: 50, width: BIRD_WIDTH, height: BIRD_HEIGHT };
+    const pipeRes = checkAnyCollision(pipeBird, pipes);
+    expect(pipeRes.collided).toBe(true);
+    expect(pipeRes.reason).toBe('pipe');
+    expect(pipeRes.pipeId).toBe(42);
+  });
+});
diff --git a/tests/flappy-bird.test.jsx b/tests/flappy-bird.test.jsx
new file mode 100644
index 0000000..a1955fe
--- /dev/null
+++ b/tests/flappy-bird.test.jsx
@@ -0,0 +1,143 @@
+import React from 'react';
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import { render, screen, fireEvent, act } from '@testing-library/react';
+import FlappyBirdGame from '../src/components/FlappyBirdGame.jsx';
+import { resetHighScore, saveHighScore } from '../src/game/storage.js';
+
+describe('FlappyBirdGame Component', () => {
+  beforeEach(() => {
+    resetHighScore();
+    window.localStorage.clear();
+
+    // Mock HTMLCanvasElement.getContext
+    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
+      clearRect: vi.fn(),
+      beginPath: vi.fn(),
+      arc: vi.fn(),
+      ellipse: vi.fn(),
+      moveTo: vi.fn(),
+      lineTo: vi.fn(),
+      closePath: vi.fn(),
+      fill: vi.fn(),
+      stroke: vi.fn(),
+      fillRect: vi.fn(),
+      strokeRect: vi.fn(),
+      fillText: vi.fn(),
+      strokeText: vi.fn(),
+      save: vi.fn(),
+      restore: vi.fn(),
+      translate: vi.fn(),
+      rotate: vi.fn(),
+      scale: vi.fn(),
+      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
+    }));
+  });
+
+  it('renders initial start screen with title, instructions, and start button', () => {
+    render(<FlappyBirdGame />);
+
+    expect(screen.getByText('FLAPPY BIRD')).toBeTruthy();
+    expect(screen.getByTestId('start-screen')).toBeTruthy();
+    expect(screen.getByTestId('start-button')).toBeTruthy();
+    expect(screen.getByTestId('idle-highscore').textContent).toBe('0');
+  });
+
+  it('renders stored high score on start screen', () => {
+    saveHighScore(18);
+    render(<FlappyBirdGame />);
+    expect(screen.getByTestId('idle-highscore').textContent).toBe('18');
+  });
+
+  it('starts the game when "Bắt đầu chơi" button is clicked', () => {
+    render(<FlappyBirdGame />);
+
+    const startButton = screen.getByTestId('start-button');
+    act(() => {
+      fireEvent.click(startButton);
+    });
+
+    // In playing mode, the start overlay should disappear
+    expect(screen.queryByTestId('start-screen')).toBeNull();
+  });
+
+  it('starts the game when clicking or pointer-down on the stage', () => {
+    render(<FlappyBirdGame />);
+
+    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });
+    act(() => {
+      fireEvent.pointerDown(stage);
+    });
+
+    expect(screen.queryByTestId('start-screen')).toBeNull();
+  });
+
+  it('starts the game when pressing the Spacebar', () => {
+    render(<FlappyBirdGame />);
+
+    act(() => {
+      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
+    });
+
+    expect(screen.queryByTestId('start-screen')).toBeNull();
+  });
+
+  it('ignores held Spacebar repeat events', () => {
+    render(<FlappyBirdGame />);
+
+    act(() => {
+      // Repeat event should be ignored and not crash
+      fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true });
+    });
+
+    // Since repeat was true, start was not triggered
+    expect(screen.getByTestId('start-screen')).toBeTruthy();
+  });
+
+  it('renders game canvas with proper accessibility role', () => {
+    render(<FlappyBirdGame />);
+    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });
+    expect(stage).toBeTruthy();
+  });
+
+  it('displays Game Over screen when bird collides, and restarts on button click', () => {
+    let engineInstance = null;
+    render(
+      <FlappyBirdGame
+        onEngineReady={(engine) => {
+          engineInstance = engine;
+        }}
+      />
+    );
+
+    expect(engineInstance).not.toBeNull();
+
+    // Start game
+    act(() => {
+      engineInstance.start();
+    });
+    expect(screen.queryByTestId('start-screen')).toBeNull();
+
+    // Trigger game over with score = 5
+    act(() => {
+      engineInstance.score = 5;
+      engineInstance.handleGameOver();
+    });
+
+    // Game Over screen should now be visible
+    expect(screen.getByTestId('game-over-screen')).toBeTruthy();
+    expect(screen.getByTestId('final-score').textContent).toBe('5');
+    expect(screen.getByTestId('best-score').textContent).toBe('5');
+    expect(screen.getByTestId('new-record-badge')).toBeTruthy();
+
+    // Click restart button
+    const restartButton = screen.getByTestId('restart-button');
+    act(() => {
+      fireEvent.click(restartButton);
+    });
+
+    // Should return to clean idle/start screen
+    expect(screen.queryByTestId('game-over-screen')).toBeNull();
+    expect(screen.getByTestId('start-screen')).toBeTruthy();
+    expect(screen.getByTestId('idle-highscore').textContent).toBe('5');
+  });
+});
diff --git a/tests/game-engine.test.js b/tests/game-engine.test.js
new file mode 100644
index 0000000..07135c1
--- /dev/null
+++ b/tests/game-engine.test.js
@@ -0,0 +1,137 @@
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import { GameEngine } from '../src/game/game-engine.js';
+import { GAME_STATUS, PLAYABLE_HEIGHT } from '../src/game/constants.js';
+import { resetHighScore } from '../src/game/storage.js';
+
+describe('GameEngine', () => {
+  let mockCanvas;
+  let mockCtx;
+
+  beforeEach(() => {
+    resetHighScore();
+    window.localStorage.clear();
+
+    mockCtx = {
+      clearRect: vi.fn(),
+      beginPath: vi.fn(),
+      arc: vi.fn(),
+      ellipse: vi.fn(),
+      moveTo: vi.fn(),
+      lineTo: vi.fn(),
+      closePath: vi.fn(),
+      fill: vi.fn(),
+      stroke: vi.fn(),
+      fillRect: vi.fn(),
+      strokeRect: vi.fn(),
+      fillText: vi.fn(),
+      strokeText: vi.fn(),
+      save: vi.fn(),
+      restore: vi.fn(),
+      translate: vi.fn(),
+      rotate: vi.fn(),
+      scale: vi.fn(),
+      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
+    };
+
+    mockCanvas = {
+      getContext: vi.fn(() => mockCtx),
+    };
+  });
+
+  it('initializes with IDLE status, 0 score, and bird at starting position', () => {
+    const onStateChange = vi.fn();
+    const engine = new GameEngine(mockCanvas, { onStateChange });
+
+    expect(engine.status).toBe(GAME_STATUS.IDLE);
+    expect(engine.score).toBe(0);
+    expect(engine.pipeManager.pipes.length).toBe(0);
+    expect(onStateChange).toHaveBeenCalledWith(
+      expect.objectContaining({
+        status: GAME_STATUS.IDLE,
+        score: 0,
+      })
+    );
+  });
+
+  it('transitions from IDLE to PLAYING on start() or flap()', () => {
+    const engine = new GameEngine(mockCanvas);
+    expect(engine.status).toBe(GAME_STATUS.IDLE);
+
+    engine.flap(); // Flapping while IDLE starts the game
+    expect(engine.status).toBe(GAME_STATUS.PLAYING);
+    expect(engine.bird.velocity).toBeLessThan(0); // Upward boost
+  });
+
+  it('clamps delta time in update to prevent huge skips', () => {
+    const engine = new GameEngine(mockCanvas);
+    engine.start();
+
+    // Large dt e.g. 5 seconds (simulating tab inactive)
+    const initialY = engine.bird.y;
+    engine.update(5.0);
+
+    // Clamped dt is 0.1s, bird shouldn't have plummeted 5 seconds worth of gravity
+    expect(engine.bird.velocity).toBeLessThanOrEqual(500);
+  });
+
+  it('increments score and updates high score when pipes are cleared', () => {
+    const onScore = vi.fn();
+    const onStateChange = vi.fn();
+    const engine = new GameEngine(mockCanvas, { onScore, onStateChange });
+    engine.start();
+
+    // Manually push a pipe positioned so that bird passes it
+    engine.pipeManager.pipes.push({
+      id: 1,
+      x: 70, // Bird is at x=80, pipe width 52, right edge 122 -> pass it by setting x=20
+      width: 52,
+      topHeight: 100,
+      gap: 150,
+      passed: false,
+    });
+    engine.pipeManager.pipes[0].x = 20; // bird.x (80) > pipe.x + pipe.width (72)
+
+    engine.update(0.016);
+
+    expect(engine.score).toBe(1);
+    expect(engine.highScore).toBe(1);
+    expect(engine.isNewHighScore).toBe(true);
+    expect(onScore).toHaveBeenCalledWith(1);
+  });
+
+  it('detects collision with ground and triggers gameOver', () => {
+    const onGameOver = vi.fn();
+    const engine = new GameEngine(mockCanvas, { onGameOver });
+    engine.start();
+
+    // Move bird to ground
+    engine.bird.y = PLAYABLE_HEIGHT + 10;
+    engine.update(0.016);
+
+    expect(engine.status).toBe(GAME_STATUS.GAME_OVER);
+    expect(onGameOver).toHaveBeenCalled();
+  });
+
+  it('restarts cleanly back to IDLE status with 0 score and empty pipes', () => {
+    const engine = new GameEngine(mockCanvas);
+    engine.start();
+    engine.score = 10;
+    engine.status = GAME_STATUS.GAME_OVER;
+
+    engine.restart();
+    expect(engine.status).toBe(GAME_STATUS.IDLE);
+    expect(engine.score).toBe(0);
+    expect(engine.pipeManager.pipes.length).toBe(0);
+  });
+
+  it('stops and cleans up animation loops on destroy', () => {
+    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
+    const engine = new GameEngine(mockCanvas);
+    engine.startLoop();
+    expect(engine.isRunning).toBe(true);
+
+    engine.destroy();
+    expect(engine.isRunning).toBe(false);
+    expect(cancelSpy).toHaveBeenCalled();
+  });
+});
diff --git a/tests/pipe-manager.test.js b/tests/pipe-manager.test.js
new file mode 100644
index 0000000..bf10f1f
--- /dev/null
+++ b/tests/pipe-manager.test.js
@@ -0,0 +1,98 @@
+import { describe, it, expect } from 'vitest';
+import {
+  createPipeManager,
+  spawnPipe,
+  updatePipes,
+  resetPipes,
+} from '../src/game/entities/pipe-manager.js';
+import {
+  CANVAS_WIDTH,
+  PIPE_WIDTH,
+  PIPE_GAP,
+  PIPE_SPEED,
+  MIN_PIPE_HEIGHT,
+  MAX_PIPE_HEIGHT,
+} from '../src/game/constants.js';
+
+describe('Pipe Manager Entity', () => {
+  it('creates an empty pipe manager', () => {
+    const manager = createPipeManager();
+    expect(manager.pipes).toEqual([]);
+    expect(manager.speed).toBe(PIPE_SPEED);
+  });
+
+  it('spawns a pipe pair with valid dimensions and right-edge position', () => {
+    const manager = createPipeManager();
+    const pipe = spawnPipe(manager);
+
+    expect(pipe.x).toBe(CANVAS_WIDTH);
+    expect(pipe.width).toBe(PIPE_WIDTH);
+    expect(pipe.gap).toBe(PIPE_GAP);
+    expect(pipe.passed).toBe(false);
+    expect(pipe.topHeight).toBeGreaterThanOrEqual(MIN_PIPE_HEIGHT);
+    expect(pipe.topHeight).toBeLessThanOrEqual(MAX_PIPE_HEIGHT);
+    expect(manager.pipes.length).toBe(1);
+  });
+
+  it('moves pipes leftward according to dt and speed', () => {
+    const manager = createPipeManager();
+    const pipe = spawnPipe(manager, 150);
+    const initialX = pipe.x;
+
+    updatePipes(manager, 0.1, 50);
+    expect(pipe.x).toBeCloseTo(initialX - PIPE_SPEED * 0.1, 1);
+  });
+
+  it('spawns pipes periodically based on spawnInterval', () => {
+    const manager = createPipeManager();
+    expect(manager.pipes.length).toBe(0);
+
+    // Update with dt less than spawn interval
+    updatePipes(manager, 1.0, 50);
+    expect(manager.pipes.length).toBe(0);
+
+    // Advance past spawn interval (1.75s)
+    updatePipes(manager, 0.8, 50);
+    expect(manager.pipes.length).toBe(1);
+  });
+
+  it('awards 1 point when bird passes the pipe, and never awards double points', () => {
+    const manager = createPipeManager();
+    const pipe = spawnPipe(manager, 150);
+    pipe.x = 100; // Pipe extends from 100 to 100 + 52 = 152
+
+    // Bird is before pipe
+    let result = updatePipes(manager, 0.01, 80);
+    expect(result.pointsAwarded).toBe(0);
+    expect(pipe.passed).toBe(false);
+
+    // Bird is beyond pipe (80 + x > 152) -> bird at 160
+    result = updatePipes(manager, 0.01, 160);
+    expect(result.pointsAwarded).toBe(1);
+    expect(pipe.passed).toBe(true);
+
+    // Subsequent frame: pipe already marked passed, no additional points
+    result = updatePipes(manager, 0.01, 160);
+    expect(result.pointsAwarded).toBe(0);
+  });
+
+  it('prunes offscreen pipes', () => {
+    const manager = createPipeManager();
+    const pipe = spawnPipe(manager, 150);
+    pipe.x = -60; // Far past left boundary (-10)
+
+    updatePipes(manager, 0.01, 200);
+    expect(manager.pipes.length).toBe(0);
+  });
+
+  it('resets all pipes and timers', () => {
+    const manager = createPipeManager();
+    spawnPipe(manager);
+    spawnPipe(manager);
+    expect(manager.pipes.length).toBe(2);
+
+    resetPipes(manager);
+    expect(manager.pipes.length).toBe(0);
+    expect(manager.spawnTimer).toBe(0);
+  });
+});
diff --git a/tests/renderer.test.js b/tests/renderer.test.js
new file mode 100644
index 0000000..04db319
--- /dev/null
+++ b/tests/renderer.test.js
@@ -0,0 +1,91 @@
+import { describe, it, expect, vi } from 'vitest';
+import { renderGame } from '../src/game/renderer.js';
+import { createBird } from '../src/game/entities/bird.js';
+import { createPipeManager, spawnPipe } from '../src/game/entities/pipe-manager.js';
+import { GAME_STATUS } from '../src/game/constants.js';
+
+describe('Renderer Module', () => {
+  const createMockCtx = () => ({
+    clearRect: vi.fn(),
+    beginPath: vi.fn(),
+    arc: vi.fn(),
+    ellipse: vi.fn(),
+    moveTo: vi.fn(),
+    lineTo: vi.fn(),
+    closePath: vi.fn(),
+    fill: vi.fn(),
+    stroke: vi.fn(),
+    fillRect: vi.fn(),
+    strokeRect: vi.fn(),
+    fillText: vi.fn(),
+    strokeText: vi.fn(),
+    save: vi.fn(),
+    restore: vi.fn(),
+    translate: vi.fn(),
+    rotate: vi.fn(),
+    scale: vi.fn(),
+    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
+  });
+
+  it('safely handles null or undefined ctx', () => {
+    expect(() => renderGame(null, {})).not.toThrow();
+  });
+
+  it('renders sky, ground, clouds, and bird in IDLE status', () => {
+    const ctx = createMockCtx();
+    const bird = createBird();
+    const pipeManager = createPipeManager();
+
+    renderGame(ctx, {
+      bird,
+      pipeManager,
+      score: 0,
+      status: GAME_STATUS.IDLE,
+      groundOffset: 10,
+      cloudOffset: 5,
+    });
+
+    expect(ctx.clearRect).toHaveBeenCalled();
+    expect(ctx.fillRect).toHaveBeenCalled(); // Sky & ground
+    expect(ctx.stroke).toHaveBeenCalled();
+  });
+
+  it('renders active pipes and in-game score in PLAYING status', () => {
+    const ctx = createMockCtx();
+    const bird = createBird();
+    const pipeManager = createPipeManager();
+    spawnPipe(pipeManager, 140);
+
+    renderGame(ctx, {
+      bird,
+      pipeManager,
+      score: 7,
+      status: GAME_STATUS.PLAYING,
+      groundOffset: 50,
+      cloudOffset: 20,
+    });
+
+    // Both top and bottom pipes drawn
+    expect(ctx.strokeRect).toHaveBeenCalled();
+    // In-game score rendered
+    expect(ctx.fillText).toHaveBeenCalledWith('7', expect.any(Number), expect.any(Number));
+    expect(ctx.strokeText).toHaveBeenCalledWith('7', expect.any(Number), expect.any(Number));
+  });
+
+  it('renders without error in GAME_OVER status', () => {
+    const ctx = createMockCtx();
+    const bird = createBird();
+    const pipeManager = createPipeManager();
+
+    renderGame(ctx, {
+      bird,
+      pipeManager,
+      score: 12,
+      status: GAME_STATUS.GAME_OVER,
+      groundOffset: 100,
+      cloudOffset: 30,
+    });
+
+    expect(ctx.clearRect).toHaveBeenCalled();
+  });
+});
diff --git a/tests/storage.test.js b/tests/storage.test.js
new file mode 100644
index 0000000..58e1873
--- /dev/null
+++ b/tests/storage.test.js
@@ -0,0 +1,65 @@
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import {
+  getHighScore,
+  saveHighScore,
+  resetHighScore,
+} from '../src/game/storage.js';
+import { STORAGE_KEY } from '../src/game/constants.js';
+
+describe('Storage Module', () => {
+  beforeEach(() => {
+    resetHighScore();
+    window.localStorage.clear();
+  });
+
+  it('returns 0 when no high score is saved', () => {
+    expect(getHighScore()).toBe(0);
+  });
+
+  it('saves and retrieves high score correctly', () => {
+    const result = saveHighScore(15);
+    expect(result).toBe(15);
+    expect(getHighScore()).toBe(15);
+    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('15');
+  });
+
+  it('does not overwrite high score with a lower score', () => {
+    saveHighScore(20);
+    const result = saveHighScore(10);
+    expect(result).toBe(20);
+    expect(getHighScore()).toBe(20);
+  });
+
+  it('updates high score when a higher score is achieved', () => {
+    saveHighScore(10);
+    const result = saveHighScore(25);
+    expect(result).toBe(25);
+    expect(getHighScore()).toBe(25);
+  });
+
+  it('handles invalid non-numeric inputs gracefully', () => {
+    saveHighScore(5);
+    saveHighScore(NaN);
+    saveHighScore(-10);
+    saveHighScore('invalid');
+    expect(getHighScore()).toBe(5);
+  });
+
+  it('handles corrupted localStorage value', () => {
+    window.localStorage.setItem(STORAGE_KEY, 'corrupted_string');
+    expect(getHighScore()).toBe(0);
+  });
+
+  it('falls back to in-memory storage when localStorage throws an error', () => {
+    const originalSetItem = window.localStorage.setItem;
+    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
+      throw new Error('QuotaExceededError');
+    });
+
+    const saved = saveHighScore(42);
+    expect(saved).toBe(42);
+    expect(getHighScore()).toBe(42);
+
+    window.localStorage.setItem = originalSetItem;
+  });
+});
```
