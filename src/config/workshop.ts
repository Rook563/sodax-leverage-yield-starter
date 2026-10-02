import { ChainKeys, type SpokeChainKey, spokeChainConfig, type XToken } from '@sodax/types';
import { parseUnits } from 'viem';

/**
 * Workshop defaults. This is the one config file feature code may edit.
 *
 * The recommended path, checked with `pnpm preflight`: ~$5 USDC from Base (or Arbitrum / Sonic) into the
 * lsodaSUSDS vault. The solver rejects deposits below roughly $2 ("Input amount too low").
 */

/** EVM chains participants may deposit from. Ethereum mainnet is left out on purpose (gas). */
export const SOURCE_CHAINS = [
  ChainKeys.BASE_MAINNET,
  ChainKeys.ARBITRUM_MAINNET,
  ChainKeys.SONIC_MAINNET,
] as const satisfies readonly SpokeChainKey[];

export type SourceChainKey = (typeof SOURCE_CHAINS)[number];

export const DEFAULT_SOURCE_CHAIN: SourceChainKey = ChainKeys.SONIC_MAINNET;

/** Native token (ETH / S) to leave in the wallet for gas when depositing the native token itself. */
export const NATIVE_GAS_RESERVE: Record<SourceChainKey, bigint> = {
  [ChainKeys.BASE_MAINNET]: parseUnits('0.0005', 18),
  [ChainKeys.ARBITRUM_MAINNET]: parseUnits('0.0005', 18),
  [ChainKeys.SONIC_MAINNET]: parseUnits('1', 18),
};

/** Vault `name` as returned by `sodax.leverageYield.listVaults()`. */
export const DEFAULT_VAULT_NAME = 'lsodaSUSDS';

/**
 * Tokens offered in deposit / withdraw pickers, by their key in the SDK chain config. Keys, not symbols:
 * Sonic's config also contains SODAX hub-internal tokens whose *symbols* look like real assets (its hub
 * weETH has symbol "weETH") plus the lsoda* share tokens themselves. Those must never be offered.
 */
export const DEPOSIT_TOKEN_KEYS = ['USDC', 'USDT', 'ETH', 'WETH', 'S', 'weETH', 'wstETH', 'USDS', 'sUSDS'] as const;

export const DEFAULT_TOKEN_KEY = 'USDC';

/** Slippage in basis points (100 = 1%). Never let users go above MAX_SLIPPAGE_BPS. */
export const DEFAULT_SLIPPAGE_BPS = 100;
export const MAX_SLIPPAGE_BPS = 300;

/**
 * Polling interval for live reads (quotes, balances, status). A room full of people shares one IP and the
 * same public RPCs, so don't poll faster than this.
 */
export const REFETCH_MS = 10_000;

export function isSourceChain(chainKey: string | undefined): chainKey is SourceChainKey {
  return !!chainKey && (SOURCE_CHAINS as readonly string[]).includes(chainKey);
}

function supportedTokenEntries(chainKey: SpokeChainKey): [string, XToken][] {
  return Object.entries(spokeChainConfig[chainKey]?.supportedTokens ?? {}) as [string, XToken][];
}

/** Tokens users may deposit from (or withdraw to) on a chain: DEPOSIT_TOKEN_KEYS that exist there. */
export function getDepositTokens(chainKey: SpokeChainKey): XToken[] {
  const allowed = new Set<string>(DEPOSIT_TOKEN_KEYS);
  return supportedTokenEntries(chainKey)
    .filter(([key]) => allowed.has(key))
    .map(([, token]) => token);
}

/** Resolve a token by its SDK config key, e.g. getTokenByKey(BASE, 'USDC') (native USDC on Arbitrum, not USDC.e). */
export function getTokenByKey(chainKey: SpokeChainKey, key: string): XToken | undefined {
  return supportedTokenEntries(chainKey).find(([tokenKey]) => tokenKey === key)?.[1];
}
