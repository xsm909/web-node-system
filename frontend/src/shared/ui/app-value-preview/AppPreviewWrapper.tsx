import { memo, type ReactNode } from 'react';
import { Icon } from '../icon';

interface AppPreviewWrapperProps {
    children: ReactNode;
    type?: string;
}

/** Color mapping for different gadget types */
const TYPE_STYLES: Record<string, string> = {
    hint: 'text-amber-500/90 bg-amber-500/5 border-amber-500/20 shadow-amber-500/5',
    sql: 'text-emerald-500/90 bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5',
    python: 'text-blue-500/90 bg-blue-500/5 border-blue-500/20 shadow-blue-500/5',
    array: 'text-indigo-500/90 bg-indigo-500/5 border-indigo-500/20 shadow-indigo-500/5',
    object: 'text-purple-500/90 bg-purple-500/5 border-purple-500/20 shadow-purple-500/5',
    markdown: 'text-brand bg-brand/5 border-brand/20 shadow-brand/5',
};

/** Icon mapping for types */
const TYPE_ICONS: Record<string, string> = {
    hint: 'lightbulb_circle',
    sql: 'database',
    python: 'function',
    markdown: 'article',
    array: 'lists',
    object: 'schema',
};

/**
 * Visual gadget container with curly braces for complex data.
 * Purely responsible for the "Premium" look.
 */
export const AppPreviewWrapper = memo(({ children, type = 'markdown' }: AppPreviewWrapperProps) => {
    const styleClass = TYPE_STYLES[type] || TYPE_STYLES.markdown;
    const iconName = TYPE_ICONS[type];

    return (
        <div
            title=""
            className={`
                flex items-center gap-1.5 min-w-0 font-mono text-[10px] px-2 py-0.5 rounded-md border w-fit max-w-full
                transition-all duration-100 ease-out
                hover:scale-[0.96] hover:shadow-md cursor-default
                opacity-0 animate-[fade-in_0.5s_ease-out_forwards]
                ${styleClass}
            `}
        >
            <span className="opacity-40 font-bold select-none">{'{'}</span>

            {iconName && (
                <Icon name={iconName} size={11} className="shrink-0 opacity-80" />
            )}

            <span className="italic truncate leading-none mr-0.5" title="">
                {children}
            </span>

            <span className="opacity-40 font-bold select-none">{'}'}</span>
        </div>
    );
});
