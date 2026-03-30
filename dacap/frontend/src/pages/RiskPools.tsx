import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { pools } from '../utils/mockData'
import { generateTimeSeries } from '../utils/mockData'
import { Shield, TrendingUp, Users, DollarSign } from 'lucide-react'

export default function RiskPools() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Risk Pools</h1>
        <p className="text-slate-500 text-sm mt-0.5">Unified capital pools with enforced volatility budgets</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {pools.map((pool, i) => {
          const history = generateTimeSeries(30, pool.tvl / 1000000, pool.volatilityCap / 10)
          return (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card hover:border-opacity-40 transition-all"
              style={{ borderColor: `${pool.color}22` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-white text-lg">{pool.name}</h2>
                  <p className="text-xs text-slate-500">Vol. cap: {pool.volatilityCap}%</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${pool.color}22` }}>
                  <Shield size={18} style={{ color: pool.color }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={11} className="text-slate-500" />
                    <span className="text-xs text-slate-500">TVL</span>
                  </div>
                  <p className="font-bold font-mono text-white">${(pool.tvl / 1000000).toFixed(1)}M</p>
                </div>
                <div className="bg-surface rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={11} className="text-slate-500" />
                    <span className="text-xs text-slate-500">APY</span>
                  </div>
                  <p className="font-bold font-mono" style={{ color: pool.color }}>{pool.apy}%</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={11} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{pool.agents} active agents</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(pool.agents / 10) * 100}%`, background: pool.color }} />
                </div>
              </div>

              <ResponsiveContainer width="100%" height={70}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id={`grad-${pool.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={pool.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={pool.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 10 }} />
                  <Area type="monotone" dataKey="value" stroke={pool.color} strokeWidth={1.5} fill={`url(#grad-${pool.id})`} />
                </AreaChart>
              </ResponsiveContainer>

              <button
                className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: `${pool.color}15`, color: pool.color, border: `1px solid ${pool.color}30` }}
              >
                Deposit into {pool.name}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Pool comparison table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Pool Comparison</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-border">
              {['Pool', 'TVL', 'APY', 'Volatility Cap', 'Active Agents', 'Allocation Method'].map(h => (
                <th key={h} className="text-left pb-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pools.map(p => (
              <tr key={p.id} className="hover:bg-white/2">
                <td className="py-3 font-semibold" style={{ color: p.color }}>{p.name}</td>
                <td className="py-3 font-mono text-white">${(p.tvl / 1000000).toFixed(1)}M</td>
                <td className="py-3 font-mono text-green">{p.apy}%</td>
                <td className="py-3 font-mono text-slate-300">{p.volatilityCap}%</td>
                <td className="py-3 text-slate-300">{p.agents}</td>
                <td className="py-3 text-slate-400">Multiplicative Weights Update</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
