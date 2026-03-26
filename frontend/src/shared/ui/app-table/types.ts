import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

export interface AppTableAction {
    icon: string;
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
}

export interface AppTableConfig<TData> {
    // Categorization config
    // If provided, the table will group items by this string path (e.g. "Category|Subcategory")
    categoryExtractor?: (item: TData) => string | null | undefined;
    persistCategoryKey?: string; // Cookie key to persist expanded categories
    
    // Empty state
    emptyMessage?: ReactNode;
    
    // Styling
    // Optional property to get the row icon and styling. Useful for specific modules
    getRowConfig?: (item: TData) => {
        icon?: string;
        iconClassName?: string;
        title?: ReactNode;
        subtitle?: ReactNode;
    };
    
    rowClassName?: (item: TData) => string;
    indentColumnId?: string;

    // Drag and drop reordering inside a category
    onReorder?: (item: TData, newOrder: TData[]) => void;

    // Layout options
    layout?: 'auto' | 'fixed' | 'compact'; 
}

export interface AppTableProps<TData> {
    data: TData[];
    columns: ColumnDef<TData, any>[];
    config: AppTableConfig<TData>;
    
    isLoading?: boolean;
    onRowClick?: (row: TData) => void;
    
    // isSearching flag tells the component to flatten the tree
    isSearching?: boolean;
}
