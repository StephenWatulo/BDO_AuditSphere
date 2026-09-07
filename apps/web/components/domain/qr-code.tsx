'use client';

import * as React from 'react';
import { encodeQr, qrToSvgPath, type Ecl } from '@/lib/qr';
import { cn } from '@/lib/utils';

export function QrCode({
  value,
  size = 192,
  ecl = 'M',
  className,
  label = 'QR code',
}: {
  value: string;
  size?: number;
  ecl?: Ecl;
  className?: string;
  label?: string;
}) {
  const matrix = React.useMemo(() => {
    try {
      return encodeQr(value, ecl);
    } catch {
      return null;
    }
  }, [value, ecl]);

  if (!matrix) {
    return (
      <div className={cn('flex items-center justify-center rounded-md border border-border bg-muted text-xs', className)} style={{ width: size, height: size }}>
        Unable to render QR
      </div>
    );
  }
  const quiet = 4;
  const dim = matrix.size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      className={cn('rounded-md bg-white', className)}
      shapeRendering="crispEdges"
    >
      <rect width={dim} height={dim} fill="#fff" />
      <path transform={`translate(${quiet} ${quiet})`} d={qrToSvgPath(matrix)} fill="#000" />
    </svg>
  );
}
