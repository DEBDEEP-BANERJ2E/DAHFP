# Task List

## Phase 1: Frontend — Install & Fix Build

- [x] 1.1 Run `npm install` in `dacap/frontend` to install all dependencies
  - Test: `ls dacap/frontend/node_modules/react` exists; no error output
- [x] 1.2 Fix `dacap/frontend/tsconfig.json` — add `"jsx": "react-jsx"` and `"types": ["react", "react-dom"]` to `compilerOptions`
  - Test: `getDiagnostics` on `src/pages/Landing.tsx` shows zero JSX intrinsic errors
- [x] 1.3 Verify `dacap/frontend/src/main.tsx` renders without errors (BrowserRouter + QueryClientProvider wrapping App)
  - Test: `getDiagnostics` on `src/main.tsx` shows no errors
- [x] 1.4 Run `npm run build` in `dacap/frontend` and confirm it exits 0 with no TypeScript errors
  - Test: `dist/` directory is created; build output shows no errors

## Phase 2: Frontend — Verify All Pages Render

- [x] 2.1 Verify `Landing.tsx` renders: check imports resolve, no unused import warnings that break build
  - Test: `getDiagnostics` on `src/pages/Landing.tsx` shows zero errors
- [x] 2.2 Verify `Dashboard.tsx` renders: remove unused `LineChart`, `Line`, `pnlHistory` imports
  - Test: `getDiagnostics` on `src/pages/Dashboard.tsx` shows zero errors
- [x] 2.3 Verify `Agents.tsx` renders: remove unused `Filter`, `TrendingUp` imports; fix `e` implicit any in onChange
  - Test: `getDiagnostics` on `src/pages/Agents.tsx` shows zero errors
- [x] 2.4 Verify `AgentDetail.tsx` renders: check all imports and params resolve
  - Test: `getDiagnostics` on `src/pages/AgentDetail.tsx` shows zero errors
- [x] 2.5 Verify `RiskPools.tsx` renders: check all imports resolve
  - Test: `getDiagnostics` on `src/pages/RiskPools.tsx` shows zero errors
- [x] 2.6 Verify `AllocationEngine.tsx` renders: check `AnimatePresence` import is used or removed
  - Test: `getDiagnostics` on `src/pages/AllocationEngine.tsx` shows zero errors
- [x] 2.7 Verify `Analytics.tsx` renders: check all imports and tab logic
  - Test: `getDiagnostics` on `src/pages/Analytics.tsx` shows zero errors
- [x] 2.8 Verify `Governance.tsx` renders: check `JSX.Element` type reference in `statusIcon` record
  - Test: `getDiagnostics` on `src/pages/Governance.tsx` shows zero errors
- [x] 2.9 Verify `Contracts.tsx` renders: check all imports resolve
  - Test: `getDiagnostics` on `src/pages/Contracts.tsx` shows zero errors
- [x] 2.10 Verify Layout components render: `Layout.tsx`, `Sidebar.tsx`, `Topbar.tsx`
  - Test: `getDiagnostics` on all three layout files shows zero errors

## Phase 3: Backend — Package Structure and Startup

- [x] 3.1 Create `dacap/backend/api/__init__.py` (empty file)
  - Test: file exists at correct path
- [x] 3.2 Create `dacap/backend/ml/__init__.py` (empty file)
  - Test: file exists at correct path
- [x] 3.3 Create `dacap/backend/core/__init__.py` (empty file)
  - Test: file exists at correct path
- [x] 3.4 Create `dacap/backend/db/__init__.py` (empty file)
  - Test: file exists at correct path
- [x] 3.5 Create `dacap/backend/contracts/__init__.py` (empty file)
  - Test: file exists at correct path
- [x] 3.6 Create `dacap/backend/db/connection.py` with SQLAlchemy engine setup using `DATABASE_URL` env var, falling back to SQLite for local dev
  - Test: `from db.connection import engine` imports without error
- [x] 3.7 Create `dacap/backend/.env.example` with `DATABASE_URL=postgresql://dacap:dacap@localhost:5432/dacap` and `REDIS_URL=redis://localhost:6379`
  - Test: file exists with correct keys
- [x] 3.8 Update `dacap/backend/main.py` to load `.env` via `python-dotenv` and add a global exception handler returning HTTP 500
  - Test: `GET /health` returns `{"status": "ok", "version": "2.1.0"}`
