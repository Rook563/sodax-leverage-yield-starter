import { CheckIcon, CopyIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LiveBuilds } from './LiveBuilds';
import { bonusPrompt, type Milestone, milestonePrompt, oneShotPrompt } from './prompts';

const code = 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs';

/** The guide on GitHub (main; the checkpoints carry the same file), so participants can open it from the app. */
const WORKSHOP_URL = 'https://github.com/gosodax/sodax-leverage-yield-starter/blob/main/docs/WORKSHOP.md';

function WorkshopLink({ section }: { section?: string }) {
  return (
    <a
      href={section ? `${WORKSHOP_URL}#${section}` : WORKSHOP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      <code className={code}>docs/WORKSHOP.md</code>
    </a>
  );
}

type Mode = 'one-shot' | 'steps';

/**
 * Workshop helper: the prompt to paste into your coding agent next, straight from docs/WORKSHOP.md §3.
 * `next={1}` on main, `next={2}` on checkpoint/m1 … `next="done"` on checkpoint/m4. Not rendered on `solution`.
 * On main it offers two ways in: the one-shot prompt (the default, for capable agents) or Milestone 1.
 * Also links the live builds still ahead: every checkpoint and the solution on main, only the solution after M4.
 */
export function NextPrompt({ next }: { next: Milestone | 'done' }) {
  const oneShot = next === 1 ? oneShotPrompt() : undefined;
  const [mode, setMode] = useState<Mode>(oneShot ? 'one-shot' : 'steps');
  const showOneShot = oneShot !== undefined && mode === 'one-shot';

  const step = showOneShot ? oneShot : next === 'done' ? bonusPrompt() : milestonePrompt(next);
  const eyebrow = showOneShot
    ? 'Start here · the whole app'
    : next === 'done'
      ? 'All four milestones built'
      : next === 1
        ? 'Start here · 1 of 4'
        : `Next · ${next} of 4`;
  const title = !step ? 'Open the workshop guide' : showOneShot ? step.title : `${step.label}: ${step.title}`;

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <TerminalIcon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {showOneShot ? (
              'For a capable coding agent (Claude Opus 5.5, Codex Sol 6 or similar): one prompt builds the whole feature. Prefer to go step by step, or using a lighter model? Switch to milestones.'
            ) : next === 'done' ? (
              <>
                Compare yours with the <code className={code}>solution</code> branch (vault list + modal, SDK/API
                toggle), or rebrand it: fill in the two placeholders, then paste.
              </>
            ) : (
              'Paste this into your coding agent. Only M1 links the SODAX guide, so keep M2–M4 in the same session (or give a new one the guide link again).'
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {oneShot && <ModeToggle mode={mode} onChange={setMode} />}
        {step ? (
          <PromptBox prompt={step.prompt} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Open <WorkshopLink section="3-prompts" /> and give your agent the next prompt from §3.
          </p>
        )}
        {step?.check && (
          <p className="text-sm">
            <span className="font-semibold">Check:</span> {step.check}
          </p>
        )}
        <LiveBuilds from={next === 'done' ? 5 : next} />
        <p className="text-xs text-subtle-foreground">
          From <WorkshopLink />.{next !== 'done' && ' Your agent moves this card on when a milestone is done.'}
        </p>
      </CardContent>
    </Card>
  );
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'one-shot', label: 'All at once' },
  { value: 'steps', label: 'Milestone by milestone' },
];

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <fieldset className="flex w-fit gap-1 rounded-full border bg-muted p-1">
      <legend className="sr-only">How to build it</legend>
      {MODES.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition-colors',
            mode === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function PromptBox({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative rounded-md border bg-muted p-4 sm:pr-28">
      <p className="font-mono text-xs leading-relaxed">{prompt}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 sm:absolute sm:top-3 sm:right-3 sm:mt-0"
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
