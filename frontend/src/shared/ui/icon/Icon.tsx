import React, { useEffect, useState } from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    dir?: 'icons' | 'node_icons';
    size?: number | string;
}

// Use relative paths and modern glob query for better Vite compatibility
const iconModules = import.meta.glob('../../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true });
const nodeIconModules = import.meta.glob('../../../assets/node_icons/*.svg', { query: '?raw', import: 'default', eager: true });

export const Icon: React.FC<IconProps> = ({ name, dir = 'icons', size = 20, className = '', ...props }) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [viewBox, setViewBox] = useState<string>("0 -960 960 960");

    useEffect(() => {
        const modules = dir === 'icons' ? iconModules : nodeIconModules;

        // Construct the expected key for the glob map
        const path = dir === 'icons'
            ? `../../../assets/icons/${name}.svg`
            : `../../../assets/node_icons/${name}.svg`;

        const rawSvg = modules[path] as string | undefined;

        if (rawSvg) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');
            if (svgElement) {
                setSvgContent(svgElement.innerHTML);
                if (svgElement.getAttribute('viewBox')) {
                    setViewBox(svgElement.getAttribute('viewBox')!);
                } else {
                    setViewBox("0 -960 960 960");
                }
            }
        } else {
            console.error(`Failed to load icon: ${name} from ${dir} at ${path}`);
        }
    }, [name, dir]);

    if (!svgContent) return <div style={{ width: size, height: size }} className={className} />;

    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill="currentColor"
            className={`icon icon-${name} ${className}`}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            {...props}
        />
    );
};
