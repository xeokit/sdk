/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdatatypes.svg)](https://badge.fury.io/js/%40xeokit%2Fdatatypes)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/basictypes/badge)](https://www.jsdelivr.com/package/npm/@xeokit/basictypes)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:130px;" src="media://images/cityJSONLogo.svg"/>
 *
 * # xeokit CityJSON 1.1.3 Data Types
 *
 * * Defines numeric constants for the set of [CityJSON](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#cityjson) 1.1.3 entity and relationship types.
 * * Use with {@link "@xeokit/data" | @xeokit/data}  to assign CityJSON types to {@link @xeokit/data!DataObject | DataObjects}
 * and {@link @xeokit/data!Relationship | Relationships} and treat them as elements of a basic entity-relationship graph.
 * * Use with {@link "@xeokit/treeview" | @xeokit/treeview} , to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating CityJSON objects.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/cityjsontypes1x1x3
 * ````
 *
 * @module @xeokit/cityjsontypes_1_1_3
 */

/**
 * A generic aggregation relationship between two generic entities.
 */
export const BasicAggregation = 2001;

/**
 * This CityObject type represents a bridge, which can have attributes such as the length, height, and type of bridge.
 */
export const Bridge = 2000;

/**
 * This CityJSON object represents a physical or functional subdivision of a Bridge.
 */
export const BridgePart = 2001;

/**
 * This CityJSON type represents a permanent part of a Bridge (inside and/or outside) which does not have the significance of a
 * BridgePart. In contrast to BridgeConstructiveElements, a BridgeInstallation is not essential from a structural point of view.
 * Examples are stairs, antennas or railways.
 */
export const BridgeInstallation = 2002;

/**
 * This CityJSON type represents an element of a bridge which is essential from a structural point of view. Examples are pylons,
 * anchorages, slabs, beams.
 */
export const BridgeConstructiveElement = 2003;

/**
 * This CityJSON type represents  a space within a Bridge or BridgePart intended for human occupancy (e.g. a place of work or
 * recreation) and/or containment (storage) of animals or things. A BridgeRoom is bounded physically and/or virtually (e.g. by
 * ClosureSurfaces or GenericSurfaces).
 */
export const BridgeRoom = 2004;

/**
 * This CityJSON type represents equipment for occupant use, usually not fixed to the bridge. [cf. ISO 6707-1]
 */
export const BridgeFurniture = 2005;

/**
 *  This CityObject type represents a building, which can contain one or more "BuildingPart" objects. The Building object can
 *  have attributes such as the building height, number of floors, and the year of construction.
 */
export const Building = 2006;

/**
 * This CityObject type represents a part of a building, such as a wing or a tower. Building parts can have attributes such
 * as the building part height and the material used in its construction.
 */
export const BuildingPart = 2007;

/**
 * This CityJSON type represents a permanent part of a Building (inside and/or outside) which has not the significance of a
 * BuildingPart. Examples are stairs, antennas, balconies or small roofs.
 */
export const BuildingInstallation = 2008;

/**
 * This CityJSON type represents an element of a Building which is essential from a structural point of view. Examples are walls,
 * slabs, staircases, beams.
 */
export const BuildingConstructiveElement = 2009;

/**
 * This CityJSON type represents equipment for occupant use, usually not fixed to the building. [cf. ISO 6707-1]
 */
export const BuildingFurniture = 2010;

/**
 * This CityJSON type represents  a horizontal section of a Building. BuildingStorey are not always defined according to the
 * building structure, but can also be defined according to logical considerations.
 */
export const BuildingStorey = 2011;

/**
 * This CityJSON type represents a space within a Building or BuildingPart intended for human occupancy (e.g. a place of work or recreation)
 * and/or containment of animals or things. A BuildingRoom is bounded physically and/or virtually (e.g. by ClosureSurfaces or GenericSurfaces).
 */
export const BuildingRoom = 2012;

/**
 * This CityJSON type represents a logical subdivision of a Building. BuildingUnits are formed according to some homogeneous
 * property like function, ownership, management, or accessibility. They may be separately sold, rented out, inherited, managed, etc.
 */
export const BuildingUnit = 2013;

/**
 * This CityObject type represents outdoor furniture, such as benches, trash cans, and street lamps. CityFurniture objects can
 * have attributes such as the type of furniture and its location.
 */
export const CityFurniture = 2014;

/**
 * This CityObject type represents a group of other CityObjects. CityObjectGroup objects can have attributes such as the name
 * of the group and the CityObjects it contains.
 */
export const CityObjectGroup = 2015;

/**
 * This CityObject type represents the land use of a particular area, such as residential, commercial, or industrial. LandUse
 * objects can have attributes such as the name of the land use and the area it covers.
 */
export const LandUse = 2016;

/**
 * this CityObject type represents an unclassified, generic element of construction.
 */
export const OtherConstruction = 2017;

/**
 * This CityObject type represents vegetation, such as trees, bushes, and grass. PlantCover objects can have attributes such
 * as the type of vegetation and its location.
 */
export const PlantCover = 2018;

/**
 * This CityObject type represents individual vegetation objects, e.g. trees or bushes.
 */
export const SolitaryVegetationObject = 2019;

/**
 * This CityJSON type represents a terrain component as a triangulated irregular network.
 */
export const TINRelief = 2020;


export const TransportationSquare = 2021;

/**
 * This CityObject type represents a railway, which can have attributes such as the type of railway and the tracks' location.
 */
export const Railway = 2022;

/**
 * This CityObject type represents a road, which can have attributes such as the road type and the road's location.
 */
export const Road = 2023;

/**
 * This CityObject type  is used to represent any type of underground or underwater structure designed for passage or transportation,
 * such as a subway or water tunnel. It is defined by its geometry and other attributes.
 */
export const Tunnel = 2024;

/**
 * This CityObject type represents a physical or functional subdivision of a Tunnel. It would be considered a Tunnel, if it were
 * not part of a collection of other TunnelParts.
 */
export const TunnelPart = 2025;

/**
 * This CityObject type represents  a permanent part of a Tunnel (inside and/or outside) which does not have the significance of a
 * TunnelPart. In contrast to TunnelConstructiveElement, a TunnelInstallation is not essential from a structural point of view. Examples
 * are stairs, antennas or railings.
 */
export const TunnelInstallation = 2026;

/**
 * This CityObject type represents an element of a Tunnel which is essential from a structural point of view. Examples are walls, slabs, beams.
 */
export const TunnelConstructiveElement = 2027;

/**
 * This CityObject type represents a hollow space within a Tunnel.
 */
export const TunnelHollowSpace = 2028;

/**
 * This CityObject type represents equipment for occupant use, usually not fixed to the tunnel. [cf. ISO 6707-1]
 */
export const TunnelFurniture = 2029;

/**
 * This CityObject type represents a body of water, such as a river, lake, or ocean. It is defined by its geometry and other attributes,
 * and can be used to model and analyze hydrological features.
 */
export const WaterBody = 2030;

/**
 * This CityObject type  is used to represent a natural or man-made channel that carries water, such as a river, canal, or stormwater drain.
 * It is defined by its geometry and other attributes, and can be used to model and analyze hydrological features.
 */
export const Waterway = 2031;

/**
 * Map of names for all supported CityObject types.
 */
export const typeNames: { [key: number]: string } = {
    [Bridge]: "Bridge",
    [BridgePart]: "BridgePart",
    [BridgeInstallation]: "BridgeInstallation",
    [BridgeConstructiveElement]: "BridgeConstructiveElement",
    [BridgeRoom]: "BridgeRoom",
    [BridgeFurniture]: "BridgeFurniture",
    [Building]: "Building",
    [BuildingPart]: "BuildingPart",
    [BuildingInstallation]: "BuildingInstallation",
    [BuildingConstructiveElement]: "BuildingConstructiveElement",
    [BuildingFurniture]: "BuildingFurniture",
    [BuildingStorey]: "BuildingStorey",
    [BuildingRoom]: "BuildingRoom",
    [BuildingUnit]: "BuildingUnit",
    [CityFurniture]: "CityFurniture",
    [CityObjectGroup]: "CityObjectGroup",
    [LandUse]: "LandUse",
    [OtherConstruction]: "OtherConstruction",
    [PlantCover]: "PlantCover",
    [SolitaryVegetationObject]: "SolitaryVegetationObject",
    [TINRelief]: "TINRelief",
    [TransportationSquare]: "TransportationSquare",
    [Railway]: "Railway",
    [Road]: "Road",
    [Tunnel]: "Tunnel",
    [TunnelPart]: "TunnelPart",
    [TunnelInstallation]: "TunnelInstallation",
    [TunnelConstructiveElement]: "TunnelInstallation",
    [TunnelHollowSpace]: "TunnelHollowSpace",
    [TunnelFurniture]: "TunnelFurniture",
    [WaterBody]: "WaterBody",
    [Waterway]: "Waterway",
};

/**
 * Map of type codes for all CityObject type names.
 */
export const typeCodes: { [key: string]: number } = {
    "Bridge": Bridge,
    "BridgePart": BridgePart,
    "BridgeInstallation": BridgeInstallation,
    "BridgeConstructiveElement": BridgeConstructiveElement,
    "BridgeRoom": BridgeRoom,
    "BridgeFurniture": BridgeFurniture,
    "Building": Building,
    "BuildingPart": BuildingPart,
    "BuildingInstallation": BuildingInstallation,
    "BuildingConstructiveElement": BuildingConstructiveElement,
    "BuildingFurniture": BuildingFurniture,
    "BuildingStorey": BuildingStorey,
    "BuildingRoom": BuildingRoom,
    "BuildingUnit": BuildingUnit,
    "CityFurniture": CityFurniture,
    "CityObjectGroup": CityObjectGroup,
    "LandUse": LandUse,
    "OtherConstruction": OtherConstruction,
    "PlantCover": PlantCover,
    "SolitaryVegetationObject": SolitaryVegetationObject,
    "TINRelief": TINRelief,
    "TransportationSquare": TransportationSquare,
    "Railway": Railway,
    "Road": Road,
    "Tunnel": Tunnel,
    "TunnelPart": TunnelPart,
    "TunnelInstallation": TunnelInstallation,
    "TunnelConstructiveElement": TunnelInstallation,
    "TunnelHollowSpace": TunnelHollowSpace,
    "TunnelFurniture": TunnelFurniture,
    "WaterBody": WaterBody,
    "Waterway": Waterway
};
