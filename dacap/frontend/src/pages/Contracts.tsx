import { motion } from 'framer-motion'
import { smartContracts } from '../utils/mockData'
import { Shield, CheckCircle, AlertTriangle, ExternalLink, Copy, FileCode2 } from 'lucide-react'

const contractDetails = [
  {
    name: 'Capital Vault v2.1',
    description: 'Custodies all investor funds. Enforces position limits, leverage caps, drawdown ceilings, and volatility budgets. Agents never directly control capital.',
    functions: ['deposit(uint256 amount)', 'withdraw(uint256 amount)', 'enforceRiskLimits()', 'getAgentAllocation(address agent)'],
    events: ['Deposited', 'Withdrawn', 'RiskLimitBreached', 'AllocationUpdated'],
  },
  {
    name: 'Allocation Engine v1.4',
    description: 'Implements Multiplicative Weights Update algorithm. Continuously rebalances capital weights based on risk-adjusted agent performance.',
    functions: ['updateWeights(address[] agents, int256[] returns)', 'getWeight(address agent)', 'normalizeWeights()', 'setLearningRate(uint256 eta)'],
    events: ['WeightsUpdated', 'LearningRateChanged', 'AgentSlashed'],
  },
  {
    name: 'Agent Registry v1.0',
    description: 'Manages agent registration, staking, and reputation scores. Enforces anti-sybil bonding requirements.',
    functions: ['registerAgent(bytes32 strategyHash)', 'stakeCollateral()', 'slashAgent(address agent)', 'getReputationScore(address agent)'],
    events: ['AgentRegistered', 'CollateralStaked', 'AgentSlashed', 'ScoreUpdated'],
  },
  {
    name: 'Slashing Module v1.2',
    description: 'Monitors drawdown thresholds and executes slashing when agents breach risk limits. Redistributes slashed collateral to the protocol treasury.',
    functions: ['checkDrawdown(address agent)', 'executeSlash(address agent)', 'setThreshold(uint256 bps)', 'getSlashHistory(address agent)'],
    events: ['DrawdownBreached', 'SlashExecuted', 'TreasuryUpdated'],
  },
]

export default function Contracts() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Smart Contracts</h1>
        <p className="text-slate-500 text-sm mt-0.5">On-chain protocol infrastructure · Ethereum Mainnet</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-3">
        {smartContracts.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card">
            <div className="flex items-center justify-between mb-3">
              <FileCode2 size={14} className="text-cyan" />
              {c.audited
                ? <span className="flex items-center gap-1 text-xs text-green"><CheckCircle size={11} /> Audited</span>
                : <span className="flex items-center gap-1 text-xs text-gold"><AlertTriangle size={11} /> Pending</span>
              }
            </div>
            <p className="text-sm font-semibold text-white mb-1">{c.name}</p>
            <p className="text-xs font-mono text-slate-500 mb-2">{c.address}</p>
            <span className="text-xs bg-green/10 text-green px-2 py-0.5 rounded-full">{c.status}</span>
          </motion.div>
        ))}
      </div>

      {/* Contract details */}
      <div className="space-y-4">
        {contractDetails.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
            className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">{c.description}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <Copy size={13} className="text-slate-400" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <ExternalLink size={13} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Functions</p>
                <div className="space-y-1">
                  {c.functions.map(f => (
                    <div key={f} className="font-mono text-xs text-cyan bg-cyan/5 rounded px-2 py-1 border border-cyan/10">{f}</div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Events</p>
                <div className="space-y-1">
                  {c.events.map(e => (
                    <div key={e} className="font-mono text-xs text-purple bg-purple/5 rounded px-2 py-1 border border-purple/10">{e}</div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Smart contract code preview */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Capital Vault — Core Logic Preview</h3>
        <pre className="text-xs font-mono text-slate-300 bg-surface rounded-xl p-4 border border-border overflow-x-auto leading-relaxed">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CapitalVault {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public agentWeights;
    uint256 public totalTVL;
    uint256 public constant MAX_DRAWDOWN_BPS = 2000; // 20%

    event Deposited(address indexed investor, uint256 amount);
    event WeightsUpdated(address[] agents, uint256[] weights);
    event AgentSlashed(address indexed agent, uint256 amount);

    modifier onlyAllocationEngine() {
        require(msg.sender == allocationEngine, "Unauthorized");
        _;
    }

    function deposit(uint256 amount) external {
        // Transfer tokens, update balances
        balances[msg.sender] += amount;
        totalTVL += amount;
        emit Deposited(msg.sender, amount);
    }

    function updateWeights(
        address[] calldata agents,
        uint256[] calldata weights
    ) external onlyAllocationEngine {
        // Multiplicative Weights Update applied off-chain
        // Normalized weights stored on-chain
        for (uint i = 0; i < agents.length; i++) {
            agentWeights[agents[i]] = weights[i];
        }
        emit WeightsUpdated(agents, weights);
    }

    function enforceRiskLimits(address agent) external {
        uint256 drawdown = calculateDrawdown(agent);
        if (drawdown > MAX_DRAWDOWN_BPS) {
            _slashAgent(agent);
        }
    }
}`}
        </pre>
      </div>
    </div>
  )
}
