# Requirements Document

## Introduction

The Simulated AI Agent Trading Engine extends the DACAP platform with a fully autonomous on-chain
trading simulation. The existing Ganache-based local blockchain is replaced by a Hardhat node
forking Ethereum mainnet, giving agents access to realistic DeFi protocol interfaces via mock
contracts (MockUniswapRouter, MockAavePool, MockPriceFeed, MockERC20). A Python trading engine
runs per-agent asyncio loops that read live mock prices, apply a momentum-based MWU strategy, and
submit signed transactions to CapitalVault's new trading extension functions. A FastAPI WebSocket
endpoint streams TradeExecuted events to the React frontend, which renders a live PnL chart, a
scrolling trade feed, and per-agent AI trading toggles.

Key architectural notes:
- Hardhat replaces Ganache: port 8545, chainId 31337, mainnet fork via Alchemy/Infura free tier.
- CapitalVault gains three new functions: executeSwap, supplyToAave, borrowFromAave, withdrawFromAave.
- Agent portfolio state (token balances, PnL) is tracked on-chain in CapitalVault.
- The Python AgentTradingEngine class manages one asyncio task per active agent.
- WebSocket at ws://localhost:8000/ws/trading broadcasts every TradeExecuted event in real time.
- The frontend Dashboard gains a live PnL chart; a new TradingFeed component shows recent trades.
- Agents page gains per-agent "AI Trading: ON/OFF" toggle and portfolio value display.

---

## Glossary

- **Hardhat_Node**: Local Ethereum node running at http://127.0.0.1:8545 with chainId 31337, forking Ethereum mainnet.
- **CapitalVault**: Existing smart contract extended with swap, lending, and portfolio-tracking functions.
- **MockUniswapRouter**: Deployed mock contract simulating ETH→ERC20 swaps with price feed, 0.3% fee, and ±2% slippage.
- **MockAavePool**: Deployed mock contract simulating supply (5% APY) and borrow (8% APR) positions.
- **MockPriceFeed**: Deployed mock contract storing and updating prices for WBTC, WETH, USDC, LINK, UNI every 10 seconds via ±1% random walk.
- **MockERC20**: Mintable ERC20 token contract deployed for WBTC, USDC, LINK, and UNI.
- **AgentTradingEngine**: Python class in `dacap/backend/agents/trading_engine.py` that manages per-agent asyncio trading loops.
- **TradingLoop**: A single asyncio task running every 10 seconds for one agent: fetch prices → MWU decision → execute trade.
- **MomentumStrategy**: Trading strategy that buys tokens with positive 3-period price momentum and sells tokens with negative momentum.
- **TradeExecuted**: On-chain event emitted by CapitalVault on every swap or lending action: (agent, tokenOut, amountIn, amountOut, timestamp).
- **TradingFeed**: Frontend React component displaying a scrolling list of recent TradeExecuted events.
- **PnL**: Profit and Loss, tracked per agent as `int256 agentPnL[agent]` in CapitalVault.
- **agentTokenBalances**: On-chain mapping `(agent => (token => uint256))` tracking each agent's ERC20 holdings.
- **maxAllocationWei**: The maximum ETH-equivalent amount an agent may deploy, set by the investor in DelegationParams.
- **RandomWalk**: Price update model where each tick multiplies the current price by `(1 + r)` where `r` is uniform in `[-0.01, +0.01]`.
- **SlippageTolerance**: The maximum acceptable price deviation from the quoted price; swaps revert if `amountOut < minAmountOut`.
- **Hardhat_Account**: One of the 20 pre-funded accounts provided by Hardhat, used as agent signing keys.

---

## Requirements

### Requirement 1: Hardhat Mainnet Fork Setup

**User Story:** As a developer, I want the local blockchain to be a Hardhat mainnet fork instead of
Ganache, so that agents can interact with realistic DeFi protocol interfaces at known addresses.

#### Acceptance Criteria

1. THE Hardhat_Node SHALL run on port 8545 with chainId 31337 and fork Ethereum mainnet via a
   configurable RPC URL (Alchemy or Infura free tier).
2. THE Hardhat_Node configuration SHALL be stored in `dacap/contracts/hardhat.config.js` and SHALL
   expose a `hardhat` network entry with `forking.url` read from the `ALCHEMY_RPC_URL` environment
   variable.
3. WHEN the deploy script runs against the Hardhat_Node, THE Deploy_Script SHALL deploy
   MockPriceFeed, MockERC20 (four tokens), MockUniswapRouter, MockAavePool, and all existing DACAP
   contracts (CapitalVault, AllocationEngine, AgentRegistry, SlashingModule) in dependency order.
