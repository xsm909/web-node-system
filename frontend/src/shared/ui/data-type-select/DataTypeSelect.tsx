import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ComboBox } from '../combo-box/ComboBox';
import type { SelectionGroup } from '../selection-list/SelectionList';

export interface DataType {
    id: number;
    type: string;
    config?: any;
    [key: string]: any;
}

interface DataTypeSelectProps {
    value?: string;
    onChange: (value: string, dataType?: DataType) => void;
    categoryFilter?: string | string[];
    valueProp?: 'id' | 'type'; // 'id' for ClientMetadata, 'type' for AITask
    placeholder?: string;
    className?: string;
    dataTypes?: DataType[]; // optional, if provided it won't fetch
    disabled?: boolean;
}

export const DataTypeSelect: React.FC<DataTypeSelectProps> = ({
    value,
    onChange,
    categoryFilter,
    valueProp = 'type',
    placeholder = 'Select data type...',
    className = '',
    dataTypes: externalDataTypes,
    disabled = false,
}) => {
    const { data: fetchedDataTypes = [], isLoading } = useQuery({
        queryKey: ['data-types', 'all'],
        queryFn: async () => {
            const response = await apiClient.get<DataType[]>('/data-types/');
            return response.data;
        },
        enabled: !externalDataTypes
    });

    const allDataTypes = externalDataTypes || fetchedDataTypes;

    const dataTypes = useMemo(() => {
        if (!categoryFilter) return allDataTypes;
        const filters = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        return allDataTypes.filter(dt => filters.includes(dt.category));
    }, [allDataTypes, categoryFilter]);

    const categoryData: Record<string, SelectionGroup> = useMemo(() => {
        const map: Record<string, SelectionGroup> = {};

        dataTypes.forEach(dt => {
            const idVal = valueProp === 'id' ? String(dt.id) : dt.type;
            const label = dt.config?.Caption || dt.config?.caption || dt.type;
            map[label] = {
                id: idVal,
                name: label,
                icon: dt.config?.icon || 'category',
                selectable: true,
                items: [],
                children: {}
            };
        });

        return map;
    }, [dataTypes, valueProp]);

    const getLabel = (val?: string) => {
        if (!val) return '';
        const dt = dataTypes.find(d => (valueProp === 'id' ? String(d.id) === val : d.type === val));
        return dt ? (dt.config?.Caption || dt.config?.caption || dt.type) : val;
    };

    const getIcon = (val?: string) => {
        if (!val) return undefined;
        const dt = dataTypes.find(d => (valueProp === 'id' ? String(d.id) === val : d.type === val));
        return dt?.config?.icon || 'category';
    };

    const handleSelect = (itemId: string) => {
        const dt = dataTypes.find(d => (valueProp === 'id' ? String(d.id) === itemId : d.type === itemId));
        onChange(itemId, dt);
    };

    return (
        <ComboBox
            value={value}
            label={getLabel(value) || (isLoading && !externalDataTypes ? 'Loading...' : value)}
            icon={getIcon(value)}
            placeholder={placeholder}
            data={categoryData}
            onSelect={(item) => handleSelect(item.id)}
            className={className}
            disabled={disabled}
        />
    );
};
