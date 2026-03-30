# Requirements Document

## Introduction

DACAP (Decentralized Autonomous Capital Allocation Protocol) is a full-stack DeFi platform where AI agents compete for capital allocation under cryptoeconomic constraints. The system uses a Multiplicative Weights Update (MWU) algorithm to dynamically reallocate capital across agents based on risk-adjusted performance. The platform consists of four layers: a React/TypeScript frontend, a FastAPI/Python backend with ML/quant engine, four Solidity smart contracts, and a PostgreSQL + Redis data layer. The codebase is scaffolded but not yet wired together, tested, or production-ready.

## Glossary

- **System**: The DACAP platform as a whole
- **Frontend**: The React + TypeScript + Vite application
- **Backend**: The FastAPI Python application
- **ML_Engine**: The Python modules for Monte Carlo, regime classification, and allocation (monte_carlo.py, regime_classifier.py, allocation.py)
- **CapitalVault**: The Solidity contract that custodies investor funds and enforces risk limits
- **AllocationEngine_Contract**: The Solidity contract that stores MWU weights on-chain
- **AgentRegistry**: The Solidity contract managing agent registration and staking
- **SlashingModule**: The Solidity contract monitoring drawdown and executing slashing
- **API**: The FastAPI backend REST interface
- **Agent**: An autonomous strategy participant registered in the protocol
- **Pool**: A risk-class capital pool (Conservative, Balanced, or Aggressive)
- **MWU**: Multiplicative Weights Update algorithm
- **Layout**: The shared shell component (Sidebar + Topbar + Outlet)
- **Hardhat**: The Ethereum development and testing framework for smart contracts

## Requirements

### Requirement 1: Frontend Dependency Installation and Build

**User Story:** As a developer, I want the frontend to install all dependencies and build without errors, so that I can run the application locally.

#### Acceptance Criteria

1. WHEN `npm install` is run in `dacap/frontend`, THE Frontend SHALL install all packages listed in `package.json` without errors
2. WHEN `npm run build` is run in `dacap/frontend`, THE Frontend SHALL compile TypeScript and produce a valid Vite build artifact without type errors
3. THE Frontend SHALL resolve all module imports for `react`, `react-dom`, `react-router-dom`, `framer-motion`, `recharts`, `lucide-react`, `zustand`, `axios`, `@tanstack/react-query`, and `clsx`
4. THE Frontend SHALL have a `tsconfig.json` that includes `"jsx": "react-jsx"` and `"types": ["react", "react-dom"]` so JSX intrinsic elements resolve correctly

### Requirement 2: Frontend Pages Render Without Errors

**User Story:** As a developer, I want all nine frontend pages to render without runtime errors, so that I can verify the UI is functional.

#### Acceptance Criteria

1. WHEN the user navigates to `/`, THE Frontend SHALL render the Landing page with hero section, features grid, and math section
2. WHEN the user navigates to `/dashboard`, THE Frontend SHALL render the Dashboard page with metric cards, portfolio chart, allocation pie, and agent table
3. WHEN the user navigates to `/agents`, THE Frontend SHALL render the Agents page with search, filter buttons, and agent cards
4. WHEN the user navigates to `/agents/:id`, THE Frontend SHALL render the AgentDetail page with metrics, PnL chart, and allocation chart
5. WHEN the user navigates to `/pools`, THE Frontend SHALL render the RiskPools page with three pool cards and comparison table
6. WHEN the user navigates to `/allocation`, THE Frontend SHALL render the AllocationEngine page with MWU simulation controls and live bar chart
7. WHEN the user navigates to `/analytics`, THE Frontend SHALL render the Analytics page with all five tabs (Monte Carlo, Rolling Volatility, Trend Wave, Regime Classifier, Time Series)
8. WHEN the user navigates to `/governance`, THE Frontend SHALL render the Governance page with proposals list and parameter sliders
9. WHEN the user navigates to `/contracts`, THE Frontend SHALL render the Contracts page with contract cards, detail sections, and code preview
10. WHILE on any page under the Layout route, THE Frontend SHALL display the Sidebar and Topbar without errors

### Requirement 3: Backend Module Structure and Startup

**User Story:** As a developer, I want the FastAPI backend to start without import errors, so that the API is accessible.

#### Acceptance Criteria

1. WHEN `uvicorn main:app` is run from `dacap/backend`, THE Backend SHALL start without `ModuleNotFoundError` or `ImportError`
2. THE Backend SHALL have `__init__.py` files in `api/`, `ml/`, `core/`, `db/`, and `contracts/` directories so Python treats them as packages
3. WHEN `GET /health` is called, THE API SHALL return `{"status": "ok", "version": "2.1.0"}` with HTTP 200
4. THE Backend SHALL load environment variables from a `.env` file using `python-dotenv` for `DATABASE_URL` and `REDIS_URL`

### Requirement 4: Backend API Endpoints

