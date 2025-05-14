<template>
  <div class="bonsai-app">
    <!-- ────────── HEADER ────────── -->
    <header class="app-header">
      <div class="nav-container">
        <button class="nav-btn" @click="goTop">TOP</button>
        <button class="nav-btn active">Staking</button>
        <div class="spacer"></div>
        <!-- 接続前 -->
        <button v-if="!isConnected" class="connect-btn" @click="connectWallet">
          Connect Wallet
        </button>
        <!-- 接続後：クリックで切断 -->
        <div v-else class="wallet-chip" @click="disconnectWallet">
          {{ shortAddress }}
        </div>
      </div>
    </header>

    <!-- ────────── MAIN CONTENT ────────── -->
    <main class="main-container">
      <!-- LOGO -->
      <div class="logo-container">
        <!-- <img src="../src/assets/logo.png" alt="BONSAICOIN" class="logo" /> -->
        <img src="https://static.wixstatic.com/media/3e4de0_efd319fa51504fcbafb6b96c42b82040~mv2.png/v1/crop/x_252,y_141,w_459,h_259/fill/w_388,h_219,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/BONSAICOIN_ogp.png" alt="BONSAICOIN" class="logo" />
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
          />
          <button class="max-btn" @click="setMax">max</button>
        </div>
        <button 
          class="stake-btn"
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
        class="claim-btn"
        :disabled="claimable === 0 || !address"
        @click="claimAll"
      >
        Claim
      </button>

      <!-- TX STATUS -->
      <!-- <div class="status-text">{{ status }}</div> -->
    </main>

    <!-- ────────── FOOTER ────────── -->
    <footer class="app-footer">
      <!-- <div class="social-icons">
        <div v-for="i in 6" :key="i" class="social-icon">mdi-circle-small</div>
      </div> -->
      <div class="copyright">© 2024 by SBONSAICOIN</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ethers, BrowserProvider } from 'ethers'

import ERC20 from '@/abi/ERC20.json'
import StakingContract from '@/abi/ERC20Staking.json'

const tokenAddress = '0x5e1C5AccE47aA5c6eC23dEFF9330263729F652D3'
const stakeContractAddress = '0x835Acf913aE99e97096f6c10D324515a4F12A902'

// ────────── STATE ──────────
const address  = ref('')
const provider = ref<BrowserProvider>()
const signer   = ref()
const status   = ref('')

const balance   = ref<number | null>(null)
const amount    = ref('') // ユーザー入力値
const staked    = ref<number | null>(null) //total staked = claimable+claimed 
const claimable = ref<number | null>(null)   // ← 初期値 null で「取得前」を示す
const claimed   = ref<number | null>(null)


