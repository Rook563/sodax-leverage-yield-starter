import { useState } from 'react';
import { NextPrompt } from '@/components/workshop/NextPrompt';
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

  if (!vault) return null;

  return (
    <div className="flex flex-col gap-6">
      <NextPrompt next="done" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Vaults</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {vaults.map(v => (
              <VaultCard
                key={v.name}
                vault={v}
                address={address}
                selected={v.name === vault.name}
                onDeposit={() => {
                  setVaultName(v.name);
                  document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onWithdraw={() => setWithdrawName(v.name)}
              />
            ))}
          </div>
        </section>
        <div className="lg:sticky lg:top-6">
          <DepositPanel
            vaults={vaults}
            vault={vault}
            onVaultChange={v => setVaultName(v.name)}
            srcChain={srcChain}
            onSrcChainChange={setSrcChain}
          />
        </div>
      </div>
      {withdrawVault && (
        <WithdrawDialog vault={withdrawVault} open onOpenChange={open => !open && setWithdrawName(undefined)} />
      )}
    </div>
  );
}
