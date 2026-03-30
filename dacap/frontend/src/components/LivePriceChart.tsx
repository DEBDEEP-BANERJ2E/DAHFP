import { useState } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TokenPrices } from '../hooks/usePriceWebSocket'

const TOKEN_COLORS: Record<string, string> = {
  WBTC: '#f59e0b',
  USDC: '#10b981',
  LINK: '#3b82f6',
  UNI:  '#a855f7',
}

const TOKEN_LABELS: Record<string, string> = {
  WBTC: 'Wrapped Bitcoin',
  USDC: 'USD Coin',
  LINK: 'Chainlink',
  UNI:  'Uniswap',
}

interface Props {
  prices: TokenPrices
  connected: boolean
}

export default function LivePriceChart({ prices, connected }: Props) {
  const [selected, setSelected] = useState<string | 'all'>('all')
  const tokens = Object.keys(prices)

  // Build chart data — normalize each token to % change from first history point
  const buildChartData = (sym: string) => {
    const hist = prices[sym]?.history ?? []
    if (hist.length === 0) return []
    const base = hist[0]
    return hist.map((p, i) => ({
      i,
      [sym]: base > 0 ? ((p - base) / base) * 100 : 0,
    }))
  }

  // Merge all tokens into one dataset for "all" view
  const allData = (() => {
    const maxLen = Math.max(...tokens.map(s => prices[s]?.history.length ?? 0))
    if (maxLen === 0) return []
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { i }
      for (const sym of tokens) {
        const hist = prices[sym]?.history ?? []
        const base = hist[0] ?? 1
        if (hist[i] != null) {
          point[sym] = base > 0 ? ((hist[i] - base) / base) * 100 : 0
        }
      }
      return point
    })
  })()

  const chartData = selected === 'all' ? allData : buildChartData(selected)
  const visibleTokens = selected === 'all' ? tokens : [selected]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Live Asset Prices</h3>
          <p className="text-xs text-slate-500">% change from session start</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            connected ? 'bg-green/10 text-green' : 'bg-gold/10 text-gold'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green animate-pulse' : 'bg-gold'}`} />
            {connected ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Token selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelected('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
            selected === 'all'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-500 hover:text-slate-300 border border-border'
          }`}
        >
          All
        </button>
        {tokens.map(sym => (
          <button
            key={sym}
            onClick={() => setSelected(sym)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              selected === sym
                ? 'text-white border'
                : 'text-slate-500 hover:text-slate-300 border border-border'
            }`}
            style={selected === sym ? {
              background: TOKEN_COLORS[sym] + '20',
              borderColor: TOKEN_COLORS[sym] + '40',
              color: TOKEN_COLORS[sym],
            } : {}}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Price badges */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {tokens.map(sym => {
          const p = prices[sym]
          const isUp = (p?.change_pct ?? 0) >= 0
          return (
            <div key={sym} className="bg-surface rounded-lg p-2 text-center">
              <div className="text-xs text-slate-500 mb-0.5">{sym}</div>
              <div className="text-sm font-bold font-mono text-white">
                ${p?.current?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
              </div>
              <div className={`text-xs font-mono ${isUp ? 'text-green' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{p?.change_pct?.toFixed(3) ?? '0.000'}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      {chartData.length < 2 ? (
        <div className="flex items-center justify-center h-[160px] text-slate-500 text-sm">
          Collecting price data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <XAxis dataKey="i" hide />
            <YAxis
              tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
              width={50}
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
              formatter={(value: number, name: string) => [
                `${value > 0 ? '+' : ''}${value.toFixed(3)}%`,
                name,
              ]}
            />
            {visibleTokens.map(sym => (
              <Line
                key={sym}
                type="monotone"
                dataKey={sym}
                stroke={TOKEN_COLORS[sym] ?? '#00f5ff'}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {selected === 'all' && (
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {tokens.map(sym => (
            <div key={sym} className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-0.5 rounded" style={{ background: TOKEN_COLORS[sym] }} />
              {sym} — {TOKEN_LABELS[sym]}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
