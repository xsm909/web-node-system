export interface CategoryTreeNode<T> {
    nodes: T[];
    children: Record<string, CategoryTreeNode<T>>;
}

export type CategoryTree<T> = Record<string, CategoryTreeNode<T>>;

function makeEmptyNode<T>(): CategoryTreeNode<T> {
    return { nodes: [], children: {} };
}

/**
 * Builds a recursive tree from a flat list of objects with a 'category' property.
 * Category paths use '|' as the separator (e.g. "AI|Chat|Gemini").
 */
export function buildCategoryTree<T extends { category?: string | null }>(nodes: T[]): CategoryTree<T> {
    const root: CategoryTree<T> = {};

    for (const node of nodes) {
        const parts = (node.category || 'Uncategorized').split('|').map(p => p.trim()).filter(Boolean);
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // If we're at a leaf node and the path is finished
            if (i === parts.length - 1) {
                if (!current[part]) current[part] = makeEmptyNode<T>();
                current[part].nodes.push(node);
            } else {
                if (!current[part]) current[part] = makeEmptyNode<T>();
                current = current[part].children;
            }
        }
    }

    return root;
}

/**
 * Returns a sorted array of unique full category paths from a list of objects with a 'category' property.
 */
export function getUniqueCategoryPaths<T extends { category?: string | null }>(nodes: T[]): string[] {
    const paths = new Set<string>();
    for (const node of nodes) {
        if (node.category) {
            // Also add all ancestor paths so the combo-box offers them
            const parts = node.category.split('|').map(p => p.trim()).filter(Boolean);
            for (let i = 1; i <= parts.length; i++) {
                paths.add(parts.slice(0, i).join('|'));
            }
        }
    }
    return Array.from(paths).sort();
}
