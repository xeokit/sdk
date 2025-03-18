/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/cityJSONLogo.svg"/>
 *
 * # xeokit CityJSON 1.1.3 Data Types
 *
 * * Defines numeric constants for the set of [CityJSON](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson) 1.1.3 entity and relationship types.
 * * Use with {@link data | data} to assign CityJSON types to {@link data!DataObject | DataObjects}
 *   and {@link data!Relationship | Relationships} and treat them as elements of a basic entity-relationship graph.
 * * Use with {@link "treeview" | treeview} to configure the appearance and behavior of
 *   {@link treeview!TreeView | TreeViews} for navigating CityJSON objects.
 *
 * # Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * # Usage
 *
 * ```javascript
 * import { BasicEntity, BasicAggregation } from "@xeokit/sdk/basctypes";
 *
 * //...
 * ```
 *
 * @module cityjsontypes_1_1_3
 */
/**
 * A generic aggregation relationship between two generic CityJSON entities.
 */
export declare const BasicAggregation = 2001;
/**
 * This CityJSON type represents a bridge, which can have attributes such as length, height, and type of bridge.
 */
export declare const Bridge = 2000;
/**
 * This CityJSON type represents a physical or functional subdivision of a bridge.
 */
export declare const BridgePart = 2001;
/**
 * This CityJSON type represents a permanent part of a bridge (inside and/or outside) that does not have the significance of a BridgePart.
 * In contrast to BridgeConstructiveElements, a BridgeInstallation is not essential from a structural point of view.
 * Examples include stairs, antennas, or railways.
 */
export declare const BridgeInstallation = 2002;
/**
 * This CityJSON type represents an essential structural element of a bridge. Examples include pylons, anchorages, slabs, and beams.
 */
export declare const BridgeConstructiveElement = 2003;
/**
 * This CityJSON type represents a space within a bridge or bridge part intended for human occupancy (e.g., a workplace or recreational space)
 * or for storing animals or objects. It is bounded physically and/or virtually (e.g., by ClosureSurfaces or GenericSurfaces).
 */
export declare const BridgeRoom = 2004;
/**
 * This CityJSON type represents equipment for occupant use within a bridge, usually not fixed to the structure. [cf. ISO 6707-1]
 */
export declare const BridgeFurniture = 2005;
/**
 * This CityJSON type represents a building, which can contain one or more "BuildingPart" objects. A building can have attributes
 * such as height, number of floors, and year of construction.
 */
export declare const Building = 2006;
/**
 * This CityJSON type represents a part of a building, such as a wing or a tower. Building parts can have attributes such as height and material used.
 */
export declare const BuildingPart = 2007;
/**
 * This CityJSON type represents a permanent part of a building (inside and/or outside) that does not have the significance of a BuildingPart.
 * Examples include stairs, antennas, balconies, or small roofs.
 */
export declare const BuildingInstallation = 2008;
/**
 * This CityJSON type represents an essential structural element of a building. Examples include walls, slabs, staircases, and beams.
 */
export declare const BuildingConstructiveElement = 2009;
/**
 * This CityJSON type represents equipment for occupant use within a building, usually not fixed to the structure. [cf. ISO 6707-1]
 */
export declare const BuildingFurniture = 2010;
/**
 * This CityJSON type represents a horizontal section of a building. Building storeys are sometimes defined by logical considerations rather than structural elements.
 */
export declare const BuildingStorey = 2011;
/**
 * This CityJSON type represents a space within a building or building part intended for human occupancy or storage. It is bounded physically and/or virtually.
 */
export declare const BuildingRoom = 2012;
/**
 * This CityJSON type represents a logical subdivision of a building, often defined by function, ownership, management, or accessibility.
 */
export declare const BuildingUnit = 2013;
/**
 * This CityJSON type represents various types of city furniture, such as benches, trash cans, and street lamps.
 */
export declare const CityFurniture = 2014;
/**
 * This CityJSON type represents a group of other CityObjects. A CityObjectGroup can have attributes such as a name and a list of contained objects.
 */
export declare const CityObjectGroup = 2015;
/**
 * This CityJSON type represents the land use of a particular area, such as residential, commercial, or industrial zones.
 */
export declare const LandUse = 2016;
/**
 * This CityJSON type represents an unclassified, generic element of construction.
 */
export declare const OtherConstruction = 2017;
/**
 * This CityJSON type represents vegetation, such as trees, bushes, and grass.
 */
export declare const PlantCover = 2018;
/**
 * This CityJSON type represents individual vegetation objects, such as trees or bushes.
 */
export declare const SolitaryVegetationObject = 2019;
/**
 * This CityJSON type represents a terrain component modeled as a triangulated irregular network (TIN).
 */
export declare const TINRelief = 2020;
/**
 * This CityJSON type represents a transportation square, which can include plazas and other large paved areas.
 */
export declare const TransportationSquare = 2021;
/**
 * This CityJSON type represents a railway, which can have attributes such as track type and location.
 */
export declare const Railway = 2022;
/**
 * This CityJSON type represents a road, which can have attributes such as type and location.
 */
export declare const Road = 2023;
/**
 * This CityJSON type represents a tunnel, including underground and underwater passages for transportation or other purposes.
 */
export declare const Tunnel = 2024;
/**
 * This CityJSON type represents a subdivision of a tunnel, defined as part of a larger tunnel system.
 */
export declare const TunnelPart = 2025;
/**
 * This CityJSON type represents a permanent installation within a tunnel, which is not structurally significant.
 */
export declare const TunnelInstallation = 2026;
/**
 * This CityJSON type represents a structural component of a tunnel, such as walls or beams.
 */
export declare const TunnelConstructiveElement = 2027;
/**
 * This CityJSON type represents a hollow space within a tunnel.
 */
export declare const TunnelHollowSpace = 2028;
/**
 * This CityJSON type represents furniture or equipment within a tunnel, usually not fixed to the structure.
 */
export declare const TunnelFurniture = 2029;
/**
 * This CityJSON type represents a body of water, such as a river, lake, or ocean.
 */
export declare const WaterBody = 2030;
/**
 * This CityJSON type represents a waterway, including rivers, canals, or stormwater drains.
 */
export declare const Waterway = 2031;
/**
 * Map of names for all supported CityObject types.
 */
export declare const typeNames: {
    [key: number]: string;
};
/**
 * Map of type codes for all CityObject type names.
 */
export declare const typeCodes: {
    [key: string]: number;
};
//# sourceMappingURL=index.d.ts.map