4. WHEN the deploy script completes, THE Deploy_Script SHALL write all deployed contract addresses
   to `dacap/frontend/src/contracts/config.json`, extending the existing schema with keys:
   MockUniswapRouter, MockAavePool, MockPriceFeed, WBTC, USDC, LINK, UNI.
5. THE Hardhat_Node configuration SHALL include at least 20 pre-funded accounts with 10 000 ETH
   each, accessible via deterministic private keys.

---

### Requirement 2: Mock DeFi Contracts

**User Story:** As a developer, I want mock Uniswap, Aave, and price feed contracts deployed
locally, so that agents can execute realistic-looking trades without requiring mainnet access.

#### Acceptance Criteria

1. THE MockPriceFeed SHALL store an initial price for each of WBTC (30 000 USD), WETH (2 000 USD),
   USDC (1 USD), LINK (15 USD), and UNI (8 USD), scaled by 1e8.
2. WHEN `MockPriceFeed.updatePrices()` is called, THE MockPriceFeed SHALL update each stored price
   by multiplying it by `(1e8 + delta) / 1e8` where `delta` is a pseudo-random integer in
   `[-1 000 000, +1 000 000]` (representing ±1%).
3. THE MockPriceFeed SHALL enforce that no price ever falls below 50% or rises above 200% of its
   initial value (bounded random walk).
4. THE MockERC20 SHALL be an OpenZeppelin ERC20 with a `mint(address to, uint256 amount)` function
   callable only by the contract owner.
5. THE MockUniswapRouter SHALL implement `swapExactETHForTokens(uint256 minAmountOut, address token,
   address to)` payable, computing `amountOut = (msg.value * price / 1e8) * (10000 - 30) / 10000`
   (0.3% fee) then applying a pseudo-random slippage of ±2% before minting tokens to `to`.
6. IF `amountOut` after slippage is less than `minAmountOut`, THEN THE MockUniswapRouter SHALL
   revert with "Slippage exceeded".
7. THE MockAavePool SHALL implement `supply(address token, uint256 amount, address onBehalfOf)`
   which transfers `amount` of `token` from `msg.sender` to the pool and records the position.
8. THE MockAavePool SHALL implement `borrow(address token, uint256 amount, address onBehalfOf)`
   which mints `amount` of `token` to `onBehalfOf` and records the debt position.
9. THE MockAavePool SHALL implement `withdraw(address token, uint256 amount, address to)` which
   transfers `amount` of `token` back to `to` and reduces the supply position.
10. WHEN `MockAavePool.accrueInterest()` is called, THE MockAavePool SHALL increase each supply
    position by `position * 5 / (100 * 365 * 24 * 360)` (5% APY per 10-second tick) and increase
    each debt position by `debt * 8 / (100 * 365 * 24 * 360)` (8% APR per 10-second tick).

---

### Requirement 3: CapitalVault Trading Extension

**User Story:** As an agent, I want to call CapitalVault functions to execute swaps and lending
operations, so that my trades are custodied and tracked on-chain within my allocated capital.

#### Acceptance Criteria

1. THE CapitalVault SHALL expose `executeSwap(address tokenOut, uint256 amountIn, uint256
   minAmountOut)` callable only by a registered agent address, which forwards `amountIn` ETH to
   MockUniswapRouter and credits the received tokens to `agentTokenBalances[msg.sender][tokenOut]`.
2. IF `amountIn` exceeds the agent's remaining allocation (investor's `maxAllocationWei` minus
   already-deployed capital), THEN THE CapitalVault SHALL revert with "Exceeds allocation cap".
3. THE CapitalVault SHALL expose `supplyToAave(address token, uint256 amount)` callable only by a
   registered agent, which approves MockAavePool and calls `MockAavePool.supply()` on behalf of the
   agent, reducing `agentTokenBalances[msg.sender][token]` by `amount`.
4. THE CapitalVault SHALL expose `borrowFromAave(address token, uint256 amount)` callable only by a
   registered agent, which calls `MockAavePool.borrow()` and credits `amount` to
   `agentTokenBalances[msg.sender][token]`.
5. THE CapitalVault SHALL expose `withdrawFromAave(address token, uint256 amount)` callable only by
   a registered agent, which calls `MockAavePool.withdraw()` and credits `amount` to
   `agentTokenBalances[msg.sender][token]`.
6. WHEN any of executeSwap, supplyToAave, borrowFromAave, or withdrawFromAave completes
   successfully, THE CapitalVault SHALL emit `TradeExecuted(agent, tokenOut, amountIn, amountOut,
   block.timestamp)`.
7. THE CapitalVault SHALL maintain `mapping(address agent => mapping(address token => uint256))
   agentTokenBalances` updated after every trade function.
8. THE CapitalVault SHALL maintain `mapping(address agent => int256) agentPnL` updated after every
   executeSwap: `agentPnL[agent] += int256(amountOut * price / 1e8) - int256(amountIn)`.
