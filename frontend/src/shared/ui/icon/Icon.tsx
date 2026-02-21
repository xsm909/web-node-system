import React, { useEffect, useState } from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string;
    size?: number | string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, className = '', ...props }) => {
    const [svgContent, setSvgContent] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/src/assets/icons/${name}.svg`)
            .then(res => res.text())
            .then(text => {
                // Extract only the path or inner content if needed, 
                // but for simplicity we'll just inject the whole thing and strip svg tags if they exist
                // or just render as is if we wrap it.
                // Best way for "currentColor" is to have the <svg> in the DOM.
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'image/svg+xml');
                const svgElement = doc.querySelector('svg');
                if (svgElement) {
                    setSvgContent(svgElement.innerHTML);
                }
            })
            .catch(err => console.error(`Failed to load icon: ${name}`, err));
    }, [name]);

    if (!svgContent) return <div style={{ width: size, height: size }} className={className} />;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 -960 960 960"
            fill="currentColor"
            className={`icon icon-${name} ${className}`}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            {...props}
        />
    );
};