// TODO: env=stgの場合に分岐させてもいい
function goTop() {
  window.location.href = 'https://coin.bonsainft.club/'   // ルート URL へリダイレクト
}
/* ────────── HELPERS ────────── */
function formatNumber(n: number) {
  return n.toLocaleString()
}
// function setMax() { amount.value = String(balance.value) }
function setMax() { 
  amount.value = formatNumber(balance.value)
  if (balance.value !== null)
    amount.value = formatNumber(balance.value)
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

/* ────────── WALLET: MetaMask only ────────── */
async function connectWallet () {
  const mm = (window as any).ethereum
  if (!mm) {
    status.value = '❌ MetaMask が見つかりません'
    return
  }

  try {
    // ① 既に接続済みか確認
    let accounts: string[] = await mm.request({ method: 'eth_accounts' })

    // ② 未接続ならリクエストを表示
    if (accounts.length === 0) {
      accounts = await mm.request({ method: 'eth_requestAccounts' })
    }

    const tmpProvider = new BrowserProvider(mm)   // ← ここでエラーが出ていた
    const tmpSigner   = await tmpProvider.getSigner()

    provider.value = tmpProvider
    signer.value   = tmpSigner
    address.value  = accounts[0]
    status.value   = '✅ Connected'
    balance.value  = null // ← 古い表示を即クリア

    // connectWallet の成功ブロック末尾で呼ぶ
    await fetchTokenBalance()
    await fetchClaimData()  

    // ウォレット側でアカウントを切り替えたら残高も更新
    mm.on?.('accountsChanged', async (a: string[]) => {
      address.value = a[0] ?? ''
      await fetchTokenBalance()
      await fetchClaimData() 
    })
    console.log('Connected - balance.value:', balance.value)
  } catch (e) {
    console.error(e)
    status.value = '❌ 接続をキャンセル／失敗'
  }
}

/* ——————— 切断処理 ——————— */
function disconnectWallet () {
  provider.value = undefined
  signer.value   = undefined
  address.value  = ''
  balance.value  = null
  status.value   = '👋 Disconnected'
}

/* ────────── 自動復旧 (任意) ────────── */
onMounted(() => {
  connectWallet()    // ページ読み込み時に一度だけ試行
})

/* ────────── Approve & getBalance ────────── */

// JsonRpcProviderは　private-method 競合がそもそも起きない
const staticProvider = new ethers.JsonRpcProvider('https://sepolia.base.org');

async function fetchTokenBalance () {
  // if (!signer.value) return
  // const erc20 = new ethers.Contract(tokenAddress, ERC20, signer.value)
  console.log('fetchTokenBalance')
  if (!provider.value) return
  const erc20  = new ethers.Contract(tokenAddress, ERC20, staticProvider)
  console.log('bal_s')
  const raw = await erc20.balanceOf(address.value)
  console.log('bal') 
  console.log('dec_s')
  const dec    = await erc20.decimals()
  console.log('dec')
  balance.value = parseFloat(ethers.formatUnits(raw, dec))
}

async function fetchClaimData () {
  if (!provider.value || !address.value) return

  // const staking = new ethers.Contract(stakeContractAddress, StakingContract, provider.value)
  const staking = new ethers.Contract(stakeContractAddress, StakingContract, staticProvider)
  const stakes  = await staking.getStakes(address.value)

  /* --- パターン B: getStakes(addr) で計算する場合 ------------------ */
  
  let totalClaimable = BigInt(0)
  let totalClaimed   = BigInt(0)

  for (const s of stakes) {
    if (s.claimed) {
      totalClaimed   += s.amount     // uint256 → bigint
    } else {
      totalClaimable += s.amount
    }
  }

  claimable.value = Number(ethers.formatEther(totalClaimable))
  claimed.value   = Number(ethers.formatEther(totalClaimed))
  staked.value    = claimable.value + claimed.value
  /* -------------------------------------------------------------- */
}
/* ────────── STAKE & CLAIM (ダミー) ────────── */
async function stake () {
  if (!signer.value || !amount.value) return

  // 「1,234,567」→ 「1234567」→ 数値 1234567
  const amt = Number(amount.value.replace(/,/g, ''))

  // staked.value  += Number(amt)
  balance.value -= Number(amount.value)
  amount.value   = ''
  status.value   = '✅ Stake success'
  await fetchClaimData() 
}

async function claimAll () {
  if (!signer.value || claimable.value === 0) return
  // claimed.value += claimable.value
  claimable.value = 0
  status.value    = '✅ Claim success'
  await fetchClaimData()
}
</script>

<style scoped>
/* Global styles for dark theme */
.bonsai-app {
  background-color: #1a1a1a;
  color: #ffffff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
  max-width:980px;     /* TOP ページと同じ固定幅 */
  margin:0 auto;       /* 余白を左右に均等配置 */
  width:100%;          /* 画面が狭い時は 100% で縮む */
}

.nav-btn{
  font-family:"Satoshi",sans-serif;   /* GoogleFonts 可 */
  font-size:20px;                     /* ← TOP と同じ */
  letter-spacing:0.05em;
  font-weight:400;
  color:#c4c4c4;
  background:transparent;
  border:none;
  margin-right:48px;                  /* ← 項目間 48px */
  cursor:pointer;
  transition:color .2s;
}

.nav-btn.active {
  color: #ffffff;
  font-weight: 700;
}

.nav-btn:last-of-type{
  margin-right:0;
}

.spacer {
  flex-grow: 1;
}

.connect-btn {
  background: transparent;
  border: 1px solid #ffffff;
  border-radius: 4px;
  color: #ffffff;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
}

/* .wallet-chip {
  border: 1px solid #ffffff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 14px;
} */
.wallet-chip {
  border: 1px solid #ffffff;
  padding: 4px 12px;
  font-size: 14px;
}
/***** Main Content *****/
.main-container {
  /* max-width: 680px; */
  max-width: 980px;
  margin: 0 auto;
  padding: 48px 16px 64px;
  text-align: center;
  flex: 1;
}

/* Logo */
.logo-container {
  margin-bottom: 40px;
}

.logo {
  height: 120px;
  width: auto;
}

/* Balance display */
.balance-line {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
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
  margin-bottom: 32px;
  gap: 8px;
}

.input-wrapper {
  flex: 1;
  position: relative;
}

.stake-input {
  width: 100%;
  background-color: #2e2e2e;
  border: 1px solid #444444;
  border-radius: 4px;
  color: #ffffff;
  font-size: 16px;
  padding: 10px 50px 10px 16px;
  text-align: center;
}

.max-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #888888;
  font-size: 12px;
  cursor: pointer;
}

.stake-btn {
  background-color: #2e2e2e;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-weight: 600;
  min-width: 80px;
  cursor: pointer;
}

.stake-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats table */
.stats-container {
  max-width: 400px;
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
  background-color: #2e2e2e;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-weight: 600;
  padding: 10px 24px;
  margin-top: 32px;
  cursor: pointer;
}

.claim-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-text {
  min-height: 20px;
  color: #888888;
  margin-top: 16px;
  font-size: 12px;
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
</style>