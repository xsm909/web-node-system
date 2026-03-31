import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import { useProjectStore } from '../../projects/store';
import type { NodeType } from '../../../entities/node-type/model/types';

export function useNodeTypeManagement() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<NodeType | null>(null);

    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);
    const effectiveProjectId = isProjectMode ? activeProject?.id : null;

    // 1. Fetch Node Types (Global Query)
    const { data: nodeTypes = [], isLoading } = useQuery({
        queryKey: ['node-types', isProjectMode, effectiveProjectId],
        queryFn: async () => {
            const res = await apiClient.get<NodeType[]>(`/workflows/node-types?t=${Date.now()}`);
            return res.data;
        }
    });

    const handleOpenModal = (node?: NodeType) => {
        if (node) {
            setEditingNode(node);
        } else {
            setEditingNode(null);
        }
        setIsModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async ({ data, id }: { data: Partial<NodeType>, id?: string }) => {
            if (id) {
                const res = await apiClient.put<NodeType>(`/admin/node-types/${id}`, data);
                return res.data;
            } else {
                const res = await apiClient.post<NodeType>('/admin/node-types', data);
                return res.data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['node-types'] });
            queryClient.invalidateQueries({ queryKey: ['workflows'] }); // Workflow list might depend on node types
        }
    });

    const handleSave = async (data: Partial<NodeType>, nodeId?: string, onSuccess?: (saved: NodeType) => void) => {
        const savedNode = await saveMutation.mutateAsync({ data, id: nodeId });
        if (onSuccess) onSuccess(savedNode);
        return savedNode;
    };

    const handleDuplicateNode = (_node: NodeType) => {
        setEditingNode(null);
        setIsModalOpen(true);
    };

    return useMemo(() => ({
        nodeTypes,
        isLoading,
        isModalOpen,
        setIsModalOpen,
        editingNode,
        handleOpenModal,
        handleDuplicateNode,
        handleSave,
        isSaving: saveMutation.isPending
    }), [nodeTypes, isLoading, isModalOpen, setIsModalOpen, editingNode, saveMutation]);
}
