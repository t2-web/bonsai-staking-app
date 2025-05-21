<template>
  <div class="bonsai-app">
    <!-- ────────── HEADER ────────── -->
    <header class="app-header">
      <div class="nav-container">
        <button class="nav-btn" @click="goTop">Top</button>
        <button class="nav-btn active">BONSAI BANK</button>
      </div>
    </header>

    <!-- ────────── MAIN CONTENT ────────── -->
    <main class="main-container">
      <!-- LOGO -->
      <div class="logo-container">
        <img src="../src/assets/BONSAI_BANK_logo.png" alt="BONSAICOIN" class="logo" />
      </div>

      <div class="connect-btn-container">
        <!-- 接続前 -->
        <template v-if="!isConnected">
          <button
            class="connect-btn btn"
            @click="connectWallet()"
          >
            Connect Wallet
          </button>
        </template>
        <!-- 接続後：クリックで切断 -->
        <div v-else class="wallet-chip btn" @click="disconnectWallet">
          {{ shortAddress }}
        </div>
      </div>

      <!-- BALANCE LINE -->
      <div class="balance-line">
        <span class="label">My $BONSAICOIN:</span>
        <span class="value">{{ displayBalance }}</span>
      </div>

      <!-- STAKE INPUT -->
      <div class="stake-container">
        <div class="input-wrapper">
          <input
            v-model="amount"
            type="text"
            placeholder="0 - 999999..."
            class="stake-input"
            @input="onInput"
          />
          <button class="max-btn" @click="setMax">max</button>
        </div>
        <button
          class="stake-btn btn"
          :disabled="!amount || !address"
          @click="stake"
        >
          Stake
        </button>
      </div>

      <!-- STATS TABLE -->
      <div class="stats-container">
        <div class="stat-row">
          <span class="stat-label">Stake Total Amount:</span>
          <span class="stat-value">{{ displayStaked }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Claimable Amount:</span>
          <span class="stat-value">{{ displayClaimable }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Claimed Amount:</span>
          <span class="stat-value">{{ displayClaimed }}</span>
        </div>
      </div>

      <!-- CLAIM BUTTON -->
      <button
        class="claim-btn btn"
        :disabled="claimable === 0 || !address"
        @click="claimAll"
      >
        Claim
      </button>

      <!-- TX STATUS -->
      <div class="tx-link" v-if="txFilterUrl">
        Stake Tx Link :
        <a :href="`${txFilterUrl}`" target="_blank" rel="noopener">
          <span class="hash">{{ shortFilterUrl }}</span>
        </a>
      </div>

      <div class="tx-link" >
        Stake Address :
        <a :href="`${EXPLORER_URL}/address/${stakeContractAddress}`" target="_blank" rel="noopener">
          <span class="hash">{{ stakeContractAddress }}</span>
        </a>
      </div>
    </main>

    <!-- ────────── FOOTER ────────── -->
    <footer class="app-footer">
      <div class="copyright">© 2025 by SBONSAICOIN</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw, h, watch } from 'vue'
import { ethers } from 'ethers'
import { useToast, TYPE } from 'vue-toastification'

import ERC20 from '@/abi/ERC20.json'
import StakingContract from '@/abi/ERC20Staking.json'
import { configureChains, createConfig, disconnect, getAccount, getWalletClient, watchAccount, type Chain } from '@wagmi/core';
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum';
import { base } from '@wagmi/core/chains'
import { Web3Modal } from '@web3modal/html';

// Stakelist
// https://base-sepolia.blockscout.com/advanced-filter?transaction_types=ERC-20%2CERC-404%2CERC-721%2CERC-1155&to_address_hashes_to_include=0x835Acf913aE99e97096f6c10D324515a4F12A902&from_address_hashes_to_include=0x835Acf913aE99e97096f6c10D324515a4F12A902%2C0x9035ae14AF7C27cEffcbc1Ce626e0663f877813f

/* ---------- ネットワーク定義 ---------- */
// テストネット
// const chain = baseSepolia                              // 10進数
// const tokenAddress = '0x5e1C5AccE47aA5c6eC23dEFF9330263729F652D3'
// const stakeContractAddress = '0x835Acf913aE99e97096f6c10D324515a4F12A902'

// メインネット
const chain = base
const tokenAddress = '0xA0aeBd4Ae5F256B72B7D43f67eD934237Adb1AeE' //bonsai
const stakeContractAddress = '0x5e1C5AccE47aA5c6eC23dEFF9330263729F652D3' //1hour

const chains: Chain[] = [chain]
const projectId = '11de27f464d53a18220d68841ac45f99'
const EXPLORER_URL = chain.blockExplorers?.default?.url ?? ''

// ────────── STATE ──────────
const provider = ref()
const address = ref()
const signer   = ref()
const status   = ref('')
const balance   = ref<number | null>(null)

const rawAmountValue = ref('')
const amount    = ref('') // ユーザー入力値

const staked    = ref<number | null>(null) //total staked = claimable+claimed
const claimable = ref<number | null>(null)   // ← 初期値 null で「取得前」を示す
const claimed   = ref<number | null>(null)

const toast = useToast()
const web3modal = ref<Web3Modal>()

function initConnectModal() {
  // Configure the chains
  const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])
  const wagmiConfig = createConfig({
    autoConnect: false,
    connectors: w3mConnectors({ projectId, chains: chains }),
    publicClient
  })
  const ethereumClient = new EthereumClient(wagmiConfig, chains)

  web3modal.value = new Web3Modal({
    projectId,
    themeVariables: {
      '--w3m-accent-color': '#004d3b',
      '--w3m-button-border-radius': '999px',
      '--w3m-text-medium-regular-size': '14px',
      '--w3m-background-color': '#004d3b',
    }
  }, ethereumClient)

  // Disconnect from any previous connection
  disconnect()

  // Watch for account changes
  watchAccount(async () => {
    const account = getAccount()
    if (account && chain) {
      const walletClient = await getWalletClient({ chainId: chain.id })
      if (walletClient) {
        const { chain, transport } = walletClient
        const network = {
          chainId: chain.id,
          name: chain.name,
        }

        address.value = account.address
        provider.value = markRaw(new ethers.providers.Web3Provider(transport, network))
        signer.value = markRaw(provider.value.getSigner(account.address))

        fetchTokenBalance()
        fetchClaimData()
      }
    } else {
      address.value = null
      provider.value = null
      signer.value = null
      balance.value = null
      staked.value = null
      claimable.value = null
      claimed.value = null
    }
  })
}


