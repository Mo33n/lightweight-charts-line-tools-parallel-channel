import { IChartApiBase, ISeriesApi, IHorzScaleBehavior, SeriesType, Coordinate } from 'lightweight-charts';
import { BaseLineTool, LineToolPoint, LineToolOptionsInternal, LineToolType, DeepPartial, LineToolsCorePlugin, PriceAxisLabelStackingManager, Point, HitTestResult, ConstraintResult, InteractionPhase } from 'lightweight-charts-line-tools-core';
/**
 * Defines the default configuration options for the Parallel Channel tool.
 *
 * **Tutorial Note:**
 * A Parallel Channel consists of three visual components:
 * 1. **Channel Line:** The solid borders (Top P0-P1 and Bottom P2-P3).
 * 2. **Middle Line:** The dashed center line running between the borders.
 * 3. **Background:** A semi-transparent fill between the borders.
 *
 * The defaults configure these components with a standard blue theme and dashed middle line.
 * Axis labels are disabled by default as this is primarily a trend analysis tool.
 */
export declare const ParallelChannelOptionDefaults: LineToolOptionsInternal<'ParallelChannel'>;
/**
 * Concrete implementation of the Parallel Channel drawing tool.
 *
 * **What is a Parallel Channel?**
 * It is defined by **3 points**:
 * - **P0 & P1:** Define the "Base Line" (typically the top trend line).
 * - **P2:** Defines the "Parallel Line" offset. The slope of the parallel line is identical to P0-P1.
 *
 * **Complex Interaction:**
 * This tool manages **6 Interactive Anchors** (3 real, 3 virtual) to allow resizing the channel's
 * slope, width (height), or position from various grab points.
 */
