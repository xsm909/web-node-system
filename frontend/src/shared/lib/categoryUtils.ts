export interface CategoryTreeNode<T> {
    name: string; // The display name for this category
    nodes: T[];
    children: Record<string, CategoryTreeNode<T>>;
}

export type CategoryTree<T> = Record<string, CategoryTreeNode<T>>;

function makeEmptyNode<T>(name: string = ''): CategoryTreeNode<T> {
    return { name, nodes: [], children: {} };
}

/**
 * Builds a recursive tree from a flat list of objects with a 'category' property.
 * Category paths use '|' as the separator (e.g. "AI|Chat|Gemini").
 * Returns a single root node containing all schemas and sub-categories.
 */
export function buildCategoryTree<T extends { category?: string | null, key: string, content?: any }>(nodes: T[]): CategoryTreeNode<T> {
    const root = makeEmptyNode<T>('Uncategorized');

    // First pass: build the tree structure
    for (const node of nodes) {
        const categoryStr = (node.category || '').trim();
        if (!categoryStr) {
            root.nodes.push(node);
            continue;
        }

        const parts = categoryStr.split('|').map(p => p.trim()).filter(Boolean);
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partKey = part.toLowerCase();

            if (!current.children[partKey]) {
                current.children[partKey] = makeEmptyNode<T>(part);
            }

            if (i === parts.length - 1) {
                current.children[partKey].nodes.push(node);
            } else {
                current = current.children[partKey];
            }
        }
    }

    // Second pass: recursive sort
    const sortNode = (node: CategoryTreeNode<T>) => {
        // Sort schemas within this node
        node.nodes.sort((a, b) => {
            const titleA = (a.content?.title || a.key).toLowerCase();
            const titleB = (b.content?.title || b.key).toLowerCase();
            return titleA.localeCompare(titleB);
        });

        // Sort sub-categories by name and recurse
        const sortedChildren: Record<string, CategoryTreeNode<T>> = {};
        const sortedKeys = Object.keys(node.children).sort((a, b) => a.localeCompare(b));

        for (const key of sortedKeys) {
            sortNode(node.children[key]);
            sortedChildren[key] = node.children[key];
        }
        node.children = sortedChildren;
    };

    sortNode(root);
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