async function connectWallet() {
  if (!web3modal.value) {
    const msg = 'Web3Modal is not initialized'
    toast.error(`❌ ${msg}`, { timeout: 6000 })
    return
  }
  await web3modal.value.openModal()
}

/* ——————— 切断処理 ——————— */
function disconnectWallet () {
  disconnect()
  address.value = ""
  staked.value = null
  claimable.value = null
  claimed.value = null
}

/* ────────── 自動復旧 (任意) ────────── */
onMounted(() => {
  initConnectModal()
})

/* ---------- util: 10 進 → 16 進 ---------- */
const toHex = (id: number) => '0x' + id.toString(16)

// TODO: env=stgの場合に分岐させてもいい
function goTop() {
  window.location.href = 'https://coin.bonsainft.club/'   // ルート URL へリダイレクト
}

const staticProvider = new ethers.providers.JsonRpcProvider(
  chain.rpcUrls.default.http[0]         // ← ③
)

/* ────────── HELPERS ────────── */
const formatInputNumber = (value: string): string => {
  const number = parseFloat(value.replace(/,/g, ''))
  if (isNaN(number)) return ''
  return number.toLocaleString()
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const numericOnly = target.value.replace(/[^0-9]/g, '')
  rawAmountValue.value = numericOnly
  amount.value = formatInputNumber(numericOnly)
}

function formatNumber(n: number) {
  return n.toLocaleString()
}

function setMax() {
  if (balance.value !== null) {
    // balance.valueがnullでない場合にのみ、amount.valueを更新
    amount.value = formatNumber(balance.value)
  }
}

/* ────────── COMPUTED ────────── */
/* ────────── 接続済みはADDRESS 表示 ────────── */
const shortAddress = computed(() =>
  address.value ? `${address.value.slice(0, 6)}…${address.value.slice(-4)}` : ''
)
const isConnected = computed(() => !!address.value)

const displayBalance = computed(() =>
  address.value
    ? balance.value !== null   // 取得済みならフォーマット
        ? formatNumber(balance.value)
        : '…'                  // 取得中（アドレスはあるが balance=null）
    : '-'                      // 未接続
)

