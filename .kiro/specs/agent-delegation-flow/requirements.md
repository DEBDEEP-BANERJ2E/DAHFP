# Requirements Document

## Introduction

The Agent Delegation Flow enables DACAP platform investors to delegate capital to autonomous AI agents
through a secure, on-chain process. The user browses registered agents, selects one, configures risk
parameters (ETH deposit amount, max drawdown limit, max allocation cap), signs the delegation with
MetaMask using EIP-712 typed data, and confirms an ETH deposit transaction that locks funds in the
CapitalVault contract on the local Ganache network. The flow concludes with a success state showing
the transaction hash. The agent backend can subsequently call AllocationEngine.submitUpdate() to
trade within the investor's configured limits.

Key architectural notes:
- The existing CapitalVault uses ERC20 tokens; this feature introduces a native ETH deposit path
  via a new `depositETH(uint8 pool, address agent, uint256 maxDrawdownBps, uint256 maxAllocationWei)`
  payable function and a `DelegationParams` struct stored per investor-agent pair.
- EIP-712 typed signatures are verified on-chain to ensure delegation parameters were authorized
  by the investor before funds are accepted.
- The deploy script writes deployed addresses to a frontend-readable JSON config file.

---

## Glossary

- **Investor**: A human user who connects their MetaMask wallet and deposits ETH into the protocol.
- **Agent**: An autonomous AI strategy registered in AgentRegistry.sol with an on-chain address.
- **CapitalVault**: The smart contract that custodies investor ETH and enforces risk limits.
- **AllocationEngine**: The smart contract that receives off-chain MWU weight updates from the agent backend.
- **DelegationParams**: A struct containing the agent address, ETH amount, max drawdown limit (bps), and max allocation cap (wei) signed by the investor.
- **EIP-712**: An Ethereum standard for typed structured data hashing and signing, enabling human-readable MetaMask signature prompts.
- **MaxDrawdownBps**: The maximum percentage loss (in basis points, e.g. 2000 = 20%) before the agent's allocation is zeroed.
- **MaxAllocationWei**: The maximum ETH amount (in wei) the agent may deploy at any one time from the investor's deposit.
- **Pool**: A risk tier in CapitalVault (0 = Conservative, 1 = Balanced, 2 = Aggressive).
- **DelegationModal**: The frontend UI component that collects delegation parameters and orchestrates the MetaMask signing and deposit transaction.
- **ContractConfig**: A JSON file written by the deploy script containing deployed contract addresses, read by the frontend at runtime.
- **Ganache**: The local Ethereum blockchain running at http://127.0.0.1:7545 with chainId 1337.
- **Tx_Hash**: The hexadecimal transaction hash returned by Ganache after a confirmed on-chain transaction.

---

## Requirements

### Requirement 1: Agent Browsing and Selection

**User Story:** As an Investor, I want to browse registered AI agents and select one to delegate capital to, so that I can initiate the delegation flow with a pre-selected agent.

#### Acceptance Criteria

1. THE Agents_Page SHALL display all agents returned by the `/api/agents` endpoint, falling back to mock data when the backend is unavailable.
2. WHEN an Investor clicks a "Delegate Capital" button on an agent card, THE DelegationModal SHALL open with that agent's address and name pre-populated.
3. THE Agents_Page SHALL display each agent's name, strategy, risk tier, Sharpe ratio, max drawdown, and protocol score.
4. WHEN the Investor applies a risk-tier filter, THE Agents_Page SHALL display only agents matching the selected tier.

---

### Requirement 2: Delegation Parameter Input

**User Story:** As an Investor, I want to configure the ETH amount, max drawdown limit, and max allocation cap before delegating, so that I retain control over my risk exposure.

#### Acceptance Criteria

1. THE DelegationModal SHALL provide an input field for the ETH deposit amount, accepting values greater than 0.
2. THE DelegationModal SHALL provide an input field for MaxDrawdownBps, accepting integer values between 100 (1%) and 5000 (50%).
3. THE DelegationModal SHALL provide an input field for MaxAllocationWei expressed in ETH, accepting values greater than 0 and less than or equal to the deposit amount.
4. IF the Investor submits the form with an ETH amount of 0 or less, THEN THE DelegationModal SHALL display the error message "Deposit amount must be greater than 0".
5. IF the Investor submits the form with MaxDrawdownBps outside the range [100, 5000], THEN THE DelegationModal SHALL display the error message "Max drawdown must be between 1% and 50%".
6. IF the Investor submits the form with MaxAllocationWei greater than the deposit amount, THEN THE DelegationModal SHALL display the error message "Allocation cap cannot exceed deposit amount".
7. THE DelegationModal SHALL display the selected agent's name, risk tier, and current protocol score as read-only context.

---

### Requirement 3: EIP-712 Typed Data Signature

**User Story:** As an Investor, I want to sign my delegation parameters using MetaMask's EIP-712 typed data prompt, so that I can verify the exact parameters before committing funds.

#### Acceptance Criteria

1. WHEN the Investor clicks "Sign & Continue", THE DelegationModal SHALL construct an EIP-712 typed data payload containing: agent address, ETH amount in wei, MaxDrawdownBps, MaxAllocationWei, investor address (nonce), and chainId 1337.
2. WHEN the EIP-712 payload is constructed, THE DelegationModal SHALL call `window.ethereum.request({ method: 'eth_signTypedData_v4', params: [address, payload] })` to present the MetaMask signature prompt.
3. WHEN MetaMask returns a valid signature, THE DelegationModal SHALL store the signature and advance to the deposit confirmation step.
4. IF MetaMask returns an error or the Investor rejects the signature, THEN THE DelegationModal SHALL display the error message "Signature rejected. Please try again." and remain on the signing step.
5. THE EIP-712 domain SHALL use name "DACAP", version "1", chainId 1337, and the deployed CapitalVault contract address as verifyingContract.
6. FOR ALL valid DelegationParams objects, signing then recovering the signer address using the returned signature SHALL produce the Investor's wallet address (round-trip property).

