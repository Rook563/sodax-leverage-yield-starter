import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SOURCE_CHAIN, DEFAULT_VAULT_NAME, type SourceChainKey } from '@/config/workshop';
import { useEvmWallet } from '@/wallet';
import { DepositPanel } from './DepositPanel';
import { useVaults } from './hooks';
import { VaultCard } from './VaultCard';
import { WithdrawDialog } from './WithdrawDialog';

export function LeverageYieldPage() {
  const vaults = useVaults();
  const { address } = useEvmWallet();
  const [vaultName, setVaultName] = useState(DEFAULT_VAULT_NAME);
  const [srcChain, setSrcChain] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [withdrawName, setWithdrawName] = useState<string | undefined>();
  const vault = vaults.find(v => v.name === vaultName) ?? vaults[0];
  const withdrawVault = vaults.find(v => v.name === withdrawName);

  const ordered = useMemo(() => (vault ? [vault, ...vaults.filter(v => v !== vault)] : vaults), [vault, vaults]);
  const sliderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (vaultName) sliderRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [vaultName]);

  if (!vault) return null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Vaults</h2>
        <div
          ref={sliderRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-2 pb-3 sm:-mx-6 sm:px-6"
        >
          {ordered.map(v => (
            <VaultCard
              key={v.name}
              vault={v}
              address={address}
              selected={v.name === vault.name}
              onSelect={() => setVaultName(v.name)}
              onDeposit={() => {
                setVaultName(v.name);
                document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onWithdraw={() => setWithdrawName(v.name)}
            />
          ))}
        </div>
      </section>
      <div className="w-full">
        <DepositPanel vault={vault} srcChain={srcChain} onSrcChainChange={setSrcChain} />
      </div>
      {withdrawVault && (
        <WithdrawDialog vault={withdrawVault} open onOpenChange={open => !open && setWithdrawName(undefined)} />
      )}
    </div>
  );
}