const displayClaimable = computed(() =>
  claimable.value === null ? '…' : formatNumber(claimable.value)
)
const displayClaimed = computed(() =>
  claimed.value === null ? '…' : formatNumber(claimed.value)
)
const displayStaked = computed(() =>
  staked.value === null ? '…' : formatNumber(staked.value)
)

// stakeContractHistoryUrlの作成
const txFilterUrl = computed(() => {
  if (!address.value) return ''

  const qs = new URLSearchParams({
    tadd: stakeContractAddress,
    fadd: address.value
  }).toString()

  return `${EXPLORER_URL}/advanced-filter?${qs}&qt=1`
})

const shortFilterUrl = computed(() => {
  if (!txFilterUrl.value) return ''
  const full = txFilterUrl.value
  return full.length > 48 ? full.slice(0, 32) + '…' + full.slice(-10) : full
})

/* ────────── Approve & getBalance ────────── */


async function fetchTokenBalance () {
  // if (!signer.value) return
  // const erc20 = new ethers.Contract(tokenAddress, ERC20, signer.value)
  console.log('fetchTokenBalance')
  if (!provider.value) return
  const erc20  = markRaw(new ethers.Contract(tokenAddress, ERC20, staticProvider))
  const raw = await erc20.balanceOf(address.value)
  const dec    = await erc20.decimals()
  balance.value = parseFloat(ethers.utils.formatUnits(raw, dec))
}

async function fetchClaimData () {
  if (!provider.value || !address.value) return

  // const staking = new ethers.Contract(stakeContractAddress, StakingContract, provider.value)
  const staking = markRaw(new ethers.Contract(stakeContractAddress, StakingContract, staticProvider))

  const stakes  = await staking.getStakes(address.value)
  const lockDuration  = Number(await staking.LOCK_DURATION())
  const now           = Math.floor(Date.now() / 1e3)
  console.log('lockDuration:', lockDuration, ', now:', now)

  let unlocked = ethers.BigNumber.from(0)  // claimable
  let locked   = ethers.BigNumber.from(0)  // まだロック中
  let already  = ethers.BigNumber.from(0)  // 既に請求済み

  for (const s of stakes) {
    const amt  = ethers.BigNumber.from(s[0])      // ← ⑥
    const startTs    = Number(s[1])
    const isClaimed  = Boolean(s[2])

    if (isClaimed) {
      already = already.add(amt)
    } else if (now >= startTs + lockDuration) {
      unlocked = unlocked.add(amt)         // ロック解除済み・未請求
    } else {
      locked   = locked.add(amt)           // まだロック中
    }
  }

  claimable.value = Number(ethers.utils.formatEther(unlocked))
  claimed.value   = Number(ethers.utils.formatEther(already))
  staked.value    = Number(ethers.utils.formatEther(locked))
}
/* ────────── STAKE  ────────── */
async function stake () {
  if (!signer.value || !amount.value || !address.value) return

  const cleaned = amount.value.replace(/,/g, '')
  const weiAmt  = ethers.utils.parseUnits(cleaned, 18)   // BONSAICOIN は 18dec

  const erc20   = markRaw(new ethers.Contract(tokenAddress, ERC20, signer.value))
  const staking = markRaw(new ethers.Contract(stakeContractAddress, StakingContract, signer.value))

  /* ----- 3. allowance 取得 (ゼロなら 0 でフォールバック) ----- */
  let allowance: ethers.BigNumber
  try {
    allowance = await erc20.allowance(address.value, stakeContractAddress)
  } catch (e) {
    console.warn('allowance revert → 0 とみなす', e)
    allowance = ethers.constants.Zero
  }

  /* ----- 4. approve & stake ----- */
  if (allowance.lt(weiAmt)) {
    const pendingApprove = toast.info('⏳ Approving… …', { timeout: 4000 })
    status.value = '⏳ Approving…'
    try {
      const txA = await erc20.approve(stakeContractAddress, weiAmt)
      await txA.wait()
      toast.update(pendingApprove, { // Stake Confirmed + リンク
        content: h(
            'a',
            {
              href: `https://${EXPLORER_URL}/tx/${txA.hash}`,
              target: '_blank',
              style: 'color:#fff;text-decoration:underline;'
            },
            'Stake Confirmed. Tx: ' + txA.hash.slice(0, 8) + '…'
          ),
          options: {
            type: TYPE.SUCCESS,
            timeout: 8000
          }
        })
      allowance = weiAmt                                  // 直後の check 用
    } catch (err) {
      const msg = (err as any).reason ?? (err as any).message ?? 'Stake failed'
      toast.update(pendingApprove, {
        content: msg,
        options: {
          type: TYPE.ERROR,
          timeout: 8000
        }
      })
      status.value = '❌ Approve failed'
      return
    }
  }

  /* ========= ② Stake 実行 ========= */
  const pendingStake = toast.info('⏳ Staking…', { timeout: false })

  try {
    const txS = await staking.stake(weiAmt)
    await txS.wait()

    toast.update(pendingStake, { // Stake Confirmed + リンク
      content: h(
        'a',
        {
          href: `https://${EXPLORER_URL}/tx/${txS.hash}`,
          target: '_blank',
          style: 'color:#fff;text-decoration:underline;'
        },
        'Stake Confirmed. Tx: ' + txS.hash.slice(0, 8) + '…'
      ),
      options: {
        type: TYPE.SUCCESS,
        timeout: 8000
      }
    })

    status.value = '✅ Stake success'
    amount.value = ''

    // Make sure the tx is confirmed
    setTimeout(async () => {
      await fetchTokenBalance()
      await fetchClaimData()
    }, 3000)

  } catch (err) {
    const msg = (err as any).reason ?? (err as any).message ?? '❌ Stake failed'
    toast.update(pendingStake, {
      content: msg,
      options: {
        type: TYPE.ERROR,
        timeout: 8000
      }
    })
    status.value = '❌ Stake failed'
  }
}

