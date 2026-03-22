import React, { useEffect, useState } from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    dir?: 'icons' | 'node_icons';
    size?: number | string;
}

// Use relative paths and modern glob query for better Vite compatibility
const iconModules = import.meta.glob('../../../assets/icons/*.{svg,png}', { query: '?raw', import: 'default', eager: true });
const nodeIconModules = import.meta.glob('../../../assets/node_icons/*.{svg,png}', { query: '?raw', import: 'default', eager: true });
const iconAssets = import.meta.glob('../../../assets/icons/*.png', { eager: true, import: 'default' });

export const Icon: React.FC<IconProps> = ({ name, dir = 'icons', size = 20, className = '', fill: propFill, ...props }) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [viewBox, setViewBox] = useState<string>("0 -960 960 960");
    const [sourceFill, setSourceFill] = useState<string | null>(null);

    useEffect(() => {
        const modules = dir === 'icons' ? iconModules : nodeIconModules;

        // Try SVG first
        const svgPath = dir === 'icons'
            ? `../../../assets/icons/${name}.svg`
            : `../../../assets/node_icons/${name}.svg`;

        const rawSvg = modules[svgPath] as string | undefined;

        if (rawSvg) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');
            if (svgElement) {
                if (svgElement.getAttribute('viewBox')) {
                    setViewBox(svgElement.getAttribute('viewBox')!);
                } else {
                    setViewBox("0 -960 960 960");
                }
                const rootFill = svgElement.getAttribute('fill');
                setSourceFill(rootFill);
                let content = svgElement.innerHTML;
                content = content.replace(/fill="#(000000|0F1729|1f1f1f|333333)"/gi, 'fill="currentColor"');
                content = content.replace(/stroke="#(000000|0F1729|1f1f1f|333333)"/gi, 'stroke="currentColor"');
                setSvgContent(content);
                setImageUrl(null);
            }
        } else {
            // Try PNG
            const pngPath = dir === 'icons'
                ? `../../../assets/icons/${name}.png`
                : `../../../assets/node_icons/${name}.png`;
            
            const pngAsset = iconAssets[pngPath] as string | undefined;
            if (pngAsset) {
                setImageUrl(pngAsset);
                setSvgContent(null);
            } else {
                console.error(`Failed to load icon: ${name} from ${dir}`);
            }
        }
    }, [name, dir]);

    if (imageUrl) {
        return (
            <img 
                src={imageUrl} 
                alt={name} 
                style={{ width: size, height: size }} 
                className={`icon icon-${name} object-contain ${className}`}
                {...(props as any)}
            />
        );
    }

    if (!svgContent) return <div style={{ width: size, height: size }} className={className} />;

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
