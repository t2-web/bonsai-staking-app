<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { ethers } from 'ethers'
import { useToast, TYPE } from 'vue-toastification'

import ERC20 from '@/abi/ERC20.json'
import StakingContract from '@/abi/ERC20Staking.json'

/* ---------- Provider ---------- */
const staticProvider = new ethers.providers.JsonRpcProvider(
  'https://sepolia.base.org'
)

/* ---------- Wallet 接続 ---------- */
async function connectWallet () {
  const mm = (window as any).ethereum
  if (!mm) return

  try {
    let accounts: string[] = await mm.request({ method: 'eth_accounts' })
    if (accounts.length === 0)
      accounts = await mm.request({ method: 'eth_requestAccounts' })

    // v5 は Web3Provider
    const tmpProvider = new ethers.providers.Web3Provider(mm, 'any')
    const tmpSigner   = tmpProvider.getSigner()

    provider.value = tmpProvider
    signer.value   = tmpSigner
    address.value  = accounts[0]

    await fetchTokenBalance()
    await fetchClaimData()

    mm.on?.('accountsChanged', async (a: string[]) => {
      address.value = a[0] ?? ''
      await fetchTokenBalance()
      await fetchClaimData()
    })
  } catch (err) {
    console.error(err)
  }
}

/* ---------- 残高取得 ---------- */
async function fetchTokenBalance () {
  if (!address.value) return
  const erc20 = new ethers.Contract(tokenAddress, ERC20, staticProvider)
  const raw   = await erc20.balanceOf(address.value)
  const dec   = await erc20.decimals()
  balance.value = parseFloat(ethers.utils.formatUnits(raw, dec))
}

/* ---------- Stake 集計 ---------- */
async function fetchClaimData () {
  if (!address.value) return
  const staking = new ethers.Contract(stakeContractAddress, StakingContract, staticProvider)
  const stakes  = await staking.getStakes(address.value)

  let unlocked = ethers.BigNumber.from(0)
  let locked   = ethers.BigNumber.from(0)

  for (const s of stakes) {
    const amt  = ethers.BigNumber.from(s[0])
    const flag = s[2]                     // bool
    flag ? unlocked = unlocked.add(amt) : locked = locked.add(amt)
  }

  unlockedStake.value = parseFloat(ethers.utils.formatEther(unlocked))
  lockedStake.value   = parseFloat(ethers.utils.formatEther(locked))
  currentStake.value  = unlockedStake.value + lockedStake.value
}

/* ---------- Stake 実行 ---------- */
async function stake () {
  if (!signer.value || !amount.value) return

  const cleaned = amount.value.replace(/,/g, '')
  const weiAmt  = ethers.utils.parseUnits(cleaned, 18)

  const erc20   = new ethers.Contract(tokenAddress, ERC20, signer.value)
  const staking = new ethers.Contract(stakeContractAddress, StakingContract, signer.value)

  const allowance = await erc20.allowance(address.value, stakeContractAddress)
  if (allowance.lt(weiAmt)) {
    const tx = await erc20.approve(stakeContractAddress, weiAmt)
    await tx.wait()
  }

  const tx2 = await staking.stake(weiAmt)
  await tx2.wait()

  await fetchTokenBalance()
  await fetchClaimData()
}
</script>
