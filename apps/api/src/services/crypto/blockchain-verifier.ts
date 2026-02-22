/**
 * Blockchain Verifier Service
 * Verifies USDT transactions on TRON (TRC20) and BSC (BEP20) networks
 */

import bs58 from 'bs58'

export interface TransactionVerificationResult {
  valid: boolean
  amount: number | null
  from: string | null
  to: string | null
  blockNumber: string | null
  confirmations: number | null
  blockTimestamp: number | null  // Unix timestamp in seconds (for 24h age check)
  error?: string
}

// USDT Contract Addresses
// TRON USDT contract in hex format (without 41 prefix for comparison)
const TRON_USDT_CONTRACT_HEX = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const BSC_USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'

// Minimum confirmations required
const TRON_MIN_CONFIRMATIONS = 19
const BSC_MIN_CONFIRMATIONS = 15

// TronGrid API Key
const TRONGRID_API_KEY = '256e8004-6cc9-40d4-b535-2bd40a04ff5a'

// ANKR BSC RPC Endpoint
const ANKR_BSC_RPC = 'https://rpc.ankr.com/bsc/c9ecbfee193038ca70ec5ff9c485ae3e39ae51fa6246a0fa4abdba1fe9aba5a4'

// Build headers for TronGrid API
function getTronGridHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'TRON-PRO-API-KEY': TRONGRID_API_KEY
  }
}

// Convert TRON base58 address to hex for comparison
function tronAddressToHex(address: string): string {
  // If already hex format
  if (address.startsWith('41') || address.startsWith('0x')) {
    return address.replace('0x', '').replace('41', '').toLowerCase()
  }

  // For base58 addresses starting with T, decode to hex
  if (address.startsWith('T')) {
    try {
      const decoded = bs58.decode(address)
      // First byte is 0x41 (TRON prefix), last 4 bytes are checksum
      const hex = Buffer.from(decoded.slice(0, -4)).toString('hex')
      return hex.slice(2).toLowerCase() // Remove 41 prefix
    } catch (e) {
      console.log(`[TRON] Failed to decode address ${address}:`, e)
      return address.toLowerCase()
    }
  }

  return address.toLowerCase()
}

/**
 * Verify a TRON TRC20 USDT transaction
 */
