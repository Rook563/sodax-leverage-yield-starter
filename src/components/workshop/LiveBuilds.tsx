import { ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIVE_BUILDS } from './builds';

/** Links to the hosted builds from milestone `from` on (5 = only the solution), so you can see what comes next. */
export function LiveBuilds({ from }: { from: number }) {
  const builds = LIVE_BUILDS.filter(build => build.milestone >= from);
  if (builds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">See it live:</span>
      <ul className="flex flex-wrap gap-2">
        {builds.map(build => {
          const final = build.branch === 'solution';
          return (
            <li key={build.branch}>
              <a
                href={build.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Branch ${build.branch}`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  final
                    ? 'border-primary bg-primary text-primary-foreground hover:bg-primary'
                    : 'bg-card text-foreground hover:bg-muted',
                )}
              >
                {build.label}
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
