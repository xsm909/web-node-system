import { useState } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';

export function useNodeTypeManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<NodeType | null>(null);

    const handleOpenModal = (node?: NodeType) => {
        if (node) {
            setEditingNode(node);
        } else {
            setEditingNode(null);
        }
        setIsModalOpen(true);
    };

    const handleSave = async (data: Partial<NodeType>, nodeId?: string, onSuccess?: () => void) => {
        try {
            if (nodeId) {
                await apiClient.put(`/admin/node-types/${nodeId}`, data);
            } else {
                await apiClient.post('/admin/node-types', data);
            }
            setIsModalOpen(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error('Failed to save node type:', error);
            const message = error.response?.data?.detail || 'Failed to save node type';
            alert(typeof message === 'string' ? message : JSON.stringify(message));
        }
    };

    const handleDuplicateNode = (_node: NodeType) => {
        setEditingNode(null);
        setIsModalOpen(true);
    };

    return {
        isModalOpen,
        setIsModalOpen,
        editingNode,
        handleOpenModal,
        handleDuplicateNode,
        handleSave
    };
}
