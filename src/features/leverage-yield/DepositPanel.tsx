import type { LeverageYieldVault, XToken } from '@sodax/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getTokenByKey,
  NATIVE_GAS_RESERVE,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { HUB_CHAIN, useShareHoldings, useTokenBalance, useVaultDeposit, useVaultQuote } from './hooks';
import { errorMessage, isNativeToken, SHARE_DECIMALS } from './lib';
import { ChainSelect, Field, FlowSteps, TokenSelect } from './parts';

export function DepositPanel({
  vault,
  srcChain,
  onSrcChainChange,
}: {
  vault: LeverageYieldVault;
  srcChain: SourceChainKey;
  onSrcChainChange: (chain: SourceChainKey) => void;
}) {
  const wallet = useEvmWallet(srcChain);
  const [token, setToken] = useState<XToken | undefined>(() => getTokenByKey(srcChain, DEFAULT_TOKEN_KEY));
  const [amountText, setAmountText] = useState('');
  const flow = useVaultDeposit();
  const busy = ['approving', 'signing', 'processing'].includes(flow.state.step);

  const amount = token ? parseTokenAmount(amountText, token.decimals) : undefined;
  const balance = useTokenBalance(srcChain, token, wallet.address);
  const holdings = useShareHoldings(vault, wallet.address);
  const quote = useVaultQuote({
    srcChainKey: srcChain,
    srcToken: token?.address,
    dstChainKey: HUB_CHAIN,
    dstToken: vault.vault,
    amount,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
  });

  const reserve = isNativeToken(token) ? NATIVE_GAS_RESERVE[srcChain] : 0n;
  const spendable = balance !== undefined ? (balance > reserve ? balance - reserve : 0n) : undefined;
  const overBalance = amount !== undefined && spendable !== undefined && amount > spendable;

  const changeChain = (chain: SourceChainKey) => {
    onSrcChainChange(chain);
    setToken(
      getTokenByKey(chain, token ? keyFor(chain, token) : DEFAULT_TOKEN_KEY) ?? getTokenByKey(chain, DEFAULT_TOKEN_KEY),
    );
    flow.reset();
  };

  const submit = () => {
    if (!wallet.address || !wallet.walletProvider || !token || !amount || !quote.minimum) return;
    flow.deposit({
      vault,
      srcChainKey: srcChain,
      srcAddress: wallet.address,
      token,
      inputAmount: amount,
      minShares: quote.minimum,
      walletProvider: wallet.walletProvider,
    });
  };

  const showFlow = flow.state.step !== 'idle';

  return (
    <Card id="deposit">
      <CardContent className="flex flex-col gap-4 pt-6">
        <Field label="From network">
          <ChainSelect value={srcChain} onChange={changeChain} />
        </Field>
        <Field label="Token">
          <TokenSelect
            chainKey={srcChain}
            value={token}
            onChange={t => {
              setToken(t);
              flow.reset();
            }}
          />
        </Field>
        <Field
          label="Amount"
          hint={
            wallet.address && token ? (
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => spendable !== undefined && setAmountText(formatPlain(spendable, token.decimals))}
              >
                Balance {formatTokenAmount(balance, token.decimals)} {token.symbol}
              </button>
            ) : undefined
          }
        >
          <Input
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Amount in ${token?.symbol ?? 'tokens'}`}
            className="h-24 px-5 text-5xl font-semibold tabular-nums"
            value={amountText}
            disabled={busy}
            onChange={e => {
              setAmountText(e.target.value);
              if (flow.state.step === 'done' || flow.state.step === 'error') flow.reset();
            }}
          />
        </Field>

        {quote.error !== undefined && quote.error !== null && quote.hasPayload && (
          <div className="flex items-center justify-between gap-2 text-sm text-destructive">
            <span>{errorMessage(quote.error, 'Quote failed')}</span>
            <Button size="sm" variant="ghost" onClick={() => quote.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!wallet.isConnected ? (
          <Button size="lg" onClick={wallet.connect}>
            Connect wallet
          </Button>
        ) : wallet.isWrongChain ? (
          <Button size="lg" onClick={wallet.switchChain}>
            Switch to {chainName(srcChain)}
          </Button>
        ) : (
          <Button
            size="lg"
            disabled={busy || !quote.minimum || quote.isFetching || overBalance || !amount}
            onClick={submit}
          >
            {overBalance
              ? 'Not enough balance'
              : busy
                ? 'Depositing…'
                : `Deposit ${amountText || ''} ${token?.symbol ?? ''}`.trim()}
          </Button>
        )}

        {showFlow && (
          <FlowSteps
            state={flow.state}
            chainKey={srcChain}
            needsApproval={flow.state.step === 'approving' || !!flow.state.approveTxHash}
            doneLabel={`Shares received: ${formatTokenAmount(holdings.total, SHARE_DECIMALS)} ${vault.name}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

function _quoteValue(hasPayload: boolean, fetching: boolean, value: bigint | undefined, unit: string) {
  if (!hasPayload) return '–';
  if (fetching && value === undefined) return 'Quoting…';
  return value !== undefined ? `${formatTokenAmount(value, SHARE_DECIMALS)} ${unit}` : '–';
}

function formatPlain(amount: bigint, decimals: number): string {
  return formatTokenAmount(amount, decimals, decimals).replace(/,/g, '');
}

function keyFor(_chain: SourceChainKey, token: XToken): string {
  return token.symbol === 'USDC' || token.symbol === 'USDC.e' ? 'USDC' : token.symbol;
}
