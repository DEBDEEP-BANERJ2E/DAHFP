import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useGovernanceProposals } from '../hooks/useGovernanceProposals'
import { Vote, CheckCircle, XCircle, Clock } from 'lucide-react'

const statusIcon: Record<string, React.ReactElement> = {
  active: <Clock size={13} className="text-cyan" />,
  passed: <CheckCircle size={13} className="text-green" />,
  rejected: <XCircle size={13} className="text-red-400" />,
}

const statusStyle: Record<string, string> = {
  active: 'bg-cyan/10 text-cyan border-cyan/20',
  passed: 'bg-green/10 text-green border-green/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function Governance() {
  const [eta, setEta] = useState(0.01)
  const [slashing, setSlashing] = useState(20)
  const [volCap, setVolCap] = useState(35)
  const { data: proposals = [], isLoading, isError } = useGovernanceProposals()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Governance DAO</h1>
        <p className="text-slate-500 text-sm mt-0.5">On-chain parameter control and protocol proposals</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-white">Active & Recent Proposals</h3>
          {isLoading && <p className="text-xs text-slate-500">Loading proposals...</p>}
          {isError && <p className="text-xs text-red-400">Failed to load proposals.</p>}
          {proposals.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="border border-border rounded-xl p-4 hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-white font-medium flex-1 pr-4">{p.title}</p>
                <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${statusStyle[p.status]}`}>
                  {statusIcon[p.status]} {p.status}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>For: {p.votes_for}%</span>
                  <span>Against: {p.votes_against}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden flex">
                  <div className="h-full bg-green rounded-l-full transition-all" style={{ width: `${p.votes_for}%` }} />
                  <div className="h-full bg-red-500 rounded-r-full transition-all" style={{ width: `${p.votes_against}%` }} />
                </div>
              </div>
              {p.status === 'active' && (
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-all">
                    Vote For
                  </button>
                  <button className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                    Vote Against
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-600 mt-2">Ends: {p.end_date}</p>
            </motion.div>
          ))}
        </div>

        {/* Parameter tuning */}
        <div className="card space-y-5">
          <h3 className="text-sm font-semibold text-white">Protocol Parameters</h3>
          <p className="text-xs text-slate-500">Propose changes via DAO vote</p>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Learning Rate η</span>
              <span className="font-mono text-cyan">{eta.toFixed(3)}</span>
            </div>
            <input type="range" min="0.001" max="0.05" step="0.001" value={eta}
              onChange={e => setEta(parseFloat(e.target.value))} className="w-full accent-cyan" />
            <p className="text-xs text-slate-600 mt-1">Controls allocation adaptation speed</p>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Slashing Threshold</span>
              <span className="font-mono text-red-400">{slashing}%</span>
            </div>
            <input type="range" min="5" max="50" step="1" value={slashing}
              onChange={e => setSlashing(parseInt(e.target.value))} className="w-full accent-red-400" />
            <p className="text-xs text-slate-600 mt-1">Max drawdown before stake slash</p>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Aggressive Vol. Cap</span>
              <span className="font-mono text-purple">{volCap}%</span>
            </div>
            <input type="range" min="10" max="60" step="1" value={volCap}
              onChange={e => setVolCap(parseInt(e.target.value))} className="w-full accent-purple" />
            <p className="text-xs text-slate-600 mt-1">Max annualized volatility for aggressive pool</p>
          </div>

          <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-purple/10 text-purple border border-purple/20 hover:bg-purple/20 transition-all flex items-center justify-center gap-2">
            <Vote size={13} /> Submit Proposal
          </button>
        </div>
      </div>
    </div>
  )
}
