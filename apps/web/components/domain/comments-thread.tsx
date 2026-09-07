'use client';

import * as React from 'react';
import { Lock, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/avatar';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useAddComment, useComments } from '@/lib/queries/collaboration';
import { useCurrentUser } from '@/lib/auth';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export function CommentsThread({
  targetType,
  targetId,
  className,
  allowInternalToggle = true,
}: {
  targetType: string;
  targetId: string;
  className?: string;
  allowInternalToggle?: boolean;
}) {
  const { user } = useCurrentUser();
  const { data, isLoading, error, refetch } = useComments(targetType, targetId);
  const add = useAddComment();
  const [body, setBody] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(true);

  const submit = async () => {
    if (!body.trim()) return;
    await add.mutateAsync({ targetType, targetId, body: body.trim(), isInternal });
    setBody('');
  };

  const comments = React.useMemo(
    () => [...(data ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [data],
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="space-y-3">
        {isLoading ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : comments.length === 0 ? (
          <EmptyState compact icon={<MessageSquare />} title="No comments yet" description="Start the conversation below." />
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <UserAvatar name={c.author?.displayName} src={c.author?.avatarUrl} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold">{c.author?.displayName ?? 'Unknown'}</span>
                  <span className="text-muted-foreground">{fmtRelative(c.createdAt)}</span>
                  {c.isInternal ? (
                    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                      <Lock className="size-3" /> Internal
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2.5">
        <UserAvatar name={user?.displayName} src={user?.avatarUrl} size="sm" className="mt-0.5" />
        <div className="flex-1 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment… (Ctrl+Enter to send)"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit();
            }}
            aria-label="New comment"
          />
          <div className="flex items-center justify-between gap-2">
            {allowInternalToggle ? (
              <div className="flex items-center gap-2">
                <Switch id={`internal-${targetId}`} checked={isInternal} onCheckedChange={setIsInternal} />
                <Label htmlFor={`internal-${targetId}`} className="text-xs font-normal text-muted-foreground">
                  Internal only (hidden from business users)
                </Label>
              </div>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={submit} loading={add.isPending} disabled={!body.trim()}>
              <Send /> Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
