# Implementation Plan: Simulated Trading Engine

## Overview

Extend DACAP with a fully autonomous on-chain trading simulation: replace Ganache with a Hardhat
node, deploy mock DeFi contracts, extend CapitalVault with trading functions, run a Python
momentum-based trading engine, stream events over WebSocket, and render live PnL and trade feed
in the React frontend.

## Tasks

- [x] 1. Update Hardhat configuration
  - In `dacap/contracts/hardhat.config.js`, replace the `ganache` network entry with a `hardhat`
    network block: `chainId: 31337`, `forking: { url: process.env.ALCHEMY_RPC_URL || "" }`,
    `accounts: { count: 20, accountsBalance: "10000000000000000000000" }`.
  - Add a `localhost` network entry pointing to `http://127.0.0.1:8545` with `chainId: 31337`.
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 2. Implement mock Solidity contracts
  - [x] 2.1 Create `dacap/contracts/src/MockERC20.sol`
    - Extend OpenZeppelin `ERC20` + `Ownable`; add `uint8 _decimals` override and
      `mint(address to, uint256 amount) external onlyOwner`.
    - _Requirements: 2.4_

  - [ ]* 2.2 Write unit tests for MockERC20
    - Test mint access control (owner succeeds, non-owner reverts).
    - Test `decimals()` returns the value passed to the constructor.
    - _Requirements: 2.4_

  - [x] 2.3 Create `dacap/contracts/src/MockPriceFeed.sol`
    - Constructor accepts `address[] _tokens` and `uint256[] _initialPrices`; stores both in
      `prices` and `initialPrices` mappings.
    - `updatePrices()`: for each token derive a pseudo-random delta via
      `keccak256(abi.encodePacked(block.timestamp, block.prevrandao, token, i))` mapped to
      `[-1_000_000, +1_000_000]`; apply `price = price * (1e8 + delta) / 1e8`; clamp to
      `[initialPrice * 50 / 100, initialPrice * 200 / 100]`.
    - `getPrice(address token) external view returns (uint256)`.
    - Emit `PricesUpdated(tokens, newPrices)`.
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.4 Write property test for MockPriceFeed bounded random walk
    - **Property 3: Bounded Price Random Walk**
    - **Validates: Requirements 2.3, 10.3**
    - Use Hardhat fuzz: call `updatePrices()` N times (N up to 500) and assert every price stays
      within `[50%, 200%]` of its initial value.

  - [x] 2.5 Create `dacap/contracts/src/MockUniswapRouter.sol`
    - Constructor stores `IMockPriceFeed priceFeed`.
    - `swapExactETHForTokens(uint256 minAmountOut, address token, address to) external payable`:
      compute `base = msg.value * price / 1e8`, `afterFee = base * (10000 - 30) / 10000`,
      derive pseudo-random `slippagePct` ∈ `[-200, +200]`, compute
      `amountOut = afterFee + afterFee * slippagePct / 10000`.
    - Revert `"Slippage exceeded"` if `amountOut < minAmountOut`.
    - Call `IMockERC20(token).mint(to, amountOut)`.
    - Emit `Swap(token, to, msg.value, amountOut)`.
    - _Requirements: 2.5, 2.6_

  - [ ]* 2.6 Write property test for MockUniswapRouter slippage tolerance
    - **Property 4: Slippage Tolerance Invariant**
    - **Validates: Requirements 2.6, 10.4**
    - Fuzz `minAmountOut` and `ethIn`; assert that when computed `amountOut < minAmountOut` the
      call reverts with `"Slippage exceeded"`.

  - [x] 2.7 Create `dacap/contracts/src/MockAavePool.sol`
    - Implement `supply(address token, uint256 amount, address onBehalfOf)`: `transferFrom`
      `msg.sender` → pool, increment `supplyPositions[onBehalfOf][token]`.
    - Implement `borrow(address token, uint256 amount, address onBehalfOf)`: mint `amount` to
      `onBehalfOf`, increment `debtPositions[onBehalfOf][token]`.
    - Implement `withdraw(address token, uint256 amount, address to)`: revert
      `"Insufficient supply position"` if `supplyPositions[msg.sender][token] < amount`;
      transfer `amount` to `to`, decrement supply position.
    - Implement `accrueInterest()`: iterate tracked users/tokens; increase supply positions by
      `position * 5 / (100 * 365 * 24 * 360)` and debt positions by
      `debt * 8 / (100 * 365 * 24 * 360)`.
    - Emit `Supplied`, `Borrowed`, `Withdrawn`, `InterestAccrued`.
    - _Requirements: 2.7, 2.8, 2.9, 2.10_

  - [ ]* 2.8 Write property test for MockAavePool round-trip
    - **Property 5: Aave Round-Trip Invariant**
    - **Validates: Requirements 2.7, 2.9**
    - Fuzz `amount`; assert `supply(token, amount, user)` then `withdraw(token, amount, user)`
      (without calling `accrueInterest` between them) restores the user's token balance.

