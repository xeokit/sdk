export type BCFViewpointData = {
    snapshot?: {
        snapshot_data: any;
        snapshot_type: string
    };
    clipping_planes?: any[];
    components?: {
        visibility: {
            default_visibility: any;
            exceptions: any[];
            view_setup_hints: any;
        };
        selection: any[];
        coloring: any[];
    };
    perspective_camera?: {
        camera_view_point: any;
        camera_direction: any;
        camera_up_vector: any;
        field_of_view: any;
    };
    orthogonal_camera?: {
        camera_view_point: any;
        camera_direction: any;
        camera_up_vector: any;
        view_to_world_scale: any;
    };
};