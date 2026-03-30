import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, Shield } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { portfolioHistory, allocationData, agents } from '../utils/mockData'
import { useWebSocket } from '../hooks/useWebSocket'
import { usePriceWebSocket } from '../hooks/usePriceWebSocket'
import LivePnLChart from '../components/LivePnLChart'
import TradingFeed from '../components/TradingFeed'
import LivePriceChart from '../components/LivePriceChart'
import AgentPredictionPanel from '../components/AgentPredictionPanel'

const COLORS = ['#00f5ff', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

const metrics = [
  { label: 'Total Portfolio Value', value: '$1,284,720', change: '+12.4%', up: true, icon: DollarSign },
  { label: 'Unrealized PnL', value: '+$142,380', change: '+34.7%', up: true, icon: TrendingUp },
  { label: 'Active Agents', value: '6 / 47', change: 'Protocol-wide', up: true, icon: Users },
  { label: 'Portfolio Volatility', value: '14.2%', change: 'Within budget', up: true, icon: Activity },
  { label: 'Max Drawdown', value: '-8.2%', change: 'Last 30d', up: false, icon: TrendingDown },
  { label: 'Risk Score', value: '72 / 100', change: 'Balanced', up: true, icon: Shield },
]

// Simulated PnL that runs even without real trades
function useSimulatedPnL() {
  const [simPnL, setSimPnL] = useState<{ x: number; pnl: number }[]>([])
  const cumRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.48) * 0.002  // slight positive bias
      cumRef.current += delta
      tickRef.current += 1
      setSimPnL(prev => {
        const next = [...prev, { x: tickRef.current, pnl: cumRef.current }]
        return next.slice(-100)
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return simPnL
}

export default function Dashboard() {
  const { messages, status } = useWebSocket('ws://localhost:8000/ws/trading')
  const { prices, connected: pricesConnected } = usePriceWebSocket('ws://localhost:8000/ws/prices')
  const simPnL = useSimulatedPnL()
  const [agentMode, setAgentMode] = useState(true)
  const activeAgentId = 'AGT-001'

  // Cumulative PnL from real trades
  const [realPnL, setRealPnL] = useState(0)
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    const TOKEN_PRICE_ETH: Record<string, number> = {
      WBTC: 15.0, USDC: 0.0005, LINK: 0.0075, UNI: 0.004, WETH: 1.0,
    }
    const tokenVal = Number(last.amountOut) * (TOKEN_PRICE_ETH[last.token] ?? 0) / 1e18
    const ethSpent = Number(last.amountIn) / 1e18
    setRealPnL(prev => prev + tokenVal - ethSpent)
  }, [messages])

  const displayPnL = messages.length > 0 ? realPnL : (simPnL[simPnL.length - 1]?.pnl ?? 0)
  const pnlColor = displayPnL >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Portfolio Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time capital allocation overview</p>
        </div>
        <div className={`text-xs font-mono px-3 py-1.5 rounded-lg border ${
          displayPnL >= 0
            ? 'bg-green/10 text-green border-green/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          Session PnL: {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(6)} ETH
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-cyan/10 flex items-center justify-center">
                <m.icon size={14} className="text-cyan" />
              </div>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${m.up ? 'bg-green/10 text-green' : 'bg-red-500/10 text-red-400'}`}>
                {m.change}
              </span>
            </div>
            <div className="text-xl font-bold text-white">{m.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Live price chart — always active */}
      <LivePriceChart prices={prices} connected={pricesConnected} />

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Portfolio value */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Portfolio Value</h3>
              <p className="text-xs text-slate-500">90-day history</p>
            </div>
            <span className="text-xs font-mono text-green bg-green/10 px-2 py-1 rounded">+12.4%</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={portfolioHistory}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#00f5ff" strokeWidth={2} fill="url(#portfolioGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-1">Capital Allocation</h3>
          <p className="text-xs text-slate-500 mb-3">By agent weight</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {allocationData.slice(0, 4).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-slate-400">{d.name}</span>
                </div>
                <span className="text-slate-300 font-mono">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live PnL + Agent Predictions side by side */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          {/* Always-active PnL chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Live PnL</h3>
                <p className="text-xs text-slate-500">
                  {messages.length > 0 ? 'From real trades' : 'Simulated (no trades yet)'}
                </p>
              </div>
              <div className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                displayPnL >= 0 ? 'bg-green/10 text-green' : 'bg-red-500/10 text-red-400'
              }`}>
                {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(6)} ETH
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={messages.length > 0 ? undefined : simPnL}>
                <defs>
                  <linearGradient id="pnlGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={pnlColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" hide />
                <YAxis
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(4)}`}
                  width={60}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(6)} ETH`, 'PnL']}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={pnlColor}
                  strokeWidth={2}
                  fill="url(#pnlGrad2)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent prediction panel */}
        <AgentPredictionPanel
          agentId={activeAgentId}
          agentMode={agentMode}
          onToggleMode={setAgentMode}
        />
      </div>

      {/* Trading feed */}
      <TradingFeed messages={messages} />

      {/* Agent performance table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Top Agents by Allocation</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-border">
              {['Agent', 'Strategy', 'Sharpe', 'Drawdown', 'Allocation', 'PnL', 'Status'].map(h => (
                <th key={h} className="text-left pb-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.map(a => (
              <tr key={a.id} className="hover:bg-white/2 transition-colors">
                <td className="py-2.5 font-mono text-cyan">{a.name}</td>
                <td className="py-2.5 text-slate-400">{a.strategy}</td>
                <td className="py-2.5 text-green font-mono">{a.sharpe}</td>
                <td className="py-2.5 text-red-400 font-mono">{a.drawdown}%</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-cyan rounded-full" style={{ width: `${a.allocation}%` }} />
                    </div>
                    <span className="font-mono text-slate-300">{a.allocation}%</span>
                  </div>
                </td>
                <td className={`py-2.5 font-mono ${a.pnl > 0 ? 'text-green' : 'text-red-400'}`}>+{a.pnl}%</td>
                <td className="py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${a.status === 'active' ? 'bg-green/10 text-green' : 'bg-gold/10 text-gold'}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
