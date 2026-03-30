# Design Document: Simulated Trading Engine

## Overview

The Simulated Trading Engine extends DACAP with a fully autonomous on-chain trading simulation.
It replaces the Ganache local blockchain with a Hardhat node (port 8545, chainId 31337), deploys
mock DeFi contracts (MockPriceFeed, MockERC20 ×4, MockUniswapRouter, MockAavePool), extends
CapitalVault with swap and lending functions, runs a Python AgentTradingEngine with per-agent
asyncio loops executing a momentum strategy every 10 seconds, streams TradeExecuted events over
FastAPI WebSocket, and renders a live PnL chart, scrolling TradingFeed, and per-agent trading
controls in the React frontend.

The design follows the existing DACAP three-layer architecture: CapitalVault (custody + execution),
AllocationEngine (weight management), and AgentRegistry (identity). The trading engine sits
entirely within the Python backend and communicates with the chain via web3.py.

---

## Architecture

```mermaid
graph TD
  subgraph Hardhat Node :8545
    CV[CapitalVault\n+executeSwap\n+supplyToAave\n+borrowFromAave\n+withdrawFromAave]
    MPF[MockPriceFeed]
    MUR[MockUniswapRouter]
    MAP[MockAavePool]
    ERC[MockERC20 x4\nWBTC USDC LINK UNI]
  end

  subgraph Python Backend :8000
    ATE[AgentTradingEngine\nasyncio loops]
    WS[WebSocket /ws/trading\nbroadcast manager]
    API[FastAPI REST\n/api/agents/{id}/...]
    EF[web3.py event filter\nTradeExecuted]
  end

  subgraph React Frontend :3000
    DB[Dashboard\nuseWebSocket hook\nPnL chart\nTradingFeed]
    AG[Agents page\ntrading controls\nportfolio value]
  end

  ATE -->|web3.py signed tx| CV
  ATE -->|updatePrices| MPF
  CV -->|swap| MUR
  CV -->|supply/borrow/withdraw| MAP
  MUR -->|mint| ERC
  MAP -->|mint/transfer| ERC
  CV -->|emit TradeExecuted| EF
  EF -->|event| WS
  WS -->|JSON over WS| DB
  WS -->|JSON over WS| AG
  API -->|start/stop| ATE
  API -->|read state| CV
  DB -->|REST| API
  AG -->|REST| API
```

**Key design decisions:**

- Hardhat replaces Ganache: deterministic accounts, mainnet fork capability, better tooling.
- Mock contracts are minimal Solidity — no external oracle dependencies, fully self-contained.
- CapitalVault is the single custody point; agents never hold ETH directly.
- The Python engine uses one asyncio `Task` per agent, cancellable via `stop()`.
- WebSocket broadcast uses a `set` of active connections; disconnects are handled gracefully.
- Frontend state is driven entirely by WebSocket messages — no polling.

---

## Components and Interfaces

### 1. Hardhat Configuration (`dacap/contracts/hardhat.config.js`)

```js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { sources: "./src", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: { url: process.env.ALCHEMY_RPC_URL || "" },
      accounts: { count: 20, accountsBalance: "10000000000000000000000" }  // 10 000 ETH
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  }
};
```

The `ganache` network entry is replaced. `ALCHEMY_RPC_URL` is read from `.env`; if absent the
node runs without forking (suitable for CI).

---

### 2. Mock Contract Interfaces (Solidity)

#### MockPriceFeed (`dacap/contracts/src/MockPriceFeed.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPriceFeed {
    // token address => current price (scaled 1e8)
    mapping(address => uint256) public prices;
    // token address => initial price (for bounds enforcement)
    mapping(address => uint256) public initialPrices;
    address[] public tokens;

    event PricesUpdated(address[] tokens, uint256[] newPrices);

    constructor(address[] memory _tokens, uint256[] memory _initialPrices) { ... }

    /// @notice Update all prices by ±1% pseudo-random walk, bounded [50%, 200%] of initial
    function updatePrices() external { ... }

    /// @notice Read current price for a token
    function getPrice(address token) external view returns (uint256) { ... }
}
```

Initial prices (scaled 1e8): WBTC=3_000_000_000_000, WETH=200_000_000_000, USDC=100_000_000,
LINK=1_500_000_000, UNI=800_000_000.

Random walk uses `keccak256(abi.encodePacked(block.timestamp, block.prevrandao, token, i))` to
derive a pseudo-random delta in `[-1_000_000, +1_000_000]` per token per call.

#### MockERC20 (`dacap/contracts/src/MockERC20.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol) Ownable(msg.sender) { _decimals = decimals_; }

    function decimals() public view override returns (uint8) { return _decimals; }

    /// @notice Mint tokens — owner only
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
```

Deployed four times: WBTC (8 decimals), USDC (6 decimals), LINK (18 decimals), UNI (18 decimals).

#### MockUniswapRouter (`dacap/contracts/src/MockUniswapRouter.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMockPriceFeed { function getPrice(address token) external view returns (uint256); }
interface IMockERC20    { function mint(address to, uint256 amount) external; }

