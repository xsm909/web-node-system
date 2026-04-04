import { memo, useLayoutEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { AppPortal } from '../portal';
import { Icon } from '../icon';

interface AppValueTooltipProps {
    value: any;
    type: string;
    anchorRect: DOMRect | null;
}

/** Icon mapping for types (shared with wrapper for consistency) */
const TYPE_ICONS: Record<string, string> = {
    hint: 'lightbulb_circle',
    sql: 'database',
    python: 'function',
    markdown: 'article',
    array: 'lists',
    object: 'schema',
};

const TYPE_COLORS: Record<string, string> = {
    hint: 'border-amber-500/30 text-amber-500',
    sql: 'border-emerald-500/30 text-emerald-500',
    python: 'border-blue-500/30 text-blue-500',
    array: 'border-indigo-500/30 text-indigo-500',
    object: 'border-purple-500/30 text-purple-500',
    markdown: 'border-brand/30 text-brand',
};

/**
 * Premium, glassmorphic tooltip for displaying full data previews.
 * Supports Markdown rendering and multi-line code formatting.
 * 
 * Uses a portal to ensure it renders above and outside any clipping containers.
 */
export const AppValueTooltip = memo(({ value, type, anchorRect }: AppValueTooltipProps) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        if (!anchorRect || !tooltipRef.current) return;

        const gap = 12;
        const tt = tooltipRef.current.getBoundingClientRect();
        
        // Ensure tt has dimensions before calculating
        if (tt.width === 0) return;

        let top = anchorRect.top - tt.height - gap;
        let left = anchorRect.left + (anchorRect.width / 2) - (tt.width / 2);

        // Flip to bottom if no space at top
        if (top < gap) {
            top = anchorRect.bottom + gap;
        }

        // Boundary checks (left/right)
        if (left < gap) left = gap;
        if (left + tt.width > window.innerWidth - gap) {
            left = window.innerWidth - tt.width - gap;
        }

        setCoords({ top, left });
    }, [anchorRect, value]);

    if (!anchorRect) return null;

    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const isMd = type === 'hint' || type === 'markdown';
    const isCode = type === 'sql' || type === 'python' || type === 'array' || type === 'object';

    return (
        <AppPortal>
            <div 
                ref={tooltipRef}
                style={{
                    top: coords?.top ?? -9999,
                    left: coords?.left ?? -9999,
                }}
                className="fixed z-[9999] pointer-events-none transition-none"
            >
                <div 
                    className={`
                        max-w-[450px] max-h-[350px] overflow-auto no-scrollbar
                        bg-surface-800 border-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] 
                        rounded-2xl p-0 select-text pointer-events-auto
                        ${TYPE_COLORS[type] || TYPE_COLORS.markdown}
                        ${coords ? 'opacity-100' : 'opacity-0'}
                    `}
                >
                    {/* Premium Header */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-inherit/20 bg-white/5">
                        <Icon name={TYPE_ICONS[type] || 'article'} size={14} className="opacity-70" />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                            {type === 'hint' ? 'Documentation' : type}
                        </span>
                    </div>

                    <div className="p-4">
                        {isMd ? (
                            <div 
                                className="markdown-content text-[13px] leading-relaxed select-text" 
                                dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }} 
                            />
                        ) : (
                            <pre className={`
                                text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words select-text
                                ${isCode ? 'text-brand' : 'text-[var(--text-main)]'}
                            `}>
                                {content}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </AppPortal>
    );
});
