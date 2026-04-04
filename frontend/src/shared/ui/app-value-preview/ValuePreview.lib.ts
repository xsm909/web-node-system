/**
 * ValuePreview Detection and Formatting Logic
 * 
 * Separates business rules from visual representation.
 */

/**
 * Detects if a string is likely SQL.
 */
export const isSql = (val: string): boolean => 
    /^(SELECT|UPDATE|INSERT|WITH|DELETE|CREATE|ALTER|DROP|FROM)\b/i.test(val.trim());

/**
 * Detects if a string is likely Python code.
 */
export const isPython = (val: string): boolean => 
    /^(import|from|def|class|if|for|while|@)\b/.test(val.trim());

/**
 * Detects if a string is likely Markdown.
 */
export const isMarkdown = (val: string): boolean => {
    const trimmed = val.trim();
    return trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('- ');
};

export type ValuePreviewType = 'sql' | 'python' | 'markdown' | 'array' | 'object' | 'primitive' | 'hint';

export interface PreviewResult {
    display: string;
    isComplex: boolean;
    type: ValuePreviewType;
}

/**
 * Resolves the preview content and complexity flag for any value.
 * Used to determine the visual gadget state.
 */
export const resolveValuePreview = (value: any, keyName?: string): PreviewResult => {
    if (value === null || value === undefined) return { display: '', isComplex: false, type: 'primitive' };

    // Handle Strings (SQL, MD, Python, etc.)
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return { display: '', isComplex: false, type: 'primitive' };
        
        const lines = value.split('\n').filter(l => l.trim().length > 0);
        const firstLine = lines.length > 0 ? lines[0].trim() : '';
        
        // Rules for complexity (visual wrapping in gadgets)
        const isS = isSql(trimmed);
        const isPy = isPython(trimmed);
        const isMd = isMarkdown(trimmed);
        const isH = (keyName?.toUpperCase().includes('HINT')) || (isMd && trimmed.length > 5);

        const isComplex = isS || isPy || isMd || isH || lines.length > 1 || trimmed.length > 12;
        const type: ValuePreviewType = isH ? 'hint' : isS ? 'sql' : isPy ? 'python' : isMd ? 'markdown' : 'primitive';

        let display = firstLine;
        
        // For hints, let's strip the Markdown symbols for the preview to make it "cleaner"
        if (type === 'hint') {
            display = display.replace(/^#+\s*/, '').replace(/^>\s*/, '').replace(/^-\s*/, '').trim();
        }

        // Apply length constraints for the preview "gadget"
        const maxLength = isComplex ? 30 : 40;
        if (display.length > maxLength) {
            display = display.substring(0, maxLength - 3) + '...';
        }

        // Add visual hint for multi-line or truncated content
        const hasExtraContent = lines.length > 1 || (firstLine.length < trimmed.length && !display.endsWith('...'));
        if (isComplex && hasExtraContent) {
            display = display.endsWith('...') ? display : `${display}...`;
        }

        return { display, isComplex, type };
    }

    // Handle Arrays / Tables
    if (Array.isArray(value)) {
        const count = value.length;
        const display = count === 0 ? 'empty table' : count === 1 ? '1 item' : `${count} items`;
        return { display, isComplex: true, type: 'array' };
    }

    // Handle Objects
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        const display = keys.length === 0 ? 'empty' : 'object';
        const type: ValuePreviewType = (keys.includes('tool') || keys.includes('type')) ? 'object' : 'object';
        return { display, isComplex: true, type };
    }

    // Primitives (Numbers, Booleans)
    return { display: String(value), isComplex: false, type: 'primitive' };
};