contract MockUniswapRouter {
    IMockPriceFeed public priceFeed;
    uint256 public constant FEE_BPS = 30;       // 0.3%
    uint256 public constant SLIPPAGE_BPS = 200; // ±2%

    event Swap(address indexed token, address indexed to, uint256 ethIn, uint256 tokenOut);

    constructor(address _priceFeed) { priceFeed = IMockPriceFeed(_priceFeed); }

    /// @notice Swap ETH for tokens
    /// @param minAmountOut Minimum acceptable token output (slippage guard)
    /// @param token        ERC20 token to receive
    /// @param to           Recipient address
    function swapExactETHForTokens(
        uint256 minAmountOut,
        address token,
        address to
    ) external payable returns (uint256 amountOut) { ... }
}
```

`amountOut` computation:
1. `base = msg.value * price / 1e8`
2. `afterFee = base * (10000 - 30) / 10000`
3. `slippageDelta = afterFee * slippagePct / 10000` where `slippagePct` ∈ `[-200, +200]` (pseudo-random)
4. `amountOut = afterFee + slippageDelta`
5. Revert `"Slippage exceeded"` if `amountOut < minAmountOut`
6. `IMockERC20(token).mint(to, amountOut)`

#### MockAavePool (`dacap/contracts/src/MockAavePool.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Transfer {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}
interface IMockERC20Mint { function mint(address, uint256) external; }

