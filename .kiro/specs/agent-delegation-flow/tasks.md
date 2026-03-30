# Implementation Plan: Agent Delegation Flow

## Overview

Implement the end-to-end ETH delegation flow: update `CapitalVault.sol` with EIP-712 and `depositETH`, update the deploy script to emit `config.json`, build the frontend hook and modal, wire the "Delegate Capital" button, and add contract + frontend tests with property-based coverage.

## Tasks

- [x] 1. Update CapitalVault.sol with ETH deposit path and EIP-712
  - [x] 1.1 Add `DelegationParams` struct, `delegations` mapping, `DOMAIN_SEPARATOR`, `DELEGATION_TYPEHASH`, and `DelegationDeposited` event to `dacap/contracts/src/CapitalVault.sol`
    - Remove the `IERC20` import and `token` state variable (ETH-native vault; existing ERC20 `deposit`/`withdraw` functions can be removed or left as dead code — remove them to keep the contract clean)
    - Set `DOMAIN_SEPARATOR` in the constructor using `keccak256(abi.encode(domainTypeHash, name, version, chainId, address(this)))`
    - _Requirements: 4.2, 4.5, 4.6, 7.4_

  - [x] 1.2 Implement `depositETH(uint8 pool, address agent, uint256 maxDrawdownBps, uint256 maxAllocationWei, bytes calldata signature) external payable nonReentrant`
    - Revert "Invalid pool" if `pool > 2`
    - Revert "ETH amount must be > 0" if `msg.value == 0`
    - Recover signer from EIP-712 digest; revert "Invalid delegation signature" if signer != `msg.sender`
    - Update `investorBalances[msg.sender][pool]`, `poolTVL[pool]`, and `delegations[msg.sender][agent]`
    - Emit `DelegationDeposited`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9_

  - [x] 1.3 Implement `getDelegation(address investor, address agent) external view returns (DelegationParams memory)`
    - _Requirements: 7.4_

- [ ] 2. Contract tests for CapitalVault depositETH
  - [ ] 2.1 Write unit tests in `dacap/contracts/test/CapitalVault.test.js` for `depositETH`
    - Valid params + valid signature → succeeds, balances updated, event emitted
    - `msg.value == 0` → reverts "ETH amount must be > 0"
    - `pool > 2` → reverts "Invalid pool"
    - Tampered signature → reverts "Invalid delegation signature"
    - `getDelegation` returns stored params after deposit
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9, 7.4_

  - [ ]* 2.2 Write property test for EIP-712 sign-then-recover round trip (Property 7)
    - **Property 7: EIP-712 sign-then-recover round trip**
    - **Validates: Requirements 3.6**
    - File: `dacap/contracts/test/CapitalVault.pbt.test.js`
    - Use `fast-check` with random signers and random DelegationParams; assert recovered address equals signer

  - [ ]* 2.3 Write property test for on-chain signature verification (Property 8)
    - **Property 8: On-chain signature verification**
    - **Validates: Requirements 4.2, 4.3**
    - File: `dacap/contracts/test/CapitalVault.pbt.test.js`
    - Use `fc.uint8Array({minLength:65,maxLength:65})` for tampered signatures; assert revert

  - [ ]* 2.4 Write property test for deposit balance invariant (Property 9)
    - **Property 9: Deposit balance invariant**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 7.4**
    - File: `dacap/contracts/test/CapitalVault.pbt.test.js`
    - Use `fc.bigInt({min:1n})` for value, random pool/agent/params; assert balance and TVL deltas equal `msg.value` and `getDelegation` returns correct params

  - [ ]* 2.5 Write property test for drawdown breach zeroes agent weights (Property 13)
    - **Property 13: Drawdown breach zeroes agent weights**
    - **Validates: Requirements 7.3**
    - File: `dacap/contracts/test/CapitalVault.pbt.test.js`
    - Random peak/current value pairs where `current < peak * (1 - maxDrawdownBps/10000)`; assert `agentWeights[agent] == 0` and `DrawdownBreached` emitted

- [ ] 3. Checkpoint — contract layer
  - Ensure all Hardhat tests pass: `npx hardhat test --network hardhat`
  - Ask the user if questions arise.

