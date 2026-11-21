# CLAUDE.md — agent-collab (Agent Collaboration MVP)

## Mục tiêu & người dùng
- Framework điều phối nhiều agent tự động, không cần API key: người dùng nhập yêu cầu một lần trên Web UI ("Studio"), hệ thống tự chạy
  Codex CLI (lập kế hoạch + audit cuối) → Antigravity/Gemini `agy` (viết code, sửa lỗi) → test/build → Claude Code CLI (review đối kháng) → lặp sửa → COMPLETED.
- Người dùng: chủ dự án (dùng nội bộ), chạy trên máy local với các CLI đã đăng nhập bằng gói subscription.

## Stack & cấu trúc
- Node + TypeScript (ESM, chạy bằng `tsx`), npm workspaces (`packages/*`, `apps/*`, `shared`). Phụ thuộc runtime duy nhất: `zod`.
- Server HTTP thuần (`server.ts`, cổng cố định 3000, bind `127.0.0.1`), stream sự kiện qua SSE. Không có DB: trạng thái lưu file JSON.
- `server.ts` / `cli.ts` — điểm vào Web UI và CLI.
- `orchestrator/` — `WorkflowController` (`workflow.ts`), state machine, router, runner, verifier.
- `adapters/{codex,claude,gemini}/` — gọi từng CLI; `protocol/` — types, schemas zod, events.
- `prompts/` — prompt cho từng vai trò; `.orchestrator/` — config pipeline + rules (`preserve-app.md`, `review.md`, …) nạp cho agent.
- `web/` — UI tĩnh (HTML/JS/CSS) do `server.ts` phục vụ; `mvp.config.json` — danh sách model và model mặc định.
- `packages/orchestrator-core`, `packages/orchestrator-ui`, `packages/antigravity-extension` (extension VS Code/Antigravity, build ra `.vsix`), `apps/standalone`, `shared/` — bản tách module.
  Lưu ý: `orchestrator/` trùng nội dung với `packages/orchestrator-core/src/orchestrator/`, `web/` trùng với `packages/orchestrator-ui/src/`.
  TODO (người dùng xác nhận): bản nào là nguồn chính khi sửa — root hay `packages/`?
- `runs/<run-id>/` — artifact mỗi lượt (plan.json, review-*.json, final-check.json); `workspaces/<run-id>/project/` — code sinh ra. Cả hai bị gitignore (trừ `runs/run-e2e-001/`).
- `tests/` — unit test (chạy bằng `tsx`, không dùng framework); `scripts/` — gate-0, e2e, chẩn đoán.

## Lệnh
Chưa có `node_modules`: chạy `npm install` trước (lockfile npm).
- `npm run gate-0` — kiểm tra môi trường (node, npm, git, Codex CLI, Claude Code CLI, `agy`).
- `npm run dev` (hoặc `npm run ui`) — Web UI tại http://127.0.0.1:3000/
- `npm start` — chạy qua CLI (`cli.ts`).
- `npm test` — 4 unit test: state-machine, schema, fallback-review, model-agnostic-routing.
- `npm run build` — `tsc` (cũng dùng làm typecheck).
- `npm run e2e` / `npm run test:e2e` — E2E tự động (gọi các CLI thật, tốn quota).
- `npm run test:defect`, `npm run test:interruption` — kiểm tra Claude bắt lỗi cố ý, khôi phục sau khi ngắt tiến trình.
- `npm run diagnose:claude` — chẩn đoán Claude CLI.
- `npm run ext:build`, `npm run ext:install` — đóng gói và cài extension vào Antigravity IDE (đường dẫn `/Applications/Antigravity IDE.app`).
- Không có lint, không có CI.

## Điều bất biến
- Không dùng API key: các adapter/runner xoá `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` khỏi env của tiến trình con. Không thêm đường gọi API trả phí.
- State machine chặn hoàn thành sớm: `completeRun()` chỉ cho COMPLETED khi có plan hợp lệ, test pass, review APPROVED, audit conformant và build sạch. Không nới điều kiện này.
- Mỗi run chạy trong sandbox riêng `workspaces/<run-id>/project/`; agent không được ghi ra ngoài workspace của run.
- Server chỉ bind `127.0.0.1` (dù đặt CORS `*`): không mở ra mạng ngoài.
- Schema trong `protocol/schemas.ts` là hợp đồng giữa các agent (plan/review/final-check JSON); đổi schema phải giữ tương thích với run cũ trong `runs/`.
- Rule `.orchestrator/rules/preserve-app.md` áp cho agent sinh code: không viết lại/xoá tính năng ngoài phạm vi task.

## Cách kiểm chứng
- `npm test` và `npm run build` phải pass.
- Sửa UI/server: `npm run dev`, mở http://127.0.0.1:3000/, chọn preset "React Todo App", bấm **Start Collaboration**, xem stepper + SSE feed chạy tới COMPLETED (hoặc ít nhất qua bước plan).
- Sửa adapter/workflow: chạy `npm run gate-0`, rồi `npm run test:defect` hoặc `npm run e2e` (tốn quota, báo người dùng trước).
- Ghi chú: link trong `README.md` và `docs/*.md` vẫn trỏ đường dẫn cũ `.../xtools/agent-colab/` (thiếu chữ l); đường đúng là `xtools/agent-collab/`.
