import React, { useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { buildCategoryTree } from '../../../shared/lib/categoryUtils';
import { SelectionList, type SelectionGroup, type SelectionItem } from '../../../shared/ui/selection-list';

interface AddNodeMenuProps {
    clientX: number;
    clientY: number;
    nodeTypes: NodeType[];
    onAddNode: (type: NodeType) => void;
    onCancel: () => void;
}

// ─── Main AddNodeMenu ─────────────────────────────────────────────────────────

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ clientX, clientY, nodeTypes, onAddNode, onCancel }) => {

    const categoryTree = useMemo(() => buildCategoryTree(nodeTypes), [nodeTypes]);

    const selectionData = useMemo(() => {
        const transform = (node: any): Record<string, SelectionGroup> => {
            const data: Record<string, SelectionGroup> = {};

            // Add sub-categories
            Object.entries(node.children || {}).forEach(([key, child]: [string, any]) => {
                data[child.name] = {
                    id: key,
                    name: child.name,
                    selectable: false,
                    icon: 'folder',
                    items: child.nodes.map((nt: NodeType) => ({
                        id: nt.id,
                        name: nt.name,
                        description: nt.description,
                        parentId: key,
                        selectable: true,
                        icon: nt.icon || 'task'
                    })),
                    children: transform(child)
                };
            });

            return data;
        };

        const rootData = transform(categoryTree);

        // If there are nodes in the root (uncategorized), add them in a special group
        if (categoryTree && categoryTree.nodes && categoryTree.nodes.length > 0) {
            rootData['General'] = {
                id: 'root-nodes',
                name: 'General',
                selectable: false,
                icon: 'category',
                items: categoryTree.nodes.map(nt => ({
                    id: nt.id,
                    name: nt.name,
                    description: nt.description,
                    parentId: 'root-nodes',
                    selectable: true,
                    icon: nt.icon || 'task'
                })),
                children: {}
            };
        }

        return rootData;
    }, [categoryTree]);

    const handleSelect = (item: SelectionItem) => {
        const nodeType = nodeTypes.find(nt => nt.id === item.id);
        if (nodeType) {
            onAddNode(nodeType);
            onCancel();
        }
    };

    return (
        <SelectionList
            data={selectionData}
            onSelect={handleSelect}
            onClose={onCancel}
            searchPlaceholder="Search node..."
            config={{}} // No CRUD actions for add node menu
            position={{ x: clientX, y: clientY }}
        />
    );
};
