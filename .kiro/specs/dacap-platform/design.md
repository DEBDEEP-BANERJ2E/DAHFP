# Design Document

## Overview

DACAP is a three-layer DeFi platform. The work required is not greenfield — the scaffold exists. The design here describes the wiring, fixes, and test infrastructure needed to make the existing code production-ready.

**Layer 1 — Smart Contracts (Solidity 0.8.20):** CapitalVault, AllocationEngine, AgentRegistry, SlashingModule. Need Hardhat setup, compilation verification, and test suites.

**Layer 2 — Backend (FastAPI + Python):** ML engine (MWU, Monte Carlo, HMM), REST API routes. Need `__init__.py` files, error handling, DB connection module, and pytest suites.

**Layer 3 — Frontend (React + TypeScript + Vite):** Nine pages, shared Layout. Need `npm install`, tsconfig fix, API integration hooks, and Vitest tests.

**Infrastructure:** PostgreSQL schema, Redis, Docker Compose.

---

## Architecture

```
Browser
  └── React App (Vite, port 3000)
        ├── React Query hooks → Axios → FastAPI (port 8000)
        │     ├── /api/agents    → agents.py (in-memory + future DB)
        │     ├── /api/pools     → pools.py
        │     ├── /api/analytics → analytics.py → ML_Engine
        │     ├── /api/governance→ governance.py
        │     └── /api/contracts → contracts.py
        └── Mock data fallback (mockData.ts)

FastAPI Backend
  ├── ml/monte_carlo.py   (GBM simulation)
  ├── ml/regime_classifier.py (HMM)
  ├── core/allocation.py  (MWU engine)
  └── db/connection.py    (SQLAlchemy → PostgreSQL)

Smart Contracts (Hardhat)
  ├── CapitalVault.sol
  ├── AllocationEngine.sol
  ├── AgentRegistry.sol
  └── SlashingModule.sol

Infrastructure
  ├── PostgreSQL 16 (schema.sql)
  ├── Redis 7
  └── Docker Compose
```

---

## Component Design

### 1. Frontend Fix: tsconfig + npm install

The root cause of all JSX errors is that `node_modules` is not installed (no `npm install` has been run). The `tsconfig.json` also needs `"jsx": "react-jsx"` and `"types": ["react", "react-dom"]` to resolve JSX intrinsics.

**tsconfig.json target:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["react", "react-dom"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

### 2. Frontend API Layer

**`src/utils/api.ts`** — Axios instance:
```ts
import axios from 'axios'
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})
```

**`src/hooks/useAgents.ts`** — React Query hook:
```ts
import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'
import { agents as mockAgents } from '../utils/mockData'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/api/agents').then(r => r.data),
    placeholderData: mockAgents,
  })
}
```

Similar hooks for `useAgent(id)`, `usePools`, `useMonteCarloData`, `useGovernanceProposals`.

### 3. Backend Package Structure

Add `__init__.py` to: `api/`, `ml/`, `core/`, `db/`, `contracts/`.

**`db/connection.py`:**
```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dacap.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**Global error handler in `main.py`:**
```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

### 4. Hardhat Setup

**`dacap/contracts/package.json`:**
```json
{
  "name": "dacap-contracts",
  "scripts": { "compile": "hardhat compile", "test": "hardhat test" },
  "devDependencies": {
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.0.0"
  }
}
```

**`dacap/contracts/hardhat.config.js`:**
```js
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.20",
  paths: { sources: ".", tests: "./test", artifacts: "./artifacts" }
};
```

**Note:** OpenZeppelin v5 changed `Ownable` constructor signature — `CapitalVault` and others already use `Ownable(msg.sender)` which is correct for v5. The `security/ReentrancyGuard` import path changed in v5 to `utils/ReentrancyGuard`. This needs to be fixed in `CapitalVault.sol` and `AgentRegistry.sol`.

### 5. Contract Test Structure

Each contract gets a test file in `dacap/contracts/test/`:
- `CapitalVault.test.js`
- `AllocationEngine.test.js`
- `AgentRegistry.test.js`
- `SlashingModule.test.js`

Tests use Hardhat's built-in ethers.js v6 and `@nomicfoundation/hardhat-chai-matchers`.

### 6. Backend Test Structure

```
dacap/backend/tests/
  __init__.py
  conftest.py          # FastAPI TestClient fixture
  test_agents.py
  test_pools.py
  test_analytics.py
  test_ml.py           # property-based tests with hypothesis
```

Add `pytest` and `httpx` to `requirements.txt` (httpx is already there; add `pytest`, `pytest-asyncio`, `hypothesis`).

### 7. Frontend Test Structure

```
dacap/frontend/src/__tests__/
  Landing.test.tsx
  Dashboard.test.tsx
  Agents.test.tsx
  AllocationEngine.test.tsx
```

Add to `package.json` devDependencies: `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

Update `vite.config.ts`:
```ts
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

---

## Data Flow: Frontend → Backend

```
Page loads
  → React Query hook fires
  → Axios GET /api/...
  → FastAPI route handler
  → (in-memory data or ML computation)
  → JSON response
  → React Query caches result
  → Component re-renders with real data
  
If API unavailable:
  → React Query returns placeholderData (mockData.ts)
  → Component renders with mock data
```

---

## Correctness Properties

### ML Engine Properties

1. **MWU weight normalization (invariant):** For any input weights and returns, `sum(mwu_update(w, r, eta)) == 1.0` within 1e-9 tolerance.

2. **GBM positivity (invariant):** For any valid `S0 > 0`, `mu`, `sigma > 0`, `T > 0`, all values in `gbm_paths(...)` are strictly positive.

3. **CVaR ≤ VaR (metamorphic):** For any simulated paths, `var_cvar(paths)["cvar"] <= var_cvar(paths)["var"]`.

4. **Rolling volatility non-negative (invariant):** For any returns array, all values in `rolling_volatility(returns, window)` are `>= 0`.

5. **Regime confidence in [0,1] (invariant):** For any returns, all confidences from `RegimeClassifier.predict` are in `[0.0, 1.0]`.

6. **MWU convergence (metamorphic):** If one agent has strictly higher returns than all others for T steps, that agent's weight after T steps is strictly greater than its initial weight.

### Smart Contract Properties

7. **Deposit/withdraw round-trip (round-trip):** After `deposit(pool, amount)` followed by `withdraw(pool, amount)`, `poolTVL[pool]` returns to its original value.

8. **Weight sum invariant (invariant):** After `updateWeights(agents, weights)`, the sum of all stored `agentWeights` equals `1e18`.

9. **Slash reduces stake (metamorphic):** After `slashAgent(agent, slashBps)`, `agent.stakedAmount` is strictly less than before.

10. **Drawdown threshold enforcement (invariant):** After `reportPerformance` triggers a slash, `agentWeights[agent]` in CapitalVault is `0`.
