import {
  useBalances,
  useLeverageYieldDeposit,
  useLeverageYieldQuote,
  useLeverageYieldShareBalances,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import {
  ChainKeys,
  type IEvmWalletProvider,
  type LeverageYieldVault,
  type SpokeChainKey,
  type XToken,
} from '@sodax/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { REFETCH_MS, SOURCE_CHAINS } from '@/config/workshop';
import { minAmountAfterSlippage } from '@/lib/format';
import { withTxListener } from './lib';

export function useVaults(): readonly LeverageYieldVault[] {
  const { sodax } = useSodaxContext();
  return useMemo(() => sodax.leverageYield.listVaults(), [sodax]);
}

export function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function useTokenBalance(chainKey: SpokeChainKey, token: XToken | undefined, address: string | undefined) {
  const query = useBalances({
    params: { chainKey, tokens: token ? [token] : [], address },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  return token ? query.data?.[token.address] : undefined;
}

export function useShareHoldings(vault: LeverageYieldVault | undefined, address: string | undefined) {
  const holders = useMemo(
    () => (address ? SOURCE_CHAINS.map(chainKey => ({ chainKey, address })) : undefined),
    [address],
  );
  const queries = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const rows = queries.flatMap(q => (q.data ? [q.data] : []));
  const total = rows.reduce((sum, row) => sum + row.shares, 0n);
  return { rows, total, isLoading: queries.some(q => q.isLoading) };
}

type QuoteArgs = {
  srcChainKey: SpokeChainKey;
  srcToken: string | undefined;
  dstChainKey: SpokeChainKey;
  dstToken: string | undefined;
  amount: bigint | undefined;
  slippageBps: number;
};

export function useVaultQuote({ srcChainKey, srcToken, dstChainKey, dstToken, amount, slippageBps }: QuoteArgs) {
  const debouncedAmount = useDebounced(amount);
  const payload =
    srcToken && dstToken && debouncedAmount && debouncedAmount > 0n
      ? {
          token_src: srcToken,
          token_src_blockchain_id: srcChainKey,
          token_dst: dstToken,
          token_dst_blockchain_id: dstChainKey,
          amount: debouncedAmount,
          quote_type: 'exact_input' as const,
        }
      : undefined;
  const query = useLeverageYieldQuote({
    params: { payload },
    queryOptions: { refetchInterval: REFETCH_MS },
  });
  const result = query.data;
  const quoted = result?.ok ? result.value.quoted_amount : undefined;
  return {
    quoted,
    minimum: quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined,
    error: result && !result.ok ? result.error : query.error,
    isFetching: query.isFetching || amount !== debouncedAmount,
    refetch: query.refetch,
    hasPayload: !!payload,
  };
}

export type FlowStep = 'idle' | 'approving' | 'signing' | 'processing' | 'done' | 'error';
export type FlowState = { step: FlowStep; approveTxHash?: string; srcTxHash?: string; error?: unknown };

function useFlow() {
  const [state, setState] = useState<FlowState>({ step: 'idle' });
  const patch = useCallback((next: Partial<FlowState>) => setState(prev => ({ ...prev, ...next })), []);
  const queryClient = useQueryClient();
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setState({ step: 'signing' });
      try {
        await fn();
        await queryClient.invalidateQueries();
      } catch (error) {
        patch({ step: 'error', error });
      }
    },
    [patch, queryClient],
  );
  const reset = useCallback(() => setState({ step: 'idle' }), []);
  return { state, patch, run, reset };
}

export type DepositInput = {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  token: XToken;
  inputAmount: bigint;
  minShares: bigint;
  walletProvider: IEvmWalletProvider;
};

export function useVaultDeposit() {
  const { sodax } = useSodaxContext();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const flow = useFlow();
  const { patch, run } = flow;

  const deposit = useCallback(
    (input: DepositInput) =>
      run(async () => {
        const { vault, srcChainKey, srcAddress, token, inputAmount, minShares, walletProvider } = input;
        if (minShares <= 0n) throw new Error('Minimum received must be greater than 0.');
        const built = await buildDeposit({
          vault: vault.vault,
          srcChainKey,
          srcAddress,
          inputToken: token.address,
          inputAmount,
          minOutputAmount: minShares,
        });
        if (!built.ok) throw built.error;
        const payload = built.value;

        const allowance = await sodax.swaps.isAllowanceValid({ params: payload.params, raw: false, walletProvider });
        if (!allowance.ok) throw allowance.error;
        if (!allowance.value) {
          patch({ step: 'approving' });
          const approved = await approve({
            params: payload.params,
            walletProvider: withTxListener(walletProvider, hash => patch({ approveTxHash: hash })),
          });
          if (!approved.ok) throw approved.error;
          const receipt = await walletProvider.waitForTransactionReceipt(approved.value as `0x${string}`);
          if (receipt.status === 'reverted' || receipt.status === '0x0') {
            throw new Error('The approval failed on-chain. Check your gas balance and try again.');
          }
        }

        patch({ step: 'signing' });
        const result = await vaultSwap({
          ...payload,
          walletProvider: withTxListener(walletProvider, hash => patch({ step: 'processing', srcTxHash: hash })),
        });
        if (!result.ok) throw result.error;
        patch({ step: 'done', srcTxHash: result.value.intentDeliveryInfo.srcTxHash });
      }),
    [sodax, buildDeposit, approve, vaultSwap, patch, run],
  );

  return { ...flow, deposit };
}

export type WithdrawInput = {
  vault: LeverageYieldVault;
  srcChainKey: SpokeChainKey;
  srcAddress: string;
  dstChainKey: SpokeChainKey;
  token: XToken;
  shares: bigint;
  minOutput: bigint;
  walletProvider: IEvmWalletProvider;
};

export function useVaultWithdraw() {
  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const flow = useFlow();
  const { patch, run } = flow;

  const withdraw = useCallback(
    (input: WithdrawInput) =>
      run(async () => {
        const { vault, srcChainKey, srcAddress, dstChainKey, token, shares, minOutput, walletProvider } = input;
        if (minOutput <= 0n) throw new Error('Minimum received must be greater than 0.');
        const built = await buildWithdraw({
          vault: vault.vault,
          srcChainKey,
          srcAddress,
          dstChainKey,
          outputToken: token.address,
          inputAmount: shares,
          minOutputAmount: minOutput,
        });
        if (!built.ok) throw built.error;
        const result = await vaultSwap({
          ...built.value,
          walletProvider: withTxListener(walletProvider, hash => patch({ step: 'processing', srcTxHash: hash })),
        });
        if (!result.ok) throw result.error;
        patch({ step: 'done', srcTxHash: result.value.intentDeliveryInfo.srcTxHash });
      }),
    [buildWithdraw, vaultSwap, patch, run],
  );

  return { ...flow, withdraw };
}

export const HUB_CHAIN = ChainKeys.SONIC_MAINNET;
