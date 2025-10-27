import { CanvasRenderingContext2D } from 'canvas';

export function createCanvasGradientFromCssString(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    cssString: string,
) {
    if (!cssString || typeof cssString !== 'string') return null;
    if (!cssString.startsWith('linear-gradient')) return null;

    const gradientParts = cssString.match(/linear-gradient\(([^,]+),\s*(.+)\)/);
    if (!gradientParts || gradientParts.length < 3) return null;

    const angleText = gradientParts[1].trim();
    const stopsText = gradientParts[2].trim();

    let angleRadians = 0;
    if (angleText.endsWith('deg'))
        angleRadians = (parseFloat(angleText) * Math.PI) / 180;
    else angleRadians = parseFloat(angleText);

    const x1 = Math.cos(angleRadians) * canvasWidth;
    const y1 = Math.sin(angleRadians) * canvasHeight;
    const gradient = ctx.createLinearGradient(0, 0, x1, y1);

    const stops = stopsText.match(
        /(rgba?\([^)]+\)|#[a-fA-F0-9]{3,6}|[a-zA-Z]+)\s*(\d+%?)/g,
    );
    if (!stops) return null;

    stops.forEach((stop, index) => {
        const parts = stop.match(
            /(rgba?\([^)]+\)|#[a-fA-F0-9]{3,6}|[a-zA-Z]+)\s*(\d+)%?/,
        );
        if (parts) {
            const color = parts[1];
            const position = parts[2]
                ? parseFloat(parts[2]) / 100
                : index / (stops.length - 1);
            try {
                gradient.addColorStop(position, color);
            } catch {}
        }
    });

    return gradient;
}
