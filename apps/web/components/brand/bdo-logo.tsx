import Image from 'next/image';
import { cn } from '@/lib/utils';

export function BdoLogo({ white = false, className }: { white?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-block w-[52px] shrink-0 overflow-hidden aspect-[945/364]', className)}>
      <Image
        src={white ? '/brand/bdo-white.png' : '/brand/bdo-color.png'}
        alt="BDO"
        width={1668}
        height={1084}
        unoptimized
        priority
        className="absolute left-[-38.2%] top-[-98.6%] h-auto w-[176.5%] max-w-none"
      />
    </span>
  );
}
