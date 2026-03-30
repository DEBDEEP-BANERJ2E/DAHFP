import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { agents } from '../utils/mockData'
import { Play, RefreshCw, Info } from 'lucide-react'

const ETA = 0.01

export default function AllocationEngine() {
  const [weights, setWeights] = useState(agents.map(a => ({ ...a, weight: a.allocation / 100 })))
  const [eta, setEta] = useState(ETA)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setWeights(prev => {
        const updated = prev.map(a => ({
          ...a,
          weight: a.weight * Math.exp(eta * (a.sharpe * (0.9 + Math.random() * 0.2)))
        }))
        const total = updated.reduce((s, a) => s + a.weight, 0)
        return updated.map(a => ({ ...a, weight: a.weight / total }))
      })
      setStep(s => s + 1)
    }, 800)
    return () => clearInterval(interval)
  }, [running, eta])

  const chartData = weights.map(a => ({ name: a.name, weight: parseFloat((a.weight * 100).toFixed(2)) }))
  const COLORS = ['#00f5ff', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Allocation Engine</h1>
          <p className="text-slate-500 text-sm mt-0.5">Live Multiplicative Weights Update simulation</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRunning(r => !r) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              running ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-cyan/10 text-cyan border border-cyan/20'
            }`}
          >
            {running ? <><RefreshCw size={13} className="animate-spin" /> Running</> : <><Play size={13} /> Simulate</>}
          </button>
        </div>
      </div>

      {/* Math formula */}
      <div className="card border-purple/20 glow-purple">
        <div className="flex items-start gap-3">
          <Info size={14} className="text-purple mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 mb-2">Capital Allocation Update Rule (Multiplicative Weights)</p>
            <div className="font-mono text-sm text-purple bg-purple/5 rounded-lg px-4 py-2 border border-purple/10 inline-block">
              w<sub>i</sub>(t+1) = w<sub>i</sub>(t) · exp(η · R<sub>i</sub>(t)) / Σ<sub>j</sub> w<sub>j</sub>(t+1)
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Regret bound: O(√T · ln N) — guarantees near-optimal allocation vs. best fixed agent in hindsight.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-2 block">Learning Rate η = {eta.toFixed(3)}</label>
            <input
              type="range" min="0.001" max="0.05" step="0.001"
              value={eta}
              onChange={e => setEta(parseFloat(e.target.value))}
              className="w-full accent-cyan"
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Update Steps</p>
            <p className="text-2xl font-bold font-mono text-cyan">{step}</p>
          </div>
        </div>
      </div>

      {/* Live weight chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Live Capital Weights</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" domain={[0, 50]} tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)}%`, 'Weight']}
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Capital flow visualization */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-5">Capital Flow Architecture</h3>
        <div className="flex items-center justify-between gap-2">
          {[
            { label: 'Investors', sub: '3 Risk Pools', color: '#00f5ff' },
            { label: '→', sub: '', color: '#475569' },
            { label: 'Capital Vault', sub: 'On-Chain', color: '#a855f7' },
            { label: '→', sub: '', color: '#475569' },
            { label: 'Alloc. Engine', sub: 'MWU Algorithm', color: '#3b82f6' },
            { label: '→', sub: '', color: '#475569' },
            { label: 'AI Agents', sub: 'Off-Chain', color: '#10b981' },
            { label: '→', sub: '', color: '#475569' },
            { label: 'DEX Markets', sub: 'Execution', color: '#f59e0b' },
          ].map((node, i) => (
            node.label === '→'
              ? <div key={i} className="text-slate-600 text-xl font-light">→</div>
              : (
                <motion.div
                  key={i}
                  animate={running ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                  className="flex-1 rounded-xl p-3 text-center border"
                  style={{ borderColor: `${node.color}30`, background: `${node.color}08` }}
                >
                  <p className="text-xs font-semibold" style={{ color: node.color }}>{node.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{node.sub}</p>
                </motion.div>
              )
          ))}
        </div>
      </div>
    </div>
  )
}
