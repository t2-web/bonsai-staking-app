import { http, createConfig } from '@wagmi/vue'
import { base, baseSepolia } from '@wagmi/vue/chains'
import { injected, walletConnect } from '@wagmi/vue/connectors'

const projectId = '11de27f464d53a18220d68841ac45f99'

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})