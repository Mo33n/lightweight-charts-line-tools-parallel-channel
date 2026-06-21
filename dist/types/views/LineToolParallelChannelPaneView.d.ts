import { IChartApiBase, ISeriesApi, SeriesType } from 'lightweight-charts';
import { LineToolPaneView, CompositeRenderer, SegmentRenderer } from 'lightweight-charts-line-tools-core';
import { LineToolParallelChannel } from '../model/LineToolParallelChannel';
import { ParallelChannelRenderer } from '../rendering/ParallelChannelRenderer';
/**
 * Pane View for the Parallel Channel tool.
 *
 * **Tutorial Note on Logic:**
 * This view manages the complex visual state of a channel.
 * 1. **State Machine:** It distinguishes between the "Ghost Phase" (user has clicked once, drawing the base line)
 *    and the "Channel Phase" (user has clicked twice, expanding the width).
 * 2. **Derivation:** It derives the 4th corner (P3) logic for rendering, mirroring the Model's logic.
 * 3. **Composition:** It uses a `SegmentRenderer` for the ghost phase and a specialized `ParallelChannelRenderer` for the final shape.
 */
export declare class LineToolParallelChannelPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
    /**
     * Internal renderer for the full channel shape (3 lines + fill).
     * @protected
     */
    protected _channelRenderer: ParallelChannelRenderer<HorzScaleItem>;
    /**
     * Internal renderer for the single base line segment (used during creation).
     * @protected
     */
    protected _segmentRenderer: SegmentRenderer<HorzScaleItem>;
    /**
     * Initializes the Parallel Channel View.
     *
     * @param source - The specific Parallel Channel model instance.
     * @param chart - The Chart API.
     * @param series - The Series API.
     */
    constructor(source: LineToolParallelChannel<HorzScaleItem>, chart: IChartApiBase<HorzScaleItem>, series: ISeriesApi<SeriesType, HorzScaleItem>);
    /**
     * The core update logic.
     *
     * It handles visibility culling using a 4-point bounding strategy and switches between
     * rendering a single line (creation step 1) and the full channel (creation step 2 / final).
     *
     * @param height - The height of the pane.
     * @param width - The width of the pane.
     * @protected
     * @override
     */
    protected _updateImpl(height: number, width: number): void;
    /**
     * Creates and adds the 6 interactive anchor points.
     *
     * **Tutorial Note on Anchors:**
     * We render anchors for:
     * - **0-3:** The four corners (P3 is derived/virtual). These use `Move` cursors (rigid side movement).
     * - **4:** Bottom Edge Midpoint. Uses `VerticalResize` (adjusts channel height from bottom).
     * - **5:** Top Edge Midpoint. Uses `VerticalResize` (adjusts channel height from top).
     *
     * @param renderer - The composite renderer to append anchors to.
     * @protected
     * @override
     */
    protected _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void;
}