contract MockAavePool {
    // user => token => supplied amount
    mapping(address => mapping(address => uint256)) public supplyPositions;
    // user => token => debt amount
    mapping(address => mapping(address => uint256)) public debtPositions;

    // 5% APY per 10s tick: 5 / (100 * 365 * 24 * 360)
    uint256 public constant SUPPLY_RATE_PER_TICK_NUM = 5;
    uint256 public constant SUPPLY_RATE_PER_TICK_DEN = 100 * 365 * 24 * 360;
    // 8% APR per 10s tick
    uint256 public constant BORROW_RATE_PER_TICK_NUM = 8;
    uint256 public constant BORROW_RATE_PER_TICK_DEN = 100 * 365 * 24 * 360;

    event Supplied(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event InterestAccrued();

    /// @notice Transfer tokens from msg.sender to pool and record supply position
    function supply(address token, uint256 amount, address onBehalfOf) external { ... }

    /// @notice Mint tokens to onBehalfOf and record debt position
    function borrow(address token, uint256 amount, address onBehalfOf) external { ... }

    /// @notice Transfer tokens back to `to` and reduce supply position
    function withdraw(address token, uint256 amount, address to) external { ... }

    /// @notice Accrue interest on all positions (called once per 10s cycle)
    function accrueInterest() external { ... }
}
```

---

### 3. CapitalVault Extensions

New storage added to `CapitalVault.sol`:

```solidity
// Trading infrastructure addresses (set by owner post-deploy)
address public mockUniswapRouter;
address public mockAavePool;
address public mockPriceFeed;

// Per-agent token balances: agent => token => amount
mapping(address => mapping(address => uint256)) public agentTokenBalances;

// Per-agent PnL in wei-equivalent (signed)
mapping(address => int256) public agentPnL;

// Registered agent addresses (set by AgentRegistry or owner)
mapping(address => bool) public registeredAgents;

// Tracks total ETH deployed per agent (for allocation cap enforcement)
mapping(address => uint256) public agentDeployedWei;

event TradeExecuted(
    address indexed agent,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 timestamp,
    string tradeType  // "swap" | "supply" | "borrow" | "withdraw"
);
```

New functions:

```solidity
modifier onlyRegisteredAgent() {
    require(registeredAgents[msg.sender], "Not a registered agent");
    _;
}

/// @notice Register an agent address (owner or AgentRegistry)
function registerAgent(address agent) external onlyOwner { ... }

/// @notice Set trading infrastructure addresses
function setTradingContracts(
    address _router,
    address _aavePool,
    address _priceFeed
) external onlyOwner { ... }

/// @notice Execute ETH→token swap via MockUniswapRouter
/// @param tokenOut     ERC20 token to receive
/// @param amountIn     ETH amount to spend
/// @param minAmountOut Slippage guard
function executeSwap(
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external onlyRegisteredAgent nonReentrant { ... }

/// @notice Supply agent's ERC20 tokens to MockAavePool
function supplyToAave(address token, uint256 amount)
    external onlyRegisteredAgent nonReentrant { ... }

/// @notice Borrow ERC20 tokens from MockAavePool
function borrowFromAave(address token, uint256 amount)
    external onlyRegisteredAgent nonReentrant { ... }

/// @notice Withdraw previously supplied tokens from MockAavePool
function withdrawFromAave(address token, uint256 amount)
    external onlyRegisteredAgent nonReentrant { ... }
```

`executeSwap` internal logic:
1. Compute `remainingAllocation = maxAllocationWei(agent) - agentDeployedWei[agent]`
2. Revert `"Exceeds allocation cap"` if `amountIn > remainingAllocation`
3. Call `IMockUniswapRouter(mockUniswapRouter).swapExactETHForTokens{value: amountIn}(minAmountOut, tokenOut, address(this))`
4. `agentTokenBalances[msg.sender][tokenOut] += amountOut`
5. `agentDeployedWei[msg.sender] += amountIn`
6. `uint256 price = IMockPriceFeed(mockPriceFeed).getPrice(tokenOut)`
7. `agentPnL[msg.sender] += int256(amountOut * price / 1e8) - int256(amountIn)`
8. `emit TradeExecuted(msg.sender, tokenOut, amountIn, amountOut, block.timestamp, "swap")`

`maxAllocationWei(agent)` is derived from the investor's `DelegationParams.maxAllocationWei` for
the agent. Since multiple investors may delegate to the same agent, the vault uses the sum of all
active delegations' `maxAllocationWei` values.

---

### 4. Deploy Script Updates (`dacap/contracts/scripts/deploy.js`)

Deployment order (dependency-first):

1. MockERC20 ×4 (WBTC, USDC, LINK, UNI)
2. MockPriceFeed (token addresses)
3. MockUniswapRouter (priceFeed address)
4. MockAavePool
5. MockStakeToken (existing)
6. AgentRegistry (stakeToken)
7. CapitalVault
8. AllocationEngine (vault)
9. SlashingModule (vault, registry)
10. Wire: `vault.setAllocationEngine`, `vault.setSlashingModule`, `vault.setTradingContracts`
11. Transfer MockERC20 ownership to MockUniswapRouter and MockAavePool (so they can mint)

`config.json` schema extension:

```json
{
  "CapitalVault": "0x...",
  "AllocationEngine": "0x...",
  "AgentRegistry": "0x...",
  "SlashingModule": "0x...",
  "MockUniswapRouter": "0x...",
  "MockAavePool": "0x...",
  "MockPriceFeed": "0x...",
  "WBTC": "0x...",
  "USDC": "0x...",
  "LINK": "0x...",
  "UNI": "0x..."
}
```

---

### 5. Python AgentTradingEngine (`dacap/backend/agents/trading_engine.py`)

```python
class AgentTradingEngine:
    """
    Manages one asyncio Task per active agent.
    Each task: fetch prices → compute momentum → execute trade → sleep 10s.
    """

    def __init__(self, w3: Web3, vault_contract, price_feed_contract,
                 accounts: list[LocalAccount]):
        self.w3 = w3
        self.vault = vault_contract
        self.price_feed = price_feed_contract
        self.accounts = accounts          # indexed by agent slot
        self._tasks: dict[str, asyncio.Task] = {}
        self._price_history: dict[str, deque] = {}  # agent_id → deque of {token: price}

    async def start(self, agent_id: str) -> None:
        """Launch trading loop for agent_id. Raises if already running."""
        if agent_id in self._tasks:
            raise ValueError(f"Agent {agent_id} is already trading")
        task = asyncio.create_task(self._trading_loop(agent_id))
        self._tasks[agent_id] = task

    async def stop(self, agent_id: str) -> None:
        """Cancel trading loop for agent_id. Raises if not running."""
        task = self._tasks.pop(agent_id, None)
        if task is None:
            raise ValueError(f"Agent {agent_id} is not trading")
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    def is_trading(self, agent_id: str) -> bool:
        return agent_id in self._tasks and not self._tasks[agent_id].done()

    async def _trading_loop(self, agent_id: str) -> None:
        history: deque[dict[str, int]] = deque(maxlen=4)  # keep 4 ticks for 3-period momentum
        while True:
            try:
                await self._cycle(agent_id, history)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Agent {agent_id} cycle error: {e}")
            await asyncio.sleep(10)

    async def _cycle(self, agent_id: str, history: deque) -> None:
        # 1. Advance price random walk
        await self._send_tx(agent_id, self.price_feed.functions.updatePrices())

        # 2. Fetch current prices
        prices = {sym: self.price_feed.functions.getPrice(addr).call()
                  for sym, addr in TOKEN_ADDRESSES.items()}
        history.append(prices)

        # 3. Compute momentum and trade if signal is strong enough
        if len(history) >= 4:
            for sym, addr in TOKEN_ADDRESSES.items():
                momentum = (prices[sym] - history[0][sym]) / history[0][sym]
                await self._apply_momentum(agent_id, sym, addr, momentum)

    async def _apply_momentum(self, agent_id, sym, token_addr, momentum):
        account = self._account_for(agent_id)
        allocation = self._remaining_allocation(agent_id)
        slice_wei = allocation // 10  # 10% of remaining

        if momentum > 0.005 and slice_wei > 0:
            min_out = 0  # accept any slippage for simulation
            await self._send_tx(agent_id,
                self.vault.functions.executeSwap(token_addr, slice_wei, min_out),
                value=slice_wei)

        elif momentum < -0.005:
            balance = self.vault.functions.agentTokenBalances(account.address, token_addr).call()
            if balance > 0:
                # Sell: swap token back — simplified as a new buy in opposite direction
                # In simulation, we record a negative PnL adjustment
                await self._send_tx(agent_id,
                    self.vault.functions.executeSwap(token_addr, 0, 0))

    async def _send_tx(self, agent_id: str, fn, value: int = 0) -> None:
        account = self._account_for(agent_id)
        try:
            tx = fn.build_transaction({
                "from": account.address,
                "value": value,
                "nonce": self.w3.eth.get_transaction_count(account.address),
                "gas": 300_000,
            })
            signed = account.sign_transaction(tx)
            self.w3.eth.send_raw_transaction(signed.raw_transaction)
        except Exception as e:
            logger.warning(f"Agent {agent_id} tx reverted: {e}")

    def _account_for(self, agent_id: str) -> LocalAccount:
        slot = int(agent_id, 16) % len(self.accounts)
        return self.accounts[slot]

    def _remaining_allocation(self, agent_id: str) -> int:
        account = self._account_for(agent_id)
        # Read from chain — simplified; real impl caches and updates
        deployed = self.vault.functions.agentDeployedWei(account.address).call()
        max_alloc = self.vault.functions.agentWeights(account.address).call()
        return max(0, max_alloc - deployed)
```

The engine is instantiated once at app startup and stored as `app.state.trading_engine`.

---

### 6. REST API Endpoints (`dacap/backend/api/trading.py`)

```python
router = APIRouter()

@router.post("/{agent_id}/start-trading")
async def start_trading(agent_id: str, request: Request):
    engine: AgentTradingEngine = request.app.state.trading_engine
    try:
        await engine.start(agent_id)
        return {"status": "started", "agent_id": agent_id}
    except ValueError:
        raise HTTPException(status_code=409, detail="Agent is already trading")

@router.post("/{agent_id}/stop-trading")
async def stop_trading(agent_id: str, request: Request):
    engine: AgentTradingEngine = request.app.state.trading_engine
    try:
        await engine.stop(agent_id)
        return {"status": "stopped", "agent_id": agent_id}
    except ValueError:
        raise HTTPException(status_code=409, detail="Agent is not trading")

@router.get("/{agent_id}/portfolio")
async def get_portfolio(agent_id: str, request: Request):
    engine: AgentTradingEngine = request.app.state.trading_engine
    vault = request.app.state.vault_contract
    account_addr = engine._account_for(agent_id).address
    token_balances = {
        sym: vault.functions.agentTokenBalances(account_addr, addr).call()
        for sym, addr in TOKEN_ADDRESSES.items()
    }
    pnl_wei = vault.functions.agentPnL(account_addr).call()
    return {
        "token_balances": token_balances,
        "pnl_wei": str(pnl_wei),
        "trading_active": engine.is_trading(agent_id),
    }
```

---

### 7. WebSocket Broadcast (`dacap/backend/api/ws_trading.py`)

```python
class TradingBroadcaster:
    def __init__(self):
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self._clients.discard(ws)

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self._clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self._clients -= dead


broadcaster = TradingBroadcaster()


@router.websocket("/ws/trading")
async def ws_trading(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive; client sends pings
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)


async def event_listener(app: FastAPI):
    """Background task: poll TradeExecuted events and broadcast."""
    vault = app.state.vault_contract
    while True:
        try:
            event_filter = vault.events.TradeExecuted.create_filter(from_block="latest")
            while True:
                for event in event_filter.get_new_entries():
                    args = event["args"]
                    await broadcaster.broadcast({
                        "agent":     args["agent"],
                        "token":     TOKEN_SYMBOL[args["tokenOut"]],
                        "amountIn":  str(args["amountIn"]),
                        "amountOut": str(args["amountOut"]),
                        "timestamp": args["timestamp"],
                        "type":      args["tradeType"],
                    })
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Event filter lost: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)
```

The `event_listener` coroutine is registered as a FastAPI `lifespan` background task.

---

### 8. WebSocket Message Schema

```typescript
interface TradeExecutedMessage {
  agent:     string;   // "0x..." checksummed address
  token:     string;   // "WBTC" | "USDC" | "LINK" | "UNI" | "WETH"
  amountIn:  string;   // wei as decimal string
  amountOut: string;   // token units as decimal string (respects token decimals)
  timestamp: number;   // Unix seconds (block.timestamp)
  type:      "swap" | "supply" | "borrow" | "withdraw";
}
```

---

### 9. Frontend Component Tree Changes

```
App
├── Dashboard                          ← modified
│   ├── MetricCards (unchanged)
│   ├── PortfolioValueChart (unchanged)
│   ├── AllocationPie (unchanged)
│   ├── LivePnLChart                   ← NEW: real-time PnL from WebSocket
│   │   └── ConnectionBadge            ← NEW: LIVE / RECONNECTING indicator
│   ├── TradingFeed                    ← NEW: scrolling trade events
│   └── AgentPerformanceTable (unchanged)
│
├── Agents                             ← modified
│   └── AgentCard (per agent)
│       ├── existing metrics (unchanged)
│       ├── TradingStatusBadge         ← NEW: AI Trading ON/OFF
│       ├── PortfolioValueDisplay      ← NEW: USD portfolio value
│       ├── StartTradingButton         ← NEW: conditional on delegation
│       └── TradingErrorMessage        ← NEW: inline error display
│
└── hooks/
    └── useWebSocket                   ← NEW: manages WS connection + reconnect
```

#### `useWebSocket` hook interface

```typescript
interface UseWebSocketReturn {
  messages:   TradeExecutedMessage[];
  status:     "connecting" | "connected" | "reconnecting" | "disconnected";
  lastMessage: TradeExecutedMessage | null;
}

function useWebSocket(url: string): UseWebSocketReturn
```

The hook:
- Opens `WebSocket(url)` on mount, closes on unmount
- On `onclose`, sets status to `"reconnecting"` and retries after 5 seconds
- Appends incoming messages to a capped array (max 100 for chart, max 50 for feed)

#### `LivePnLChart` component

Consumes `messages` from `useWebSocket`. Maintains a running cumulative PnL series:

```typescript
// On each new message:
const ethSpent = BigInt(msg.amountIn)
const tokenValue = BigInt(msg.amountOut) * priceOf(msg.token) / BigInt(1e8)
cumulativePnL += Number(tokenValue - ethSpent) / 1e18
chartData.push({ x: chartData.length, pnl: cumulativePnL })
if (chartData.length > 100) chartData.shift()
```

Renders using Recharts `AreaChart` (same pattern as existing `PortfolioValueChart`).

#### `TradingFeed` component

```typescript
// On each new message, prepend and cap at 50:
setTrades(prev => [newTrade, ...prev].slice(0, 50))
```

Each row displays: truncated agent address, action badge (color-coded by type), token symbol,
amountIn in ETH (4 decimal places), amountOut in token units, relative time ("2s ago").

---

## Data Models

### On-chain (Solidity additions to CapitalVault)

```solidity
// New storage slots
address public mockUniswapRouter;
address public mockAavePool;
address public mockPriceFeed;

mapping(address => mapping(address => uint256)) public agentTokenBalances;
// agent => token => token amount (in token's native decimals)

mapping(address => int256) public agentPnL;
// agent => cumulative PnL in wei-equivalent (ETH value of tokens received minus ETH spent)

mapping(address => bool) public registeredAgents;

mapping(address => uint256) public agentDeployedWei;
// agent => total ETH deployed so far (for allocation cap enforcement)

event TradeExecuted(
    address indexed agent,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 timestamp,
    string tradeType
);
```

### Off-chain (Python)

```python
@dataclass
class AgentState:
    agent_id: str
    task: asyncio.Task
    price_history: deque  # deque[dict[str, int]], maxlen=4

@dataclass
class PortfolioResponse:
    token_balances: dict[str, int]   # symbol → raw token units
    pnl_wei: str                     # int256 as decimal string
    trading_active: bool
```

### Frontend (TypeScript)

```typescript
interface TradeExecutedMessage {
  agent:     string;
  token:     string;
  amountIn:  string;
  amountOut: string;
  timestamp: number;
  type:      "swap" | "supply" | "borrow" | "withdraw";
}

interface AgentPortfolio {
  token_balances: Record<string, string>;
  pnl_wei:        string;
  trading_active: boolean;
}

interface ChartPoint {
  x:   number;   // trade index
  pnl: number;   // cumulative PnL in ETH (float)
}
```

---


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Allocation Cap Invariant

*For any* registered agent and any call to `executeSwap`, the ETH amount debited from the agent's
deployed balance shall never cause `agentDeployedWei[agent]` to exceed the sum of all active
investors' `maxAllocationWei` delegated to that agent.

**Validates: Requirements 3.2, 3.10, 10.1**

---

### Property 2: PnL Sum Invariant

*For any* sequence of `executeSwap` calls by a single agent, `agentPnL[agent]` shall equal the
arithmetic sum of `(tokenValueReceived_i - ethSpent_i)` across every swap `i` in that sequence,
where `tokenValueReceived_i = amountOut_i * price_i / 1e8`.

**Validates: Requirements 3.8, 3.9, 10.2**

---

### Property 3: Bounded Price Random Walk

*For any* number of calls to `MockPriceFeed.updatePrices()`, every stored price shall remain
within the closed interval `[initialPrice * 50 / 100, initialPrice * 200 / 100]`.

**Validates: Requirements 2.3, 10.3**

---

### Property 4: Slippage Tolerance Invariant

*For any* call to `MockUniswapRouter.swapExactETHForTokens` where `minAmountOut > 0`, if the
computed `amountOut` after applying fee and pseudo-random slippage is less than `minAmountOut`,
the transaction shall revert with reason `"Slippage exceeded"`.

**Validates: Requirements 2.6, 10.4**

---

### Property 5: Aave Round-Trip Invariant

*For any* token and amount, calling `supply(token, amount, user)` followed by
`withdraw(token, amount, user)` shall restore the user's token balance to its pre-supply value
(ignoring interest accrual between the two calls when `accrueInterest` is not called).

**Validates: Requirements 2.7, 2.9**

---

### Property 6: Trade State Update Consistency

*For any* successful call to `executeSwap`, `supplyToAave`, `borrowFromAave`, or
`withdrawFromAave`, the corresponding `agentTokenBalances[agent][token]` entry shall be updated
to reflect the trade, and a `TradeExecuted` event shall be emitted with matching fields.

**Validates: Requirements 3.6, 3.7**

---

### Property 7: Momentum Strategy Decision

*For any* 4-tick price history for a token, the trading decision shall satisfy:
- If `momentum > 0.005` → a buy trade is triggered (executeSwap called with `amountIn > 0`)
- If `momentum < -0.005` and agent holds a non-zero balance → a sell trade is triggered
- If `-0.005 ≤ momentum ≤ 0.005` → no trade is triggered for that token

where `momentum = (price[3] - price[0]) / price[0]`.

**Validates: Requirements 4.4, 4.5, 4.6, 4.7**

---

### Property 8: WebSocket Message Schema Completeness

*For any* `TradeExecuted` event emitted by CapitalVault, the JSON message forwarded to connected
WebSocket clients shall contain all required fields: `agent`, `token`, `amountIn`, `amountOut`,
`timestamp`, and `type`, with `type` being one of `"swap"`, `"supply"`, `"borrow"`, or
`"withdraw"`.

**Validates: Requirements 6.2, 6.3**

---

### Property 9: WebSocket Message Serialization Round-Trip

*For any* valid `TradeExecutedMessage` object, serializing it to JSON and deserializing it shall
produce an object equal to the original (all fields preserved with correct types).

**Validates: Requirements 10.5**

---

### Property 10: TradingFeed Ordering and Cap

*For any* sequence of `TradeExecuted` messages received by the frontend, the `TradingFeed`
component shall display at most 50 entries, ordered newest-first, where the first entry is always
the most recently received message.

**Validates: Requirements 8.1, 8.3**

---

### Property 11: Live PnL Chart Windowing

*For any* sequence of more than 100 `TradeExecuted` messages, the `LivePnLChart` data series
shall contain exactly 100 points, representing the 100 most recent trades, with cumulative PnL
computed as the running sum over all received trades (not just the visible window).

**Validates: Requirements 7.2, 7.3**

---

### Property 12: Trading Status Consistency

*For any* agent, calling `POST /api/agents/{id}/start-trading` followed by
`GET /api/agents/{id}/portfolio` shall return `trading_active: true`; calling
`POST /api/agents/{id}/stop-trading` followed by `GET /api/agents/{id}/portfolio` shall return
`trading_active: false`.

**Validates: Requirements 5.6, 9.1**

---

### Property 13: Portfolio Value Computation

*For any* agent with known `agentTokenBalances` and current prices from `MockPriceFeed`, the
portfolio value displayed on the Agents page shall equal
`Σ (agentTokenBalances[agent][token] * price[token] / 10^(token.decimals))` across all tokens,
converted to USD using the price feed's USD-scaled values.

**Validates: Requirements 9.5**

---

## Error Handling

| Scenario | Component | Behavior |
|---|---|---|
| `executeSwap` exceeds allocation cap | CapitalVault | Revert `"Exceeds allocation cap"` |
| Swap slippage exceeds `minAmountOut` | MockUniswapRouter | Revert `"Slippage exceeded"` |
| Non-agent calls trading functions | CapitalVault | Revert `"Not a registered agent"` |
| On-chain tx reverts in trading loop | AgentTradingEngine | Log revert reason, continue loop |
| `start-trading` called for active agent | REST API | HTTP 409 `"Agent is already trading"` |
| `stop-trading` called for inactive agent | REST API | HTTP 409 `"Agent is not trading"` |
| web3.py event filter connection lost | WebSocket listener | Log error, retry every 5 seconds |
| WebSocket client disconnects | TradingBroadcaster | Remove from set, no effect on others |
| WebSocket drops on frontend | `useWebSocket` hook | Show "RECONNECTING" badge, retry every 5s |
| Start/stop API call fails on frontend | Agents page | Show inline error on affected agent card |
| `MockPriceFeed` price would exceed bounds | MockPriceFeed | Clamp to `[50%, 200%]` of initial |
| `MockAavePool.withdraw` exceeds supply | MockAavePool | Revert `"Insufficient supply position"` |

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. Unit tests cover specific examples,
integration points, and error conditions. Property tests verify universal invariants across
randomly generated inputs.

### Property-Based Testing

**Library choices:**
- Solidity: [Foundry](https://book.getfoundry.sh/forge/fuzz-testing) fuzz tests (`forge test`)
- Python: [Hypothesis](https://hypothesis.readthedocs.io/) (`@given` decorator)
- TypeScript: [fast-check](https://fast-check.dev/) (`fc.property`)

Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
`// Feature: simulated-trading-engine, Property N: <property_text>`

**Property test mapping:**

| Property | Test file | Library |
|---|---|---|
| P1: Allocation Cap Invariant | `contracts/test/CapitalVault.trading.test.js` | Hardhat + Foundry fuzz |
| P2: PnL Sum Invariant | `contracts/test/CapitalVault.trading.test.js` | Foundry fuzz |
| P3: Bounded Price Random Walk | `contracts/test/MockPriceFeed.test.js` | Foundry fuzz |
| P4: Slippage Tolerance Invariant | `contracts/test/MockUniswapRouter.test.js` | Foundry fuzz |
| P5: Aave Round-Trip Invariant | `contracts/test/MockAavePool.test.js` | Foundry fuzz |
| P6: Trade State Update Consistency | `contracts/test/CapitalVault.trading.test.js` | Hardhat example |
| P7: Momentum Strategy Decision | `backend/tests/test_trading_engine.py` | Hypothesis |
| P8: WebSocket Message Schema | `backend/tests/test_ws_trading.py` | Hypothesis |
| P9: WS Message Serialization Round-Trip | `backend/tests/test_ws_trading.py` | Hypothesis |
| P10: TradingFeed Ordering and Cap | `frontend/src/__tests__/TradingFeed.test.tsx` | fast-check |
| P11: Live PnL Chart Windowing | `frontend/src/__tests__/LivePnLChart.test.tsx` | fast-check |
| P12: Trading Status Consistency | `backend/tests/test_trading_api.py` | Hypothesis |
| P13: Portfolio Value Computation | `frontend/src/__tests__/AgentCard.test.tsx` | fast-check |

### Unit Tests

Unit tests focus on:
- Specific deployment examples (all contracts deployed, config.json written correctly)
- Access control (non-agent reverts, non-owner mint reverts)
- Error path examples (HTTP 409 on duplicate start, WebSocket reconnect on drop)
- Integration: deploy → start trading → receive WebSocket event → chart updates

**Key unit test files:**

```
contracts/test/
  MockPriceFeed.test.js          — initial prices, updatePrices bounds
  MockERC20.test.js              — mint access control
  MockUniswapRouter.test.js      — swap computation, slippage revert
  MockAavePool.test.js           — supply/borrow/withdraw, accrueInterest
  CapitalVault.trading.test.js   — executeSwap, supplyToAave, events, allocation cap

backend/tests/
  test_trading_engine.py         — start/stop, momentum decisions, revert handling
  test_trading_api.py            — REST endpoints, 409 cases, portfolio response
  test_ws_trading.py             — broadcast, disconnect, reconnect

frontend/src/__tests__/
  useWebSocket.test.ts           — connect/disconnect, reconnect on drop
  LivePnLChart.test.tsx          — chart data append, 100-point window
  TradingFeed.test.tsx           — prepend, 50-item cap, empty state
  AgentCard.trading.test.tsx     — badge state, button visibility, error display
```

### Property Test Configuration Example (Hypothesis)

```python
from hypothesis import given, settings
import hypothesis.strategies as st

# Feature: simulated-trading-engine, Property 7: Momentum Strategy Decision
@given(
    prices=st.lists(st.integers(min_value=1, max_value=10**12), min_size=4, max_size=4)
)
@settings(max_examples=100)
def test_momentum_strategy_decision(prices):
    momentum = (prices[3] - prices[0]) / prices[0]
    history = deque(
        [{"WBTC": p} for p in prices], maxlen=4
    )
    engine = AgentTradingEngine.__new__(AgentTradingEngine)
    decision = engine._compute_decision("WBTC", history)
    if momentum > 0.005:
        assert decision == "buy"
    elif momentum < -0.005:
        assert decision == "sell"
    else:
        assert decision == "hold"
```

### Property Test Configuration Example (fast-check)

```typescript
// Feature: simulated-trading-engine, Property 10: TradingFeed Ordering and Cap
import * as fc from "fast-check"

test("TradingFeed ordering and cap", () => {
  fc.assert(
    fc.property(
      fc.array(tradeMessageArbitrary(), { minLength: 1, maxLength: 200 }),
      (messages) => {
        const feed = buildFeed(messages)
        expect(feed.length).toBeLessThanOrEqual(50)
        // newest first
        for (let i = 0; i < feed.length - 1; i++) {
          expect(feed[i].timestamp).toBeGreaterThanOrEqual(feed[i + 1].timestamp)
        }
        // last message is always first in feed
        expect(feed[0]).toEqual(messages[messages.length - 1])
      }
    ),
    { numRuns: 100 }
  )
})
```
