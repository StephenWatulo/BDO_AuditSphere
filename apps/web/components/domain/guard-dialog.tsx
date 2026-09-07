'use client';

import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, ShieldAlert, X } from 'lucide-react';
import { availableActions, type StateMachine, type Transition } from '@auditsphere/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCan } from '@/lib/auth';
import { isApiError, type GuardResult } from '@/lib/api';
import { guardLabel } from '@/lib/labels';
import type { AvailableAction, GuardCheck } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Shows failed workflow guards returned by the API (422) or pre-computed by the server. */
export function GuardFailureDialog({
  open,
  onOpenChange,
  actionLabel,
  guards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel?: string;
  guards: (GuardResult | GuardCheck)[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" />
            {actionLabel ? `Cannot ${actionLabel.toLowerCase()}` : 'Action blocked'}
          </DialogTitle>
          <DialogDescription>The following conditions must be met before this action can proceed.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-2">
            {guards.map((g, i) => {
              const passed = 'passed' in g ? g.passed : 'ok' in g ? g.ok : false;
              return (
                <li key={`${g.guard}-${i}`} className="flex items-start gap-2 text-sm">
                  {passed ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className={cn('font-medium', !passed && 'text-destructive')}>{guardLabel(g.guard)}</p>
                    {g.message && g.message !== g.guard ? (
                      <p className="text-xs text-muted-foreground">{g.message}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResolvedAction<S extends string> {
  transition: Transition<S>;
  server?: AvailableAction;
  allowed: boolean;
  failedGuards: GuardCheck[];
}

/**
 * Workflow action buttons driven by the shared state machine, the current user's
 * permissions and (when present) guard results supplied by the API.
 */
export function WorkflowActions<S extends string>({
  machine,
  state,
  serverActions,
  onTransition,
  isPending,
  primaryFirst = true,
  className,
  size = 'default',
  requireComment,
  disabled,
}: {
  machine: StateMachine<S>;
  state: S;
  serverActions?: AvailableAction[];
  onTransition: (action: string, comment?: string) => Promise<unknown>;
  isPending?: boolean;
  primaryFirst?: boolean;
  className?: string;
  size?: 'default' | 'sm';
  /** Actions that should always prompt for a comment. */
  requireComment?: string[];
  disabled?: boolean;
}) {
  const can = useCan();
  const [guardDialog, setGuardDialog] = React.useState<{ label: string; guards: (GuardResult | GuardCheck)[] } | null>(null);
  const [commentDialog, setCommentDialog] = React.useState<ResolvedAction<S> | null>(null);
  const [comment, setComment] = React.useState('');

  const actions = React.useMemo<ResolvedAction<S>[]>(() => {
    return availableActions(machine, state)
      .filter((t) => can(t.permission))
      .map((t) => {
        const server = serverActions?.find((a) => a.action === t.action);
        const failed = (server?.guards ?? []).filter((g) => g.passed === false || g.ok === false);
        const allowed = server ? server.allowed !== false && failed.length === 0 : true;
        return { transition: t, server, allowed, failedGuards: failed };
      });
  }, [machine, state, can, serverActions]);

  if (actions.length === 0) return null;

  const run = async (a: ResolvedAction<S>, c?: string) => {
    if (!a.allowed && a.failedGuards.length) {
      setGuardDialog({ label: a.transition.label, guards: a.failedGuards });
      return;
    }
    try {
      await onTransition(a.transition.action, c);
      setCommentDialog(null);
      setComment('');
    } catch (e) {
      if (isApiError(e) && e.isGuardFailure) {
        setGuardDialog({ label: a.transition.label, guards: e.guards ?? [] });
      }
    }
  };

  const handle = (a: ResolvedAction<S>) => {
    const needsComment =
      requireComment?.includes(a.transition.action) ||
      /return|reject|cancel|reopen|unlock|accept_risk/.test(a.transition.action);
    if (needsComment) {
      setCommentDialog(a);
      return;
    }
    void run(a);
  };

  const [primary, ...rest] = primaryFirst ? actions : [];
  const overflow = primaryFirst ? rest : actions;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {primary ? (
        <Button
          size={size}
          onClick={() => handle(primary)}
          loading={isPending}
          disabled={disabled}
          variant={primary.allowed ? 'default' : 'outline'}
          title={primary.allowed ? undefined : 'Some conditions are not met - click to see details'}
        >
          {!primary.allowed ? <AlertTriangle className="text-warning" /> : null}
          {primary.transition.label}
        </Button>
      ) : null}
      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={size} disabled={disabled || isPending} aria-label="More actions">
              More <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Workflow actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {overflow.map((a) => (
              <DropdownMenuItem key={a.transition.action} onSelect={() => handle(a)}>
                {!a.allowed ? <AlertTriangle className="!text-warning" /> : null}
                {a.transition.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <GuardFailureDialog
        open={!!guardDialog}
        onOpenChange={(o) => !o && setGuardDialog(null)}
        actionLabel={guardDialog?.label}
        guards={guardDialog?.guards ?? []}
      />

      <Dialog open={!!commentDialog} onOpenChange={(o) => !o && setCommentDialog(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{commentDialog?.transition.label}</DialogTitle>
            <DialogDescription>Add a comment for the audit trail. It will be visible in the history.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Label htmlFor="wf-comment">Comment</Label>
            <Textarea
              id="wf-comment"
              className="mt-1.5"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason or context…"
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialog(null)}>
              Cancel
            </Button>
            <Button loading={isPending} onClick={() => commentDialog && void run(commentDialog, comment || undefined)}>
              {commentDialog?.transition.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
