import React, { useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { buildCategoryTree, type CategoryTree } from '../../../shared/lib/categoryUtils';
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
        const transform = (tree: CategoryTree): Record<string, SelectionGroup> => {
            const data: Record<string, SelectionGroup> = {};
            Object.entries(tree).forEach(([label, node]) => {
                data[label] = {
                    id: label,
                    name: label,
                    selectable: false, // Groups are not selectable in add node menu
                    icon: 'folder',
                    items: node.nodes.map(nt => ({
                        id: nt.id,
                        name: nt.name,
                        description: nt.description,
                        parentId: label,
                        selectable: true,
                        icon: nt.icon || 'task'
                    })),
                    children: transform(node.children)
                };
            });
            return data;
        };
        return transform(categoryTree);
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
