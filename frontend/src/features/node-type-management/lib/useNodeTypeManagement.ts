import { useState, useMemo } from 'react';
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

    const handleSave = async (data: Partial<NodeType>, nodeId?: string, onSuccess?: (saved: NodeType) => void) => {
        try {
            let savedNode: NodeType;
            if (nodeId) {
                const res = await apiClient.put<NodeType>(`/admin/node-types/${nodeId}`, data);
                savedNode = res.data;
            } else {
                const res = await apiClient.post<NodeType>('/admin/node-types', data);
                savedNode = res.data;
            }
            if (onSuccess) onSuccess(savedNode);
            return savedNode;
        } catch (error: any) {
            console.error('Failed to save node type:', error);
            const message = error.response?.data?.detail || 'Failed to save node type';
            alert(typeof message === 'string' ? message : JSON.stringify(message));
            throw error;
        }
    };

    const handleDuplicateNode = (_node: NodeType) => {
        setEditingNode(null);
        setIsModalOpen(true);
    };

    return useMemo(() => ({
        isModalOpen,
        setIsModalOpen,
        editingNode,
        handleOpenModal,
        handleDuplicateNode,
        handleSave
    }), [isModalOpen, setIsModalOpen, editingNode]);
}
