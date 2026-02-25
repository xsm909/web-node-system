import { useState } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';

export function useNodeTypeManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<NodeType | null>(null);
    const [formData, setFormData] = useState<Partial<NodeType>>({});

    const handleOpenModal = (node?: NodeType) => {
        if (node) {
            setEditingNode(node);
            setFormData(node);
        } else {
            setEditingNode(null);
            setFormData({
                name: '',
                version: '1.0',
                description: '',
                code: 'def run(inputs, params):\n    return {}',
                input_schema: {},
                output_schema: {},
                parameters: [],
                category: '',
                icon: 'task',
                is_async: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent, onSuccess?: () => void) => {
        e.preventDefault();
        try {
            if (editingNode) {
                await apiClient.put(`/admin/node-types/${editingNode.id}`, formData);
            } else {
                await apiClient.post('/admin/node-types', formData);
            }
            setIsModalOpen(false);
            if (onSuccess) onSuccess();
        } catch {
            alert('Failed to save node type');
        }
    };

    return {
        isModalOpen,
        setIsModalOpen,
        editingNode,
        formData,
        setFormData,
        handleOpenModal,
        handleSave
    };
}
