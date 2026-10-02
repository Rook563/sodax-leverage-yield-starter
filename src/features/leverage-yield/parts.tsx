import type { SpokeChainKey, XToken } from '@sodax/types';
import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, Loader2Icon, XCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Callout } from '@/components/ui/callout';
import { getDepositTokens, SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName, explorerTxUrl } from '@/lib/chains';
import { cn } from '@/lib/utils';
import type { FlowState } from './hooks';
import { errorMessage } from './lib';

export function Field({ label, children, hint }: { label?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {(label || hint) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function ChainSelect({ value, onChange }: { value: SourceChainKey; onChange: (chain: SourceChainKey) => void }) {
  return (
    <fieldset aria-label="Network" className="-m-1.5 flex flex-wrap">
      {SOURCE_CHAINS.map(chain => {
        const active = chain === value;
        const logo = chainLogo(chain);
        return (
          <button
            key={chain}
            type="button"
            aria-pressed={active}
            aria-label={chainName(chain)}
            title={chainName(chain)}
            onClick={() => onChange(chain)}
            className="group p-1.5 focus-visible:outline-none"
          >
            <span
              className={cn(
                'flex size-16 items-center justify-center rounded-2xl border-2 border-foreground transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring',
                active ? 'bg-foreground' : 'border-dashed bg-card group-hover:border-solid',
              )}
            >
              {logo ? (
                <img src={logo} alt="" className={cn('size-7 rounded-md grayscale', active && 'invert')} />
              ) : (
                <span className={cn('text-xs font-semibold', active && 'text-background')}>{chainName(chain)}</span>
              )}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

export function TokenSelect({
  chainKey,
  value,
  onChange,
}: {
  chainKey: SpokeChainKey;
  value: XToken | undefined;
  onChange: (token: XToken) => void;
}) {
  const tokens = getDepositTokens(chainKey);
  return (
    <fieldset aria-label="Token" className="-m-1.5 flex flex-wrap">
      {tokens.map(token => {
        const active = token.address === value?.address;
        return (
          <button
            key={token.address}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(token)}
            className="group p-1.5 focus-visible:outline-none"
          >
            <span
              className={cn(
                'flex size-16 items-center justify-center rounded-full border-2 border-foreground text-xs font-semibold transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring',
                active
                  ? 'bg-foreground text-background'
                  : 'border-dashed bg-card text-foreground group-hover:border-solid',
              )}
            >
              {token.symbol}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right tabular-nums', strong && 'font-semibold')}>{value}</span>
    </div>
  );
}

export function TxLink({ chainKey, hash, label }: { chainKey: SpokeChainKey; hash: string; label: string }) {
  const url = explorerTxUrl(chainKey, hash);
  if (!url) return <span className="font-mono text-xs">{hash.slice(0, 10)}…</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {label}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

type StepDef = { key: string; label: string; detail?: ReactNode };

export function FlowSteps({
  state,
  chainKey,
  needsApproval,
  doneLabel,
}: {
  state: FlowState;
  chainKey: SpokeChainKey;
  needsApproval: boolean;
  doneLabel: string;
}) {
  const steps: StepDef[] = [
    ...(needsApproval
      ? [
          {
            key: 'approving',
            label: 'Approve token',
            detail: state.approveTxHash && (
              <TxLink chainKey={chainKey} hash={state.approveTxHash} label="Approval tx" />
            ),
          },
        ]
      : []),
    { key: 'signing', label: 'Sign in your wallet' },
    {
      key: 'processing',
      label: 'Delivering to Sonic and solver fill',
      detail: state.srcTxHash && <TxLink chainKey={chainKey} hash={state.srcTxHash} label="Source tx" />,
    },
    { key: 'done', label: doneLabel },
  ];
  const order = steps.map(s => s.key);
  const failedAt = state.step === 'error' ? lastReached(state) : undefined;
  const current = state.step === 'error' ? failedAt : state.step;
  const currentIndex = current ? order.indexOf(current) : -1;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const done = state.step === 'done' || index < currentIndex;
          const active = index === currentIndex && state.step !== 'done';
          const failed = active && state.step === 'error';
          return (
            <li key={step.key} className="flex items-start gap-2.5 text-sm">
              {failed ? (
                <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : done ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
              ) : active ? (
                <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className={cn(!done && !active && 'text-muted-foreground')}>{step.label}</span>
                {step.detail}
              </div>
            </li>
          );
        })}
      </ol>
      {state.step === 'error' && (
        <Callout variant="destructive">{errorMessage(state.error, 'Transaction failed')}</Callout>
      )}
    </div>
  );
}

function lastReached(state: FlowState): string {
  if (state.srcTxHash) return 'processing';
  if (state.approveTxHash) return 'approving';
  return 'signing';
}
