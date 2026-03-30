from fastapi import APIRouter

router = APIRouter()

CONTRACTS = [
    {"id": "SC-001", "name": "Capital Vault v2.1", "address": "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
     "status": "deployed", "tvl": 25300000, "audited": True, "abi_url": "/abi/vault.json"},
    {"id": "SC-002", "name": "Allocation Engine v1.4", "address": "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
     "status": "deployed", "tvl": 0, "audited": True, "abi_url": "/abi/engine.json"},
    {"id": "SC-003", "name": "Agent Registry v1.0", "address": "0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
     "status": "deployed", "tvl": 0, "audited": False, "abi_url": "/abi/registry.json"},
    {"id": "SC-004", "name": "Slashing Module v1.2", "address": "0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d",
     "status": "deployed", "tvl": 0, "audited": True, "abi_url": "/abi/slashing.json"},
]


@router.get("/")
def list_contracts():
    return CONTRACTS


@router.get("/{contract_id}")
def get_contract(contract_id: str):
    c = next((c for c in CONTRACTS if c["id"] == contract_id), None)
    return c or {"error": "Not found"}
