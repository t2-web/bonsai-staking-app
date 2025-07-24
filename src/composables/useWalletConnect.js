import { ref, markRaw } from 'vue'
import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base } from '@wagmi/chains'
import { reconnect, disconnect, switchChain, getAccount, watchAccount } from '@wagmi/core'

// Define Base Sepolia chain if needed for staging
const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
    public: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { 
      name: 'BaseScan', 
      url: 'https://sepolia.basescan.org' 
    },
  },
  testnet: true,
}

let appKit = null
let wagmiAdapter = null

export function useWalletConnect() {
  const web3modal = ref()

  async function initConnectModal(config) {
    const { projectId, chains, recommendedWallets } = config
    
    if (!wagmiAdapter) {
      wagmiAdapter = new WagmiAdapter({
        networks: chains,
        projectId,
      })
    }

    if (!appKit) {
      appKit = createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: chains,
        defaultNetwork: chains[0],
        metadata: {
          name: 'Bonsai Staking App',
          description: 'Stake your BONSAICOIN tokens',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent-color': '#004d3b',
          '--w3m-background-color': '#004d3b',
        },
        features: {
          analytics: false,
          onramp: false,
          socials: [],
          email: false,
        },
        socials: [],
        featuredWalletIds: recommendedWallets,
        includeWalletIds: recommendedWallets,
        allWallets: 'HIDE',
        enableWalletConnect: true,
        enableInjected: true,
        enableCoinbase: false,
        siweConfig: undefined, // Disable SIWE to maintain simpler connection flow
      })
    }

    // Set the modal ref for compatibility
    web3modal.value = {
      openModal: () => appKit.open()
    }

    // Try to reconnect
    try {
      await reconnect(wagmiAdapter.wagmiConfig)
    } catch (e) {
      console.log('No previous connection to restore')
    }

    return {
      wagmiConfig: wagmiAdapter.wagmiConfig,
      web3modal
    }
  }

  function getWagmiConfig() {
    return wagmiAdapter?.wagmiConfig
  }

  async function disconnectWallet() {
    if (wagmiAdapter?.wagmiConfig) {
      await disconnect(wagmiAdapter.wagmiConfig)
    }
  }

  async function switchToNetwork(chainId) {
    if (wagmiAdapter?.wagmiConfig) {
      await switchChain(wagmiAdapter.wagmiConfig, { chainId })
    }
  }

  function getCurrentAccount() {
    if (wagmiAdapter?.wagmiConfig) {
      return getAccount(wagmiAdapter.wagmiConfig)
    }
    return null
  }

  function watchAccountChanges(callback) {
    if (wagmiAdapter?.wagmiConfig) {
      return watchAccount(wagmiAdapter.wagmiConfig, {
        onChange: callback
      })
    }
  }

  async function getWalletClient(chainId) {
    if (!wagmiAdapter?.wagmiConfig) return null
    
    const account = getAccount(wagmiAdapter.wagmiConfig)
    if (!account.connector) return null

    try {
      const provider = await account.connector.getProvider()
      return {
        transport: provider,
        chain: { id: chainId, name: 'Base' }
      }
    } catch (e) {
      console.error('Failed to get wallet client:', e)
      return null
    }
  }

  return {
    initConnectModal,
    getWagmiConfig,
    disconnectWallet,
    switchToNetwork,
    getCurrentAccount,
    watchAccountChanges,
    getWalletClient,
    web3modal,
    base,
    baseSepolia
  }
}