// unlocked & un-claimed stake を 1Tx でまとめて請求
/* ────────── Claim  ────────── */
async function claimAll () {
  if (!signer.value || claimable.value === 0) return

  const staking = markRaw(
    new ethers.Contract(stakeContractAddress, StakingContract, signer.value)
  )

  try {
    await staking.callStatic.claimAll({ gasLimit: 12_000_000 })
  } catch (e) {
    const msg = (e as any).shortMessage || (e as any).message || 'Revert'
    toast.error(`❌ ${msg}`, { timeout: 6000 })
    return
  }
  /* ───── 送信 & 待機 ─────────────────────────── */
  const pending = toast.info('⏳ Claiming…', { timeout: false })
  status.value  = '⏳ Claiming…'

  try {
    const tx = await staking.claimAll()
    await tx.wait()

    /* ✔ 成功トーストに差し替え */
    toast.update(pending, {
      content: h(
        'a',
        {
          href: `https://${EXPLORER_URL}/tx/${tx.hash}`,
          target: '_blank',
          style: 'color:#fff;text-decoration:underline;'
        },
        'Claim Confirmed. Tx: ' + tx.hash.slice(0, 8) + '…'
      ),
      options: { type: TYPE.SUCCESS, timeout: 8000 }
    })

    /* 状態リフレッシュ */
    status.value   = '✅ Claim success'
    claimable.value = 0               // UI 上の即時反映
    await fetchTokenBalance()
    await fetchClaimData()
  } catch (err) {
    const msg = (err as any).shortMessage || (err as any).message || '❌ Claim failed'
    toast.update(pending, {
      content: msg,
      options: { type: TYPE.ERROR, timeout: 8000 }
    })
    status.value = '❌ Claim failed'
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap');

*:focus {
  outline: none;
}

a {
  color: #efe2c6;
  text-decoration: none;
}

/* Global styles for dark theme */
.bonsai-app {
  background-color: #004d3b;
  color: #ffffff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: "Oswald", sans-serif;
}

/***** Header navigation *****/
.app-header {
  height: 64px;
  padding: 0 20px;
}

.nav-container {
  display: flex;
  align-items: center;
  height: 100%;
  max-width:1024px;     /* TOP ページと同じ固定幅 */
  margin:0 auto;       /* 余白を左右に均等配置 */
  width:100%;          /* 画面が狭い時は 100% で縮む */
}

.nav-btn{
  font-family:"Oswald", sans-serif;   /* GoogleFonts 可 */
  font-size:20px;                     /* ← TOP と同じ */
  letter-spacing:0.05em;
  font-weight:400;
  color:#efe2c6;
  background:transparent;
  border:none;
  margin-right:48px;                  /* ← 項目間 48px */
  cursor:pointer;
  transition:color .2s;
}

.nav-btn.active {
  color: #efe2c6;
  font-weight: 700;
}

.nav-btn:last-of-type{
  margin-right:0;
}

/***** Main Content *****/
.main-container {
  max-width: 1024px;
  margin: 0 auto;
  padding: 48px 16px 64px;
  text-align: center;
  flex: 1;
  width: 100%;
}

/* Logo */
.logo {
  height: 180px;
  width: auto;
}

/* connect btn */
.connect-btn-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  max-width: 680px;
  margin: 0 auto 32px auto;
  width: 100%;
}

.connect-btn {
  padding: 6px 12px;
  font-size: 18px;
}

.wallet-chip {
  padding: 6px 12px;
  font-size: 18px;
}

/* Balance display */
.balance-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 680px;
  margin: 0 auto 32px auto;
  width: 100%;
}

