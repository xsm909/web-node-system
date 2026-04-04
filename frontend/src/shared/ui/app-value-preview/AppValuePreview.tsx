import { memo } from 'react';
import { resolveValuePreview } from './ValuePreview.lib';
import { AppPreviewWrapper } from './AppPreviewWrapper';

/**
 * Props for AppValuePreview
 */
interface AppValuePreviewProps {
    /** The value to display in preview mode */
    value: any;
    /** The name of the parameter (for logic-based type detection) */
    parameterName?: string;
    /** Optional CSS classes */
    className?: string;
}

/**
 * AppValuePreview
 * 
 * Orchestrates the display of values by resolving their preview string
 * and wrapping them in the premium { ... } gadget if they are complex.
 */
export const AppValuePreview = memo(({ value, parameterName, className = '' }: AppValuePreviewProps) => {
    if (value === null || value === undefined) return null;

    const { display, isComplex, type } = resolveValuePreview(value, parameterName);

    // Full value tooltip
    const titleValue = typeof value === 'string' 
        ? value 
        : JSON.stringify(value, null, 2);

    return (
        <div 
            className={`flex items-center min-w-0 whitespace-nowrap overflow-hidden ${className}`} 
            title={titleValue}
            style={{
                animation: 'fade-in 0.2s ease-out forwards'
            }}
        >
            {isComplex ? (
                <AppPreviewWrapper type={type}>
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