- [x] 3.9 Fix HTTP error responses in `dacap/backend/api/pools.py` — `get_pool` and `deposit` should raise `HTTPException(404)` instead of returning `{"error": ...}`
  - Test: `GET /api/pools/nonexistent` returns HTTP 404
- [x] 3.10 Fix HTTP error responses in `dacap/backend/api/governance.py` — `vote` should raise `HTTPException(404)` for missing proposal
  - Test: `POST /api/governance/vote` with invalid `proposal_id` returns HTTP 404

## Phase 4: Backend — ML Engine Correctness

- [x] 4.1 Verify `gbm_paths` returns shape `(n_paths, T+1)` and all values are positive — add assertion guard for `sigma > 0`
  - Test: `gbm_paths(100000, 0.15, 0.20, 30, 100).shape == (100, 31)` and `(paths > 0).all()`
- [x] 4.2 Verify `var_cvar` returns dict with `cvar <= var` — add type hints and docstring clarifying sign convention
  - Test: `var_cvar(paths)["cvar"] <= var_cvar(paths)["var"]` for any valid paths
- [x] 4.3 Fix `risk_adjusted_return` in `dacap/backend/core/allocation.py` — guard against `volatility=0` and `drawdown=0` returning 0.0 (already done, verify test)
  - Test: `risk_adjusted_return(0.1, 0, 0) == 0.0` without exception
- [x] 4.4 Verify `mwu_update` weights sum to 1.0 — add assertion in function body
  - Test: `abs(mwu_update(w, r, 0.01).sum() - 1.0) < 1e-9` for random inputs
- [x] 4.5 Verify `rolling_volatility` returns array of same length as input with all non-negative values
  - Test: `len(rolling_volatility(returns, 30)) == len(returns)` and `(vol >= 0).all()`
- [x] 4.6 Verify `RegimeClassifier.predict` returns confidences in `[0, 1]` — add normalization check
  - Test: all confidences in `[0.0, 1.0]` for any returns input

## Phase 5: Smart Contracts — Hardhat Setup

- [x] 5.1 Create `dacap/contracts/package.json` with Hardhat, `@nomicfoundation/hardhat-toolbox`, and `@openzeppelin/contracts` v5 dependencies
  - Test: file exists with correct devDependencies
- [x] 5.2 Run `npm install` in `dacap/contracts/`
  - Test: `node_modules/@openzeppelin/contracts` exists
- [x] 5.3 Create `dacap/contracts/hardhat.config.js` configured for Solidity 0.8.20 with sources at `.` and tests at `./test`
  - Test: file exists and is valid JS
