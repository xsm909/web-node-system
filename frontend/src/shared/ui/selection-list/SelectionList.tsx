import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon } from '../icon';

export type SelectionAction = 'add' | 'delete' | 'rename' | 'duplicate';

export interface SelectionItem {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
}

export interface SelectionGroup {
    id: string;
    name: string;
    items: SelectionItem[];
    children: Record<string, SelectionGroup>;
}

export interface SelectionListConfig {
    allowAdd?: boolean;
    allowDelete?: boolean;
    allowRename?: boolean;
    allowDuplicate?: boolean;
    groupActions?: SelectionAction[];
}

interface SelectionListProps {
    data: Record<string, SelectionGroup>;
    config?: SelectionListConfig;
    activeItemId?: string;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
    searchPlaceholder?: string;
}

// --- Recursive Panel ---
interface GroupPanelProps {
    groups: Record<string, SelectionGroup>;
    breadcrumb: string[];
    config: SelectionListConfig;
    activeDescendant: string[];
    onNavigate: (path: string[], top: number) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
}

const GroupPanel: React.FC<GroupPanelProps> = ({ groups, breadcrumb, config, activeDescendant, onNavigate, onAction }) => {
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="w-64 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 animate-in slide-in-from-left-2 duration-200">
            {breadcrumb.length > 0 && (
                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1 flex-wrap">
                    {breadcrumb.map((seg, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="opacity-50">›</span>}
                            <span>{seg}</span>
                        </React.Fragment>
                    ))}
                </div>
            )}
            <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                {entries.map(([label, group]) => {
                    const hasChildren = Object.keys(group.children).length > 0;
                    const fullPath = [...breadcrumb, label];
                    const isActive = activeDescendant[breadcrumb.length] === label;

                    return (
                        <div key={label} className="group/item relative">
                            <button
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const containerRect = e.currentTarget.closest('.selection-list-container')?.getBoundingClientRect();
                                    const top = rect.top - (containerRect?.top || 0);
                                    onNavigate(fullPath, top);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] ${isActive
                                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="truncate pr-8">{label}</span>
                                <div className="flex items-center gap-1">
                                    {isActive && config.groupActions?.map(action => (
                                        <button
                                            key={action}
                                            onClick={(e) => { e.stopPropagation(); onAction?.(action, group); }}
                                            className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                        >
                                            <Icon name={action === 'add' ? 'add' : action === 'delete' ? 'delete' : action === 'rename' ? 'edit' : 'content_copy'} size={12} />
                                        </button>
                                    ))}
                                    {hasChildren ? (
                                        <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
                                    ) : (
                                        <span className={`text-[9px] opacity-60 ${isActive ? 'opacity-80 text-white' : ''}`}>{group.items.length}</span>
                                    )}
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Item List Panel ---
interface ItemListPanelProps {
    items: SelectionItem[];
    breadcrumb: string[];
    config: SelectionListConfig;
    activeItemId?: string;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem) => void;
}

const ItemListPanel: React.FC<ItemListPanelProps> = ({ items, breadcrumb, config, activeItemId, onSelect, onAction }) => (
    <div className="w-64 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 animate-in slide-in-from-left-2 duration-200">
        <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1 flex-wrap">
            {breadcrumb.map((seg, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="opacity-50">›</span>}
                    <span>{seg}</span>
                </React.Fragment>
            ))}
        </div>
        <div className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
            {items.sort((a, b) => a.name.localeCompare(b.name)).map(item => {
                const isActive = item.id === activeItemId;
                return (
                    <div key={item.id} className="group/item relative">
                        <button
                            onClick={() => onSelect(item)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent flex flex-col justify-center min-h-[40px] ${isActive
                                ? 'bg-brand/10 border-brand/20 text-brand'
                                : 'text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 hover:border-brand/20'
                                }`}
                        >
                            <div className="flex justify-between items-center w-full">
                                <span className={`truncate ${isActive ? 'text-brand' : 'text-[var(--text-main)] group-hover/item:text-brand'}`}>{item.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    {config.allowRename && (
                                        <button onClick={(e) => { e.stopPropagation(); onAction?.('rename', item); }} className="p-1 hover:bg-brand/10 rounded-md"><Icon name="edit" size={12} /></button>
                                    )}
                                    {config.allowDuplicate && (
                                        <button onClick={(e) => { e.stopPropagation(); onAction?.('duplicate', item); }} className="p-1 hover:bg-brand/10 rounded-md"><Icon name="content_copy" size={12} /></button>
                                    )}
                                    {config.allowDelete && (
                                        <button onClick={(e) => { e.stopPropagation(); onAction?.('delete', item); }} className="p-1 hover:bg-red-500/10 text-red-500 rounded-md"><Icon name="delete" size={12} /></button>
                                    )}
                                </div>
                            </div>
                            {item.description && (
                                <div className="text-[10px] opacity-40 group-hover/item:opacity-60 font-mono mt-0.5 line-clamp-1">{item.description}</div>
                            )}
                        </button>
                    </div>
                );
            })}
        </div>
    </div>
);

// --- Main SelectionList ---
export const SelectionList: React.FC<SelectionListProps> = ({
    data,
    config = {},
    activeItemId,
    onSelect,
    onAction,
    searchPlaceholder = "Search..."
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredPath, setHoveredPath] = useState<string[]>([]);
    const [hoveredTops, setHoveredTops] = useState<number[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleNavigate = (path: string[], top: number) => {
        setHoveredPath(path);
        // depth is path.length. But we need to store top for each depth
        setHoveredTops(prev => {
            const next = [...prev];
            next[path.length - 1] = top;
            return next;
        });
    };

    const flatItems = useMemo(() => {
        const items: SelectionItem[] = [];
        const traverse = (groups: Record<string, SelectionGroup>) => {
            Object.values(groups).forEach(g => {
                items.push(...g.items);
                traverse(g.children);
            });
        };
        traverse(data);
        return items;
    }, [data]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return flatItems.filter(item =>
            item.name.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q)
        );
    }, [flatItems, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <div className="relative flex items-start h-full min-h-[400px] selection-list-container">
            {/* 
                Main container is relative. 
                Each panel will be positioned with a left offset based on its depth.
            */}
            <div
                className={`${isSearching ? 'w-80' : 'w-64'} bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 transition-all duration-300 z-[1]`}
            >
                <div className="px-1 pb-1 pt-1 relative">
                    <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                    <input
                        ref={inputRef}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full bg-[var(--bg-app)] text-xs text-[var(--text-main)] pl-8 pr-8 py-2.5 rounded-xl border border-[var(--border-base)] outline-none focus:border-brand/50 transition-colors shadow-inner"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 p-1">
                            <Icon name="close" size={12} />
                        </button>
                    )}
                </div>

                {!isSearching && (
                    <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1 relative">
                        {Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([label, group]) => {
                            const hasChildren = Object.keys(group.children).length > 0;
                            const isActive = hoveredPath[0] === label;
                            return (
                                <div key={label} className="group/item relative">
                                    <button
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const containerRect = e.currentTarget.closest('.selection-list-container')?.getBoundingClientRect();
                                            const top = rect.top - (containerRect?.top || 0);
                                            handleNavigate([label], top);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] ${isActive
                                            ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                            : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                            }`}
                                    >
                                        <span className="truncate pr-8">{label}</span>
                                        <div className="flex items-center gap-1">
                                            {isActive && config.groupActions?.map(action => (
                                                <button
                                                    key={action}
                                                    onClick={(e) => { e.stopPropagation(); onAction?.(action, group); }}
                                                    className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                                >
                                                    <Icon name={action === 'add' ? 'add' : action === 'delete' ? 'delete' : action === 'rename' ? 'edit' : 'content_copy'} size={12} />
                                                </button>
                                            ))}
                                            {hasChildren ? (
                                                <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
                                            ) : (
                                                <span className={`text-[9px] opacity-60 ${isActive ? 'opacity-80 text-white' : ''}`}>{group.items.length}</span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {isSearching && (
                    <div className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                        {searchResults.map(item => (
                            <button
                                key={item.id}
                                onClick={() => onSelect(item)}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all border border-transparent hover:border-brand/20 flex flex-col group"
                            >
                                <span className="truncate text-[var(--text-main)] group-hover:text-brand transition-colors">{item.name}</span>
                                {item.description && <span className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{item.description}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!isSearching && hoveredPath.length > 0 && (() => {
                const subPanels: React.ReactElement[] = [];
                let cur = data;
                let depth = 1; // Start from 1 as root is 0

                for (const seg of hoveredPath) {
                    const group = cur[seg];
                    if (!group) break;
                    const childKeys = Object.keys(group.children);

                    const topOffset = hoveredTops[depth - 1] || 0;

                    const panelStyle = {
                        position: 'absolute' as const,
                        left: `${depth * 140}px`,
                        top: `${topOffset}px`,
                        zIndex: depth + 1,
                    };

                    if (childKeys.length > 0) {
                        subPanels.push(
                            <div key={`group-${depth}`} style={panelStyle}>
                                <GroupPanel
                                    groups={group.children}
                                    breadcrumb={hoveredPath.slice(0, depth)}
                                    config={config}
                                    activeDescendant={hoveredPath}
                                    onNavigate={handleNavigate}
                                    onAction={onAction}
                                />
                            </div>
                        );
                        cur = group.children;
                        depth++;
                    } else {
                        subPanels.push(
                            <div key={`items-${depth}`} style={panelStyle}>
                                <ItemListPanel
                                    items={group.items}
                                    breadcrumb={hoveredPath.slice(0, depth)}
                                    config={config}
                                    activeItemId={activeItemId}
                                    onSelect={onSelect}
                                    onAction={onAction}
                                />
                            </div>
                        );
                        break;
                    }
                }
                return subPanels;
            })()}
        </div>
    );
};