- [x] 3. Checkpoint — ensure all mock contract tests pass
  - Run `npx hardhat test` in `dacap/contracts/`. Ask the user if any issues arise.

- [x] 4. Extend CapitalVault with trading functions
  - [x] 4.1 Add new storage to `dacap/contracts/src/CapitalVault.sol`
    - Add `address public mockUniswapRouter`, `address public mockAavePool`,
      `address public mockPriceFeed`.
    - Add `mapping(address => mapping(address => uint256)) public agentTokenBalances`.
    - Add `mapping(address => int256) public agentPnL`.
    - Add `mapping(address => bool) public registeredAgents`.
    - Add `mapping(address => uint256) public agentDeployedWei`.
    - Add `event TradeExecuted(address indexed agent, address indexed tokenOut, uint256 amountIn,
      uint256 amountOut, uint256 timestamp, string tradeType)`.
    - _Requirements: 3.7, 3.8_

  - [x] 4.2 Add `registerAgent`, `setTradingContracts`, and `onlyRegisteredAgent` modifier
    - `registerAgent(address agent) external onlyOwner` sets `registeredAgents[agent] = true`.
    - `setTradingContracts(address _router, address _aavePool, address _priceFeed) external onlyOwner`.
    - `modifier onlyRegisteredAgent()` reverts `"Not a registered agent"` if
      `!registeredAgents[msg.sender]`.
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [x] 4.3 Implement `executeSwap`
    - Compute `remainingAllocation` as sum of all active delegations' `maxAllocationWei` for
      `msg.sender` minus `agentDeployedWei[msg.sender]`; revert `"Exceeds allocation cap"` if
      `amountIn > remainingAllocation`.
    - Forward `amountIn` ETH to `MockUniswapRouter.swapExactETHForTokens`.
    - Update `agentTokenBalances`, `agentDeployedWei`, `agentPnL`.
    - Emit `TradeExecuted(..., "swap")`.
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8_

  - [ ]* 2.9 Write property test for allocation cap invariant
    - **Property 1: Allocation Cap Invariant**
    - **Validates: Requirements 3.2, 3.10, 10.1**
    - Fuzz sequences of `executeSwap` calls; assert `agentDeployedWei[agent]` never exceeds the
      investor's `maxAllocationWei` for that agent.

  - [ ]* 2.10 Write property test for PnL sum invariant
    - **Property 2: PnL Sum Invariant**
    - **Validates: Requirements 3.8, 3.9, 10.2**
    - Fuzz sequences of swaps; assert `agentPnL[agent]` equals the arithmetic sum of
      `(amountOut_i * price_i / 1e8) - amountIn_i` across all swaps.

  - [x] 4.4 Implement `supplyToAave`, `borrowFromAave`, `withdrawFromAave`
    - `supplyToAave`: approve MockAavePool, call `supply()`, decrement
      `agentTokenBalances[msg.sender][token]`, emit `TradeExecuted(..., "supply")`.
    - `borrowFromAave`: call `borrow()`, increment `agentTokenBalances[msg.sender][token]`,
      emit `TradeExecuted(..., "borrow")`.
    - `withdrawFromAave`: call `withdraw()`, increment `agentTokenBalances[msg.sender][token]`,
      emit `TradeExecuted(..., "withdraw")`.
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 4.5 Write unit tests for CapitalVault trading extension
    - Test `executeSwap` happy path: balances updated, event emitted.
    - Test allocation cap revert.
    - Test non-agent revert for all four trading functions.
    - Test `supplyToAave` / `borrowFromAave` / `withdrawFromAave` state updates and events.
    - **Property 6: Trade State Update Consistency** — for each function, assert
      `agentTokenBalances` and `TradeExecuted` event fields match.
    - **Validates: Requirements 3.6, 3.7**
    - _Requirements: 3.1–3.8_

