import { create } from 'zustand'

interface ProtocolState {
  walletAddress: string | null
  isConnected: boolean
  connect: (address: string) => void
  disconnect: () => void
}

export const useProtocolStore = create<ProtocolState>((set) => ({
  walletAddress: null,
  isConnected: false,
  connect: (address) => set({ walletAddress: address, isConnected: true }),
  disconnect: () => set({ walletAddress: null, isConnected: false }),
}))