.label {
  font-weight: 400;
  font-size: 18px;
}

.value {
  font-weight: 700;
  font-size: 22px;
  margin-left: 20px;
}

/* Stake input */
.stake-container {
  display: flex;
  margin: 0 auto 32px auto;
  gap: 8px;
  max-width: 680px;
}

.input-wrapper {
  flex: 1;
  position: relative;
}

.stake-input {
  width: 100%;
  background-color: transparent;
  border: 1px solid #efe2c6;
  border-radius: 8px;
  color: #ffffff;
  font-size: 16px;
  padding: 10px 50px 10px 16px;
  text-align: center;
}

/* do not group these rules */
.stake-input::-webkit-input-placeholder {
  color: #ffffff;
}
.stake-input:-moz-placeholder {
  /* FF 4-18 */
  color: #ffffff;
  opacity: 0.5;
}
.stake-input::-moz-placeholder {
  /* FF 19+ */
  color: #ffffff;
  opacity: 0.5;
}
.stake-input:-ms-input-placeholder {
  /* IE 10+ */
  color: #ffffff;
  opacity: 0.5;
}
.stake-input::-ms-input-placeholder {
  /* Microsoft Edge */
  color: #ffffff;
  opacity: 0.5;
}
.stake-input::placeholder {
  /* modern browser */
  color: #ffffff;
  opacity: 0.5;
}

.max-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #efe2c6;
  font-size: 12px;
  cursor: pointer;
}

.stake-btn {
  min-width: 80px;
}

.stake-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats table */
.stats-container {
  max-width: 680px;
  margin: 0 auto;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.stat-label {
  text-align: left;
  font-weight: 400;
}

.stat-value {
  text-align: right;
  font-weight: 600;
}

/* Claim button */
.claim-btn {
  padding: 10px 24px;
  margin-top: 32px;
}

.btn {
  background-color: #004d3b;
  border: 1px solid #efe2c6;
  border-radius: 8px;
  color: #efe2c6;
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:not(:disabled):hover{
  transform:translateY(-2px) scale(1.03);
  box-shadow:0 6px 16px rgba(0,0,0,.35);
  background-color: #efe2c6 !important;
  border: 1px solid #efe2c6;
  color: #004d3b;
}

.claim-btn:not(:disabled):active{
  transform:translateY(0) scale(.98);
  box-shadow:0 3px 8px rgba(0,0,0,.25);
}

.status-text {
  min-height: 20px;
  color: #888888;
  margin-top: 16px;
  font-size: 12px;
}

.tx-link {
  font-size: 14px;
  margin: 5rem 0;
}
.tx-link a {
  color: #efe2c6;
  text-decoration: none;
}
.tx-link a:hover {
  text-decoration: underline;
}

/* Footer */
.app-footer {
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.social-icons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.social-icon {
  color: #888888;
  font-size: 18px;
}

.copyright {
  color: #888888;
  font-size: 12px;
}

/* Responsive tweaks */
@media (max-width: 1024px) {
  .main-container {
    max-width: 980px;
    margin: 0 auto;
    padding: 48px 16px 64px;
    text-align: center;
    flex: 1;
    width: 100%;
  }
}

@media (max-width: 600px) {
  .stake-container {
    flex-direction: column;
  }

  .value {
    font-size: 20px;
  }

  .main-container {
    padding: 32px 16px;
  }
}

@media (max-width: 420px) {
  .nav-btn {
    margin-right: 20px;
  }
}
</style>