export async function verifyTronTransaction(
  txHash: string,
  expectedWalletAddress: string,
  minAmount?: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`[TRON Verifier] Verifying TX: ${txHash}`)
    console.log(`[TRON Verifier] Expected wallet: ${expectedWalletAddress}`)

    // Use wallet API to get transaction info (more reliable than v1 API)
    const txResponse = await fetch('https://api.trongrid.io/wallet/gettransactioninfobyid', {
      method: 'POST',
      headers: getTronGridHeaders(),
      body: JSON.stringify({ value: txHash })
    })

    if (!txResponse.ok) {
      console.log(`[TRON Verifier] HTTP Error: ${txResponse.status}`)
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: null,
        confirmations: null,
        blockTimestamp: null,
        error: 'Failed to fetch transaction from TRON network'
      }
    }

    const txInfo = await txResponse.json()
    console.log(`[TRON Verifier] TX Info received, blockNumber: ${txInfo.blockNumber}`)

    // Extract block timestamp (TronGrid returns milliseconds)
    const blockTimestamp = txInfo.blockTimeStamp ? Math.floor(txInfo.blockTimeStamp / 1000) : null

    if (!txInfo || !txInfo.id) {
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: null,
        confirmations: null,
        blockTimestamp,
        error: 'Transaction not found on TRON network'
      }
    }

    // Check if transaction was successful
    if (txInfo.receipt?.result !== 'SUCCESS') {
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: txInfo.blockNumber?.toString() || null,
        confirmations: null,
        blockTimestamp,
        error: 'Transaction failed'
      }
    }

    // Parse logs to find USDT transfer
    // Transfer event topic: ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    const TRANSFER_TOPIC = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    console.log(`[TRON Verifier] Looking for transfers in ${txInfo.log?.length || 0} logs`)

    // Find USDT transfer to our wallet
    let transferLog = null
    let transferAmount = 0
    let fromAddress = ''
    let toAddress = ''

    // Convert expected wallet address to hex format for comparison
    const expectedHex = tronAddressToHex(expectedWalletAddress)
    console.log(`[TRON Verifier] Expected wallet hex: ${expectedHex}`)

    if (txInfo.log && txInfo.log.length > 0) {
      for (const log of txInfo.log) {
        // Check if this is a Transfer event from USDT contract
        const isUsdtContract = log.address?.toLowerCase() === TRON_USDT_CONTRACT_HEX
        const isTransferEvent = log.topics?.[0] === TRANSFER_TOPIC

        console.log(`[TRON Verifier] Log - contract: ${log.address}, isUSDT: ${isUsdtContract}, isTransfer: ${isTransferEvent}`)

        if (isUsdtContract && isTransferEvent && log.topics.length >= 3) {
          // Extract from and to addresses from topics (remove padding)
          const fromHex = log.topics[1].slice(-40).toLowerCase()
          const toHex = log.topics[2].slice(-40).toLowerCase()

          // Extract amount from data
          const amountHex = log.data
          const amount = parseInt(amountHex, 16) / 1_000_000 // USDT has 6 decimals

          console.log(`[TRON Verifier] Found transfer: from=${fromHex}, to=${toHex}, amount=${amount}`)

          // Check if this transfer is to our expected wallet
          if (toHex === expectedHex || toHex === expectedHex.replace('41', '')) {
            transferLog = log
            transferAmount = amount
            fromAddress = fromHex
            toAddress = toHex
            console.log(`[TRON Verifier] ✓ Matched transfer to our wallet!`)
            break
          }
        }
      }
    }

    if (!transferLog) {
      console.log(`[TRON Verifier] No matching USDT transfer found`)
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: txInfo.blockNumber?.toString() || null,
        confirmations: null,
        blockTimestamp,
        error: 'No USDT transfer to your wallet found in this transaction'
      }
    }

    // Get current block for confirmations
    let confirmations = 0
    try {
      const blockResp = await fetch('https://api.trongrid.io/wallet/getnowblock', {
        headers: getTronGridHeaders()
      })
      if (blockResp.ok) {
        const blockData = await blockResp.json()
        const currentBlock = blockData.block_header?.raw_data?.number || 0
        confirmations = currentBlock - txInfo.blockNumber
      }
    } catch (e) {
      console.log(`[TRON Verifier] Could not get current block`)
    }

    console.log(`[TRON Verifier] Confirmations: ${confirmations}`)

    // Check minimum confirmations
    if (confirmations < TRON_MIN_CONFIRMATIONS) {
      return {
        valid: false,
        amount: transferAmount,
        from: fromAddress,
        to: toAddress,
        blockNumber: txInfo.blockNumber?.toString() || null,
        confirmations,
        blockTimestamp,
        error: `Insufficient confirmations. Required: ${TRON_MIN_CONFIRMATIONS}, Got: ${confirmations}`
      }
    }

    // Success!
    console.log(`[TRON Verifier] ✓ Transaction verified! Amount: ${transferAmount} USDT`)
    return {
      valid: true,
      amount: transferAmount,
      from: fromAddress,
      to: toAddress,
      blockNumber: txInfo.blockNumber?.toString() || null,
      confirmations,
      blockTimestamp
    }
  } catch (error: any) {
    console.error(`[TRON Verifier] Error:`, error)
    return {
      valid: false,
      amount: null,
      from: null,
      to: null,
      blockNumber: null,
      confirmations: null,
      blockTimestamp: null,
      error: `Verification error: ${error.message || 'Unknown error'}`
    }
  }
}

/**
 * Verify a BSC BEP20 USDT transaction using ANKR RPC
 */
