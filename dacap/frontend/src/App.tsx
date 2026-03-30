import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import AgentDetail from './pages/AgentDetail'
import RiskPools from './pages/RiskPools'
import AllocationEngine from './pages/AllocationEngine'
import Governance from './pages/Governance'
import Analytics from './pages/Analytics'
import Contracts from './pages/Contracts'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/pools" element={<RiskPools />} />
        <Route path="/allocation" element={<AllocationEngine />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/contracts" element={<Contracts />} />
      </Route>
    </Routes>
  )
}