export declare class LineToolParallelChannel<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {
    /**
     * The unique identifier for this tool type ('ParallelChannel').
     *
     * @override
     */
    readonly toolType: LineToolType;
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Parallel Channel is defined by exactly **3 points** (Start, End, and Width/Offset).
     *
     * @override
     */
    readonly pointsCount: number;
    /**
     * Initializes the Parallel Channel tool.
     *
     * **Tutorial Note on Construction:**
     * 1. **Base Defaults:** Uses `ParallelChannelOptionDefaults` (Blue theme).
     * 2. **User Options:** Merges user provided settings.
     * 3. **View:** Assigns `LineToolParallelChannelPaneView`, which handles the complex task of
     *    calculating the 4th corner (P3) and rendering the filled parallelogram.
     *
     * @param coreApi - The Core Plugin API.
     * @param chart - The Lightweight Charts Chart API.
     * @param series - The Series API this tool is attached to.
     * @param horzScaleBehavior - The horizontal scale behavior.
     * @param options - Configuration overrides.
     * @param points - Initial points.
     * @param priceAxisLabelStackingManager - The manager for label collision.
     */
    constructor(coreApi: LineToolsCorePlugin<HorzScaleItem>, chart: IChartApiBase<HorzScaleItem>, series: ISeriesApi<SeriesType, HorzScaleItem>, horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>, options: DeepPartial<LineToolOptionsInternal<"ParallelChannel">> | undefined, points: LineToolPoint[] | undefined, priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>);
    /**
     * Explicitly defines the highest valid index for an interactive anchor point.
     *
     * The Parallel Channel uses 6 anchors in total:
     * - **0, 1, 2:** The primary defining points.
     * - **3:** The derived 4th corner (P3).
     * - **4:** The bottom-edge midpoint (resizes height).
     * - **5:** The top-edge midpoint (translates the base line).
     *
     * @override
     * @returns `5`
     */
    maxAnchorIndex(): number;
    /**
     * Enables geometric constraints (Shift key) during "Click-Click" creation.
     *
     * If `true`, holding Shift while placing the second point (P1) will lock the base line
     * to horizontal or vertical axes.
     *
     * @override
     * @returns `true`
     */
    supportsShiftClickClickConstraint(): boolean;
    /**
     * Enables geometric constraints (Shift key) during "Click-Drag" creation or editing.
     *
     * If `true`, holding Shift while dragging P1 will lock the base line's angle.
     *
     * @override
     * @returns `true`
     */
    supportsShiftClickDragConstraint(): boolean;
    /**
     * Calculates the logical position for any of the 6 anchors (real or virtual).
     *
     * **Tutorial Note on Virtual Anchors:**
     * - **0-2:** Returns the stored points P0, P1, P2.
     * - **3 (Derived Corner):** Calculates the 4th corner (Bottom-Right) to complete the parallelogram.
     *   Logic: P3.x = P1.x, P3.y = P2.y + (P1.y - P0.y).
     * - **4-5 (Midpoints):** Calculates the "Height" handles using pure geometric averages.
     *   - Index 4: Bottom Edge Midpoint (Center of P2-P3).
     *   - Index 5: Top Edge Midpoint (Center of P0-P1).
     *
     * By using arithmetic averages for both Time and Price, we ensure the anchors stay
     * perfectly centered on sloped lines. This avoids the "jumping" effect caused by
     * trying to force handles onto discrete bars, matching the smooth behavior
     * of the Rectangle tool.
     *
     * @param index - The anchor index (0-5).
     * @returns The calculated {@link LineToolPoint}, or `null` if points are missing.
     * @override
     */
    getPoint(index: number): LineToolPoint | null;
    /**
     * Helper to snap a raw price value to the nearest price scale tick.
     *
     * **Why is this needed?**
     * When dragging channel edges, small floating-point variations can cause the channel height to
     * drift slightly or visually "bobble". Snapping to the price scale ensures clean, deterministic
     * vertical movements.
     *
     * @param rawPrice - The raw floating-point price from the mouse.
     * @returns The price snapped to the series' price scale.
     * @private
     */
    private _constrainNewPrice;
    /**
     * Handles the complex resizing logic for all 6 anchors.
     *
     * **Interaction Logic:**
     * - **Corners (0, 2):** Moves the **Left Side**. Dragging P0 moves P2 in unison to maintain height.
     * - **Corners (1, 3):** Moves the **Right Side**. Dragging P1 moves P3 (and thus P1) in unison.
     * - **Bottom Edge (4):** Adjusts the channel height from the bottom. Moves the Parallel Line (P2-P3) vertically.
     * - **Top Edge (5):** Adjusts the channel height from the top. Moves the Base Line (P0-P1) vertically.
     *
     * This "Rigid Side" logic ensures the channel always remains a parallelogram with vertical sides parallel to the Y-axis.
     *
     * @param index - The index of the anchor being dragged.
     * @param newPoint - The new logical position.
     * @override
     */
    setPoint(index: number, newPoint: LineToolPoint): void;
    /**
     * Overrides the ghost point logic to constrain the 3rd point (P2) during creation.
     *
     * **Tutorial Note:**
     * When placing the 3rd point (which defines the channel width/height), we force its
     * X-coordinate (Time) to match P0. This ensures that the user is defining the *vertical offset*
     * of the parallel line, creating a mathematically perfect parallel channel structure from the start.
     *
     * @param point - The raw mouse position.
     * @override
     */
    setLastPoint(point: LineToolPoint | null): void;
    /**
     * Re-orders the internal points so P0 is always to the left of P1 in time.
     *
     * **Logic:**
     * If the user draws the base line right-to-left (P0 > P1), this method swaps them.
     * Crucially, it also recalculates P2 so that the *shape* of the channel remains consistent
     * after the swap (preventing the channel from flipping inside out).
     *
     * @override
     */
    normalize(): void;
    /**
     * Performs the hit test for the Parallel Channel.
     *
     * **Architecture Note:**
     * Delegates to the `LineToolParallelChannelPaneView`. The view uses a `ParallelChannelRenderer`
     * which performs ray-casting to check if the mouse is inside the parallelogram or hovering
     * over any of the three lines (Base, Middle, Parallel).
     *
     * @param x - X coordinate in pixels.
     * @param y - Y coordinate in pixels.
     * @returns A hit result, or `null`.
     * @override
     */
    _internalHitTest(x: Coordinate, y: Coordinate): HitTestResult<any> | null;
    /**
     * Implements granular Shift constraint logic.
     *
     * **Behavior:**
     * - **Creation (P1):** Locks P1's Y-coordinate to P0 (Forces a horizontal base line).
     * - **Editing (Corners):** Locks the drag to either Horizontal or Vertical relative to the
     *   *opposing* corner.
     * - **Editing (Edges):** No shift constraint is applied (or rather, the axis is already locked by `setPoint`).
     *
     * @param pointIndex - The anchor index.
     * @param rawScreenPoint - Mouse position.
     * @param phase - Creation or Editing.
     * @param originalLogicalPoint - Starting position.
     * @param allOriginalLogicalPoints - Snapshot of all points.
     * @returns The constrained result.
     * @override
     */
    getShiftConstrainedPoint(pointIndex: number, rawScreenPoint: Point, phase: InteractionPhase, originalLogicalPoint: LineToolPoint, allOriginalLogicalPoints: LineToolPoint[]): ConstraintResult;
    /**
     * Overrides the base `addPoint` to enforce the X-axis lock when committing the 3rd point.
     *
     * While `setLastPoint` handles the *visual* constraint during the ghost phase, this method ensures
     * the *permanent* point stored in the model also adheres to the rule: P2.time must equal P0.time.
     *
     * @param point - The raw point from the mouse release event.
     * @override
     */
    addPoint(point: LineToolPoint): void;
    /**
     * Calculates the Parallel Channel's visibility based on its 2D area.
     *
     * ### Tutorial Note on Parallel Channel Culling
     * A Parallel Channel defines a slanted 2D zone. To prevent the background
     * fill from "popping" out when the user zooms into the middle of the
     * channel (where the borders are off-screen), we use Area-Based culling.
     *
     * 1. We retrieve the 3 primary points and the derived 4th corner (P3).
     * 2. We pass all 4 vertices to the core engine.
     * 3. We set 'isAreaBased' to true.
     *
     * The engine calculates the total bounding box (AABB) of the parallelogram
     * and performs a solid 2D intersection test. This is mathematically
     * simpler and more robust than checking individual line segments.
     *
     * @protected
     * @override
     */
    protected updateCullingState(): void;
}
