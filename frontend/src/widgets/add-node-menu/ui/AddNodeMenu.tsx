import React, { useMemo, useEffect, useRef } from 'react';
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
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const categoryTree = useMemo(() => buildCategoryTree(nodeTypes), [nodeTypes]);

    const selectionData = useMemo(() => {
        const transform = (tree: CategoryTree): Record<string, SelectionGroup> => {
            const data: Record<string, SelectionGroup> = {};
            Object.entries(tree).forEach(([label, node]) => {
                data[label] = {
                    id: label,
                    name: label,
                    items: node.nodes.map(nt => ({
                        id: nt.id,
                        name: nt.name,
                        description: nt.description,
                        parentId: label
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
        <>
            {/* Click-outside overlay */}
            <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={onCancel}
                onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
            />

            <div
                className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
                style={{ left: clientX, top: clientY }}
            >
                <SelectionList
                    data={selectionData}
                    onSelect={handleSelect}
                    searchPlaceholder="Search node..."
                    config={{}} // No CRUD actions for add node menu
                />
            </div>
        </>
    );
};
