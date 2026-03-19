import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { DbColumn, DbForeignKey, DbFunction } from '../model/types';

export const useDatabaseMetadata = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTables = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get<string[]>('/database-metadata/tables');
            setTables(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch tables');
        } finally {
            setLoading(false);
        }
    };

    const getColumns = async (tableName: string): Promise<DbColumn[]> => {
        try {
            const { data } = await apiClient.get<DbColumn[]>(`/database-metadata/tables/${tableName}/columns`);
            return data;
        } catch (err) {
            console.error(`Failed to fetch columns for ${tableName}`, err);
            return [];
        }
    };

    const getForeignKeys = async (tableName: string): Promise<DbForeignKey[]> => {
        try {
            const { data } = await apiClient.get<DbForeignKey[]>(`/database-metadata/tables/${tableName}/foreign-keys`);
            return data;
        } catch (err) {
            console.error(`Failed to fetch foreign keys for ${tableName}`, err);
            return [];
        }
    };

    const getFunctions = async (): Promise<DbFunction[]> => {
        try {
            const { data } = await apiClient.get<DbFunction[]>('/database-metadata/functions');
            return data;
        } catch (err) {
            console.error('Failed to fetch functions', err);
            return [];
        }
    };

    useEffect(() => {
        fetchTables();
    }, []);

    return {
        tables,
        loading,
        error,
        fetchTables,
        getColumns,
        getForeignKeys,
        getFunctions
    };
};