export async function verifyBscTransaction(
  txHash: string,
  expectedWalletAddress: string,
  minAmount?: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`[BSC Verifier] Verifying TX: ${txHash}`)
    console.log(`[BSC Verifier] Expected wallet: ${expectedWalletAddress}`)

    // Use ANKR BSC RPC to fetch transaction receipt
    const receiptResponse = await fetch(ANKR_BSC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1
      })
    })

    if (!receiptResponse.ok) {
      console.log(`[BSC Verifier] HTTP Error: ${receiptResponse.status}`)
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: null,
        confirmations: null,
        blockTimestamp: null,
        error: 'Failed to fetch transaction from BSC network'
      }
    }

    const receiptData = await receiptResponse.json()
    console.log(`[BSC Verifier] Response received`)

    if (!receiptData.result || receiptData.result === null) {
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: null,
        confirmations: null,
        blockTimestamp: null,
        error: 'Transaction not found on BSC network'
      }
    }

    const receipt = receiptData.result

    // Check if transaction was successful
    if (receipt.status !== '0x1') {
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16).toString() : null,
        confirmations: null,
        blockTimestamp: null,
        error: 'Transaction failed'
      }
    }

    // Find Transfer event in logs
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    const transferLog = receipt.logs?.find((log: any) =>
      log.topics?.[0] === TRANSFER_TOPIC &&
      log.address?.toLowerCase() === BSC_USDT_CONTRACT.toLowerCase()
    )

    if (!transferLog) {
      return {
        valid: false,
        amount: null,
        from: null,
        to: null,
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16).toString() : null,
        confirmations: null,
        blockTimestamp: null,
        error: 'No USDT transfer found in transaction'
      }
    }

    // Parse transfer event
    const fromAddress = '0x' + transferLog.topics[1].slice(26)
    const toAddress = '0x' + transferLog.topics[2].slice(26)
    const rawAmount = BigInt(transferLog.data)

    // USDT BEP20 has 18 decimals
    const amount = Number(rawAmount) / 1e18

    // Verify recipient matches expected wallet
    const normalizedExpected = expectedWalletAddress.toLowerCase()
    const normalizedTo = toAddress.toLowerCase()

    if (normalizedTo !== normalizedExpected) {
      return {
        valid: false,
        amount,
        from: fromAddress,
        to: toAddress,
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16).toString() : null,
        confirmations: null,
        blockTimestamp: null,
        error: `Recipient mismatch. Expected: ${expectedWalletAddress}, Got: ${toAddress}`
      }
    }

    // Get current block to calculate confirmations
    const blockResponse = await fetch(ANKR_BSC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    })

    let confirmations = 0

    if (blockResponse.ok) {
      const blockData = await blockResponse.json()
      const currentBlock = parseInt(blockData.result, 16)
      const txBlock = parseInt(receipt.blockNumber, 16)
      confirmations = currentBlock - txBlock
    }

    // Get block timestamp for age check
    let blockTimestamp: number | null = null
    try {
      const blockDetailResp = await fetch(ANKR_BSC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [receipt.blockNumber, false],
          id: 2
        })
      })
      if (blockDetailResp.ok) {
        const blockDetail = await blockDetailResp.json()
        if (blockDetail.result?.timestamp) {
          blockTimestamp = parseInt(blockDetail.result.timestamp, 16)
        }
      }
    } catch (e) {
      console.log('[BSC Verifier] Could not get block timestamp')
    }

    // Check if enough confirmations
    if (confirmations < BSC_MIN_CONFIRMATIONS) {
      return {
        valid: false,
        amount,
        from: fromAddress,
        to: toAddress,
        blockNumber: parseInt(receipt.blockNumber, 16).toString(),
        confirmations,
        blockTimestamp,
        error: `Insufficient confirmations. Required: ${BSC_MIN_CONFIRMATIONS}, Got: ${confirmations}`
      }
    }

    return {
      valid: true,
      amount,
      from: fromAddress,
      to: toAddress,
      blockNumber: parseInt(receipt.blockNumber, 16).toString(),
      confirmations,
      blockTimestamp
    }
  } catch (error: any) {
    console.error(`[BSC Verifier] Error:`, error)
    return {
      valid: false,
      amount: null,
      from: null,
      to: null,
      blockNumber: null,
      confirmations: null,
      blockTimestamp: null,
      error: `Verification error: ${error.message || 'Unknown error'}`
    }
  }
}

/**
 * Verify a transaction based on network type
 */
export async function verifyTransaction(
  network: 'TRON_TRC20' | 'BSC_BEP20',
  txHash: string,
  expectedWalletAddress: string,
  minAmount?: number
): Promise<TransactionVerificationResult> {
  if (network === 'TRON_TRC20') {
    return verifyTronTransaction(txHash, expectedWalletAddress, minAmount)
  } else if (network === 'BSC_BEP20') {
    return verifyBscTransaction(txHash, expectedWalletAddress, minAmount)
  } else {
    return {
      valid: false,
      amount: null,
      from: null,
      to: null,
      blockNumber: null,
      confirmations: null,
      blockTimestamp: null,
      error: `Unsupported network: ${network}`
    }
  }
}

export const CONTRACTS = {
  TRON_TRC20: TRON_USDT_CONTRACT,
  BSC_BEP20: BSC_USDT_CONTRACT
}

export const MIN_CONFIRMATIONS = {
  TRON_TRC20: TRON_MIN_CONFIRMATIONS,
  BSC_BEP20: BSC_MIN_CONFIRMATIONS
}
