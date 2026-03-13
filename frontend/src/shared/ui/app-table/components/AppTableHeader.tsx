import { Icon } from '../../icon';
import type { AppTableConfig } from '../types';

interface AppTableHeaderProps<TData> {
    config: AppTableConfig<TData>;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export function AppTableHeader<TData>({
    config,
    searchQuery,
    onSearchChange,
}: AppTableHeaderProps<TData>) {
    return (
        <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-6 flex-1 pr-12">
                <div className="flex flex-col min-w-0">
                    <h2 className="text-xl font-bold tracking-tight whitespace-nowrap text-[var(--text-main)] flex items-center gap-2">
                        {config.icon && <Icon name={config.icon} size={20} className="text-brand" />}
                        {config.title}
                    </h2>
                    {config.subtitle && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            {config.subtitle}
                        </p>
                    )}
                </div>
                
                <div className="relative flex-1 max-w-lg ml-auto">
                    <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                    <input
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder={config.searchPlaceholder || "Search..."}
                        className="w-full bg-surface-800 border border-[var(--border-base)] rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition-all shadow-inner"
                    />
                </div>
            </div>
            {config.primaryAction && (
                <button
                    onClick={config.primaryAction.onClick}
                    disabled={config.primaryAction.disabled}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Icon name={config.primaryAction.icon} size={18} />
                    {config.primaryAction.label}
                </button>
            )}
        </div>
    );
}
