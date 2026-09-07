'use client';

import * as React from 'react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Open search and command palette' },
      { keys: ['>'], label: 'Command mode inside the palette' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close dialogs and panels' },
    ],
  },
  {
    title: 'Navigate',
    items: [
      { keys: ['g', 'h'], label: 'Home' },
      { keys: ['g', 'e'], label: 'Engagements' },
      { keys: ['g', 'f'], label: 'Findings' },
      { keys: ['g', 'u'], label: 'Audit universe' },
      { keys: ['g', 'r'], label: 'Risks' },
      { keys: ['g', 'p'], label: 'Plans' },
      { keys: ['g', 'q'], label: 'Document requests' },
      { keys: ['g', 't'], label: 'My tasks' },
    ],
  },
  {
    title: 'Create',
    items: [
      { keys: ['n', 'f'], label: 'New finding' },
      { keys: ['n', 'e'], label: 'New engagement' },
    ],
  },
];

export function ShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Sequences are typed one key after another (for example g then e).</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {g.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && s.keys[0] === 'Ctrl' ? <span className="text-2xs text-muted-foreground">+</span> : null}
                          <kbd className="kbd">{k}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