- [x] 4. Update deploy script to write config.json
  - [x] 4.1 Modify `dacap/contracts/scripts/deploy.js` to write `dacap/frontend/src/contracts/config.json` after all contracts are deployed
    - Create the `dacap/frontend/src/contracts/` directory if it does not exist (use `fs.mkdirSync` with `recursive: true`)
    - Write JSON conforming to `{ CapitalVault, AllocationEngine, AgentRegistry, SlashingModule }` with checksummed addresses
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.2 Write property test for config file schema conformance (Property 11)
    - **Property 11: Config file schema conformance**
    - **Validates: Requirements 6.1, 6.2**
    - File: `dacap/contracts/test/deploy.pbt.test.js`
    - After running the deploy script programmatically, parse `config.json` and assert all four keys exist with values matching `/^0x[0-9a-fA-F]{40}$/`

- [x] 5. Create frontend contract artifacts
  - [x] 5.1 Create `dacap/frontend/src/contracts/CapitalVaultABI.ts` with the minimal ABI fragments for `depositETH`, `getDelegation`, and `DelegationDeposited`
    - _Requirements: 4.1, 7.4_

- [x] 6. Implement useContractInteraction hook
  - [x] 6.1 Create `dacap/frontend/src/hooks/useContractInteraction.ts`
    - Import `config.json`; throw "Contract configuration not found. Please deploy contracts first." if missing or malformed
    - Check `window.ethereum` exists; surface "MetaMask not detected" if absent
    - Check `chainId == 1337` before signing; surface "Please switch to Ganache (chainId 1337)" if wrong network
    - `signDelegation(params)`: construct EIP-712 payload per design, call `eth_signTypedData_v4`, catch error code 4001 → "Signature rejected. Please try again."
    - `depositETH(params, signature)`: use ethers.js v6 `BrowserProvider` + `Contract`, send payable tx, await receipt, return `txHash`; catch error code 4001 → "Transaction rejected."; parse revert reason for on-chain reverts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 5.4, 5.5, 5.6, 6.5, 6.6_

  - [ ]* 6.2 Write property test for EIP-712 payload structure (Property 6)
    - **Property 6: EIP-712 payload structure**
    - **Validates: Requirements 3.1, 3.5**
    - File: `dacap/frontend/src/__tests__/useContractInteraction.pbt.test.ts`
    - Use `fc.record` with random valid `DelegationFormParams`; assert domain fields and all six message fields are present and correctly typed

- [x] 7. Implement DelegationModal component
  - [x] 7.1 Create `dacap/frontend/src/components/agents/DelegationModal.tsx`
    - Step 1 (`params`): form with ETH amount, maxDrawdownBps, maxAllocationWei inputs; show agent name/risk/score as read-only; validate on submit per Requirements 2.1–2.6
    - Step 2 (`signing`): call `signDelegation`, show loading spinner, disable buttons; on rejection show "Signature rejected. Please try again." and stay on step 2
    - Step 3 (`confirming`): show delegation summary; call `depositETH`, show pending spinner, disable buttons; on rejection show "Transaction rejected." and return to step 3; on revert show revert reason
    - Success state: display tx hash, agent name, ETH amount, maxDrawdownBps as %, maxAllocationWei in ETH; "Done" button closes modal
    - Show "Connect wallet first" and disable "Sign & Continue" when wallet not connected
    - Show "Contract configuration not found. Please deploy contracts first." when config missing
    - _Requirements: 2.1–2.7, 3.1–3.5, 4.1, 5.1–5.6, 6.5, 6.6_

  - [ ]* 7.2 Write unit tests for DelegationModal in `dacap/frontend/src/__tests__/DelegationModal.test.tsx`
    - Renders step 1 with agent name pre-populated
    - Advances to step 2 on valid form submit
    - Shows error "Deposit amount must be greater than 0" for amount ≤ 0
    - Shows error "Max drawdown must be between 1% and 50%" for out-of-range bps
    - Shows error "Allocation cap cannot exceed deposit amount" for allocation > deposit
    - Shows success state with tx hash after confirmed deposit
    - _Requirements: 2.4, 2.5, 2.6, 5.1, 5.2_

  - [ ]* 7.3 Write property test for form validation — deposit amount (Property 3)
    - **Property 3: Form validation — deposit amount**
    - **Validates: Requirements 2.1, 2.4**
    - File: `dacap/frontend/src/__tests__/DelegationModal.pbt.test.tsx`
    - Use `fc.oneof(fc.constant(0), fc.float({max:0}), fc.float({min:0.0001}))`; assert rejection/acceptance

  - [ ]* 7.4 Write property test for form validation — drawdown bps range (Property 4)
    - **Property 4: Form validation — drawdown bps range**
    - **Validates: Requirements 2.2, 2.5**
    - File: `dacap/frontend/src/__tests__/DelegationModal.pbt.test.tsx`
    - Use `fc.integer({min:-1000, max:10000})`; assert values outside [100,5000] are rejected

  - [ ]* 7.5 Write property test for form validation — allocation cap (Property 5)
    - **Property 5: Form validation — allocation cap**
    - **Validates: Requirements 2.3, 2.6**
    - File: `dacap/frontend/src/__tests__/DelegationModal.pbt.test.tsx`
    - Use `fc.tuple(fc.float({min:0.001}), fc.float({min:0.001}))`; assert allocation > deposit is rejected

  - [ ]* 7.6 Write property test for success state rendering completeness (Property 10)
    - **Property 10: Success state rendering completeness**
    - **Validates: Requirements 5.2**
    - File: `dacap/frontend/src/__tests__/DelegationModal.pbt.test.tsx`
    - Use `fc.record` with random agent name, ETH amount, bps, allocationWei, txHash; assert all five values appear in rendered output