- [x] 5. Checkpoint — ensure CapitalVault trading tests pass
  - Run `npx hardhat test dacap/contracts/test/CapitalVault.trading.test.js`. Ask the user if
    any issues arise.

- [x] 6. Update deploy script
  - Rewrite `dacap/contracts/scripts/deploy.js` to deploy in dependency order:
    MockERC20 ×4 → MockPriceFeed → MockUniswapRouter → MockAavePool → MockStakeToken →
    AgentRegistry → CapitalVault → AllocationEngine → SlashingModule.
  - Wire: `vault.setAllocationEngine`, `vault.setSlashingModule`,
    `vault.setTradingContracts(router, aavePool, priceFeed)`.
  - Transfer MockERC20 ownership to MockUniswapRouter and MockAavePool so they can mint.
  - Write extended `config.json` with keys: `CapitalVault`, `AllocationEngine`, `AgentRegistry`,
    `SlashingModule`, `MockUniswapRouter`, `MockAavePool`, `MockPriceFeed`, `WBTC`, `USDC`,
    `LINK`, `UNI`.
  - _Requirements: 1.3, 1.4_

- [x] 7. Implement Python AgentTradingEngine
  - [x] 7.1 Create `dacap/backend/agents/__init__.py` and
    `dacap/backend/agents/trading_engine.py`
    - Define `TOKEN_ADDRESSES` dict mapping symbol → address (loaded from `config.json`).
    - Implement `AgentTradingEngine.__init__` storing `w3`, `vault`, `price_feed`, `accounts`,
      `_tasks: dict[str, asyncio.Task]`.
    - Implement `start(agent_id)`: raise `ValueError` if already running; create asyncio task
      calling `_trading_loop(agent_id)`.
    - Implement `stop(agent_id)`: raise `ValueError` if not running; cancel task and await it.
    - Implement `is_trading(agent_id) -> bool`.
    - _Requirements: 4.1, 4.2_

  - [x] 7.2 Implement `_trading_loop` and `_cycle`
    - `_trading_loop`: maintain `deque(maxlen=4)` price history; call `_cycle` every 10 seconds;
      catch and log all exceptions except `CancelledError`; re-raise `CancelledError`.
    - `_cycle`: call `updatePrices()` via `_send_tx`; fetch prices for all tokens; append to
      history; when `len(history) >= 4` call `_apply_momentum` for each token.
    - _Requirements: 4.2, 4.3, 4.4, 4.10_

  - [x] 7.3 Implement `_apply_momentum`, `_send_tx`, `_account_for`, `_remaining_allocation`
    - `_apply_momentum`: compute `momentum = (price_now - price_3_ago) / price_3_ago`; if
      `> 0.005` call `executeSwap` with `slice_wei = remaining // 10`; if `< -0.005` and agent
      holds non-zero balance call `executeSwap` to sell; else hold.
    - `_send_tx`: build tx, sign with `LocalAccount`, send raw; catch exceptions and log revert
      reason without crashing.
    - `_account_for(agent_id)`: derive slot as `int(agent_id, 16) % len(accounts)`.
    - `_remaining_allocation`: read `agentDeployedWei` and `agentWeights` from chain.
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 7.4 Write property test for momentum strategy decision
    - **Property 7: Momentum Strategy Decision**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7**
    - Use Hypothesis: generate 4-element price lists; assert `_compute_decision` returns `"buy"`,
      `"sell"`, or `"hold"` consistent with the momentum threshold rules.

