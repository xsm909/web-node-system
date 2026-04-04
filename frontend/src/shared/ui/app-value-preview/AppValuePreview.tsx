import { memo } from 'react';

/**
 * Props for AppValuePreview
 */
interface AppValuePreviewProps {
    /** The value to display in preview mode */
    value: any;
    /** Optional CSS classes */
    className?: string;
    /** Optional suffix (e.g. for key name in context) */
    label?: string;
}

/**
 * AppValuePreview
 * 
 * Provides a compact, visually rich preview for complex data types.
 * instead of full editors or [object Object] strings, it shows:
 * - { select... } for SQL
 * - { # title... } for Markdown
 * - { def... } for Python
 * - [ 5 items ] for Arrays
 * - { object } for Objects
 */
export const AppValuePreview = memo(({ value, className = '' }: AppValuePreviewProps) => {
    if (value === null || value === undefined) return null;

    // Detection logic for complex strings
    const isSql = (val: string) => /^(SELECT|UPDATE|INSERT|WITH|DELETE|CREATE|ALTER|DROP|FROM)\b/i.test(val.trim());
    const isPython = (val: string) => /^(import|from|def|class|if|for|while|@)\b/.test(val.trim());
    const isMarkdown = (val: string) => val.trim().startsWith('#') || val.trim().startsWith('>') || val.trim().startsWith('- ');
    
    const formatValue = () => {
        // Handle Strings (SQL, MD, Python, etc.)
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return '';
            
            const lines = value.split('\n').filter(l => l.trim().length > 0);
            const firstLine = lines.length > 0 ? lines[0].trim() : '';
            
            // Any multi-line, special syntax, or long text is considered "complex"
            const isComplex = isSql(trimmed) || isPython(trimmed) || isMarkdown(trimmed) || lines.length > 1 || trimmed.length > 12;

            if (isComplex) {
                // Shorten first line for preview
                let previewText = firstLine;
                if (previewText.length > 30) {
                    previewText = previewText.substring(0, 27) + '...';
                }

                return (
                    <span className="flex items-center gap-1 min-w-0 font-mono text-[10px]">
                        <span className="text-brand opacity-60 font-bold select-none">{'{'}</span>
                        <span className="italic truncate" style={{ color: 'var(--color-brand)', opacity: 0.9 }}>
                            {previewText}
                            {(lines.length > 1 || (firstLine.length < trimmed.length && !firstLine.endsWith('...'))) && '...'}
                        </span>
                        <span className="text-brand opacity-60 font-bold select-none">{'}'}</span>
                    </span>
                );
            }

            // Simple short string
            return <span className="text-[10px] text-[var(--text-main)] truncate">{firstLine}</span>;
        }

        // Handle Arrays / Tables
        if (Array.isArray(value)) {
            const count = value.length;
            return (
                <span className="flex items-center gap-1 min-w-0 font-mono text-[10px]">
                    <span className="text-brand opacity-60 font-bold select-none">{'{'}</span>
                    <span className="italic truncate" style={{ color: 'var(--color-brand)', opacity: 0.9 }}>
                        {count === 0 ? 'empty table' : count === 1 ? '1 item' : `${count} items`}
                    </span>
                    <span className="text-brand opacity-60 font-bold select-none">{'}'}</span>
                </span>
            );
        }

        // Handle Objects
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            return (
                <span className="flex items-center gap-1 min-w-0 font-mono text-[10px]">
                    <span className="text-brand opacity-60 font-bold select-none">{'{'}</span>
                    <span className="italic truncate" style={{ color: 'var(--color-brand)', opacity: 0.9 }}>
                        {keys.length === 0 ? 'empty' : 'object'}
                    </span>
                    <span className="text-brand opacity-60 font-bold select-none">{'}'}</span>
                </span>
            );
        }

        // Primitives
        return <span className="text-[10px] text-[var(--text-main)]">{String(value)}</span>;
    };

    const titleValue = typeof value === 'string' 
        ? value 
        : JSON.stringify(value, null, 2);

    return (
        <div 
            className={`flex items-center min-w-0 whitespace-nowrap overflow-hidden ${className}`} 
            title={titleValue}
        >
            {formatValue()}
        </div>
    );
});
