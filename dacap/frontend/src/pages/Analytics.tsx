import { useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine
} from 'recharts'
import { generateTimeSeries, rollingVolatility, trendWave, monteCarloData } from '../utils/mockData'
import { motion } from 'framer-motion'
import { useMonteCarloData } from '../hooks/useMonteCarloData'

const tabs = ['Monte Carlo', 'Rolling Volatility', 'Trend Wave', 'Regime Classifier', 'Time Series']

// Market regime classifier mock
const regimes = generateTimeSeries(60, 50, 15).map((d, i) => ({
  ...d,
  regime: d.value > 60 ? 'Bull' : d.value < 40 ? 'Bear' : 'Sideways',
  color: d.value > 60 ? '#10b981' : d.value < 40 ? '#ef4444' : '#f59e0b'
}))

// Time series decomposition mock
const tsData = generateTimeSeries(90, 100, 5).map((d, i) => ({
  ...d,
  trend: 100 + i * 0.3,
  seasonal: Math.sin(i / 7 * Math.PI) * 5,
  residual: (Math.random() - 0.5) * 3
}))

export default function Analytics() {
  const [tab, setTab] = useState('Monte Carlo')
  const { data: mcData } = useMonteCarloData()

  // Use hook paths when available, fall back to mock paths
  const mcPaths = mcData?.paths && mcData.paths.length > 0
    ? mcData.paths.map((path, i) => ({
        path: i,
        data: path.map((value, j) => ({ time: j, value }))
      }))
    : monteCarloData

  const mcStats = mcData?.stats ?? {
    mean_return: 0.187,
    var_95: -0.121,
    sharpe_ratio: 1.84,
    prob_profit: 0.732,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Quantitative Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">ML-powered market analysis and simulation dashboards</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t ? 'bg-cyan/10 text-cyan border border-cyan/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Monte Carlo */}
      {tab === 'Monte Carlo' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Monte Carlo Simulation</h3>
                <p className="text-xs text-slate-500">50 portfolio paths · 30-day horizon · GBM model</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-green font-mono">P95: +{((mcStats.mean_return ?? 0.187) * 100 * 2.26).toFixed(1)}%</span>
                <span className="text-gold font-mono">P50: +{((mcStats.mean_return ?? 0.187) * 100).toFixed(1)}%</span>
                <span className="text-red-400 font-mono">P5: {((mcStats.var_95 ?? -0.121) * 100).toFixed(1)}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis hide />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 10 }} />
                {mcPaths.slice(0, 30).map((path, i) => (
                  <Line
                    key={path.path}
                    data={path.data}
                    type="monotone"
                    dataKey="value"
                    stroke={i < 5 ? '#10b981' : i > 25 ? '#ef4444' : '#3b82f6'}
                    strokeWidth={i < 5 || i > 25 ? 1.5 : 0.5}
                    strokeOpacity={i < 5 || i > 25 ? 0.8 : 0.2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Expected Return', value: `+${((mcStats.mean_return ?? 0.187) * 100).toFixed(1)}%`, color: 'text-green' },
              { label: 'Value at Risk (95%)', value: `${((mcStats.var_95 ?? -0.121) * 100).toFixed(1)}%`, color: 'text-red-400' },
              { label: 'Sharpe (simulated)', value: (mcStats.sharpe_ratio ?? 1.84).toFixed(2), color: 'text-cyan' },
              { label: 'Prob. of Profit', value: `${((mcStats.prob_profit ?? 0.732) * 100).toFixed(1)}%`, color: 'text-purple' },
            ].map(m => (
              <div key={m.label} className="card text-center">
                <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
                <div className="text-xs text-slate-500 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Rolling Volatility */}
      {tab === 'Rolling Volatility' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Rolling Volatility (30d window)</h3>
                <p className="text-xs text-slate-500">Annualized realized volatility · EWMA smoothing</p>
              </div>
              <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-1 rounded">Current: 14.2%</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={rollingVolatility}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" hide />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Vol Budget', fill: '#ef4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#volGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Trend Wave */}
      {tab === 'Trend Wave' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-1">Trend Wave Visualizer</h3>
            <p className="text-xs text-slate-500 mb-4">Wavelet decomposition · Multi-scale trend extraction</p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendWave}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="#00f5ff" strokeWidth={2} dot={false} name="Price" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Regime Classifier */}
      {tab === 'Regime Classifier' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-1">Market Regime Classifier</h3>
            <p className="text-xs text-slate-500 mb-4">Deep learning HMM · 3-state regime detection (Bull / Sideways / Bear)</p>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={regimes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0]?.payload as { regime: string; value: number }
                    return (
                      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
                        <span style={{ color: '#94a3b8' }}>Regime: </span>
                        <span style={{ color: '#a855f7' }}>{d?.regime}</span>
                      </div>
                    )
                  }}
                />
                <Area type="stepAfter" dataKey="value" stroke="#a855f7" strokeWidth={2} fill="#a855f720" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs">
              {[['Bull', '#10b981'], ['Sideways', '#f59e0b'], ['Bear', '#ef4444']].map(([r, c]) => (
                <div key={r} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />
                  <span className="text-slate-400">{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Current Regime', value: 'Bull', color: 'text-green' },
              { label: 'Confidence', value: '87.4%', color: 'text-cyan' },
              { label: 'Regime Duration', value: '14 days', color: 'text-purple' },
            ].map(m => (
              <div key={m.label} className="card text-center">
                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-slate-500 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Time Series */}
      {tab === 'Time Series' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-1">Time Series Decomposition</h3>
            <p className="text-xs text-slate-500 mb-4">STL decomposition · Trend + Seasonal + Residual</p>
            <div className="space-y-4">
              {[
                { key: 'value', label: 'Original', color: '#00f5ff' },
                { key: 'trend', label: 'Trend', color: '#a855f7' },
                { key: 'seasonal', label: 'Seasonal', color: '#10b981' },
                { key: 'residual', label: 'Residual', color: '#f59e0b' },
              ].map(s => (
                <div key={s.key}>
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={tsData}>
                      <Line type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.5} dot={false} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