---

### Requirement 4: On-Chain ETH Deposit with Delegation

**User Story:** As an Investor, I want to confirm an ETH deposit transaction in MetaMask that locks my funds in CapitalVault with my delegation parameters, so that the agent can trade within my specified limits.

#### Acceptance Criteria

1. WHEN the Investor clicks "Confirm Deposit", THE DelegationModal SHALL call `CapitalVault.depositETH(pool, agent, maxDrawdownBps, maxAllocationWei, signature)` as a payable transaction with `value` equal to the specified ETH amount.
2. WHEN the deposit transaction is submitted, THE CapitalVault SHALL verify the EIP-712 signature matches the Investor's address and the provided DelegationParams.
3. IF the EIP-712 signature is invalid or does not match the caller, THEN THE CapitalVault SHALL revert with the message "Invalid delegation signature".
4. WHEN the signature is valid and `msg.value > 0`, THE CapitalVault SHALL record `investorBalances[msg.sender][pool] += msg.value` and `poolTVL[pool] += msg.value`.
5. WHEN the deposit is recorded, THE CapitalVault SHALL store the DelegationParams (agent, maxDrawdownBps, maxAllocationWei) keyed by `(investor, agent)`.
6. WHEN the deposit is recorded, THE CapitalVault SHALL emit a `DelegationDeposited(investor, agent, pool, amount, maxDrawdownBps, maxAllocationWei)` event.
7. FOR ALL valid deposits, `investorBalances[investor][pool]` after deposit SHALL equal the balance before deposit plus `msg.value` (invariant property).
8. IF `msg.value` equals 0, THEN THE CapitalVault SHALL revert with the message "ETH amount must be > 0".
9. IF the pool ID is greater than 2, THEN THE CapitalVault SHALL revert with the message "Invalid pool".

---

### Requirement 5: Transaction Confirmation and Success State

**User Story:** As an Investor, I want to see a success state with the transaction hash after my deposit is confirmed, so that I can verify the transaction on-chain.

#### Acceptance Criteria

1. WHEN the deposit transaction is confirmed on Ganache, THE DelegationModal SHALL transition to a success state displaying the Tx_Hash.
2. THE DelegationModal success state SHALL display the delegated agent name, deposited ETH amount, MaxDrawdownBps as a percentage, and MaxAllocationWei in ETH.
3. WHEN the Investor clicks "Done", THE DelegationModal SHALL close and the Agents_Page SHALL refresh the agent list.
4. WHILE the deposit transaction is pending, THE DelegationModal SHALL display a loading indicator and disable all action buttons.
5. IF the deposit transaction is rejected by the Investor in MetaMask, THEN THE DelegationModal SHALL display the error message "Transaction rejected." and return to the confirmation step.
6. IF the deposit transaction reverts on-chain, THEN THE DelegationModal SHALL display the revert reason and return to the confirmation step.

---

### Requirement 6: Contract Deployment and Frontend Configuration

**User Story:** As a developer, I want the deploy script to write contract addresses to a config file, so that the frontend can read them at runtime without hardcoding.

#### Acceptance Criteria

1. WHEN the deploy script completes successfully, THE Deploy_Script SHALL write a JSON file to `dacap/frontend/src/contracts/config.json` containing the deployed addresses for CapitalVault, AllocationEngine, AgentRegistry, and SlashingModule.
2. THE ContractConfig file SHALL conform to the schema `{ "CapitalVault": "0x...", "AllocationEngine": "0x...", "AgentRegistry": "0x...", "SlashingModule": "0x..." }`.
3. THE Deploy_Script SHALL deploy all contracts to the Ganache network at `http://127.0.0.1:7545` with chainId 1337.
4. THE Deploy_Script SHALL deploy a new ETH-native CapitalVault (no ERC20 token constructor argument) that accepts native ETH via `depositETH`.
5. THE Frontend SHALL import contract addresses exclusively from `dacap/frontend/src/contracts/config.json` and SHALL NOT hardcode any contract address.
6. IF the ContractConfig file is missing at runtime, THEN THE DelegationModal SHALL display the error message "Contract configuration not found. Please deploy contracts first."

---

### Requirement 7: Agent Backend Allocation Enforcement

**User Story:** As an agent backend operator, I want AllocationEngine.submitUpdate() to respect per-investor delegation limits, so that agents cannot exceed the capital caps set by investors.

#### Acceptance Criteria

1. WHEN AllocationEngine.submitUpdate() is called, THE AllocationEngine SHALL read each investor's MaxAllocationWei for the target agent from CapitalVault before forwarding weights.
2. IF a proposed weight for an agent would result in an allocation exceeding any investor's MaxAllocationWei for that agent, THEN THE AllocationEngine SHALL cap the effective weight to the investor's MaxAllocationWei.
3. WHEN an agent's agentCurrentValue falls below `agentPeakValue * (1 - MaxDrawdownBps/10000)` for any investor delegation, THE CapitalVault SHALL zero out `agentWeights[agent]` and emit `DrawdownBreached`.
4. THE CapitalVault SHALL expose a `getDelegation(address investor, address agent)` view function returning the stored DelegationParams for that pair.
