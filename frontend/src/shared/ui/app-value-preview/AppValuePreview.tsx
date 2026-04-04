import { memo, useRef, useState } from 'react';
import { resolveValuePreview } from './ValuePreview.lib';
import { AppPreviewWrapper } from './AppPreviewWrapper';
import { AppValueTooltip } from './AppValueTooltip';

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
 * Also manages the high-fidelity hover tooltip for full content inspection.
 */
export const AppValuePreview = memo(({ value, parameterName, className = '' }: AppValuePreviewProps) => {
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<any>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (containerRef.current) {
            setAnchorRect(containerRef.current.getBoundingClientRect());
        }
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setAnchorRect(null);
    };

    if (value === null || value === undefined) return null;

    const { display, isComplex, type } = resolveValuePreview(value, parameterName);

    return (
        <div 
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title=""
            className={`flex items-center min-w-0 whitespace-nowrap overflow-hidden ${className}`} 
            style={{
                animation: 'fade-in 0.2s ease-out forwards'
            }}
        >
            {isComplex ? (
                <AppPreviewWrapper type={type}>
                    {display}
                </AppPreviewWrapper>
            ) : (
                <span className="text-[10px] text-[var(--text-main)] truncate" title="">
                    {display}
                </span>
            )}

            {anchorRect && (
                <AppValueTooltip 
                    value={value} 
                    type={type} 
                    anchorRect={anchorRect}
                />
            )}
        </div>
    );
});
