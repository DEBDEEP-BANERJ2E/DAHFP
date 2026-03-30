# DACAP — Decentralized Autonomous Capital Allocation Protocol

A blockchain-native, online-learning-based capital allocator where AI agents compete under cryptoeconomic constraints.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Framer Motion + Recharts
- **Backend**: FastAPI (Python) + NumPy/Pandas/scikit-learn
- **Contracts**: Solidity 0.8.20 (CapitalVault, AllocationEngine, AgentRegistry, SlashingModule)
- **DB**: PostgreSQL 16 + Redis 7

## Quick Start

### Frontend only (fastest)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Full stack with Docker
```bash
docker-compose up --build
# Frontend → http://localhost:3000
# Backend API → http://localhost:8000/docs
```

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Portfolio overview + metrics |
| `/agents` | Agent marketplace |
| `/agents/:id` | Agent detail + PnL charts |
| `/pools` | Conservative / Balanced / Aggressive pools |
| `/allocation` | Live MWU simulation |
| `/analytics` | Monte Carlo, Rolling Vol, Regime Classifier, Time Series |
| `/governance` | DAO proposals + parameter tuning |
| `/contracts` | Smart contract registry + code preview |

## Smart Contracts

| Contract | Role |
|----------|------|
| `CapitalVault.sol` | Custodies funds, enforces risk limits |
| `AllocationEngine.sol` | Stores MWU weights, reputation decay |
| `AgentRegistry.sol` | Registration, staking, anti-sybil |
| `SlashingModule.sol` | Drawdown monitoring, proportional slashing |

## Core Algorithm

```
w_i(t+1) = w_i(t) * exp(η * R_i(t))
Normalized: w_i(t+1) /= Σ_j w_j(t+1)

Regret bound: O(√(T · ln N))
Score_i = Return_i / (Volatility_i + λ · |Drawdown_i|)
Reputation = α · recent + (1-α) · historical
```
