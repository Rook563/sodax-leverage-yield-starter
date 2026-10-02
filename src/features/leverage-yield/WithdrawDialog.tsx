import type { LeverageYieldVault, SpokeChainKey, XToken } from '@sodax/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_SLIPPAGE_BPS, DEFAULT_TOKEN_KEY, getTokenByKey, type SourceChainKey } from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { HUB_CHAIN, useShareHoldings, useVaultQuote, useVaultWithdraw } from './hooks';
import { errorMessage, SHARE_DECIMALS } from './lib';
import { ChainSelect, Field, FlowSteps, Row, TokenSelect } from './parts';

export function WithdrawDialog({
  vault,
  open,
  onOpenChange,
}: {
  vault: LeverageYieldVault;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const probe = useEvmWallet();
  const holdings = useShareHoldings(vault, probe.address);
  const funded = holdings.rows.filter(r => r.shares > 0n);
  const [holdingChain, setHoldingChain] = useState<SpokeChainKey | undefined>();
  const holding = funded.find(r => r.chainKey === holdingChain) ?? funded[0];
  const srcChain = (holding?.chainKey ?? HUB_CHAIN) as SourceChainKey;
  const wallet = useEvmWallet(srcChain);

  const [dstChain, setDstChain] = useState<SourceChainKey>(srcChain);
  const [token, setToken] = useState<XToken | undefined>(() => getTokenByKey(srcChain, DEFAULT_TOKEN_KEY));
  const [amountText, setAmountText] = useState('');
  const flow = useVaultWithdraw();
  const busy = ['signing', 'processing'].includes(flow.state.step);

  useEffect(() => {
    if (!open) {
      setAmountText('');
      flow.reset();
    }
  }, [open, flow.reset]);

  const shares = parseTokenAmount(amountText, SHARE_DECIMALS);
  const overBalance = shares !== undefined && holding !== undefined && shares > holding.shares;
  const quote = useVaultQuote({
    srcChainKey: HUB_CHAIN,
    srcToken: vault.vault,
    dstChainKey: dstChain,
    dstToken: token?.address,
    amount: overBalance ? undefined : shares,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
  });

  const submit = () => {
    if (!wallet.address || !wallet.walletProvider || !token || !shares || !quote.minimum) return;
    flow.withdraw({
      vault,
      srcChainKey: srcChain,
      srcAddress: wallet.address,
      dstChainKey: dstChain,
      token,
      shares,
      minOutput: quote.minimum,
      walletProvider: wallet.walletProvider,
    });
  };

  const fmtOut = (v: bigint | undefined) =>
    token && v !== undefined ? `${formatTokenAmount(v, token.decimals)} ${token.symbol}` : '–';

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from {vault.name}</DialogTitle>
          <DialogDescription>Swap your vault shares back to a token on the network you choose.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {funded.length > 1 && (
            <Field label="Shares held via">
              <Select value={holding?.chainKey} onValueChange={v => setHoldingChain(v as SpokeChainKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {funded.map(r => (
                    <SelectItem key={r.chainKey} value={r.chainKey}>
                      {chainName(r.chainKey)} · {formatTokenAmount(r.shares, SHARE_DECIMALS)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field
            label="Shares"
            hint={
              holding && (
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() =>
                    setAmountText(formatTokenAmount(holding.shares, SHARE_DECIMALS, SHARE_DECIMALS).replace(/,/g, ''))
                  }
                >
                  Max {formatTokenAmount(holding.shares, SHARE_DECIMALS)}
                </button>
              )
            }
          >
            <Input
              inputMode="decimal"
              placeholder="0.0"
              value={amountText}
              disabled={busy}
              onChange={e => setAmountText(e.target.value)}
            />
          </Field>
          <Field label={`To ${chainName(dstChain)}`}>
            <ChainSelect
              value={dstChain}
              onChange={chain => {
                setDstChain(chain);
                setToken(getTokenByKey(chain, DEFAULT_TOKEN_KEY));
              }}
            />
          </Field>
          <Field label="Token">
            <TokenSelect chainKey={dstChain} value={token} onChange={setToken} />
          </Field>
          <div className="flex flex-col gap-2 rounded-md border bg-secondary p-3">
            <Row label="You receive (est.)" strong value={quote.hasPayload ? fmtOut(quote.quoted) : '–'} />
            <Row
              label={`Minimum (${formatBps(DEFAULT_SLIPPAGE_BPS)} slippage)`}
              value={quote.hasPayload ? fmtOut(quote.minimum) : '–'}
            />
            {quote.error != null && quote.hasPayload && (
              <span className="text-sm text-destructive">{errorMessage(quote.error, 'Quote failed')}</span>
            )}
          </div>
          {wallet.isWrongChain ? (
            <Button size="lg" onClick={wallet.switchChain}>
              Switch to {chainName(srcChain)}
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={busy || overBalance || !shares || !quote.minimum || quote.isFetching}
              onClick={submit}
            >
              {overBalance ? 'More than you hold' : busy ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          )}
          {flow.state.step !== 'idle' && (
            <FlowSteps
              state={flow.state}
              chainKey={srcChain}
              needsApproval={false}
              doneLabel={`Sent to your wallet on ${chainName(dstChain)}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
