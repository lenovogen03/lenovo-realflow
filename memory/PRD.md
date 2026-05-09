# RealFlow - Product Requirements Document

## Original Problem Statement
User asked to clone the GitHub repo `https://github.com/lenovogen03/lenovo-realflow.git` into the Emergent environment, run it, and iterate. Subsequent asks: build a Visual Recorder for generating RUT automation JSON, fix bugs, optimise speed, capture 4 explicit screenshots per RUT visit.

## Project Overview
**RealFlow** — self-hosted traffic + conversion + anti-detect automation platform. Core modules: Real User Traffic (Playwright bot farm), Form Filler, CPI (Cost-Per-Install), Visual Recorder (interactive JSON builder).

## Architecture (Emergent deployment)
| Component | Location | Status |
|---|---|---|
| Frontend (React + CRACO + Tailwind + shadcn) | `/app/frontend` :3000 | RUNNING |
| Backend (FastAPI + Playwright) | `/app/backend` :8001 | RUNNING |
| MongoDB | local :27017 | RUNNING |
| CPI Worker (USB-bound) | `/app/realflow-cpi-worker` | not run (needs hardware) |

## Key Features
- Real User Traffic (RUT): anti-detect headless Chromium, proxy/UA rotation, form fill
- Visual Recorder: interactive Playwright session that records clicks → automation JSON
- CPI Module: offers, jobs, devices, smart links, dashboard
- Admin Panel, Conversions/Clicks/Links analytics

## What's been implemented
- 2026-05-06: Repo cloned & set up; admin auth working
- Jan 2026: `processed` NameError fix; post_submit_wait expanded 15s→600s; disk persistence for inline uploads; Resume-from-visit feature
- Feb 2026: Built full Visual Recorder MVP (interactive JSON builder)
- **Feb 2026 (this fork)**: Visual Recorder async startup refactor + RUT 4-screenshot live activity + bulk speed optimisation
  - `visual_recorder.py` — `start_session` now returns immediately (<2s) and runs Playwright launch + initial goto in `asyncio.create_task` wrapped with `asyncio.wait_for(timeout=30)`. New state machine: `starting | ready | error | stopped`
  - `server.py` — `/visual-recorder/start` returns state immediately; `/state` returns `{state, error_message, elapsed_seconds}`; `/screenshot` returns 202+JSON while not ready, 200 image once ready; **also accepts `?t=<jwt>` query token so `<img>` tags can load directly without fetch/blob plumbing**; all 8 interaction endpoints (click/type/wait/wait-load/scroll/navigate/group-random/mark-final) return 409 if state≠ready via new `_vr_require_ready` helper
  - `VisualRecorderPage.js` — new connecting / error / ready UI states with elapsed timer + Try-Again button. Polls `/state` every 1s. **Live preview now uses direct `<img src=…?t=token&ts=tick>` (cache-busted via tick state) instead of fetch+blob URLs — eliminates blob race condition that was causing broken-image icons**. End-to-end verified via Playwright: `img_complete=true, naturalWidth=824, naturalHeight=1828`
  - `real_user_traffic.py` — 4 explicit live-activity stages emitted with `📷 N/4` labels:
    - `landing` (1/4 URL fully loaded — captured AFTER networkidle, no longer before)
    - `form_filled` (2/4 Form filled — re-labeled from `pre_submit`)
    - `post_submit` (3/4 Post-submit page loaded)
    - `final` (4/4 Final conversion page — new explicit step push, was previously bundled into `done`)
  - `RealUserTrafficPage.js` — Live Activity modal recognises new stage colors (cyan/pink/purple/emerald)
  - Bulk RUT speed: shared+relaunch Chromium args extended (`--disable-extensions`, `--disable-background-networking`, `--no-first-run`, `--mute-audio`, etc.). NetworkIdle waits reduced 20s→6s + 10s→4s
  - Test credentials seeded: `vrtest@test.local / TestPass2026!` with `real_user_traffic=true`
- Tests: `/app/backend/tests/test_iteration7_visual_recorder_async.py` (12/12 ✅)

## Known Limitations
- Bad proxy → state may still go to `ready` because Chromium launch succeeds even if proxy never delivers a page. User sees a chrome-error preview rather than a hard error. Acceptable for now.
- iter6 RUT test suite uses stale credentials (`test@test.com/test12345`); needs update to `vrtest@test.local` or DB seeding.

## Backlog (P1 → P3)
- P1: UI design overhaul (Dashboard / Login modernise) — user previously requested
- P1: Refactor server.py 13.6k LOC into routers (visual_recorder_router, rut_router, uploads_router)
- P2: Expose `STARTUP_TIMEOUT_S` and `VR_STARTUP_TIMEOUT_S` as env vars
- P2: Return 410 (instead of 202) when VR session is in terminal `error` state for clearer client semantics
- P2: Add `Retry-After` header on 409 responses from `_vr_require_ready`
- P3: Resource-blocking toggle (block images/fonts/media) in RUT job config for further speed
