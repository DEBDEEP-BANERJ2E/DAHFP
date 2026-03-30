import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'
import { proposals as mockProposals } from '../utils/mockData'

export interface GovernanceProposal {
  id: number
  title: string
  description?: string
  status: string
  votes_for: number
  votes_against: number
  end_date: string
}

export function useGovernanceProposals() {
  return useQuery<GovernanceProposal[]>({
    queryKey: ['governance', 'proposals'],
    queryFn: () => api.get('/api/governance/proposals').then(r => r.data),
    placeholderData: mockProposals.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      votes_for: p.votes.for,
      votes_against: p.votes.against,
      end_date: p.ends,
    })),
  })
}
