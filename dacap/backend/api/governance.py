from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

PROPOSALS = [
    {"id": 1, "title": "Increase η from 0.01 to 0.015", "votes_for": 68, "votes_against": 32, "status": "active"},
    {"id": 2, "title": "Reduce max drawdown threshold to 15%", "votes_for": 81, "votes_against": 19, "status": "passed"},
]

PARAMS = {"eta": 0.01, "slashing_threshold_bps": 2000, "aggressive_vol_cap": 0.35}


class Proposal(BaseModel):
    title: str
    param: str
    new_value: float


class Vote(BaseModel):
    proposal_id: int
    support: bool
    voter: str


@router.get("/proposals")
def list_proposals():
    return PROPOSALS


@router.post("/propose")
def create_proposal(data: Proposal):
    new = {"id": len(PROPOSALS) + 1, "title": data.title, "votes_for": 0, "votes_against": 0, "status": "active"}
    PROPOSALS.append(new)
    return new


@router.post("/vote")
def vote(data: Vote):
    p = next((p for p in PROPOSALS if p["id"] == data.proposal_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if data.support:
        p["votes_for"] += 1
    else:
        p["votes_against"] += 1
    return {"message": "Vote recorded", "proposal": p}


@router.get("/params")
def get_params():
    return PARAMS