**User Story:** As a developer, I want all API routes to return valid responses, so that the frontend can consume real data.

#### Acceptance Criteria

1. WHEN `GET /api/agents` is called, THE API SHALL return a JSON array of agent objects with fields: `id`, `name`, `strategy`, `risk`, `sharpe`, `drawdown`, `allocation`, `pnl`, `volatility`, `stake`, `status`, `score`
2. WHEN `GET /api/agents/{agent_id}` is called with a valid ID, THE API SHALL return the matching agent object with HTTP 200
3. IF `GET /api/agents/{agent_id}` is called with an invalid ID, THEN THE API SHALL return HTTP 404 with a descriptive error message
4. WHEN `GET /api/pools` is called, THE API SHALL return a JSON array of pool objects with fields: `id`, `name`, `tvl`, `apy`, `agents`, `volatility_cap`
5. WHEN `GET /api/analytics/monte-carlo` is called, THE API SHALL return `{"stats": {...}, "paths": [...]}` computed by the ML_Engine
6. WHEN `GET /api/analytics/rolling-volatility` is called, THE API SHALL return `{"volatility": [...]}` as a float array
7. WHEN `GET /api/analytics/regime` is called, THE API SHALL return `{"regimes": [...], "confidences": [...]}` from the RegimeClassifier
8. WHEN `GET /api/analytics/allocation-weights` is called, THE API SHALL return `{"weights_history": [...], "final_weights": [...], "regret_bound": float}`
9. WHEN `GET /api/governance/proposals` is called, THE API SHALL return the proposals array
10. WHEN `GET /api/contracts` is called, THE API SHALL return the contracts array
11. IF any API handler raises an unhandled exception, THEN THE API SHALL return HTTP 500 with `{"detail": "<error message>"}` and log the error

### Requirement 5: Backend Error Handling

**User Story:** As a developer, I want the backend to handle errors gracefully, so that the frontend receives meaningful error responses.

#### Acceptance Criteria

1. IF a request body fails Pydantic validation, THEN THE API SHALL return HTTP 422 with field-level error details
2. IF `POST /api/pools/deposit` is called with a non-existent `pool_id`, THEN THE API SHALL return HTTP 404
3. IF `POST /api/governance/vote` is called with a non-existent `proposal_id`, THEN THE API SHALL return HTTP 404
4. THE Backend SHALL include a global exception handler that catches unhandled exceptions and returns HTTP 500

### Requirement 6: ML Engine Correctness

**User Story:** As a quant developer, I want the ML algorithms to produce mathematically correct outputs, so that the analytics are trustworthy.

#### Acceptance Criteria

1. WHEN `gbm_paths(S0, mu, sigma, T, n_paths)` is called, THE ML_Engine SHALL return an ndarray of shape `(n_paths, T+1)` where all values are positive
2. WHEN `var_cvar(paths)` is called, THE ML_Engine SHALL return a dict where `var <= 0` (loss) and `cvar <= var` (CVaR is worse than VaR)
3. WHEN `mwu_update(weights, returns, eta)` is called, THE ML_Engine SHALL return weights that sum to 1.0 within floating-point tolerance (1e-9)
4. WHEN `mwu_update` is called repeatedly with identical returns, THE ML_Engine SHALL produce weights that converge (higher-return agents gain weight monotonically)
5. WHEN `rolling_volatility(returns, window)` is called, THE ML_Engine SHALL return an array of the same length as `returns` with all non-negative values
6. WHEN `RegimeClassifier.predict(returns)` is called after `fit`, THE ML_Engine SHALL return regimes and confidences of equal length to `returns`, with each confidence in `[0, 1]`
7. WHEN `risk_adjusted_return(raw_return, volatility, drawdown)` is called with `volatility=0` and `drawdown=0`, THE ML_Engine SHALL return `0.0` without raising a ZeroDivisionError

### Requirement 7: Smart Contract Compilation

**User Story:** As a smart contract developer, I want all four Solidity contracts to compile without errors, so that they can be deployed and tested.

#### Acceptance Criteria

1. THE System SHALL have a Hardhat project initialized in `dacap/contracts/` with `hardhat.config.js`, `package.json`, and OpenZeppelin dependencies
2. WHEN `npx hardhat compile` is run, THE System SHALL compile `CapitalVault.sol`, `AllocationEngine.sol`, `AgentRegistry.sol`, and `SlashingModule.sol` without errors or warnings
3. THE System SHALL produce ABI JSON artifacts in `dacap/contracts/artifacts/` after compilation

### Requirement 8: Smart Contract Tests

**User Story:** As a smart contract developer, I want unit tests for all four contracts, so that I can verify on-chain logic before deployment.

#### Acceptance Criteria

