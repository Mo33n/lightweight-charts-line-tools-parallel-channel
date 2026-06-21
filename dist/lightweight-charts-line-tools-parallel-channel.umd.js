(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('lightweight-charts'), require('lightweight-charts-line-tools-core')) :
    typeof define === 'function' && define.amd ? define(['exports', 'lightweight-charts', 'lightweight-charts-line-tools-core'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.LightweightChartsLineToolsParallelChannel = {}, global.LightweightCharts, global.LightweightChartsLineToolsCore));
})(this, (function (exports, lightweightCharts, lightweightChartsLineToolsCore) { 'use strict';

    // src/rendering/ParallelChannelRenderer.ts
    // Common tolerance for line hit-testing
    const HIT_TEST_TOLERANCE = 4;
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
    class ParallelChannelRenderer {
        /**
         * Initializes the Parallel Channel Renderer.
         *
         * Sets up reusable `HitTestResult` templates for Line hits (Pointer cursor) and Background hits (Grabbing cursor).
         */
        constructor() {
            this._data = null;
            this._mediaSize = { width: 0, height: 0 };
            this._hitTestLine = new lightweightChartsLineToolsCore.HitTestResult(lightweightChartsLineToolsCore.HitTestType.MovePoint, { pointIndex: null, suggestedCursor: lightweightChartsLineToolsCore.PaneCursorType.Pointer });
            this._hitTestBackground = new lightweightChartsLineToolsCore.HitTestResult(lightweightChartsLineToolsCore.HitTestType.MovePointBackground, { pointIndex: null, suggestedCursor: lightweightChartsLineToolsCore.PaneCursorType.Grabbing });
        }
        /**
         * Sets the data payload required to draw.
         *
         * @param data - The {@link ParallelChannelRendererData} containing points and styles.
         * @returns void
         */
        setData(data) {
            this._data = data;
        }
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
        draw(target) {
            if (!this._data || !this._data.points || this._data.points.length < 3) {
                return;
            }
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
                this._mediaSize = mediaSize;
                const [p0, p1, p2] = this._data.points;
                const { width: W, height: H } = mediaSize;
                const { extend, channelLine, middleLine, showMiddleLine } = this._data;
                /**
                 * 1. GEOMETRY DERIVATION (P3)
                 *
                 * A Parallel Channel is a parallelogram. P3 is derived such that the vector P2->P3
                 * is identical to P0->P1.
                 */
                const p1MinusP0 = p1.subtract(p0);
                const p3 = p2.add(p1MinusP0);
                // 2. --- Calculate Dynamic Margin for Placeholder Polygon ---
                /**
                 * 2. INFINITE FILL STRATEGY (DYNAMIC MARGIN)
                 *
                 * To render an "infinite" fill, we cannot just draw to infinity.
                 * We calculate a "Far Off" distance based on the viewport's diagonal length.
                 * This ensures that no matter the angle, the edges of our placeholder polygon
                 * are well outside the visible area.
                 */
                const SAFETY_BUFFER = 100;
                // Calculate the length of the viewport diagonal (Guaranteed max length for any on-screen line)
                const diagonalLength = Math.sqrt(W * W + H * H);
                // The Margin must be at least the diagonal + a buffer
                const MARGIN = diagonalLength + SAFETY_BUFFER;
                // Define the far-off coordinates based on the margin
                const X_FAR_LEFT = 0 - MARGIN;
                const X_FAR_RIGHT = W + MARGIN;
                // 3. Define Line Equations (y = mx + b)
                /**
                 * 3. LINE EQUATIONS
                 *
                 * We calculate the slope (`m`) and y-intercept (`b`) for the Top and Bottom lines.
                 * These are used to project the corner points to the "Far Off" X-coordinates calculated above.
                 */
                const lineTop = lightweightChartsLineToolsCore.lineThroughPoints(p0, p1);
                const lineBottom = lightweightChartsLineToolsCore.lineThroughPoints(p2, p3);
                // Guard against degenerate lines (p0=p1 or p2=p3)
                if (lineTop === null || lineBottom === null) {
                    return; // Cannot draw or fill a channel with a zero-length segment
                }
                // Note: Error handling for vertical lines (line.b === 0) is omitted for brevity...
                const m_top = -lineTop.a / lineTop.b; // slope
                const b_top = -lineTop.c / lineTop.b; // y-intercept
                const m_bottom = -lineBottom.a / lineBottom.b;
                const b_bottom = -lineBottom.c / lineBottom.b;
                // 4. --- Calculate the 4 Vertices of the Initial Placeholder Polygon ---
                // Start with the four core points
                /**
                 * 4. POLYGON CONSTRUCTION
                 *
                 * We construct the 4 vertices of the fill polygon.
                 * - If extended, we replace the actual corners (P0, P1, etc.) with the projected points
                 *   at `X_FAR_LEFT` and `X_FAR_RIGHT`.
                 * - If not extended, we use the actual screen points.
                 */
                let p_start_top = p0;
                let p_end_top = p1;
                let p_start_bottom = p2;
                let p_end_bottom = p3;
                // Apply extension only if the slope is defined (i.e., not a perfectly vertical line)
                // AND only if the line is NOT perfectly vertical (to avoid Infinity from line.b === 0)
                if (lineTop.b !== 0) {
                    if (extend.left) {
                        p_start_top = new lightweightChartsLineToolsCore.Point(X_FAR_LEFT, (m_top * X_FAR_LEFT + b_top));
                        p_start_bottom = new lightweightChartsLineToolsCore.Point(X_FAR_LEFT, (m_bottom * X_FAR_LEFT + b_bottom));
                    }
                    if (extend.right) {
                        p_end_top = new lightweightChartsLineToolsCore.Point(X_FAR_RIGHT, (m_top * X_FAR_RIGHT + b_top));
                        p_end_bottom = new lightweightChartsLineToolsCore.Point(X_FAR_RIGHT, (m_bottom * X_FAR_RIGHT + b_bottom));
                    }
                }
                const initialPolygon = [p_start_top, p_end_top, p_end_bottom, p_start_bottom];
                // 5. Clip this large polygon to the actual screen boundaries (The Final Crop)
                /**
                 * 5. POLYGON CLIPPING (THE CROP)
                 *
                 * Drawing the massive polygon directly can cause rendering artifacts or performance issues.
                 * We use `clipPolygonToViewport` (Sutherland-Hodgman algorithm) to slice the polygon
                 * exactly at the screen edges. This results in a clean, drawable shape.
                 */
                const clippedFillPolygon = lightweightChartsLineToolsCore.clipPolygonToViewport(initialPolygon, W, H);
                // --- Draw Background Fill ---
                if (this._data.background?.color && clippedFillPolygon && clippedFillPolygon.length >= 3) {
                    ctx.save();
                    ctx.fillStyle = this._data.background.color;
                    // Draw the clipped polygon (which should now fill the gap correctly)
                    ctx.beginPath();
                    ctx.moveTo(clippedFillPolygon[0].x, clippedFillPolygon[0].y);
                    for (let i = 1; i < clippedFillPolygon.length; i++) {
                        ctx.lineTo(clippedFillPolygon[i].x, clippedFillPolygon[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                // --- Draw Lines (Uses existing segment clipping logic) ---
                // A. Base Line (P0 to P1)
                /**
                 * DRAW BASE LINE (P0-P1)
                 *
                 * We calculate and draw the top segment (Base Line).
                 * We use `extendAndClipLineSegment` to handle infinite extensions if configured.
                 */
                const topSegment = lightweightChartsLineToolsCore.extendAndClipLineSegment(p0, p1, W, H, extend.left, extend.right);
                if (topSegment && !(topSegment instanceof lightweightChartsLineToolsCore.Point)) {
                    const [topLeft, topRight] = topSegment;
                    ctx.save();
                    ctx.lineWidth = channelLine.width;
                    ctx.strokeStyle = channelLine.color;
                    lightweightChartsLineToolsCore.setLineStyle(ctx, channelLine.style);
                    lightweightChartsLineToolsCore.drawLine(ctx, topLeft.x, topLeft.y, topRight.x, topRight.y, channelLine.style);
                    ctx.restore();
                }
                // B. Parallel Line (P2 to P3)
                /**
                 * DRAW PARALLEL LINE (P2-P3)
                 *
                 * We calculate and draw the bottom segment.
                 * This line is mathematically parallel to the base line and passes through P2.
                 */
                const bottomSegment = lightweightChartsLineToolsCore.extendAndClipLineSegment(p2, p3, W, H, extend.left, extend.right);
                if (bottomSegment && !(bottomSegment instanceof lightweightChartsLineToolsCore.Point)) {
                    const [bottomLeft, bottomRight] = bottomSegment;
                    ctx.save();
                    ctx.lineWidth = channelLine.width;
                    ctx.strokeStyle = channelLine.color;
                    lightweightChartsLineToolsCore.setLineStyle(ctx, channelLine.style);
                    lightweightChartsLineToolsCore.drawLine(ctx, bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y, channelLine.style);
                    ctx.restore();
                }
                // C. Middle Line (Midpoint P0P2 to Midpoint P1P3)
                /**
                 * DRAW MIDDLE LINE
                 *
                 * If enabled, we calculate the geometric center line.
                 * Logic: Midpoint(P0, P2) to Midpoint(P1, P3).
                 */
                if (showMiddleLine) {
                    const mid0 = p0.add(p2).scaled(0.5);
                    const mid1 = p1.add(p3).scaled(0.5);
                    // The middle line must also be clipped/extended
                    const midSegment = lightweightChartsLineToolsCore.extendAndClipLineSegment(mid0, mid1, W, H, extend.left, extend.right);
                    if (midSegment && !(midSegment instanceof lightweightChartsLineToolsCore.Point)) {
                        const [midStart, midEnd] = midSegment;
                        ctx.save();
                        ctx.lineWidth = middleLine.width;
                        ctx.strokeStyle = middleLine.color;
                        lightweightChartsLineToolsCore.setLineStyle(ctx, middleLine.style);
                        lightweightChartsLineToolsCore.drawLine(ctx, midStart.x, midStart.y, midEnd.x, midEnd.y, middleLine.style);
                        ctx.restore();
                    }
                }
            });
        }
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
        hitTest(x, y) {
            if (!this._data || this._data.points.length < 3) {
                return null;
            }
            const [p0, p1, p2] = this._data.points;
            const { extend, channelLine, middleLine, showMiddleLine } = this._data;
            // 1. Calculate the Derived 4th Point (P3)
            const p1MinusP0 = p1.subtract(p0);
            const p3 = p2.add(p1MinusP0);
            const point = new lightweightChartsLineToolsCore.Point(x, y);
            const { width: W, height: H } = this._mediaSize;
            // Safety check: ensure mediaSize has been set by a prior draw() call
            if (W === 0 || H === 0)
                return null;
            // Helper to check line hit (for Base, Parallel, and Middle lines)
            /**
             * HIT TEST HELPER
             *
             * A utility function to check if the mouse is within `HIT_TEST_TOLERANCE` of a line segment.
             * It handles the complex logic of extending and clipping the line to the viewport
             * before measuring distance, ensuring accurate hits even on parts of the line
             * that are far from the defining points.
             */
            const checkLine = (pA, pB, cursor) => {
                // Clip the segment exactly as in draw()
                const segmentOrPoint = lightweightChartsLineToolsCore.extendAndClipLineSegment(pA, pB, W, H, extend.left, extend.right);
                if (segmentOrPoint === null || segmentOrPoint instanceof lightweightChartsLineToolsCore.Point)
                    return null;
                const [start, end] = segmentOrPoint;
                if (lightweightChartsLineToolsCore.distanceToSegment(start, end, point).distance <= HIT_TEST_TOLERANCE) {
                    const suggestedCursor = this._data.toolDefaultHoverCursor || cursor;
                    return new lightweightChartsLineToolsCore.HitTestResult(lightweightChartsLineToolsCore.HitTestType.MovePoint, { pointIndex: null, suggestedCursor });
                }
                return null;
            };
            // --- A. Line Hit Tests (Priority over Background) ---
            // 1. Check Base Line (P0-P1)
            let hit = checkLine(p0, p1, lightweightChartsLineToolsCore.PaneCursorType.Pointer);
            if (hit)
                return hit;
            // 2. Check Parallel Line (P2-P3)
            hit = checkLine(p2, p3, lightweightChartsLineToolsCore.PaneCursorType.Pointer);
            if (hit)
                return hit;
            // 3. Check Middle Line (Midpoints)
            if (showMiddleLine) {
                const mid0 = p0.add(p2).scaled(0.5);
                const mid1 = p1.add(p3).scaled(0.5);
                hit = checkLine(mid0, mid1, lightweightChartsLineToolsCore.PaneCursorType.Pointer);
                if (hit)
                    return hit;
            }
            // --- B. Background Hit Test (Must mirror draw logic) ---
            /**
             * BACKGROUND HIT TEST
             *
             * We reconstruct the exact same clipped polygon used in `draw()` and use `pointInPolygon`
             * to check if the mouse is inside.
             */
            if (this._data.hitTestBackground && this._data.background?.color) {
                // 1. --- Calculate Dynamic Margin for Placeholder Polygon (Mirroring draw) ---
                const SAFETY_BUFFER = 100;
                const MARGIN = Math.sqrt(W * W + H * H) + SAFETY_BUFFER;
                const X_FAR_LEFT = 0 - MARGIN;
                const X_FAR_RIGHT = W + MARGIN;
                // 2. Define Line Equations (Mirroring draw)
                const lineTop = lightweightChartsLineToolsCore.lineThroughPoints(p0, p1);
                const lineBottom = lightweightChartsLineToolsCore.lineThroughPoints(p2, p3);
                // --- FIX: Guard against degenerate lines ---
                if (lineTop === null || lineBottom === null) {
                    return null; // Cannot perform hit test on a zero-length line
                }
                const m_top = -lineTop.a / lineTop.b;
                const b_top = -lineTop.c / lineTop.b;
                const m_bottom = -lineBottom.a / lineBottom.b;
                const b_bottom = -lineBottom.c / lineBottom.b;
                // 3. --- Calculate the 4 Vertices of the Initial Placeholder Polygon ---
                let p_start_top = p0;
                let p_end_top = p1;
                let p_start_bottom = p2;
                let p_end_bottom = p3;
                if (lineTop.b !== 0) { // Check if the line is not perfectly vertical
                    if (extend.left) {
                        p_start_top = new lightweightChartsLineToolsCore.Point(X_FAR_LEFT, (m_top * X_FAR_LEFT + b_top));
                        p_start_bottom = new lightweightChartsLineToolsCore.Point(X_FAR_LEFT, (m_bottom * X_FAR_LEFT + b_bottom));
                    }
                    if (extend.right) {
                        p_end_top = new lightweightChartsLineToolsCore.Point(X_FAR_RIGHT, (m_top * X_FAR_RIGHT + b_top));
                        p_end_bottom = new lightweightChartsLineToolsCore.Point(X_FAR_RIGHT, (m_bottom * X_FAR_RIGHT + b_bottom));
                    }
                }
                const initialPolygon = [p_start_top, p_end_top, p_end_bottom, p_start_bottom];
                // 4. Clip this large polygon to the actual screen boundaries
                /**
                 * POLYGON CLIPPING (HIT TEST)
                 *
                 * To check if the mouse is "inside" the infinite channel, we must recreate the exact
                 * clipped polygon used in the `draw` method. We clip the infinite coordinates to the
                 * viewport dimensions so `pointInPolygon` has a finite shape to test against.
                 */
                const clippedFillPolygon = lightweightChartsLineToolsCore.clipPolygonToViewport(initialPolygon, W, H);
                // 5. Perform the hit test on the final clipped polygon
                if (clippedFillPolygon && lightweightChartsLineToolsCore.pointInPolygon(point, clippedFillPolygon)) {
                    const suggestedCursor = this._data.toolDefaultDragCursor || lightweightChartsLineToolsCore.PaneCursorType.Grabbing;
                    return new lightweightChartsLineToolsCore.HitTestResult(lightweightChartsLineToolsCore.HitTestType.MovePointBackground, { pointIndex: null, suggestedCursor });
                }
            }
            return null;
        }
        /**
         * Helper to draw a single line segment with extension logic.
         *
         * Wraps `extendAndClipLineSegment` and the canvas drawing calls into one utility
         * to avoid code duplication for the Top, Bottom, and Middle lines.
         *
         * @private
         */
        _drawLine(ctx, pA, pB, options, extend, W, H) {
            const segmentOrPoint = lightweightChartsLineToolsCore.extendAndClipLineSegment(pA, pB, W, H, extend.left, extend.right);
            if (segmentOrPoint instanceof lightweightChartsLineToolsCore.Point)
                return;
            if (segmentOrPoint === null)
                return;
            const [start, end] = segmentOrPoint;
            ctx.save();
            ctx.lineWidth = options.width;
            ctx.strokeStyle = options.color;
            lightweightChartsLineToolsCore.setLineStyle(ctx, options.style);
            lightweightChartsLineToolsCore.drawLine(ctx, start.x, start.y, end.x, end.y, options.style);
            ctx.restore();
        }
    }

    // src/views/LineToolParallelChannelPaneView.ts
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
    class LineToolParallelChannelPaneView extends lightweightChartsLineToolsCore.LineToolPaneView {
        /**
         * Initializes the Parallel Channel View.
         *
         * @param source - The specific Parallel Channel model instance.
         * @param chart - The Chart API.
         * @param series - The Series API.
         */
        constructor(source, chart, series) {
            super(source, chart, series);
            /**
             * Internal renderer for the full channel shape (3 lines + fill).
             * @protected
             */
            this._channelRenderer = new ParallelChannelRenderer();
            /**
             * Internal renderer for the single base line segment (used during creation).
             * @protected
             */
            this._segmentRenderer = new lightweightChartsLineToolsCore.SegmentRenderer();
        }
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
        _updateImpl(height, width) {
            this._invalidated = false;
            this._renderer.clear();
            const options = this._tool.options();
            if (!options.visible) {
                this._renderer.clear();
                return;
            }
            /**
             * CULLING CHECK
             *
             * We query the Model's pre-calculated state. This ensures that the
             * channel fill remains visible even if the user is zoomed into
             * the center of the slanted area where no borders are visible.
             */
            if (this._tool.isCulled()) {
                //console.log('parallel channel culled')
                return;
            }
            // 2. Convert Points to Screen Coordinates
            const hasScreenPoints = this._updatePoints();
            if (!hasScreenPoints) {
                this._renderer.clear();
                return;
            }
            const currentPoints = this._tool.points(); // Re-fetch, should be the same as 'points' above
            const compositeRenderer = this._renderer;
            compositeRenderer.clear();
            // --- 3. RENDERING STATE MACHINE ---
            /**
             * RENDERING STATE MACHINE
             *
             * The visual representation changes based on the creation progress:
             * - **2 Points (Ghosting P1):** We only have the Base Line. We use `SegmentRenderer` to draw a simple line.
             * - **3 Points (Ghosting P2 or Final):** We have the full shape. We use `ParallelChannelRenderer` to draw the filled parallelogram.
             */
            if (currentPoints.length === 2) {
                // State: After 1st click, ghosting P1 (drawing the P0-P1 segment).
                const [p0, p1] = this._points; // Screen coordinates P0, P1_ghost
                // Use a segment renderer to draw the base line P0-P1_ghost
                this._segmentRenderer.setData({
                    points: [p0, p1],
                    // Pass the line options, but must ensure 'extend' is false for the segment render
                    line: {
                        ...options.channelLine,
                        extend: { left: false, right: false },
                        join: lightweightChartsLineToolsCore.LineJoin.Miter,
                        cap: lightweightChartsLineToolsCore.LineCap.Butt,
                    }, // Cast is safe as we Omitted properties for the interface
                    toolDefaultHoverCursor: options.defaultHoverCursor,
                    toolDefaultDragCursor: options.defaultDragCursor,
                });
                compositeRenderer.append(this._segmentRenderer);
            }
            else if (currentPoints.length >= 3) {
                // --- State: Final or Ghosting P2 (Drawing the full parallel shape) ---
                const [point0, point1, point2] = this._points; // Screen coordinates P0, P1, P2_ghost or final
                // 2. Setup Renderer Data
                const channelRendererData = {
                    points: [point0, point1, point2],
                    channelLine: options.channelLine,
                    middleLine: options.middleLine,
                    showMiddleLine: options.showMiddleLine,
                    extend: options.extend,
                    background: options.background,
                    hitTestBackground: false,
                    toolDefaultHoverCursor: options.defaultHoverCursor,
                    toolDefaultDragCursor: options.defaultDragCursor,
                };
                this._channelRenderer.setData(channelRendererData);
                compositeRenderer.append(this._channelRenderer);
            }
            else {
                // 0 or 1 point (P0 ghosting state) - nothing to draw yet.
                return;
            }
            // 4. Add Anchors (always last for hit-test priority)
            //if (this.areAnchorsVisible()) {
            this._addAnchors(compositeRenderer);
            //}
        }
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
        _addAnchors(renderer) {
            if (this._points.length < 3)
                return;
            // P0, P1, P2 are screen points from _points array
            const [p0Screen, p1Screen, p2Screen] = this._points;
            // Calculate virtual anchor points in screen coordinates (P3, Midpoints)
            const tool = this._tool;
            const getScreenPoint = (index) => {
                const logicalPoint = tool.getPoint(index);
                const screenPoint = logicalPoint ? tool.pointToScreenPoint(logicalPoint) : new lightweightChartsLineToolsCore.Point(0, 0);
                // We return a new AnchorPoint instance with the correct index and screen coordinates
                return new lightweightChartsLineToolsCore.AnchorPoint(screenPoint.x, screenPoint.y, index, false);
            };
            const p3Screen = getScreenPoint(3); // P3 (4th corner - Bottom Right)
            const heightMidScreen = getScreenPoint(4); // Height Midpoint (Bottom Middle)
            const baseMidScreen = getScreenPoint(5); // Translation Midpoint (Top Middle)
            // Anchor points array (must be an AnchorPoint instance to hold the index and cursor)
            const anchorPoints = [
                // 0: Top-Left (P0) - Rigid X/Y movement. Use 'Move' or 'Diagonal'
                new lightweightChartsLineToolsCore.AnchorPoint(p0Screen.x, p0Screen.y, 0, false, lightweightChartsLineToolsCore.PaneCursorType.Move),
                // 1: Top-Right (P1) - Rigid X/Y movement. Use 'Move' or 'Diagonal'
                new lightweightChartsLineToolsCore.AnchorPoint(p1Screen.x, p1Screen.y, 1, false, lightweightChartsLineToolsCore.PaneCursorType.Move),
                // 2: Bottom-Left (P2) - Rigid X/Y movement. Use 'Move' or 'Diagonal'
                new lightweightChartsLineToolsCore.AnchorPoint(p2Screen.x, p2Screen.y, 2, false, lightweightChartsLineToolsCore.PaneCursorType.Move),
                // 3: Bottom-Right (P3) - Rigid X/Y movement. Use 'Move' or 'Diagonal'
                new lightweightChartsLineToolsCore.AnchorPoint(p3Screen.x, p3Screen.y, 3, false, lightweightChartsLineToolsCore.PaneCursorType.Move),
                // 4: Bottom Middle (Height Midpoint) - ONLY adjusts vertical height (Y)
                new lightweightChartsLineToolsCore.AnchorPoint(heightMidScreen.x, heightMidScreen.y, 4, true, lightweightChartsLineToolsCore.PaneCursorType.VerticalResize),
                // 5: Top Middle (Height Adjustment from Top) - ONLY adjusts vertical height (Y)
                new lightweightChartsLineToolsCore.AnchorPoint(baseMidScreen.x, baseMidScreen.y, 5, true, lightweightChartsLineToolsCore.PaneCursorType.VerticalResize),
            ];
            const anchorData = {
                points: anchorPoints,
            };
            // Pass tool-level default anchor cursors to createLineAnchor
            const toolOptions = this._tool.options();
            renderer.append(this.createLineAnchor({
                ...anchorData,
                defaultAnchorHoverCursor: toolOptions.defaultAnchorHoverCursor,
                defaultAnchorDragCursor: toolOptions.defaultAnchorDragCursor,
            }, 0));
        }
    }

    // src/model/LineToolParallelChannel.ts
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
    const ParallelChannelOptionDefaults = {
        visible: true,
        editable: true,
        defaultHoverCursor: lightweightChartsLineToolsCore.PaneCursorType.Pointer,
        defaultDragCursor: lightweightChartsLineToolsCore.PaneCursorType.Grabbing,
        defaultAnchorHoverCursor: lightweightChartsLineToolsCore.PaneCursorType.Pointer,
        defaultAnchorDragCursor: lightweightChartsLineToolsCore.PaneCursorType.Grabbing,
        notEditableCursor: lightweightChartsLineToolsCore.PaneCursorType.NotAllowed,
        showPriceAxisLabels: false, // Default to false for complex tools
        showTimeAxisLabels: false,
        priceAxisLabelAlwaysVisible: false,
        timeAxisLabelAlwaysVisible: false,
        channelLine: {
            width: 1,
            color: '#2962ff',
            style: lightweightCharts.LineStyle.Solid,
        },
        middleLine: {
            width: 1,
            color: '#2962ff',
            style: lightweightCharts.LineStyle.Dashed,
        },
        showMiddleLine: true,
        extend: { left: false, right: false },
        background: { color: 'rgba(41, 98, 255, 0.2)' },
    };
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
    class LineToolParallelChannel extends lightweightChartsLineToolsCore.BaseLineTool {
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
        constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
            // 1. Create final options object
            const finalOptions = lightweightChartsLineToolsCore.deepCopy(ParallelChannelOptionDefaults);
            lightweightChartsLineToolsCore.merge(finalOptions, options);
            // 2. Call the BaseLineTool constructor
            super(coreApi, chart, series, horzScaleBehavior, finalOptions, points, 'ParallelChannel', 3, // 3-point tool
            priceAxisLabelStackingManager);
            /**
             * The unique identifier for this tool type ('ParallelChannel').
             *
             * @override
             */
            this.toolType = 'ParallelChannel';
            /**
             * Defines the number of anchor points required to draw this tool.
             *
             * A Parallel Channel is defined by exactly **3 points** (Start, End, and Width/Offset).
             *
             * @override
             */
            this.pointsCount = 3;
            // 3. Set the specific PaneView for this tool.
            this._setPaneViews([new LineToolParallelChannelPaneView(this, this._chart, this._series)]);
            console.log(`ParallelChannel Tool created with ID: ${this.id()}`);
        }
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
        maxAnchorIndex() {
            return 5;
        }
        /**
         * Enables geometric constraints (Shift key) during "Click-Click" creation.
         *
         * If `true`, holding Shift while placing the second point (P1) will lock the base line
         * to horizontal or vertical axes.
         *
         * @override
         * @returns `true`
         */
        supportsShiftClickClickConstraint() {
            return true; // We want Y-lock for the second click
        }
        /**
         * Enables geometric constraints (Shift key) during "Click-Drag" creation or editing.
         *
         * If `true`, holding Shift while dragging P1 will lock the base line's angle.
         *
         * @override
         * @returns `true`
         */
        supportsShiftClickDragConstraint() {
            return true; // We want Y-lock if the user drags the second point
        }
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
        getPoint(index) {
            const currentPoints = this.points();
            // P0, P1, P2 are the primary stored/ghosted points.
            if (index < 3) {
                return currentPoints[index] || null;
            }
            // Cannot calculate virtual anchors (3, 4, 5) if the primary points are missing.
            if (currentPoints.length < 3) {
                return null;
            }
            const [p0, p1, p2] = currentPoints;
            // 1. Anchor 3 (Derived 4th Corner - Bottom Right)
            // We derive P3 so that the segment P2-P3 is mathematically parallel to P0-P1.
            // Since the sides are rigid vertically, P3 shares P1's timestamp.
            if (index === 3) {
                const channelHeight = p1.price - p0.price;
                return {
                    timestamp: p1.timestamp,
                    price: p2.price + channelHeight,
                };
            }
            // 2. Identify the endpoints for the requested midpoint
            let midPointA;
            let midPointB;
            if (index === 4) {
                const p3 = this.getPoint(3);
                if (!p3)
                    return null;
                midPointA = p2;
                midPointB = p3;
            }
            else if (index === 5) {
                midPointA = p0;
                midPointB = p1;
            }
            else {
                return null;
            }
            // --- STABLE MIDPOINT CALCULATION START ---
            // 1. Convert Timestamps to Logical Indices (Grid Positions)
            // We use the core interpolation utility to find where these points sit on the chart grid.
            const idxA = lightweightChartsLineToolsCore.interpolateLogicalIndexFromTime(this._chart, this.getSeries(), midPointA.timestamp);
            const idxB = lightweightChartsLineToolsCore.interpolateLogicalIndexFromTime(this._chart, this.getSeries(), midPointB.timestamp);
            if (idxA === null || idxB === null) {
                // Fallback: If grid lookup fails, use raw time average
                return {
                    timestamp: (midPointA.timestamp + midPointB.timestamp) / 2,
                    price: (midPointA.price + midPointB.price) / 2,
                };
            }
            // 2. Average the Grid Positions
            // This handles the "Odd Width" issue (e.g., (Index 5 + Index 6) / 2 = 5.5)
            const midIndex = (idxA + idxB) / 2;
            // 3. Convert the fractional Grid Position back to a "Visual" Timestamp
            // Our core utility is designed to project time for these fractional spots.
            const stableTime = lightweightChartsLineToolsCore.interpolateTimeFromLogicalIndex(this._chart, this.getSeries(), midIndex);
            return {
                timestamp: stableTime !== null ? Number(stableTime) : (midPointA.timestamp + midPointB.timestamp) / 2,
                price: (midPointA.price + midPointB.price) / 2,
            };
            // --- STABLE MIDPOINT CALCULATION END ---
        }
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
        _constrainNewPrice(rawPrice) {
            const series = this.getSeries();
            if (!series)
                return rawPrice;
            // 1. Convert the raw price to a Y-coordinate (pixel)
            const rawCoord = series.priceToCoordinate(rawPrice);
            if (rawCoord === null)
                return rawPrice;
            // 2. Round the Y-coordinate to the nearest integer pixel
            const snappedCoord = Math.round(rawCoord);
            // 3. Convert the snapped Y-coordinate (pixel) back to a price value
            const snappedPrice = series.coordinateToPrice(snappedCoord);
            return snappedPrice !== null ? snappedPrice : rawPrice;
        }
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
        setPoint(index, newPoint) {
            const originalPoints = this._points;
            const P0 = originalPoints[0]; // Top-Left
            const P1 = originalPoints[1]; // Top-Right
            const P2 = originalPoints[2]; // Bottom-Left (defines channel's vertical offset)
            // Derived P3 (Bottom-Right)
            const P3 = this.getPoint(3);
            if (P3 === null)
                return;
            let priceDelta;
            let newP0;
            let newP1;
            let newP2;
            // Constrain the dragged price to the nearest stable price pixel for ALL corner/side drags (0, 1, 2, 3)
            const constrainedPrice = this._constrainNewPrice(newPoint.price);
            const constrainedPoint = { ...newPoint, price: constrainedPrice };
            switch (index) {
                // --- RIGID LEFT SIDE MOVEMENT (Anchors 0 and 2) ---
                case 0: // Top Left (P0) is dragged.
                case 2: { // Bottom Left (P2) is dragged.
                    // 1. Calculate the Y-distance (Price)
                    const channelHeightDelta = P2.price - P0.price;
                    // 2. The dragged point (constrainedPoint) sets the new position for the entire side.
                    // X-movement is now allowed (uses newPoint.timestamp)
                    if (index === 0) {
                        // Dragging P0: P0 moves to newPoint, P2 follows, maintaining height.
                        newP0 = constrainedPoint; // Uses new X and constrained Y
                        newP2 = {
                            timestamp: constrainedPoint.timestamp,
                            price: constrainedPoint.price + channelHeightDelta
                        };
                    }
                    else { // index === 2
                        // Dragging P2: P2 moves to newPoint, P0 follows, maintaining height.
                        newP2 = constrainedPoint; // Uses new X and constrained Y
                        newP0 = {
                            timestamp: constrainedPoint.timestamp,
                            price: constrainedPoint.price - channelHeightDelta
                        };
                    }
                    // Apply updates atomically
                    this._points[0] = newP0;
                    this._points[2] = newP2;
                    break;
                }
                // --- RIGID RIGHT SIDE MOVEMENT (Anchors 1 and 3) ---
                case 1: // Top Right (P1) is dragged.
                case 3: { // Bottom Right (P3 derived) is dragged.
                    // The base P1 position before the move
                    const oldP1 = this._points[1];
                    if (index === 1) {
                        // Dragging P1: P1 is simply set to the new, constrained position.
                        newP1 = constrainedPoint; // Uses new X and constrained Y
                    }
                    else { // index === 3 (Dragging P3)
                        // 1. Calculate the vertical delta of the P3 move relative to its original position.
                        // P3 is defined by this.getPoint(3), which we fetched at the start of setPoint.
                        const dragDeltaPrice = constrainedPoint.price - P3.price;
                        // 2. The P3 drag means P1 must move by the same vertical delta.
                        newP1 = {
                            timestamp: constrainedPoint.timestamp, // New X is from mouse
                            price: oldP1.price + dragDeltaPrice // New Y is P1's old Y + the delta
                        };
                    }
                    // Apply updates atomically
                    this._points[1] = newP1;
                    // P0 and P2 are left unchanged. This ensures only the right side moves.
                    break;
                }
                // --- VERTICAL HEIGHT ADJUSTMENT FROM BOTTOM (Anchor 4 - Bottom Middle) ---
                case 4: {
                    // Anchor 4 (Bottom Middle) moves the parallel line (P2-P3) vertically.
                    // This movement must be Y-only (X-locked).
                    const originalAnchor4 = this.getPoint(4);
                    if (!originalAnchor4)
                        return;
                    // Use the constrained newPoint for the delta calculation
                    // X is locked, so we use the original P2 X
                    priceDelta = constrainedPoint.price - originalAnchor4.price;
                    // Update P2: Y-position moves by the delta. X-position remains fixed.
                    newP2 = {
                        timestamp: P2.timestamp,
                        price: P2.price + priceDelta,
                    };
                    // Apply update
                    this._points[2] = newP2;
                    break;
                }
                // --- VERTICAL HEIGHT ADJUSTMENT FROM TOP (Anchor 5 - Top Middle) ---
                case 5: {
                    // Anchor 5 (Top Middle) moves the base line (P0-P1) vertically, leaving P2 fixed.
                    // This movement must be Y-only (X-locked).
                    const originalAnchor5 = this.getPoint(5);
                    if (!originalAnchor5)
                        return;
                    // Use the constrained newPoint for the delta calculation
                    priceDelta = constrainedPoint.price - originalAnchor5.price;
                    // Translate P0 and P1. P2 remains fixed.
                    newP0 = {
                        timestamp: P0.timestamp,
                        price: P0.price + priceDelta,
                    };
                    newP1 = {
                        timestamp: P1.timestamp,
                        price: P1.price + priceDelta,
                    };
                    // Apply updates atomically
                    this._points[0] = newP0;
                    this._points[1] = newP1;
                    break;
                }
                // --- FALLBACK (For primary points 0, 1, 2 if dragged directly) ---
                default:
                    // Fall back to the original BaseLineTool implementation for single-point edits.
                    super.setPoint(index, newPoint);
                    break;
            }
            // *** EFFICIENCY FIX: Only call update once, after all point manipulations are complete. ***
            this._triggerChartUpdate();
        }
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
        setLastPoint(point) {
            if (point === null) {
                super.setLastPoint(null);
                return;
            }
            // Check if we are ghosting the 3rd point (P2)
            // This happens when 2 permanent points (P0, P1) already exist.
            if (this._points.length === 2) {
                const p0 = this._points[0]; // P0 is permanent
                this._points[1]; // P1 is permanent
                // 1. Get the X-coordinate that P2 must be locked to.
                // Since we want a channel with rigid vertical sides, P2's X must lock to P0's X.
                const fixedTime = p0.timestamp;
                // 2. The Y-coordinate (price) is taken directly from the mouse (newPoint).
                const newPrice = point.price;
                // 3. Create the constrained point.
                const constrainedPoint = {
                    timestamp: fixedTime,
                    price: newPrice,
                };
                // 4. Set the constrained point as the last point.
                super.setLastPoint(constrainedPoint);
                return;
            }
            // For all other cases (ghosting P1), use the default unconstrained behavior
            // This means P1 is free to move in X and Y during its creation step.
            super.setLastPoint(point);
        }
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
        normalize() {
            if (this._points.length < 3) {
                return;
            }
            let p0 = this._points[0];
            let p1 = this._points[1];
            // Only normalize if the top line is drawn right-to-left
            if (p0.timestamp > p1.timestamp) {
                // 1. Get the position of the derived P3 (Bottom Right) BEFORE the swap.
                const P3_old_position = this.getPoint(3);
                if (P3_old_position === null)
                    return;
                // 2. SWAP: P0 <-> P1
                [this._points[0], this._points[1]] = [p1, p0];
                // 3. SWAP: P2 (old Bottom Left) must become the new Bottom Right's counterpart.
                // The new P2 must be the old P3 (Bottom Right) position to maintain the shape.
                this._points[2] = P3_old_position;
            }
        }
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
        _internalHitTest(x, y) {
            if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
                return null;
            }
            const paneView = this._paneViews[0];
            const compositeRenderer = paneView.renderer();
            if (!compositeRenderer || !compositeRenderer.hitTest) {
                return null;
            }
            return compositeRenderer.hitTest(x, y);
        }
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
        getShiftConstrainedPoint(pointIndex, rawScreenPoint, phase, originalLogicalPoint, allOriginalLogicalPoints) {
            // 1. Determine the Constraint Source Point (Logical Coordinates)
            let constraintSourceLogical = null;
            // --- SCENARIO A: CREATION PHASE (P1 Y-Lock to P0 Y) ---
            if (phase === lightweightChartsLineToolsCore.InteractionPhase.Creation) {
                // During creation, we are placing the 2nd point (P1). The constraint source is P0 (index 0).
                // The InteractionManager passes allOriginalLogicalPoints[0] as P0.
                // We ensure the constraint only applies when placing P1 (pointIndex should be 1).
                if (pointIndex === 1 && allOriginalLogicalPoints.length >= 1) {
                    // P0 (index 0) is the source point.
                    constraintSourceLogical = allOriginalLogicalPoints[0];
                }
            }
            // --- SCENARIO B: EDITING PHASE (Anchor Y-Lock to Opposite Anchor Y) ---
            else if (phase === lightweightChartsLineToolsCore.InteractionPhase.Editing) {
                // This is the logic for dragging one of the four corners (Indices 0, 1, 2, 3) 
                // while holding Shift to force a horizontal drag (Y-lock).
                // This is the logic you originally provided for the Edit phase (Constraining Corners)
                if (pointIndex === 0) { // Dragging P0 is constrained by P1
                    constraintSourceLogical = this.getPoint(1);
                }
                else if (pointIndex === 1) { // Dragging P1 is constrained by P0
                    constraintSourceLogical = this.getPoint(0);
                }
                else if (pointIndex === 2) { // Dragging P2 is constrained by P3
                    constraintSourceLogical = this.getPoint(3);
                }
                else if (pointIndex === 3) { // Dragging P3 is constrained by P2
                    constraintSourceLogical = this.getPoint(2);
                }
                else {
                    // No Y-lock constraint for middle anchors (4, 5) during editing.
                    return { point: rawScreenPoint, snapAxis: 'none' };
                }
            }
            // --- Fallback if no constraint is applicable or source is missing ---
            if (!constraintSourceLogical) {
                return { point: rawScreenPoint, snapAxis: 'none' };
            }
            // 2. Apply the Constraint (Same for both Creation and Editing Scenarios A & B)
            // Convert the constraint source's logical position to its current screen coordinates.
            // NOTE: If using 'this.getPoint(index)' for Editing, this is already the constrained logical point.
            const constraintSourceScreenPoint = this.pointToScreenPoint(constraintSourceLogical);
            // 3. The constraint is to set the new Y-coordinate to the other point's Y-coordinate.
            const constrainedY = constraintSourceScreenPoint.y;
            // The X coordinate is free to move (rawScreenPoint.x).
            const constrainedPoint = new lightweightChartsLineToolsCore.Point(rawScreenPoint.x, constrainedY);
            // The resulting segment is forced horizontal, meaning we are constraining the PRICE (Y) axis.
            return { point: constrainedPoint, snapAxis: 'price' };
        }
        /**
         * Overrides the base `addPoint` to enforce the X-axis lock when committing the 3rd point.
         *
         * While `setLastPoint` handles the *visual* constraint during the ghost phase, this method ensures
         * the *permanent* point stored in the model also adheres to the rule: P2.time must equal P0.time.
         *
         * @param point - The raw point from the mouse release event.
         * @override
         */
        addPoint(point) {
            // If it's the 1st or 2nd point, allow it as-is.
            if (this._points.length < 2) {
                super.addPoint(point);
                return;
            }
            // --- Constraint Logic for the 3rd Point (P2) ---
            if (this._points.length === 2) {
                // We are adding the 3rd point (P2). P0 already exists at index 0.
                const P0 = this._points[0];
                // 1. Lock the X-coordinate (timestamp) to P0's X (Time).
                const fixedTime = P0.timestamp;
                // 2. Use the raw Y-coordinate (price) from the mouse up position.
                const finalPointP2 = {
                    timestamp: fixedTime,
                    price: point.price,
                };
                // Commit the constrained point.
                super.addPoint(finalPointP2);
                return;
            }
            // Default fallback for any unexpected case (e.g., if a multi-point tool allows more than 3)
            super.addPoint(point);
        }
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
        updateCullingState() {
            const points = this.points();
            const options = this.options();
            // 1. Guard: Ensure the tool is fully formed before culling.
            if (points.length < this.pointsCount || this.isCreating() || this.isEditing()) {
                this._setIsCulled(false);
                return;
            }
            // --- AREA-BASED CULLING START ---
            // 2. Derive the 4th corner (P3) to ensure the bounding box is complete.
            const p3 = this.getPoint(3);
            if (!p3) {
                this._setIsCulled(false);
                return;
            }
            // 3. Construct the array of all 4 geometric corners.
            const channelCorners = [points[0], points[1], points[2], p3];
            // 4. Invoke the Core Culler in Area-Based mode.
            // This handles the overlap check and infinite extensions in one O(1) step.
            const cullingState = lightweightChartsLineToolsCore.getToolCullingState(channelCorners, this, options.extend, undefined, undefined, true // isAreaBased: true
            );
            this._setIsCulled(cullingState !== lightweightChartsLineToolsCore.OffScreenState.Visible);
            // --- AREA-BASED CULLING END ---
        }
    }

    // src/index.ts
    // Define the name under which this specific tool will be registered
    const PARALLEL_CHANNEL_NAME = 'ParallelChannel';
    /**
     * Registers the Parallel Channel tool with the provided Core Plugin instance.
     *
     * This function serves as the entry point to enable the Parallel Channel functionality
     * within your Lightweight Charts application.
     *
     * @param corePlugin - The instance of the Core Line Tools Plugin (created via `createLineToolsPlugin`).
     * @returns void
     *
     */
    function registerParallelChannelPlugin(corePlugin) {
        // 1. Register the ParallelChannel Tool
        corePlugin.registerLineTool(PARALLEL_CHANNEL_NAME, LineToolParallelChannel);
        console.log(`Registered Line Tool: ${PARALLEL_CHANNEL_NAME}`);
    }

    exports.LineToolParallelChannel = LineToolParallelChannel;
    exports.default = registerParallelChannelPlugin;
    exports.registerParallelChannelPlugin = registerParallelChannelPlugin;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=lightweight-charts-line-tools-parallel-channel.umd.js.map
