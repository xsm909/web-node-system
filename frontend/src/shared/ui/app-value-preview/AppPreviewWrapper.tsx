import { memo, type ReactNode } from 'react';

/**
 * Visual gadget container with curly braces for complex data.
 * Purely responsible for the "Premium" look.
 */
export const AppPreviewWrapper = memo(({ children }: { children: ReactNode }) => (
    <span className="flex items-center gap-1 min-w-0 font-mono text-[10px]">
        <span className="text-brand opacity-60 font-bold select-none">{'{'}</span>
        <span className="italic truncate" style={{ color: 'var(--color-brand)', opacity: 0.9 }}>
            {children}
        </span>
        <span className="text-brand opacity-60 font-bold select-none">{'}'}</span>
    </span>
));
