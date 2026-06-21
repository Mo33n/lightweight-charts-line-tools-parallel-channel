/**
 * Main entry point for the 'lightweight-charts-line-tools-parallel-channel' plugin.
 * This file registers the LineToolParallelChannel class with the core line tools plugin.
 */
import { ILineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { LineToolParallelChannel } from './model/LineToolParallelChannel';
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
export declare function registerParallelChannelPlugin<HorzScaleItem>(corePlugin: ILineToolsPlugin & {
    registerLineTool: <H>(type: string, toolClass: new (...args: any[]) => any) => void;
}): void;
export { LineToolParallelChannel, };
export default registerParallelChannelPlugin;
