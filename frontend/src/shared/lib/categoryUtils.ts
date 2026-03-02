import type { NodeType } from '../../entities/node-type/model/types';

export interface CategoryTreeNode {
    nodes: NodeType[];
    children: Record<string, CategoryTreeNode>;
}

export type CategoryTree = Record<string, CategoryTreeNode>;

function makeEmptyNode(): CategoryTreeNode {
    return { nodes: [], children: {} };
}

/**
 * Builds a recursive tree from a flat list of NodeType objects.
 * Category paths use '|' as the separator (e.g. "AI|Chat|Gemini").
 */
export function buildCategoryTree(nodes: NodeType[]): CategoryTree {
    const root: CategoryTree = {};

    for (const node of nodes) {
        const parts = (node.category || 'Uncategorized').split('|').map(p => p.trim()).filter(Boolean);
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current[part]) current[part] = makeEmptyNode();
            if (i === parts.length - 1) {
                current[part].nodes.push(node);
            } else {
                current = current[part].children;
            }
        }
    }

    return root;
}

/**
 * Returns a sorted array of unique full category paths from a list of nodes.
 */
export function getUniqueCategoryPaths(nodes: NodeType[]): string[] {
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
