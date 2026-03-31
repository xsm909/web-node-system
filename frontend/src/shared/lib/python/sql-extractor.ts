/**
 * Utility to extract SQL strings from Python code at a given cursor position.
 * Supports both triple-quoted and single-quoted strings.
 */

export interface SqlMatch {
    content: string;
    from: number;
    to: number;
    quoteLength: number;
    fullMatch: string;
}

export function findSqlAtPosition(doc: string, pos: number): SqlMatch | null {
    // Search for triple quotes first (more specific), then regular quotes
    const tripleQuoteRegex = /([\w\d_]+\s*=\s*)?("""[\s\S]*?"""|'''[\s\S]*?''')/g;
    const singleQuoteRegex = /([\w\d_]+\s*=\s*)?("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/g;

    let match;
    let foundMatch = null;

    // Try triple quotes
    while ((match = tripleQuoteRegex.exec(doc)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (pos >= start && pos <= end) {
            foundMatch = match;
            break;
        }
    }

    // Try single quotes if not found in triple quotes
    if (!foundMatch) {
        singleQuoteRegex.lastIndex = 0;
        while ((match = singleQuoteRegex.exec(doc)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (pos >= start && pos <= end) {
                foundMatch = match;
                break;
            }
        }
    }

    if (foundMatch) {
        const assignmentPart = foundMatch[1] || "";
        const stringPart = foundMatch[2];
        
        let content = "";
        let quoteLength = 0;
        if (stringPart.startsWith('"""') || stringPart.startsWith("'''")) {
            content = stringPart.slice(3, -3);
            quoteLength = 3;
        } else {
            content = stringPart.slice(1, -1);
            quoteLength = 1;
        }

        const stringStartPos = foundMatch.index + assignmentPart.length;
        
        return {
            content: content.trim(),
            from: stringStartPos + quoteLength,
            to: stringStartPos + stringPart.length - quoteLength,
            quoteLength: quoteLength,
            fullMatch: foundMatch[0]
        };
    }

    return null;
}
