from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

AGENTS = [
    {"id": "AGT-001", "name": "AlphaWave", "strategy": "Momentum + ML", "risk": "Aggressive",
     "sharpe": 2.41, "drawdown": -8.2, "allocation": 28, "pnl": 34.7, "volatility": 18.4,
     "stake": 50000, "status": "active", "score": 91, "address": "0x1a2b3c4d5e6f"},
    {"id": "AGT-002", "name": "NeuralArb", "strategy": "Cross-DEX Arbitrage", "risk": "Balanced",
     "sharpe": 1.87, "drawdown": -4.1, "allocation": 22, "pnl": 21.3, "volatility": 11.2,
     "stake": 40000, "status": "active", "score": 84, "address": "0x2b3c4d5e6f7a"},
    {"id": "AGT-003", "name": "QuantSigma", "strategy": "Mean Reversion", "risk": "Conservative",
     "sharpe": 1.52, "drawdown": -2.8, "allocation": 18, "pnl": 14.6, "volatility": 7.8,
     "stake": 35000, "status": "active", "score": 78, "address": "0x3c4d5e6f7a8b"},
]


class AgentRegister(BaseModel):
    name: str
    strategy: str
    risk: str
    stake: float
    address: str


@router.get("/")
def list_agents(risk: Optional[str] = None):
    if risk:
        return [a for a in AGENTS if a["risk"].lower() == risk.lower()]
    return AGENTS


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    agent = next((a for a in AGENTS if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@router.post("/register")
def register_agent(data: AgentRegister):
    new_id = f"AGT-{len(AGENTS) + 1:03d}"
    agent = {"id": new_id, "score": 50, "status": "probation", "allocation": 0,
             "pnl": 0, "drawdown": 0, "sharpe": 0, "volatility": 0, **data.dict()}
    AGENTS.append(agent)
    return {"id": new_id, "message": "Agent registered. Entering simulation arena."}