1. WHEN `npx hardhat test` is run, THE System SHALL execute all contract test suites and report pass/fail
2. THE CapitalVault tests SHALL verify: deposit increases `poolTVL`, withdraw decreases `poolTVL`, `updateWeights` reverts if caller is not `allocationEngine`, weights that do not sum to `1e18` revert
3. THE AllocationEngine_Contract tests SHALL verify: `submitUpdate` stores scores, `setEta` reverts for out-of-range values, reputation decay formula is applied correctly
4. THE AgentRegistry tests SHALL verify: `registerAgent` reverts if stake is below `MIN_STAKE`, `activateAgent` reverts before simulation period ends, `slashAgent` reduces `stakedAmount` proportionally
5. THE SlashingModule tests SHALL verify: `reportPerformance` emits `DrawdownReported` when drawdown exceeds threshold, `_executeSlash` calls registry and vault, `setThreshold` reverts for out-of-range values

### Requirement 9: Database Schema and Migrations

**User Story:** As a backend developer, I want the database schema to be applied correctly, so that the application can persist data.

#### Acceptance Criteria

1. WHEN `schema.sql` is applied to a fresh PostgreSQL 16 database, THE System SHALL create all tables: `investors`, `pools`, `deposits`, `agents`, `agent_performance`, `allocation_history`, `slash_events`, `proposals`, `votes`, `contracts`
2. THE System SHALL seed the `pools` table with the three default rows (conservative, balanced, aggressive) as part of `schema.sql`
3. THE System SHALL have all indexes defined in `schema.sql` created without errors
4. THE Backend SHALL have a `db/connection.py` module that creates a SQLAlchemy engine from `DATABASE_URL`

### Requirement 10: Frontend API Integration

**User Story:** As a developer, I want the frontend to fetch real data from the backend API, so that the UI reflects live protocol state.

#### Acceptance Criteria

1. THE Frontend SHALL have an `src/utils/api.ts` module that exports an Axios instance configured with `baseURL` from `VITE_API_URL` environment variable
2. THE Frontend SHALL have React Query hooks in `src/hooks/` for: `useAgents`, `useAgent(id)`, `usePools`, `useMonteCarloData`, `useGovernanceProposals`
3. WHEN the Agents page loads, THE Frontend SHALL fetch agent data from `GET /api/agents` and display it, falling back to mock data if the API is unavailable
4. WHEN the Analytics page loads and the Monte Carlo tab is active, THE Frontend SHALL fetch from `GET /api/analytics/monte-carlo` and render the returned paths
5. WHEN the Governance page loads, THE Frontend SHALL fetch proposals from `GET /api/governance/proposals`
6. IF an API request fails, THEN THE Frontend SHALL display an error state or fall back to mock data without crashing

### Requirement 11: Docker Compose Integration

**User Story:** As a developer, I want `docker-compose up --build` to start all services, so that the full stack runs in a single command.

#### Acceptance Criteria

1. WHEN `docker-compose up --build` is run from `dacap/`, THE System SHALL build and start `frontend`, `backend`, `postgres`, and `redis` services without errors
2. WHEN all services are running, THE Frontend SHALL be accessible at `http://localhost:3000`
3. WHEN all services are running, THE Backend API SHALL be accessible at `http://localhost:8000/docs`
4. WHEN all services are running, THE Backend SHALL successfully connect to PostgreSQL and apply the schema
5. THE Backend Dockerfile SHALL install all Python dependencies from `requirements.txt` without errors
6. THE Frontend Dockerfile SHALL run `npm install` and start the Vite dev server on port 3000

### Requirement 12: Backend Unit Tests

**User Story:** As a developer, I want a pytest test suite for the backend, so that I can verify API and ML correctness automatically.

#### Acceptance Criteria

1. THE Backend SHALL have a `tests/` directory with `test_agents.py`, `test_pools.py`, `test_analytics.py`, `test_ml.py`
2. WHEN `pytest dacap/backend/tests/` is run, THE System SHALL execute all tests and report results
3. THE `test_ml.py` suite SHALL include property-based tests for `mwu_update` (weights sum to 1), `gbm_paths` (all positive), and `var_cvar` (CVaR ≤ VaR)
4. THE `test_agents.py` suite SHALL test `GET /api/agents` returns 200, `GET /api/agents/INVALID` returns 404, `POST /api/agents/register` returns a new agent ID
5. THE `test_analytics.py` suite SHALL test that all four analytics endpoints return HTTP 200 with the expected top-level keys

### Requirement 13: Frontend Component Tests

**User Story:** As a developer, I want Vitest component tests for key frontend components, so that UI regressions are caught automatically.

#### Acceptance Criteria

1. THE Frontend SHALL have Vitest and React Testing Library configured in `vite.config.ts`
2. THE Frontend SHALL have tests in `src/__tests__/` for: Landing renders hero text, Dashboard renders metric cards, Agents renders agent cards, AllocationEngine MWU simulation updates weights on step
3. WHEN `vitest --run` is executed, THE System SHALL run all frontend tests and report pass/fail
