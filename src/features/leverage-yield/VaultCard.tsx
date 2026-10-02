import {
  useLeverageYieldEffectiveApr,
  useLeverageYieldPosition,
  useLeverageYieldPreviewRedeem,
  useLeverageYieldTotalAssets,
} from '@sodax/dapp-kit';
import type { LeverageYieldVault } from '@sodax/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRayPercent, formatTokenAmount, formatWad, ONE_SHARE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useShareHoldings } from './hooks';
import { SHARE_DECIMALS, underlying } from './lib';
import { Row } from './parts';

const MAX_UINT = 2n ** 256n - 1n;
const WAD = 10n ** 18n;

export function VaultCard({
  vault,
  address,
  selected,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  selected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const asset = underlying(vault);
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault.vault } });
  const tvl = useLeverageYieldTotalAssets({ params: { vault: vault.vault } });
  const position = useLeverageYieldPosition({ params: { vault: vault.vault } });
  const sharePrice = useLeverageYieldPreviewRedeem({ params: { vault: vault.vault, shares: ONE_SHARE } });
  const holdings = useShareHoldings(vault, address);

  const p = position.data;
  const equity = p ? p.collateral - p.debt : 0n;
  const leverageWad = p && equity > 0n ? (p.collateral * WAD) / equity : undefined;
  const health = p ? (p.healthFactor >= MAX_UINT / 2n ? '∞' : formatWad(p.healthFactor)) : undefined;
  const aprValue = apr.data?.effectiveNetAprRay;

  return (
    <Card className={cn('flex flex-col transition-shadow', selected && 'ring-2 ring-primary')}>
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{vault.name}</CardTitle>
          {apr.data?.lsdApr.stale && <Badge variant="outline">APR estimate</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Leveraged {asset.symbol}
          {vault.lsdSource?.label ? ` · ${vault.lsdSource.label}` : ''}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Net APR</div>
          {apr.isLoading ? (
            <Skeleton className="mt-1 h-9 w-28" />
          ) : (
            <div
              className={cn(
                'text-3xl font-semibold tabular-nums',
                aprValue !== undefined && aprValue < 0n && 'text-destructive',
              )}
            >
              {formatRayPercent(aprValue)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Row
            label="TVL"
            value={tvl.data !== undefined ? `${formatTokenAmount(tvl.data, asset.decimals, 2)} ${asset.symbol}` : '–'}
          />
          <Row
            label="Share price"
            value={
              sharePrice.data !== undefined
                ? `${formatTokenAmount(sharePrice.data, asset.decimals, 4)} ${asset.symbol}`
                : '–'
            }
          />
          <Row label="Leverage" value={leverageWad !== undefined ? `${formatWad(leverageWad)}×` : '–'} />
          <Row label="Health factor" value={health ?? '–'} />
        </div>
        <div className="rounded-md bg-secondary px-3 py-2.5">
          <Row
            label="Your shares"
            strong
            value={
              address
                ? holdings.isLoading
                  ? '…'
                  : formatTokenAmount(holdings.total, SHARE_DECIMALS)
                : 'Connect wallet'
            }
          />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button className="flex-1" onClick={onDeposit}>
          Deposit
        </Button>
        <Button className="flex-1" variant="outline" onClick={onWithdraw} disabled={holdings.total === 0n}>
          Withdraw
        </Button>
      </CardFooter>
    </Card>
  );
}
