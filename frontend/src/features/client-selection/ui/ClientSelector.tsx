import { useMemo } from 'react';
import { useClientStore } from '../../workflow-management/model/clientStore';
import { ComboBox } from '../../../shared/ui/combo-box';
import { type SelectionItem, type SelectionGroup } from '../../../shared/ui/selection-list';

export const ClientSelector = () => {
    const { activeClientId, assignedUsers, setActiveClientId } = useClientStore();

    const activeClient = useMemo(() =>
        assignedUsers.find(u => u.id === activeClientId),
        [assignedUsers, activeClientId]
    );

    const selectionData = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};

        assignedUsers.forEach(u => {
            data[u.username] = {
                id: u.id,
                name: u.username,
                items: [],
                children: {}
            };
        });

        return data;
    }, [assignedUsers]);

    const handleSelect = (item: SelectionItem) => {
        setActiveClientId(item.id === 'all' ? null : item.id);
    };

    return (
        <div className="mb-6">
            <div className="px-3 py-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-50">Active Client</div>
            <ComboBox
                variant="sidebar"
                value={activeClientId || 'all'}
                label={activeClient?.username || 'Not selected'}
                icon={activeClient ? 'person' : 'group'}
                data={selectionData}
                onSelect={handleSelect}
                searchPlaceholder="Find client..."
            />
        </div>
    );
};