- [x] 8. Wire "Delegate Capital" button in Agents.tsx
  - [x] 8.1 Add a "Delegate Capital" button to each agent card in `dacap/frontend/src/pages/Agents.tsx`
    - Button click stops propagation and opens `DelegationModal` with the agent pre-populated (map `a.risk` to pool: Conservative=0, Balanced=1, Aggressive=2)
    - Pass `onClose` callback that refreshes the agent list on success
    - Import and render `DelegationModal` at the bottom of the page
    - _Requirements: 1.1, 1.2_

  - [ ]* 8.2 Write property test for agent card rendering completeness (Property 1)
    - **Property 1: Agent card rendering completeness**
    - **Validates: Requirements 1.3**
    - File: `dacap/frontend/src/__tests__/Agents.pbt.test.tsx`
    - Use `fc.record({ name: fc.string(), strategy: fc.string(), risk: fc.constantFrom('Conservative','Balanced','Aggressive'), sharpe: fc.float(), drawdown: fc.float(), score: fc.integer({min:0,max:100}) })`; assert all six fields appear in rendered card

  - [ ]* 8.3 Write property test for risk-tier filter correctness (Property 2)
    - **Property 2: Risk-tier filter correctness**
    - **Validates: Requirements 1.4**
    - File: `dacap/frontend/src/__tests__/Agents.pbt.test.tsx`
    - Use `fc.array(agentArb)` and `fc.constantFrom('all','conservative','balanced','aggressive')`; assert every displayed agent matches the selected filter

- [ ] 9. Checkpoint — full test suite
  - Ensure all Hardhat tests pass: `npx hardhat test --network hardhat`
  - Ensure all frontend tests pass: `npx vitest run` (from `dacap/frontend`)
  - Ask the user if questions arise.

- [x] 10. End-to-end integration on Ganache
  - [x] 10.1 Deploy all contracts to Ganache and verify `config.json` is written
    - Run `npx hardhat run scripts/deploy.js --network ganache` from `dacap/contracts`
    - Assert `dacap/frontend/src/contracts/config.json` exists and contains four valid `0x` addresses
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.2 Write an automated end-to-end test in `dacap/contracts/test/e2e.test.js` that deploys to the Hardhat in-process network, calls `depositETH` with a valid EIP-712 signature, and asserts the `DelegationDeposited` event and updated balances
    - _Requirements: 4.1–4.7_

- [ ] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check`; each must include the comment `// Feature: agent-delegation-flow, Property N: <title>`
- Each property test runs a minimum of 100 iterations
- The existing ERC20 `deposit`/`withdraw` functions in `CapitalVault.sol` should be removed since the new vault is ETH-native (per Requirement 6.4)
- `useContractInteraction` uses ethers.js v6 `BrowserProvider` (already a frontend dependency)
- The `contracts/` directory under `dacap/frontend/src/` must be created by the deploy script if absent