- [x] 5.4 Fix OpenZeppelin v5 import path in `CapitalVault.sol` — change `@openzeppelin/contracts/security/ReentrancyGuard.sol` to `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
  - Test: `npx hardhat compile` does not error on CapitalVault
- [x] 5.5 Fix OpenZeppelin v5 import path in `AgentRegistry.sol` — same ReentrancyGuard path fix
  - Test: `npx hardhat compile` does not error on AgentRegistry
- [x] 5.6 Run `npx hardhat compile` and verify all four contracts compile cleanly
  - Test: `artifacts/` directory contains ABI JSON for all four contracts; exit code 0

## Phase 6: Smart Contract Tests

- [x] 6.1 Create `dacap/contracts/test/` directory and `CapitalVault.test.js`
  - Tests: deposit increases `poolTVL`; withdraw decreases `poolTVL`; `updateWeights` reverts if caller is not `allocationEngine`; weights not summing to `1e18` revert
- [x] 6.2 Create `dacap/contracts/test/AllocationEngine.test.js`
  - Tests: `submitUpdate` stores agent scores; `setEta(0)` reverts; `setEta(50001)` reverts; reputation decay formula produces correct value
- [x] 6.3 Create `dacap/contracts/test/AgentRegistry.test.js`
  - Tests: `registerAgent` reverts if stake < `MIN_STAKE`; `activateAgent` reverts before simulation period ends; `slashAgent` reduces `stakedAmount` by correct proportion; `getActiveAgents` returns only active agents
- [x] 6.4 Create `dacap/contracts/test/SlashingModule.test.js`
  - Tests: `reportPerformance` emits `DrawdownReported` when drawdown > threshold; `setThreshold(400)` reverts (below 500); `setThreshold(5001)` reverts (above 5000); slash history is recorded
- [x] 6.5 Run `npx hardhat test` and verify all contract tests pass
  - Test: all test suites green; exit code 0

## Phase 7: Database

- [x] 7.1 Verify `dacap/db/schema.sql` applies cleanly to a fresh PostgreSQL database — run through Docker or local psql
  - Test: all 10 tables created; 3 pool seed rows inserted; all indexes created without error
- [x] 7.2 Verify `dacap/docker-compose.yml` mounts `schema.sql` correctly as init script for the postgres service
  - Test: `docker-compose up postgres` initializes DB with schema on first run
- [x] 7.3 Add `dacap/db/seed.sql` with sample agents, proposals, and contracts rows for development
  - Test: seed data inserts without FK violations

## Phase 8: Frontend API Integration

- [x] 8.1 Create `dacap/frontend/src/utils/api.ts` — Axios instance with `baseURL` from `VITE_API_URL` env var
  - Test: `getDiagnostics` on `api.ts` shows no errors; import works in other files
- [x] 8.2 Create `dacap/frontend/src/hooks/useAgents.ts` — React Query hook for `GET /api/agents` with mock data as `placeholderData`
  - Test: `getDiagnostics` shows no errors; hook returns `{ data, isLoading, isError }`
- [x] 8.3 Create `dacap/frontend/src/hooks/useAgent.ts` — React Query hook for `GET /api/agents/:id`
  - Test: `getDiagnostics` shows no errors
- [x] 8.4 Create `dacap/frontend/src/hooks/usePools.ts` — React Query hook for `GET /api/pools`
  - Test: `getDiagnostics` shows no errors
- [x] 8.5 Create `dacap/frontend/src/hooks/useMonteCarloData.ts` — React Query hook for `GET /api/analytics/monte-carlo`
  - Test: `getDiagnostics` shows no errors
- [x] 8.6 Create `dacap/frontend/src/hooks/useGovernanceProposals.ts` — React Query hook for `GET /api/governance/proposals`
  - Test: `getDiagnostics` shows no errors
- [x] 8.7 Update `dacap/frontend/src/pages/Agents.tsx` to use `useAgents` hook instead of direct mock data import; keep mock as fallback
  - Test: `getDiagnostics` shows no errors; page still renders with mock data when API is down
- [x] 8.8 Update `dacap/frontend/src/pages/Analytics.tsx` Monte Carlo tab to use `useMonteCarloData` hook; keep mock paths as fallback
  - Test: `getDiagnostics` shows no errors
- [x] 8.9 Update `dacap/frontend/src/pages/Governance.tsx` to use `useGovernanceProposals` hook
  - Test: `getDiagnostics` shows no errors
- [x] 8.10 Add `VITE_API_URL=http://localhost:8000` to `dacap/frontend/.env.example`
  - Test: file exists with correct key

## Phase 9: Backend Tests

- [x] 9.1 Add `pytest`, `pytest-asyncio`, and `hypothesis` to `dacap/backend/requirements.txt`
  - Test: `pip install -r requirements.txt` succeeds
- [x] 9.2 Create `dacap/backend/tests/__init__.py` and `dacap/backend/tests/conftest.py` with FastAPI `TestClient` fixture
  - Test: `conftest.py` imports without error; `client` fixture is available
- [x] 9.3 Create `dacap/backend/tests/test_agents.py`
  - Tests: `GET /api/agents` → 200 + list; `GET /api/agents/AGT-001` → 200 + correct name; `GET /api/agents/INVALID` → 404; `POST /api/agents/register` → 200 + new ID
- [x] 9.4 Create `dacap/backend/tests/test_pools.py`
  - Tests: `GET /api/pools` → 200 + 3 pools; `GET /api/pools/conservative` → 200; `GET /api/pools/nonexistent` → 404; `POST /api/pools/deposit` with valid data → 200
- [x] 9.5 Create `dacap/backend/tests/test_analytics.py`
  - Tests: all four analytics endpoints return 200; `monte-carlo` response has `stats` and `paths` keys; `regime` response has `regimes` and `confidences` of equal length
