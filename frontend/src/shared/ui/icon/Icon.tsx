import React, { useEffect, useState } from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    dir?: 'icons' | 'node_icons';
    size?: number | string;
}

// Use relative paths and modern glob query for better Vite compatibility
const iconModules = import.meta.glob('../../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true });
const nodeIconModules = import.meta.glob('../../../assets/node_icons/*.svg', { query: '?raw', import: 'default', eager: true });

export const Icon: React.FC<IconProps> = ({ name, dir = 'icons', size = 20, className = '', fill: propFill, ...props }) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [viewBox, setViewBox] = useState<string>("0 -960 960 960");
    const [sourceFill, setSourceFill] = useState<string | null>(null);

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
                // Extract structural info
                if (svgElement.getAttribute('viewBox')) {
                    setViewBox(svgElement.getAttribute('viewBox')!);
                } else {
                    setViewBox("0 -960 960 960");
                }

                // Extract fill from source root or use none if missing but has strokes
                const rootFill = svgElement.getAttribute('fill');
                setSourceFill(rootFill);

                // Process internal content: replace hardcoded colors with currentColor
                // for theme awareness.
                let content = svgElement.innerHTML;
                
                // Replace #000000, #0F1729, #1f1f1f etc with currentColor
                // We target common dark colors used in SVG exports
                content = content.replace(/fill="#(000000|0F1729|1f1f1f|333333)"/gi, 'fill="currentColor"');
                content = content.replace(/stroke="#(000000|0F1729|1f1f1f|333333)"/gi, 'stroke="currentColor"');
                
                setSvgContent(content);
            }
        } else {
            console.error(`Failed to load icon: ${name} from ${dir} at ${path}`);
        }
    }, [name, dir]);

    if (!svgContent) return <div style={{ width: size, height: size }} className={className} />;

    // Decide what fill to use
    // 1. Explicit propFill takes precedence
    // 2. If source had fill="none", use "none"
    // 3. Otherwise default to "currentColor" for solid icons
    const finalFill = propFill || (sourceFill === 'none' ? 'none' : 'currentColor');

    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill={finalFill}
            className={`icon icon-${name} ${className}`}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            {...props}
        />
    );
};
