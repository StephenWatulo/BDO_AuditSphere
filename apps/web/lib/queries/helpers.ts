'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/lib/api';

/** Shows an error toast unless the error is a workflow guard failure (handled by dialogs). */
export function toastApiError(e: unknown, fallback?: string) {
  if (isApiError(e) && e.isGuardFailure) return;
  toast.error(errorMessage(e, fallback));
}

interface ApiMutationOptions<TData, TVariables> {
  /** Query keys to invalidate on success. Prefix matching applies. */
  invalidate?: QueryKey[] | ((data: TData, variables: TVariables) => QueryKey[]);
  /** Success toast message. */
  success?: string | ((data: TData, variables: TVariables) => string | undefined);
  /** Suppress the automatic error toast. */
  silent?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: unknown, variables: TVariables) => void;
}

export function useApiMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: ApiMutationOptions<TData, TVariables> = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVariables>({
    mutationFn,
    onSuccess: async (data, variables) => {
      const keys = typeof options.invalidate === 'function' ? options.invalidate(data, variables) : options.invalidate;
      if (keys?.length) await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
      const msg = typeof options.success === 'function' ? options.success(data, variables) : options.success;
      if (msg) toast.success(msg);
      await options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (!options.silent) toastApiError(error);
      options.onError?.(error, variables);
    },
  });
}

export function compactParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
