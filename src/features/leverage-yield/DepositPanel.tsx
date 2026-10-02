import type { LeverageYieldVault, XToken } from '@sodax/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
        <Field label={`From ${chainName(srcChain)}`}>
          <ChainSelect value={srcChain} onChange={changeChain} />
        </Field>
        <Field>
          <TokenSelect
            chainKey={srcChain}
            value={token}
            onChange={t => {
              setToken(t);
              flow.reset();
            }}
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field>
              <div className="group/amount relative">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Amount in ${token?.symbol ?? 'tokens'}`}
                  className="h-24 pr-28 pb-6 pl-5 text-5xl font-semibold tabular-nums"
                  value={amountText}
                  disabled={busy}
                  onChange={e => {
                    setAmountText(e.target.value);
                    if (flow.state.step === 'done' || flow.state.step === 'error') flow.reset();
                  }}
                />
                {wallet.address && token && (
                  <>
                    <span className="pointer-events-none absolute bottom-3 left-5 text-sm text-muted-foreground">
                      Balance {formatTokenAmount(balance, token.decimals)} {token.symbol}
                    </span>
                    <div className="absolute inset-y-0 right-4 flex items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !spendable}
                        onClick={() => spendable !== undefined && setAmountText(formatPlain(spendable, token.decimals))}
                        className="transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/amount:opacity-100 pointer-fine:group-hover/amount:opacity-100"
                      >
                        Max
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Field>
          </div>
          {!wallet.isConnected ? (
            <Button size="lg" className="h-24 shrink-0 px-8 sm:w-80" onClick={wallet.connect}>
              Connect wallet
            </Button>
          ) : wallet.isWrongChain ? (
            <Button size="lg" className="h-24 shrink-0 px-8 sm:w-80" onClick={wallet.switchChain}>
              Switch to {chainName(srcChain)}
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-24 shrink-0 px-8 sm:w-80"
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
        </div>

        {quote.error !== undefined && quote.error !== null && quote.hasPayload && (
          <div className="flex items-center justify-between gap-2 text-sm text-destructive">
            <span>{errorMessage(quote.error, 'Quote failed')}</span>
            <Button size="sm" variant="ghost" onClick={() => quote.refetch()}>
              Retry
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {quote.quoted !== undefined && quote.minimum !== undefined
            ? `You get ~${formatTokenAmount(quote.quoted, SHARE_DECIMALS, 2)} ${vault.name}, at least ${formatTokenAmount(quote.minimum, SHARE_DECIMALS, 2)}. `
            : quote.hasPayload
              ? 'Getting a quote… '
              : ''}
          Leveraged vault: APR can turn negative and the share price can fall.
        </p>

        <Dialog open={showFlow} onOpenChange={open => !open && !busy && flow.reset()}>
          <DialogContent
            onInteractOutside={e => busy && e.preventDefault()}
            onEscapeKeyDown={e => busy && e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>
                Depositing {amountText} {token?.symbol} into {vault.name}
              </DialogTitle>
              <DialogDescription>Keep this open until the shares arrive, usually under 2 minutes.</DialogDescription>
            </DialogHeader>
            <FlowSteps
              state={flow.state}
              chainKey={srcChain}
              needsApproval={flow.state.step === 'approving' || !!flow.state.approveTxHash}
              doneLabel={
                flow.state.step === 'done'
                  ? `Shares received. You now hold ${formatTokenAmount(holdings.total, SHARE_DECIMALS)} ${vault.name}`
                  : 'Shares arrive in your hub wallet'
              }
            />
            {(flow.state.step === 'done' || flow.state.step === 'error') && (
              <Button onClick={flow.reset}>{flow.state.step === 'done' ? 'Done' : 'Close'}</Button>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function formatPlain(amount: bigint, decimals: number): string {
  return formatTokenAmount(amount, decimals, decimals).replace(/,/g, '');
}

function keyFor(_chain: SourceChainKey, token: XToken): string {
  return token.symbol === 'USDC' || token.symbol === 'USDC.e' ? 'USDC' : token.symbol;
}
