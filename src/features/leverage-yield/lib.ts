import { isNoRouteRefusal } from '@sodax/sdk';
import { type IEvmWalletProvider, type LeverageYieldVault, sonicSupportedTokens, type XToken } from '@sodax/types';
import { zeroAddress } from 'viem';

export const SHARE_DECIMALS = 18;

const hubTokenByAddress = new Map(
  (Object.values(sonicSupportedTokens) as XToken[]).map(token => [token.address.toLowerCase(), token]),
);

export function underlying(vault: LeverageYieldVault): { symbol: string; decimals: number } {
  const asset = hubTokenByAddress.get(vault.asset.toLowerCase());
  return { symbol: asset?.symbol ?? vault.name.replace(/^lsoda/, ''), decimals: asset?.decimals ?? SHARE_DECIMALS };
}

export function isNativeToken(token: XToken | undefined): boolean {
  return !!token && token.address.toLowerCase() === zeroAddress;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isNoRouteRefusal(error)) return 'No route for this amount right now. Retrying shortly; a larger amount may work.';
  const e = error as { detail?: { message?: string }; message?: string; code?: string };
  if (e?.code === 'USER_REJECTED') return 'You rejected the request in your wallet.';
  const message = e?.detail?.message ?? e?.message ?? fallback;
  if (/amount too low/i.test(message)) return 'Amount too low. Try at least ~$2.';
  if (/user rejected|denied/i.test(message)) return 'You rejected the request in your wallet.';
  return message;
}

// Reports each tx hash as soon as the user signs, so links show before the solver fills.
export function withTxListener(walletProvider: IEvmWalletProvider, onTx: (hash: string) => void): IEvmWalletProvider {
  return new Proxy(walletProvider, {
    get(target, prop) {
      if (prop === 'sendTransaction') {
        return async (...args: Parameters<IEvmWalletProvider['sendTransaction']>) => {
          const hash = await target.sendTransaction(...args);
          onTx(hash);
          return hash;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
