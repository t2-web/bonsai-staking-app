<template>
  <div class="bonsai-app">
    <!-- ────────── HEADER ────────── -->
    <header class="app-header">
      <div class="nav-container">
        <button class="nav-btn">TOP</button>
        <button class="nav-btn active">Staking</button>
        <div class="spacer"></div>
        <button v-if="!address" class="connect-btn" @click="connectWallet">
          Connect Wallet
        </button>
        <div v-else class="wallet-chip">
          {{ shortAddress }}
        </div>
      </div>
    </header>

    <!-- ────────── MAIN CONTENT ────────── -->
    <main class="main-container">
      <!-- LOGO -->
      <div class="logo-container">
        <img src="../src/assets/logo.png" alt="BONSAICOIN" class="logo" />
      </div>

      <!-- BALANCE LINE -->
      <div class="balance-line">
        <span class="label">My $BONSAICOIN:</span>
        <span class="value">{{ formatNumber(balance) }}</span>
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
          <span class="stat-value">{{ formatNumber(staked) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Claimable Amount:</span>
          <span class="stat-value">{{ formatNumber(claimable) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Claimed Amount:</span>
          <span class="stat-value">{{ formatNumber(claimed) }}</span>
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
      <div class="status-text">{{ status }}</div>
    </main>

    <!-- ────────── FOOTER ────────── -->
    <footer class="app-footer">
      <div class="social-icons">
        <div v-for="i in 6" :key="i" class="social-icon">mdi-circle-small</div>
      </div>
      <div class="copyright">© 2024 by SBONSAICOIN</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ethers, BrowserProvider } from 'ethers';
import { Web3Modal } from '@web3modal/standalone';

/* ────────── WALLET CONNECT ────────── */
const modal = new Web3Modal({
  projectId: '11de27f464d53a18220d68841ac45f99', 
  walletConnectVersion: 2,
  defaultChain: { id: 84532, name: 'Base Sepolia'}
});

/* ────────── STATE ────────── */
const address = ref('');
const provider = ref<BrowserProvider | null>(null);
const signer = ref<ethers.Signer | null>(null);

const balance = ref(999999); // mock, replace with on‑chain
const amount = ref('');
const staked = ref(100);
const claimable = ref(100);
const claimed = ref(100);
const status = ref('');

/* ────────── COMPUTED ────────── */
const shortAddress = computed(() =>
  address.value ? `${address.value.slice(0,6)}…${address.value.slice(-4)}` : ''
);

/* ────────── HELPERS ────────── */
function formatNumber(n: number) {
  return n.toLocaleString();
}

function setMax() {
  amount.value = String(balance.value);
}

/* ────────── WALLET FUNCTIONS ────────── */
async function connectWallet() {
  try {
    const ses = await modal.connect();
    address.value = ses.accounts[0];
    provider.value = new BrowserProvider(window.ethereum as any);
    signer.value = await provider.value.getSigner();
    status.value = 'Wallet connected';
    // TODO: fetch real data
  } catch {
    status.value = 'Connection cancelled';
  }
}

/* ────────── STAKE & CLAIM (mock) ────────── */
async function stake() {
  if (!signer.value) return;
  status.value = '⏳ Staking…';
  await new Promise(r => setTimeout(r, 800));
  staked.value += Number(amount.value);
  balance.value -= Number(amount.value);
  amount.value = '';
  status.value = '✅ Stake success';
}

async function claimAll() {
  if (!signer.value) return;
  status.value = '⏳ Claiming…';
  await new Promise(r => setTimeout(r, 800));
  claimed.value += claimable.value;
  claimable.value = 0;
  status.value = '✅ Claim success';
}

function goTop() {
  window.location.href = '/';
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
}

.nav-btn {
  background: transparent;
  border: none;
  color: #888888;
  font-size: 16px;
  font-weight: 500;
  margin-right: 16px;
  cursor: pointer;
}

.nav-btn.active {
  color: #ffffff;
  font-weight: 700;
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

.wallet-chip {
  border: 1px solid #ffffff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 14px;
}

/***** Main Content *****/
.main-container {
  max-width: 680px;
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