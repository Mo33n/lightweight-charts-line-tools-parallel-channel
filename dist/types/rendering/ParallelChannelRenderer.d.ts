import { IPaneRenderer, CanvasRenderingTarget2D, LineToolHitTestData, HitTestResult, PaneCursorType, Point, ExtendOptions } from 'lightweight-charts-line-tools-core';
import { Coordinate, LineStyle } from 'lightweight-charts';
/**
 * Data structure required by the {@link ParallelChannelRenderer}.
 *
 * It contains the 3 defining screen points (P0, P1, P2) and the full styling configuration
 * for the channel borders, middle line, and background fill.
 */
export interface ParallelChannelRendererData {
    points: [Point, Point, Point];
    channelLine: {
        width: number;
        color: string;
        style: LineStyle;
    };
    middleLine: {
        width: number;
        color: string;
        style: LineStyle;
    };
    showMiddleLine: boolean;
    extend: ExtendOptions;
    background?: {
        color: string;
    };
    hitTestBackground?: boolean;
    toolDefaultHoverCursor?: PaneCursorType;
    toolDefaultDragCursor?: PaneCursorType;
}
/**
 * Custom Renderer for the Parallel Channel tool.
 *
 * **Tutorial Note on Rendering:**
 * This renderer is responsible for:
 * 1. **Geometry Derivation:** Calculating the 4th corner (P3) based on the parallel relationship.
 * 2. **Infinite Fill:** Calculating a massive "Placeholder Polygon" that extends off-screen if `extend` is enabled,
 *    and then clipping it to the viewport to creating the effect of an infinite fill.
 * 3. **Line Drawing:** Drawing the Top, Bottom, and Middle lines with their specific styles (Solid/Dashed).
 *
 * @typeParam HorzScaleItem - The type of the horizontal scale item.
 */
export declare class ParallelChannelRenderer<HorzScaleItem> implements IPaneRenderer {
    private _data;
    private _mediaSize;
    private _hitTestLine;
    private _hitTestBackground;
    /**
     * Initializes the Parallel Channel Renderer.
     *
     * Sets up reusable `HitTestResult` templates for Line hits (Pointer cursor) and Background hits (Grabbing cursor).
     */
    constructor();
    /**
     * Sets the data payload required to draw.
     *
     * @param data - The {@link ParallelChannelRendererData} containing points and styles.
     * @returns void
     */
    setData(data: ParallelChannelRendererData): void;
    /**
     * Draws the complete Parallel Channel.
     *
     * **Algorithm:**
     * 1. Calculate P3.
     * 2. Construct a "Mega Polygon" that extends well beyond the screen boundaries if the channel is extended.
     * 3. Clip that polygon to the viewport using `clipPolygonToViewport` to generate the fill shape.
     * 4. Draw the fill.
     * 5. Draw the 3 line segments (Top, Bottom, Middle), handling their individual extensions via `extendAndClipLineSegment`.
     *
     * @param target - The canvas target.
     * @returns void
     */
    draw(target: CanvasRenderingTarget2D): void;
    /**
     * Performs a hit test on the channel.
     *
     * **Priority Order:**
     * 1. **Lines:** Checks if the mouse is close to the Base, Parallel, or Middle lines. (Cursor: Pointer).
     * 2. **Background:** Checks if the mouse is inside the filled area. (Cursor: Grabbing).
     *
     * This logic mirrors the `draw` method's geometry calculations to ensure the hit area
     * matches the visual area exactly.
     *
     * @param x - X coordinate.
     * @param y - Y coordinate.
     * @returns A hit result, or `null`.
     */
    hitTest(x: Coordinate, y: Coordinate): HitTestResult<LineToolHitTestData> | null;
    /**
     * Helper to draw a single line segment with extension logic.
     *
     * Wraps `extendAndClipLineSegment` and the canvas drawing calls into one utility
     * to avoid code duplication for the Top, Bottom, and Middle lines.
     *
     * @private
     */
    private _drawLine;
}