- [x] 8. Implement REST trading endpoints
  - Create `dacap/backend/api/trading.py` with `APIRouter`.
  - `POST /{agent_id}/start-trading`: call `engine.start(agent_id)`; return
    `{"status": "started", "agent_id": agent_id}`; catch `ValueError` → HTTP 409
    `"Agent is already trading"`.
  - `POST /{agent_id}/stop-trading`: call `engine.stop(agent_id)`; return
    `{"status": "stopped", "agent_id": agent_id}`; catch `ValueError` → HTTP 409
    `"Agent is not trading"`.
  - `GET /{agent_id}/portfolio`: read `agentTokenBalances` and `agentPnL` from vault via web3.py;
    return `{token_balances, pnl_wei, trading_active}`.
  - Register router in `dacap/backend/main.py` under prefix `/api/agents` and initialize
    `app.state.trading_engine` in a lifespan handler.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.1 Write unit tests for trading REST endpoints
    - Test start/stop happy paths and HTTP 409 duplicate-start / not-running-stop cases.
    - Test portfolio response shape and `trading_active` flag.
    - **Property 12: Trading Status Consistency** — start then GET returns `trading_active: true`;
      stop then GET returns `trading_active: false`.
    - **Validates: Requirements 5.6, 9.1**
    - _Requirements: 5.1–5.6_

- [x] 9. Implement WebSocket broadcaster and event listener
  - Create `dacap/backend/api/ws_trading.py`.
  - Implement `TradingBroadcaster` with `connect(ws)`, `disconnect(ws)`, and `broadcast(message)`
    that removes dead connections silently.
  - Implement `@router.websocket("/ws/trading")` endpoint: accept, add to broadcaster, loop on
    `receive_text()` for keep-alive, handle `WebSocketDisconnect`.
  - Implement `event_listener(app)` background coroutine: create `TradeExecuted` event filter;
    poll `get_new_entries()` every 1 second; broadcast each event as JSON matching the
    `TradeExecutedMessage` schema; on exception log and retry after 5 seconds.
  - Register `event_listener` as a FastAPI lifespan background task in `main.py`.
  - Mount `ws_trading.router` in `main.py`.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 9.1 Write unit tests for WebSocket broadcaster
    - Test broadcast reaches all connected clients.
    - Test dead client is silently removed.
    - Test reconnect logic in `event_listener` (mock filter raising exception).
    - **Property 8: WebSocket Message Schema Completeness** — assert every broadcast message
      contains all required fields with correct types.
    - **Property 9: WebSocket Message Serialization Round-Trip** — serialize then deserialize;
      assert equality.
    - **Validates: Requirements 6.2, 6.3, 10.5**
    - _Requirements: 6.1–6.6_

- [x] 10. Checkpoint — ensure backend tests pass
  - Run `pytest dacap/backend/tests/` from the backend directory. Ask the user if any issues arise.

- [x] 11. Implement `useWebSocket` hook
  - Create `dacap/frontend/src/hooks/useWebSocket.ts`.
  - Open `WebSocket(url)` on mount; close on unmount.
  - On `onmessage`: parse JSON, append to `messages` array capped at 100; set `lastMessage`.
  - On `onopen`: set `status = "connected"`.
  - On `onclose`: set `status = "reconnecting"`; schedule retry after 5 seconds.
  - Return `{ messages, status, lastMessage }`.
  - _Requirements: 7.1, 7.4, 7.5_

  - [ ]* 11.1 Write unit tests for useWebSocket hook
    - Test connect/disconnect lifecycle.
    - Test status transitions: `connecting` → `connected` → `reconnecting`.
    - Test message array is capped at 100.
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 12. Implement `LivePnLChart` component
  - Create `dacap/frontend/src/components/LivePnLChart.tsx`.
  - Accept `messages: TradeExecutedMessage[]` and `status` as props (or call `useWebSocket`
    internally).
  - Maintain `chartData: ChartPoint[]` (max 100 points) and running `cumulativePnL`.
  - On each new message: compute `ethSpent = BigInt(msg.amountIn)`,
    `tokenValue = BigInt(msg.amountOut) * priceOf(msg.token) / BigInt(1e8)`,
    `cumulativePnL += Number(tokenValue - ethSpent) / 1e18`; push `{ x, pnl }` and shift if
    length > 100.
  - Render Recharts `AreaChart` with `pnl` on y-axis and trade index on x-axis.
  - Render `ConnectionBadge`: green "LIVE" when `status === "connected"`, yellow "RECONNECTING"
    otherwise.
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ]* 12.1 Write property test for LivePnLChart windowing
    - **Property 11: Live PnL Chart Windowing**
    - **Validates: Requirements 7.2, 7.3**
    - Use fast-check: generate > 100 messages; assert chart data has exactly 100 points and
      cumulative PnL equals the running sum over all received messages.

