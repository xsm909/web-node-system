import { memo } from 'react';
import { resolveValuePreview } from './ValuePreview.lib';
import { AppPreviewWrapper } from './AppPreviewWrapper';

/**
 * Props for AppValuePreview
 */
interface AppValuePreviewProps {
    /** The value to display in preview mode */
    value: any;
    /** Optional CSS classes */
    className?: string;
}

/**
 * AppValuePreview
 * 
 * Orchestrates the display of values by resolving their preview string
 * and wrapping them in the premium { ... } gadget if they are complex.
 */
export const AppValuePreview = memo(({ value, className = '' }: AppValuePreviewProps) => {
    if (value === null || value === undefined) return null;

    const { display, isComplex } = resolveValuePreview(value);

    // Full value tooltip
    const titleValue = typeof value === 'string' 
        ? value 
        : JSON.stringify(value, null, 2);

    return (
        <div 
            className={`flex items-center min-w-0 whitespace-nowrap overflow-hidden ${className}`} 
            title={titleValue}
        >
            {isComplex ? (
                <AppPreviewWrapper>
                    {display}
                </AppPreviewWrapper>
            ) : (
                <span className="text-[10px] text-[var(--text-main)] truncate">
                    {display}
                </span>
            )}
        </div>
    );
});