- [x] 9.6 Create `dacap/backend/tests/test_ml.py` with property-based tests using Hypothesis
  - Tests: `mwu_update` weights sum to 1.0 (property); `gbm_paths` all positive (property); `var_cvar` CVaR ≤ VaR (property); `rolling_volatility` all non-negative (property); `risk_adjusted_return` with zero denom returns 0.0 (edge case)
- [x] 9.7 Run `pytest dacap/backend/tests/ -v` and verify all tests pass
  - Test: all tests green; exit code 0

## Phase 10: Frontend Tests

- [x] 10.1 Add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` to `dacap/frontend/package.json` devDependencies
  - Test: packages listed in `package.json`; `npm install` succeeds
- [x] 10.2 Update `dacap/frontend/vite.config.ts` to add `test` config block with `environment: 'jsdom'`, `globals: true`, `setupFiles`
  - Test: `getDiagnostics` on `vite.config.ts` shows no errors
- [x] 10.3 Create `dacap/frontend/src/__tests__/setup.ts` importing `@testing-library/jest-dom`
  - Test: file exists; no import errors
- [x] 10.4 Create `dacap/frontend/src/__tests__/Landing.test.tsx` — test that hero heading and "Enter App" button render
  - Test: test file has at least 2 test cases; `getDiagnostics` shows no errors
- [x] 10.5 Create `dacap/frontend/src/__tests__/Dashboard.test.tsx` — test that metric cards render with expected labels
  - Test: test file has at least 2 test cases
- [x] 10.6 Create `dacap/frontend/src/__tests__/Agents.test.tsx` — test that agent cards render and search filter works
  - Test: test file has at least 3 test cases (renders, search filters, click navigates)
- [x] 10.7 Create `dacap/frontend/src/__tests__/AllocationEngine.test.tsx` — test that simulate button toggles running state and weights update
  - Test: test file has at least 2 test cases
- [x] 10.8 Run `vitest --run` in `dacap/frontend` and verify all tests pass
  - Test: all tests green; exit code 0

## Phase 11: Docker Compose End-to-End

- [x] 11.1 Verify `dacap/backend/Dockerfile` — confirm `COPY . .` happens after `pip install` for layer caching; confirm `uvicorn` CMD is correct
  - Test: `docker build -t dacap-backend dacap/backend` succeeds
- [x] 11.2 Verify `dacap/frontend/Dockerfile` — confirm `npm install` runs before `COPY . .` for layer caching; confirm Vite dev server starts on `--host`
  - Test: `docker build -t dacap-frontend dacap/frontend` succeeds
- [x] 11.3 Add `healthcheck` to the `backend` service in `docker-compose.yml` using `GET /health`
  - Test: `docker-compose config` validates without errors
- [x] 11.4 Add `healthcheck` to the `postgres` service in `docker-compose.yml` using `pg_isready`
  - Test: `docker-compose config` validates without errors
- [x] 11.5 Update `backend` service in `docker-compose.yml` to `depends_on` postgres with `condition: service_healthy`
  - Test: backend waits for postgres before starting
- [x] 11.6 Run `docker-compose up --build` from `dacap/` and verify all four services start and pass health checks
  - Test: `curl http://localhost:3000` returns HTML; `curl http://localhost:8000/health` returns `{"status":"ok"}`

## Phase 12: Polish and Final Verification

- [x] 12.1 Add `src/utils/cn.ts` helper combining `clsx` + `tailwind-merge` for conditional class names (used across pages)
  - Test: `getDiagnostics` shows no errors; import works
- [x] 12.2 Fix `Governance.tsx` — replace `JSX.Element` type in `statusIcon` record with `React.ReactElement` to avoid implicit JSX namespace dependency
  - Test: `getDiagnostics` on `Governance.tsx` shows no errors
- [x] 12.3 Add `src/store/protocolStore.ts` — minimal Zustand store for `{ walletAddress, isConnected }` used by Topbar wallet button
  - Test: `getDiagnostics` shows no errors; Topbar can import and use the store
- [x] 12.4 Verify `dacap/frontend/src/styles/globals.css` Tailwind directives are correct and `tailwind.config.js` content paths cover all source files
  - Test: build produces CSS with custom colors (cyan, purple, etc.)
- [x] 12.5 Run full end-to-end smoke test: start backend, start frontend, navigate all 9 pages, verify no console errors
  - Test: all pages load; no 500 errors from API; no React render errors in console