- [x] 13. Implement `TradingFeed` component
  - Create `dacap/frontend/src/components/TradingFeed.tsx`.
  - Accept `messages: TradeExecutedMessage[]` as prop.
  - Maintain `trades` state capped at 50, newest first.
  - On new message: prepend with a brief CSS highlight animation; remove oldest if count > 50.
  - Each row: truncated agent address, color-coded action badge (swap/supply/borrow/withdraw),
    token symbol, `amountIn` in ETH (4 dp), `amountOut` in token units, relative timestamp
    ("Xs ago").
  - When `trades` is empty: display "Waiting for agent trades...".
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 13.1 Write property test for TradingFeed ordering and cap
    - **Property 10: TradingFeed Ordering and Cap**
    - **Validates: Requirements 8.1, 8.3**
    - Use fast-check: generate 1–200 messages; assert feed length ≤ 50, newest-first order, and
      last received message is always at index 0.

- [x] 14. Integrate LivePnLChart and TradingFeed into Dashboard
  - In `dacap/frontend/src/pages/Dashboard.tsx`:
    - Call `useWebSocket("ws://localhost:8000/ws/trading")` at the top of the component.
    - Render `<LivePnLChart messages={messages} status={status} />` below the existing charts row.
    - Render `<TradingFeed messages={messages} />` below `LivePnLChart`.
  - _Requirements: 7.1, 7.2, 7.3, 8.4_

- [x] 15. Add trading controls to Agents page
  - In `dacap/frontend/src/pages/Agents.tsx`:
    - For each agent, call `GET /api/agents/{id}/portfolio` on mount and after start/stop actions
      to get `trading_active` and `token_balances`.
    - Render `TradingStatusBadge`: "AI Trading: ON" (green) or "AI Trading: OFF" (slate).
    - Render `PortfolioValueDisplay`: sum of `token_balances[token] * price[token]` in USD.
    - Render "Start AI Trading" button only when `getDelegation(investor, agent).maxAllocationWei > 0`.
    - On "Start AI Trading" click: call `POST /api/agents/{id}/start-trading`; on success update
      badge; on failure show inline error message on that card.
    - On "Stop AI Trading" click (shown when trading is ON): call
      `POST /api/agents/{id}/stop-trading`; on success update badge; on failure show inline error.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 15.1 Write unit tests for Agents page trading controls
    - Test badge reflects `trading_active` from API response.
    - Test "Start AI Trading" button visibility gated on delegation.
    - Test inline error display on API failure.
    - **Property 13: Portfolio Value Computation** — assert displayed USD value equals
      `Σ (balance * price / 10^decimals)`.
    - **Validates: Requirements 9.5**
    - _Requirements: 9.1–9.6_

- [x] 16. Final checkpoint — end-to-end verification
  - Verify the following sequence works via automated integration test or manual checklist:
    1. Start Hardhat node: `npx hardhat node` (run manually).
    2. Deploy all contracts: `npx hardhat run scripts/deploy.js --network localhost`.
    3. Start backend: `uvicorn main:app --reload` (run manually).
    4. Call `POST /api/agents/{id}/start-trading` for one agent.
    5. Assert `GET /api/agents/{id}/portfolio` returns `trading_active: true`.
    6. Connect a WebSocket client to `ws://localhost:8000/ws/trading`.
    7. Wait ≥ 10 seconds; assert at least one `TradeExecuted` JSON message is received.
    8. Call `POST /api/agents/{id}/stop-trading`; assert `trading_active: false`.
  - Ensure all automated tests pass. Ask the user if any issues arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 3, 5, 10, 16) ensure incremental validation.
- Property tests validate universal correctness invariants; unit tests cover specific examples and
  error paths.
- The Hardhat node and backend server must be started manually by the developer.