9. FOR ALL sequences of trades by agent A, `agentPnL[A]` SHALL equal the sum of
   `(tokenValue - ethSpent)` across all trades (PnL invariant).
10. FOR ALL calls to executeSwap, the ETH amount debited from the agent's allocation SHALL never
    exceed the investor's `maxAllocationWei` for that agent (allocation cap invariant).

---

### Requirement 4: Agent Trading Engine (Python Backend)

**User Story:** As a platform operator, I want each active agent to autonomously execute trades
every 10 seconds using a momentum strategy, so that the simulation produces realistic trading
activity without manual intervention.

#### Acceptance Criteria

1. THE AgentTradingEngine SHALL be implemented in `dacap/backend/agents/trading_engine.py` as a
   class with `start(agent_id)` and `stop(agent_id)` async methods.
2. WHEN `start(agent_id)` is called, THE AgentTradingEngine SHALL launch an asyncio task that
   loops every 10 seconds for that agent until `stop(agent_id)` is called.
3. WHILE a TradingLoop is running, THE AgentTradingEngine SHALL fetch current prices from
   MockPriceFeed via web3.py on each cycle.
4. WHILE a TradingLoop is running, THE AgentTradingEngine SHALL maintain a 3-period price history
   per token and compute momentum as `(price_now - price_3_periods_ago) / price_3_periods_ago`.
5. WHEN momentum for a token exceeds +0.005 (0.5%), THE AgentTradingEngine SHALL call
   `CapitalVault.executeSwap(token, allocationSlice, minAmountOut)` where `allocationSlice` is
   10% of the agent's remaining `maxAllocationWei`.
6. WHEN momentum for a token is below -0.005 (-0.5%), THE AgentTradingEngine SHALL call
   `CapitalVault.executeSwap` to sell (swap token back to ETH equivalent) if the agent holds a
   non-zero balance of that token.
7. WHEN momentum is between -0.005 and +0.005, THE AgentTradingEngine SHALL take no trade action
   for that token (hold).
8. THE AgentTradingEngine SHALL use a Hardhat_Account private key (indexed by agent slot) to sign
   all transactions via web3.py.
9. IF a transaction reverts on-chain, THEN THE AgentTradingEngine SHALL log the revert reason and
   continue the loop without crashing.
10. THE AgentTradingEngine SHALL also call `MockPriceFeed.updatePrices()` once per cycle to
    advance the price random walk.

---

### Requirement 5: Trading API Endpoints

**User Story:** As a frontend developer, I want REST endpoints to start/stop agent trading and
retrieve portfolio state, so that the UI can control and display agent activity.

#### Acceptance Criteria

1. THE Backend SHALL expose `POST /api/agents/{id}/start-trading` which calls
   `AgentTradingEngine.start(id)` and returns `{"status": "started", "agent_id": id}`.
2. THE Backend SHALL expose `POST /api/agents/{id}/stop-trading` which calls
   `AgentTradingEngine.stop(id)` and returns `{"status": "stopped", "agent_id": id}`.
3. IF `start-trading` is called for an agent that is already trading, THEN THE Backend SHALL return
   HTTP 409 with `{"detail": "Agent is already trading"}`.
4. IF `stop-trading` is called for an agent that is not trading, THEN THE Backend SHALL return
   HTTP 409 with `{"detail": "Agent is not trading"}`.
5. THE Backend SHALL expose `GET /api/agents/{id}/portfolio` which reads `agentTokenBalances` and
   `agentPnL` from CapitalVault via web3.py and returns a JSON object with keys `token_balances`
   (dict of token symbol → amount) and `pnl_wei` (int256 as string).
6. WHEN `GET /api/agents/{id}/portfolio` is called, THE Backend SHALL also return
   `trading_active: bool` indicating whether a TradingLoop is currently running for that agent.

---

### Requirement 6: WebSocket Trade Feed

**User Story:** As a frontend developer, I want a WebSocket endpoint that streams TradeExecuted
events in real time, so that the UI can update without polling.

#### Acceptance Criteria

1. THE Backend SHALL expose a WebSocket endpoint at `ws://localhost:8000/ws/trading`.
2. WHEN a client connects to `/ws/trading`, THE Backend SHALL subscribe to `TradeExecuted` events
   from CapitalVault using a web3.py event filter and forward each event as a JSON message.
3. THE JSON message format SHALL be:
   `{"agent": "0x...", "token": "SYMBOL", "amountIn": "...", "amountOut": "...", "timestamp": N, "type": "swap"|"supply"|"borrow"|"withdraw"}`.
4. WHEN a client disconnects, THE Backend SHALL remove the client from the broadcast set without
   affecting other connected clients.
