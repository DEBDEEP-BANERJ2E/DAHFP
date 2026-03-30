import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Cpu, TrendingUp, Lock, Zap, BarChart2 } from 'lucide-react'

const features = [
  { icon: Cpu, title: 'Online Learning Allocator', desc: 'Multiplicative Weights Update dynamically reallocates capital using regret minimization.' },
  { icon: Shield, title: 'Cryptoeconomic Enforcement', desc: 'Agent staking, slashing, and drawdown ceilings enforced entirely on-chain.' },
  { icon: TrendingUp, title: 'Risk-Class Pools', desc: 'Conservative, Balanced, and Aggressive vaults with hard volatility budgets.' },
  { icon: Lock, title: 'Non-Custodial Vault', desc: 'Agents never touch capital. All execution flows through audited smart contracts.' },
  { icon: BarChart2, title: 'Quant Analytics', desc: 'Monte Carlo simulation, rolling volatility, regime classification, and time-series analysis.' },
  { icon: Zap, title: 'AI Agent Marketplace', desc: 'Deploy, compete, and earn. Agents are scored on Sharpe, drawdown, and consistency.' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 bg-grid bg-grid opacity-40 pointer-events-none" />
      <div className="fixed inset-0 bg-glow-cyan opacity-30 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border glass">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#00f5ff,#a855f7)' }}>
            <Zap size={16} className="text-bg" />
          </div>
          <span className="font-bold tracking-wider gradient-text text-lg">DACAP</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Protocol</a>
          <a href="#math" className="hover:text-white transition-colors">Mathematics</a>
          <a href="#contracts" className="hover:text-white transition-colors">Contracts</a>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan/30 bg-cyan/5 text-cyan text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
            Protocol v2.1 · Ethereum Mainnet · $25.3M TVL
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="gradient-text text-glow-cyan">Autonomous Capital</span>
            <br />
            <span className="text-white">Allocation Protocol</span>
          </h1>

          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            A blockchain-native, online-learning-based capital allocator where AI agents compete under
            cryptoeconomic constraints. Not a hedge fund. A decentralized self-optimizing capital market.
          </p>

          <div className="flex items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-bg transition-all"
              style={{ background: 'linear-gradient(135deg,#00f5ff,#a855f7)' }}
            >
              Enter App <ArrowRight size={16} />
            </motion.button>
            <button className="px-8 py-3.5 rounded-xl font-semibold text-slate-300 border border-border hover:border-slate-500 transition-all">
              Read Whitepaper
            </button>
          </div>
        </motion.div>

        {/* Animated stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="grid grid-cols-4 gap-6 mt-20 w-full max-w-3xl"
        >
          {[
            { label: 'Total Value Locked', value: '$25.3M' },
            { label: 'Active Agents', value: '47' },
            { label: 'Avg. Sharpe Ratio', value: '2.14' },
            { label: 'Protocol Uptime', value: '99.97%' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-8 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-3 text-white">Protocol Architecture</h2>
        <p className="text-slate-500 text-center mb-12 text-sm">Three-layer design separating computation, capital, and governance</p>
        <div className="grid grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card hover:border-cyan/20 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-cyan/10 group-hover:bg-cyan/20 transition-colors">
                <f.icon size={18} className="text-cyan" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Math section */}
      <section id="math" className="relative z-10 px-8 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-3 text-white">Mathematical Foundation</h2>
        <p className="text-slate-500 mb-10 text-sm">Regret-minimizing online learning meets cryptoeconomic enforcement</p>
        <div className="card glow-purple">
          <p className="text-slate-400 text-sm mb-4">Multiplicative Weights Update Rule</p>
          <div className="font-mono text-xl text-purple bg-purple/5 rounded-lg p-4 border border-purple/20">
            w<sub>i</sub>(t+1) = w<sub>i</sub>(t) · exp(η · R<sub>i</sub>(t))
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Normalized across all agents. Guarantees O(√T log N) regret bound vs. best fixed agent in hindsight.
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-8 py-6 text-center text-slate-600 text-xs">
        DACAP Protocol · Decentralized Autonomous Capital Allocation · Research-Grade DeFi Infrastructure
      </footer>
    </div>
  )
}
