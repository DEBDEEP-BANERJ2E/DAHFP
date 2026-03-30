import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAgents } from '../hooks/useAgents'
import DelegationModal from '../components/agents/DelegationModal'

const riskColors: Record<string, string> = {
  Conservative: 'text-green bg-green/10',
  Balanced: 'text-blue bg-blue/10',
  Aggressive: 'text-purple bg-purple/10',
}

const riskToPool: Record<string, 0 | 1 | 2> = {
  conservative: 0,
  balanced: 1,
  aggressive: 2,
  Conservative: 0,
  Balanced: 1,
  Aggressive: 2,
}

type DelegateAgent = { id: string; name: string; risk: string; score: number; riskPool: 0 | 1 | 2 }

interface AgentPortfolio {
  token_balances: Record<string, string>
  pnl_wei: string
  trading_active: boolean
}

// Approximate token prices in USD for portfolio value display
const TOKEN_PRICE_USD: Record<string, number> = {
  WBTC: 30000,
  USDC: 1,
  LINK: 15,
  UNI: 8,
  WETH: 2000,
}

function computePortfolioUSD(balances: Record<string, string>): number {
  return Object.entries(balances).reduce((sum, [sym, rawAmt]) => {
    const price = TOKEN_PRICE_USD[sym] ?? 0
    // Assume 18 decimals for most tokens; WBTC=8, USDC=6
    const decimals = sym === 'WBTC' ? 8 : sym === 'USDC' ? 6 : 18
    const amount = Number(rawAmt) / Math.pow(10, decimals)
    return sum + amount * price
  }, 0)
}

function TradingStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        active ? 'bg-green/10 text-green' : 'bg-slate-700 text-slate-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green animate-pulse' : 'bg-slate-500'}`} />
      AI Trading: {active ? 'ON' : 'OFF'}
    </span>
  )
}

export default function Agents() {
  const navigate = useNavigate()
  const { data: agents = [] } = useAgents()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [delegateAgent, setDelegateAgent] = useState<DelegateAgent | null>(null)

  // Per-agent portfolio state
  const [portfolios, setPortfolios] = useState<Record<string, AgentPortfolio>>({})
  const [tradingErrors, setTradingErrors] = useState<Record<string, string>>({})
  const [tradingLoading, setTradingLoading] = useState<Record<string, boolean>>({})

  type Agent = typeof import('../utils/mockData').agents[number]
  const filtered = (agents as Agent[]).filter(a =>
    (filter === 'all' || a.risk.toLowerCase() === filter) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const fetchPortfolio = useCallback(async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/portfolio`)
      if (res.ok) {
        const data: AgentPortfolio = await res.json()
        setPortfolios(prev => ({ ...prev, [agentId]: data }))
      }
    } catch {
      // silently ignore — chain may not be running
    }
  }, [])

  // Fetch portfolios on mount
  useEffect(() => {
    (agents as Agent[]).forEach(a => fetchPortfolio(a.id))
  }, [agents, fetchPortfolio])

  const handleStartTrading = async (agentId: string) => {
    setTradingLoading(prev => ({ ...prev, [agentId]: true }))
    setTradingErrors(prev => ({ ...prev, [agentId]: '' }))
    try {
      const res = await fetch(`/api/agents/${agentId}/start-trading`, { method: 'POST' })
      if (res.ok) {
        await fetchPortfolio(agentId)
      } else {
        const body = await res.json()
        setTradingErrors(prev => ({ ...prev, [agentId]: body.detail ?? 'Failed to start trading' }))
      }
    } catch (e) {
      setTradingErrors(prev => ({ ...prev, [agentId]: 'Network error' }))
    } finally {
      setTradingLoading(prev => ({ ...prev, [agentId]: false }))
    }
  }

  const handleStopTrading = async (agentId: string) => {
    setTradingLoading(prev => ({ ...prev, [agentId]: true }))
    setTradingErrors(prev => ({ ...prev, [agentId]: '' }))
    try {
      const res = await fetch(`/api/agents/${agentId}/stop-trading`, { method: 'POST' })
      if (res.ok) {
        await fetchPortfolio(agentId)
      } else {
        const body = await res.json()
        setTradingErrors(prev => ({ ...prev, [agentId]: body.detail ?? 'Failed to stop trading' }))
      }
    } catch {
      setTradingErrors(prev => ({ ...prev, [agentId]: 'Network error' }))
    } finally {
      setTradingLoading(prev => ({ ...prev, [agentId]: false }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Marketplace</h1>
          <p className="text-slate-500 text-sm mt-0.5">Competing autonomous strategy agents</p>
        </div>
        <button className="btn-primary text-sm">+ Deploy Agent</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan/40"
          />
        </div>
        {['all', 'conservative', 'balanced', 'aggressive'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f ? 'bg-cyan/10 text-cyan border border-cyan/20' : 'text-slate-500 hover:text-slate-300 border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((a, i) => {
          const portfolio = portfolios[a.id]
          const isTrading = portfolio?.trading_active ?? false
          const portfolioUSD = portfolio ? computePortfolioUSD(portfolio.token_balances) : null
          const tradingError = tradingErrors[a.id]
          const isLoading = tradingLoading[a.id] ?? false
          // Always show trading button — user can start trading after delegating
          const hasDelegation = true

          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/agents/${a.id}`)}
              className="card cursor-pointer hover:border-cyan/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white group-hover:text-cyan transition-colors">{a.name}</span>
                    {a.status === 'active'
                      ? <CheckCircle size={13} className="text-green" />
                      : <AlertTriangle size={13} className="text-gold" />
                    }
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{a.strategy}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskColors[a.risk]}`}>{a.risk}</span>
                  <TradingStatusBadge active={isTrading} />
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Protocol Score</span>
                  <span className="font-mono text-cyan">{a.score}/100</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${a.score}%` }}
                    transition={{ delay: i * 0.05 + 0.3, duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#00f5ff,#a855f7)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Sharpe', value: a.sharpe, color: 'text-green' },
                  { label: 'Drawdown', value: `${a.drawdown}%`, color: 'text-red-400' },
                  { label: 'Alloc.', value: `${a.allocation}%`, color: 'text-cyan' },
                  { label: 'PnL', value: `+${a.pnl}%`, color: 'text-green' },
                ].map(m => (
                  <div key={m.label} className="bg-surface rounded-lg p-2">
                    <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Portfolio value display */}
              {portfolioUSD !== null && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Portfolio Value</span>
                  <span className="font-mono text-white">
                    ${portfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-slate-500">
                <span className="font-mono">{a.id}</span>
                <span>Stake: ${(a.stake / 1000).toFixed(0)}K</span>
              </div>

              {/* Trading error */}
              {tradingError && (
                <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                  {tradingError}
                </div>
              )}

              {/* Trading controls */}
              <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setDelegateAgent({
                      id: a.address ?? a.id,
                      name: a.name,
                      risk: a.risk,
                      score: a.score,
                      riskPool: riskToPool[a.risk] ?? 1,
                    })
                  }}
                  className="btn-primary flex-1 text-xs py-1.5"
                >
                  Delegate Capital
                </button>

                {hasDelegation && !isTrading && (
                  <button
                    onClick={e => { e.stopPropagation(); handleStartTrading(a.id) }}
                    disabled={isLoading}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-all disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Start AI Trading'}
                  </button>
                )}

                {isTrading && (
                  <button
                    onClick={e => { e.stopPropagation(); handleStopTrading(a.id) }}
                    disabled={isLoading}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Stop AI Trading'}
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      <DelegationModal
        isOpen={!!delegateAgent}
        onClose={() => setDelegateAgent(null)}
        agent={delegateAgent}
      />
    </div>
  )
}