5. THE Backend SHALL support at least 10 simultaneous WebSocket connections without degrading
   event delivery.
6. IF the web3.py event filter connection is lost, THEN THE Backend SHALL attempt to reconnect
   every 5 seconds and log the error.

---

### Requirement 7: Live Frontend — Dashboard PnL Chart

**User Story:** As an investor, I want to see a live PnL chart on the Dashboard that updates in
real time as agents trade, so that I can monitor portfolio performance without refreshing.

#### Acceptance Criteria

1. THE Dashboard SHALL include a `useWebSocket` hook that connects to `ws://localhost:8000/ws/trading`
   on mount and disconnects on unmount.
2. WHEN a TradeExecuted WebSocket message is received, THE Dashboard SHALL append the cumulative
   PnL value to the chart data series and re-render the chart.
3. THE Dashboard PnL chart SHALL display the last 100 trade events on the x-axis and cumulative
   PnL in ETH on the y-axis.
4. WHILE the WebSocket connection is active, THE Dashboard SHALL display a green "LIVE" indicator
   badge next to the chart title.
5. IF the WebSocket connection drops, THE Dashboard SHALL display a yellow "RECONNECTING" badge and
   attempt to reconnect every 5 seconds.

---

### Requirement 8: Live Frontend — TradingFeed Component

**User Story:** As an investor, I want a scrolling feed of recent trades showing agent, action,
token, amount, and price, so that I can see what the AI agents are doing in real time.

#### Acceptance Criteria

1. THE TradingFeed component SHALL display the 50 most recent TradeExecuted events in reverse
   chronological order (newest at top).
2. EACH trade row in TradingFeed SHALL display: agent name (truncated address), action type
   (Swap / Supply / Borrow / Withdraw), token symbol, amountIn formatted in ETH, amountOut
   formatted in token units, and a relative timestamp ("2s ago").
3. WHEN a new TradeExecuted event arrives via WebSocket, THE TradingFeed SHALL prepend the new
   row with a brief highlight animation and remove the oldest row if count exceeds 50.
4. THE TradingFeed SHALL be rendered on the Dashboard page below the PnL chart.
5. WHILE no trades have occurred, THE TradingFeed SHALL display the message "Waiting for agent
   trades...".

---

### Requirement 9: Live Frontend — Agents Page Trading Controls

**User Story:** As an investor, I want to start and stop AI trading per agent from the Agents page,
and see each agent's current portfolio value, so that I can control which agents are actively
trading my capital.

#### Acceptance Criteria

1. EACH agent card on the Agents page SHALL display an "AI Trading: ON" or "AI Trading: OFF" badge
   reflecting the current `trading_active` state from `GET /api/agents/{id}/portfolio`.
2. EACH agent card SHALL display a "Start AI Trading" button that is visible only when the
   investor has an active delegation to that agent (i.e., `getDelegation(investor, agent)` returns
   a non-zero `maxAllocationWei`).
3. WHEN the investor clicks "Start AI Trading", THE Agents_Page SHALL call
   `POST /api/agents/{id}/start-trading` and update the badge to "AI Trading: ON" on success.
4. WHEN the investor clicks "Stop AI Trading" (shown when trading is ON), THE Agents_Page SHALL
   call `POST /api/agents/{id}/stop-trading` and update the badge to "AI Trading: OFF" on success.
5. EACH agent card SHALL display the current portfolio value in USD, computed as the sum of
   `agentTokenBalances[agent][token] * price[token]` for all tokens, fetched from
   `GET /api/agents/{id}/portfolio`.
6. IF the start-trading or stop-trading API call fails, THEN THE Agents_Page SHALL display an
   inline error message on the affected agent card.

---

### Requirement 10: Correctness Properties

**User Story:** As a developer, I want formal correctness properties verified by tests, so that
critical invariants are guaranteed across all execution paths.

#### Acceptance Criteria

1. FOR ALL executeSwap calls, the ETH amount debited SHALL never exceed the investor's
   `maxAllocationWei` for the calling agent (allocation cap invariant).
2. FOR ALL sequences of trades by a single agent, `agentPnL[agent]` SHALL equal the arithmetic
   sum of `(tokenValueReceived - ethSpent)` for every swap in that sequence (PnL sum invariant).
3. FOR ALL calls to `MockPriceFeed.updatePrices()`, every stored price SHALL remain within
   [50%, 200%] of its initial value (bounded random walk invariant).
4. FOR ALL executeSwap calls where `minAmountOut > 0`, if the computed `amountOut` after slippage
   is less than `minAmountOut`, THE MockUniswapRouter SHALL revert (slippage tolerance invariant).
5. FOR ALL valid DelegationParams, the round-trip `parse(format(params)) == params` SHALL hold for
   the JSON serialization used by the WebSocket message format.
