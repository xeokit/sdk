/**
 * A bitmap snapshot of the viewpoint.
 */
export interface BCFSnapshot {

    /**
     * Format of the snapshot.
     */
    snapshot_type: "png" | "jpeg",

    /**
     * Snapshot image data.
     */
    snapshot_data: string
}
