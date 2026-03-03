import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icon';

export type SelectionAction = 'add' | 'delete' | 'rename' | 'duplicate';

export interface SelectionItem {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    selectable?: boolean;
    icon?: string;
}

export interface SelectionGroup {
    id: string;
    name: string;
    items: SelectionItem[];
    children: Record<string, SelectionGroup>;
    selectable?: boolean;
    icon?: string;
    /** Per-group override of config.groupActions. If set, only these actions show for this group. */
    groupActions?: SelectionAction[];
    /** If set, overrides config.allowDelete/allowRename/allowDuplicate for items in this group. */
    itemActions?: SelectionAction[];
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
    onClose?: () => void;
    searchPlaceholder?: string;
    position?: { x: number, y: number };
}

// --- Recursive Panel ---
interface GroupPanelProps {
    groups: Record<string, SelectionGroup>;
    breadcrumb: string[];
    config: SelectionListConfig;
    activeDescendant: string[];
    onNavigate: (path: string[], top: number) => void;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
}

const GroupPanel: React.FC<GroupPanelProps> = ({ groups, breadcrumb, config, activeDescendant, onNavigate, onSelect, onAction }) => {
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="w-64 border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/80 animate-in slide-in-from-left-2 duration-200">
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
                    const isSelectable = group.selectable ?? false;
                    // Use group-level override if set, otherwise fall back to global config
                    const effectiveGroupActions = group.groupActions ?? config.groupActions;

                    return (
                        <div key={label} className="group/item relative">
                            <button
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const containerRect = e.currentTarget.closest('.selection-list-inner')?.getBoundingClientRect();
                                    const top = rect.top - (containerRect?.top || 0);
                                    onNavigate(fullPath, top);
                                }}
                                onClick={() => {
                                    if (isSelectable) {
                                        onSelect({
                                            id: group.id,
                                            name: group.name,
                                            parentId: group.id // Or empty if top level
                                        });
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] ${isActive
                                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                    } ${!isSelectable && !isActive ? 'cursor-default' : ''}`}
                            >
                                <div className="flex items-center gap-2 truncate pr-4">
                                    {group.icon && (
                                        <Icon name={group.icon} size={14} className={isActive ? 'text-white' : 'text-brand'} />
                                    )}
                                    <span className="truncate">{label}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isActive && effectiveGroupActions?.map(action => (
                                        <button
                                            key={action}
                                            onClick={(e) => { e.stopPropagation(); onAction?.(action, group); }}
                                            className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                        >
                                            <Icon name={action === 'add' ? 'add' : action === 'delete' ? 'delete' : action === 'rename' ? 'edit' : 'content_copy'} size={12} />
                                        </button>
                                    ))}
                                    {(hasChildren || group.items.length > 0) && (
                                        <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
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
    /** Per-group override of which actions are allowed on items. */
    groupItemActions?: SelectionAction[];
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem) => void;
}

const ItemListPanel: React.FC<ItemListPanelProps> = ({ items, breadcrumb, config, activeItemId, onSelect, onAction, groupItemActions }) => (
    <div className="w-64 border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/80 animate-in slide-in-from-left-2 duration-200">
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
                const isSelectable = item.selectable ?? true;
                // Use group-level item action overrides if set
                const canRename = groupItemActions ? groupItemActions.includes('rename') : config.allowRename;
                const canDuplicate = groupItemActions ? groupItemActions.includes('duplicate') : config.allowDuplicate;
                const canDelete = groupItemActions ? groupItemActions.includes('delete') : config.allowDelete;

                return (
                    <div key={item.id} className="group/item relative">
                        <button
                            onClick={() => isSelectable && onSelect(item)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent flex flex-col justify-center min-h-[40px] ${isActive
                                ? 'bg-brand/10 border-brand/20 text-brand'
                                : isSelectable
                                    ? 'text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 hover:border-brand/20'
                                    : 'text-[var(--text-muted)] cursor-default'
                                }`}
                        >
                            <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-2 truncate flex-1 pr-2">
                                    {item.icon && (
                                        <Icon name={item.icon} size={14} className={isActive ? 'text-brand' : 'text-brand/50'} />
                                    )}
                                    <span className={`truncate ${isActive ? 'text-brand' : 'text-[var(--text-main)] group-hover/item:text-brand'}`}>{item.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    {canRename && (
                                        <button onClick={(e) => { e.stopPropagation(); onAction?.('rename', item); }} className="p-1 hover:bg-brand/10 rounded-md"><Icon name="edit" size={12} /></button>
                                    )}
                                    {canDuplicate && (
                                        <button onClick={(e) => { e.stopPropagation(); onAction?.('duplicate', item); }} className="p-1 hover:bg-brand/10 rounded-md"><Icon name="content_copy" size={12} /></button>
                                    )}
                                    {canDelete && (
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
    onClose,
    searchPlaceholder = "Search...",
    position
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [hoveredPath, setHoveredPath] = useState<string[]>([]);
    const [hoveredTops, setHoveredTops] = useState<number[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchResultsRef = useRef<HTMLDivElement>(null);

    const flatItems = useMemo(() => {
        const items: SelectionItem[] = [];
        const traverse = (groups: Record<string, SelectionGroup>) => {
            Object.values(groups).forEach(g => {
                const hasChildren = Object.keys(g.children).length > 0;
                const hasItems = g.items.length > 0;

                // If group is a leaf (selectable as a group), add it as an item for search
                if (!hasChildren && !hasItems) {
                    items.push({
                        id: g.id,
                        name: g.name,
                        parentId: g.id
                    });
                }

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

    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => { setHighlightedIndex(0); }, [searchQuery]);

    useEffect(() => {
        if (isSearching && searchResultsRef.current) {
            const container = searchResultsRef.current;
            const highlightedElement = container.children[highlightedIndex] as HTMLElement;
            if (highlightedElement) {
                highlightedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [highlightedIndex, isSearching]);

    const handleNavigate = (path: string[], top: number) => {
        setHoveredPath(path);
        // depth is path.length. But we need to store top for each depth
        setHoveredTops(prev => {
            const next = [...prev];
            next[path.length - 1] = top;
            return next;
        });
    };



    return createPortal(
        <div className="fixed inset-0 z-[100] selection-list-container">
            {/* Click-outside backdrop */}
            <div
                className="fixed inset-0 bg-black/5 backdrop-blur-[0.7px] cursor-default"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onClose?.();
                }}
            />

            <div
                className="absolute flex items-start h-full pointer-events-none selection-list-inner"
                style={{
                    height: 'fit-content',
                    left: position?.x ?? 'auto',
                    top: position?.y ?? 'auto'
                }}
            >
                <div
                    className={`${isSearching ? 'w-80' : 'w-64'} border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/80 transition-all duration-300 z-[1] pointer-events-auto shadow-2xl shadow-black/10`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-1 pb-1 pt-1 relative">
                        <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                        <input
                            ref={inputRef}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    if (isSearching && searchResults.length > 0) {
                                        onSelect(searchResults[highlightedIndex] || searchResults[0]);
                                    } else {
                                        onClose?.();
                                    }
                                } else if (e.key === 'Escape') {
                                    onClose?.();
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setHighlightedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setHighlightedIndex(prev => Math.max(0, prev - 1));
                                }
                            }}
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
                                const isSelectable = group.selectable ?? false;
                                return (
                                    <div key={label} className="group/item relative">
                                        <button
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const containerRect = e.currentTarget.closest('.selection-list-inner')?.getBoundingClientRect();
                                                const top = rect.top - (containerRect?.top || 0);
                                                handleNavigate([label], top);
                                            }}
                                            onClick={() => {
                                                if (isSelectable) {
                                                    onSelect({
                                                        id: group.id,
                                                        name: group.name,
                                                        parentId: group.id
                                                    });
                                                }
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] ${isActive
                                                ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                                : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                                } ${!isSelectable && !isActive ? 'cursor-default' : ''}`}
                                        >
                                            <div className="flex items-center gap-2 truncate pr-4">
                                                {group.icon && (
                                                    <Icon name={group.icon} size={14} className={isActive ? 'text-white' : 'text-brand'} />
                                                )}
                                                <span className="truncate">{label}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {isActive && (group.groupActions ?? config.groupActions)?.map(action => (
                                                    <button
                                                        key={action}
                                                        onClick={(e) => { e.stopPropagation(); onAction?.(action, group); }}
                                                        className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                                    >
                                                        <Icon name={action === 'add' ? 'add' : action === 'delete' ? 'delete' : action === 'rename' ? 'edit' : 'content_copy'} size={12} />
                                                    </button>
                                                ))}
                                                {(hasChildren || group.items.length > 0) && (
                                                    <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {isSearching && (
                        <div
                            ref={searchResultsRef}
                            className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar"
                        >
                            {searchResults.map((item, index) => {
                                const isHighlighted = index === highlightedIndex;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onSelect(item)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col justify-center min-h-[40px] group ${isHighlighted
                                            ? 'bg-brand/10 border-brand/20 text-brand shadow-sm'
                                            : 'border-transparent text-[var(--text-main)] hover:bg-brand/5 hover:border-brand/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {item.icon && (
                                                <Icon name={item.icon} size={14} className={isHighlighted ? 'text-brand' : 'text-brand/50'} />
                                            )}
                                            <span className={`truncate transition-colors ${isHighlighted ? 'text-brand' : 'group-hover:text-brand'}`}>{item.name}</span>
                                        </div>
                                        {item.description && (
                                            <span className={`text-[10px] font-mono mt-0.5 ml-0 line-clamp-1 transition-opacity ${isHighlighted ? 'opacity-70' : 'opacity-40 group-hover:opacity-60'}`} style={{ paddingLeft: item.icon ? '22px' : '0' }}>
                                                {item.description}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {!isSearching && hoveredPath.length > 0 && (() => {
                    const subPanels: React.ReactElement[] = [];
                    let cur = data;
                    let depth = 1;

                    for (const seg of hoveredPath) {
                        const group = cur[seg];
                        if (!group) break;
                        const childKeys = Object.keys(group.children);

                        const topOffset = hoveredTops[depth - 1] || 0;

                        const panelStyle = {
                            position: 'absolute' as const,
                            left: `${depth * 80}px`,
                            top: `${topOffset + 35}px`,
                            zIndex: depth + 1,
                        };

                        const hasItems = group.items.length > 0;
                        const hasChildren = childKeys.length > 0;

                        if (hasChildren) {
                            subPanels.push(
                                <div key={`group-${depth}`} style={panelStyle} className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                    <GroupPanel
                                        groups={group.children}
                                        breadcrumb={hoveredPath.slice(0, depth)}
                                        config={config}
                                        activeDescendant={hoveredPath}
                                        onNavigate={handleNavigate}
                                        onSelect={onSelect}
                                        onAction={onAction}
                                    />
                                </div>
                            );
                            cur = group.children;
                            depth++;
                        } else if (hasItems) {
                            subPanels.push(
                                <div key={`items-${depth}`} style={panelStyle} className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                    <ItemListPanel
                                        items={group.items}
                                        breadcrumb={hoveredPath.slice(0, depth)}
                                        config={config}
                                        activeItemId={activeItemId}
                                        onSelect={onSelect}
                                        onAction={onAction}
                                        groupItemActions={group.itemActions}
                                    />
                                </div>
                            );
                            break;
                        } else {
                            // No children and no items: don't show a sub-panel
                            break;
                        }
                    }
                    return subPanels;
                })()}
            </div>
        </div>,
        document.body
    );
};
