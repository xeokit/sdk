/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdatatypes.svg)](https://badge.fury.io/js/%40xeokit%2Fdatatypes)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/basictypes/badge)](https://www.jsdelivr.com/package/npm/@xeokit/basictypes)
 *
 * <img style="padding-top:20px; padding-bottom: 10px;" src="media://images/ifc_logo.png"/>
 *
 * # xeokit IFC Data Types
 *
 * * Defines numeric constants for [IFC](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#ifc) entity and relationship types.
 * * Use with {@link "@xeokit/data" | @xeokit/data}  to assign IFC types to {@link @xeokit/data!DataObject | DataObjects} and
 * {@link @xeokit/data!Relationship | Relationships} and treat them as IFC elements.
 * * Use with {@link "@xeokit/treeview" | @xeokit/treeview}  to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating IFC element hierachies.
 * * Supports IFC versions 2x3 and 4.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/basictypes
 * ````
 *
 * @module @xeokit/ifctypes
 */

/**
 * A request is the act or instance of asking for something, such as a request for information, bid submission, or performance of work.
 */
export const IfcActionRequest = 1000;

/**
 * The IfcActor defines all actors or human agents involved in a project during its full life cycle. It facilitates the use of person and organization definitions in the resource part of the IFC object model. This includes name, address, telecommunication addresses, and roles.
 */
export const IfcActor = 1001;

/**
 * This entity indicates a role which is performed by an actor, either a person, an organization or a person related to an organization.
 */
export const IfcActorRole: number = 1002;

/**
 * An actuator is a mechanical device for moving or controlling a mechanism or system. An actuator takes energy, usually created by air, electricity, or liquid, and converts that into some kind of motion.
 */
export const IfcActuator = 1003;

/**
 * The distribution control element type IfcActuatorType defines commonly shared information for occurrences of actuators. The set of shared information may include:
 */
export const IfcActuatorType = 1004;

/**
 * This abstract entity represents various kinds of postal and telecom addresses.
 */
export const IfcAddress = 1005;

/**
 * An advanced B-rep is a boundary representation model in which all faces, edges and vertices are explicitly represented. It is a solid with explicit topology and elementary or free-form geometry. The faces of the B-rep are of type IfcAdvancedFace. An advanced B-rep has to meet the same topological constraints as the manifold solid B-rep.
 */
export const IfcAdvancedBrep = 1006;

/**
 * The IfcAdvancedBrepWithVoids is a specialization of an advanced B-rep which contains one or more voids in its interior. The voids are represented as closed shells which are defined so that the shell normal point into the void.
 */
export const IfcAdvancedBrepWithVoids = 1007;

/**
 * An advanced face is a specialization of a face surface that has to meet requirements on using particular topological and geometric representation items for the definition of the faces, edges and vertices.
 */
export const IfcAdvancedFace = 1008;

/**
 * An air terminal is a terminating or origination point for the transfer of air between distribution system(s) and one or more spaces. It can also be used for the transfer of air between adjacent spaces.
 */
export const IfcAirTerminal = 1009;

/**
 * An air terminal box typically participates in an HVAC duct distribution system and is used to control or modulate the amount of air delivered to its downstream ductwork. An air terminal box type is often referred to as an "air flow regulator".
 */
export const IfcAirTerminalBox = 1010;

/**
 * The flow controller type IfcAirTerminalBoxType defines commonly shared information for occurrences of air terminal boxes. The set of shared information may include:
 */
export const IfcAirTerminalBoxType = 1011;

/**
 * The flow terminal type IfcAirTerminalType defines commonly shared information for occurrences of air terminals. The set of shared information may include:
 */
export const IfcAirTerminalType = 1012;

/**
 * An air-to-air heat recovery device employs a counter-flow heat exchanger between inbound and outbound air flow. It is typically used to transfer heat from warmer air in one chamber to cooler air in the second chamber (i.e., typically used to recover heat from the conditioned air being exhausted and the outside air being supplied to a building), resulting in energy savings from reduced heating (or cooling) requirements.
 */
export const IfcAirToAirHeatRecovery = 1013;

/**
 * The energy conversion device type IfcAirToAirHeatRecoveryType defines commonly shared information for occurrences of air to air heat recoverys. The set of shared information may include:
 */
export const IfcAirToAirHeatRecoveryType = 1014;

/**
 * An alarm is a device that signals the existence of a condition or situation that is outside the boundaries of normal expectation or that activates such a device.
 */
export const IfcAlarm = 1015;

/**
 * The distribution control element type IfcAlarmType defines commonly shared information for occurrences of alarms. The set of shared information may include:
 */
export const IfcAlarmType = 1016;

/**
 * An annotation is an information element within the geometric (and spatial) context of a project, that adds a note or meaning to the objects which constitutes the project model. Annotations include additional points, curves, text, dimensioning, hatching and other forms of graphical notes. It also includes virtual or symbolic representations of additional model components, not representing products or spatial structures, such as event elements, survey points, contour lines or similar.
 */
export const IfcAnnotation = 1017;

/**
 * The IfcAnnotationFillArea defines an area by a definite OuterBoundary, that might include InnerBoundaries. The areas defined by the InnerBoundaries are excluded from applying the fill area style. The InnerBoundaries shall not intersect with the OuterBoundary nor being outside of the OuterBoundary.
 */
export const IfcAnnotationFillArea = 1018;

/**
 * IfcApplication holds the information about an IFC compliant application developed by an application developer. The IfcApplication utilizes a short identifying name as provided by the application developer.
 */
export const IfcApplication = 1019;

/**
 * This entity captures a value driven by a formula, with additional qualifications including unit basis, valid date range, and categorization.
 */
export const IfcAppliedValue = 1020;

/**
 * An IfcApproval represents information about approval processes such as for a plan, a design, a proposal, or a change order in a construction or facilities management project. IfcApproval is referenced by IfcRelAssociatesApproval in IfcControlExtension schema, and thereby can be related to all subtypes of IfcRoot. An approval may also be given to resource objects using IfcResourceApprovalRelationship
 */
export const IfcApproval = 1021;

/**
 * An IfcApprovalRelationship associates approvals (one relating approval and one or more related approvals), each having different status or level as the approval process or the approved objects evolve.
 */
export const IfcApprovalRelationship = 1022;

/**
 * The closed profile IfcArbitraryClosedProfileDef defines an arbitrary two-dimensional profile for the use within the swept surface geometry, the swept area solid or a sectioned spine. It is given by an outer boundary from which the surface or solid can be constructed.
 */
export const IfcArbitraryClosedProfileDef = 1023;

/**
 * The open profile IfcArbitraryOpenProfileDef defines an arbitrary two-dimensional open profile for the use within the swept surface geometry. It is given by an open boundary from which the surface can be constructed.
 */
export const IfcArbitraryOpenProfileDef = 1024;

/**
 * The IfcArbitraryProfileDefWithVoids defines an arbitrary closed two-dimensional profile with holes. It is given by an outer boundary and inner boundaries. A kdtree3 usage of IfcArbitraryProfileDefWithVoids is as the cross section for the creation of swept surfaces or swept solids.
 */
export const IfcArbitraryProfileDefWithVoids = 1025;

/**
 * An asset is a uniquely identifiable grouping of elements acting as a single entity that has a financial value or that can be operated on as a single unit.
 */
export const IfcAsset = 1026;

/**
 * IfcAsymmetricIShapeProfileDef defines a section profile that provides the defining parameters of a singly symmetric I-shaped section. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export const IfcAsymmetricIShapeProfileDef = 1027;

/**
 * An audio-visual appliance is a device that displays, captures, transmits, or receives audio or video.
 */
export const IfcAudioVisualAppliance = 1028;

/**
 * The flow terminal type IfcAudioVisualApplianceType defines commonly shared information for occurrences of audio visual appliances. The set of shared information may include:
 */
export const IfcAudioVisualApplianceType = 1029;

/**
 * The IfcAxis1Placement provides location and direction of a single axis.
 */
export const IfcAxis1Placement = 1030;

/**
 * The IfcAxis2Placement2D provides location and orientation to place items in a two-dimensional space. The attribute RefDirection defines the x axis, the y axis is derived. If the attribute RefDirection is not given, the placement defaults to P[1] (x-axis) as [1.,0.] and P[2] (y-axis) as [0.,1.].
 */
export const IfcAxis2Placement2D = 1031;

/**
 * The IfcAxis2Placement3D provides location and orientations to place items in a three-dimensional space. The attribute Axis defines the Z direction, RefDirection the X direction. The Y direction is derived.
 */
export const IfcAxis2Placement3D = 1032;

/**
 * An IfcBeam is a horizontal, or nearly horizontal, structural member that is capable of withstanding load primarily by resisting bending. It represents such a member from an architectural point of view. It is not required to be load bearing.
 */
export const IfcBeam = 1033;

/**
 * The standard beam, IfcBeamStandardCase, defines a beam with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcBeamStandardCase handles all cases of beams, that:
 */
export const IfcBeamStandardCase = 1034;

/**
 * The element type IfcBeamType defines commonly shared information for occurrences of beams. The set of shared information may include:
 */
export const IfcBeamType = 1035;

/**
 * An IfcBlobTexture provides a 2-dimensional distribution of the lighting parameters of a surface onto which it is mapped. The texture itself is given as a single binary blob, representing the content of a pixel format file. The file format of the pixel file is given by the RasterFormat attribute and allowable formats are guided by where rule SupportedRasterFormat.
 */
export const IfcBlobTexture = 1036;

/**
 * The IfcBlock is a Construction Solid SceneGeometry (CSG) 3D primitive. It is defined by a position and a positve distance along the three orthogonal axes. The inherited Position attribute has the IfcAxisPlacement3D type and provides:
 */
export const IfcBlock = 1037;

/**
 * A boiler is a closed, pressure-rated vessel in which water or other fluid is heated using an energy source such as natural gas, heating oil, or electricity. The fluid in the vessel is then circulated out of the boiler for use in various processes or heating applications.
 */
export const IfcBoiler = 1038;

/**
 * The energy conversion device type IfcBoilerType defines commonly shared information for occurrences of boilers. The set of shared information may include:
 */
export const IfcBoilerType = 1039;

/**
 * A clipping result is defined as a special subtype of the general IfcBooleanResult. It constrains the operands and the operator of the Boolean result.
 */
export const IfcBooleanClippingResult = 1040;

/**
 * The IfcBooleanResult is the result of applying a Boolean operation to two operands being solids.
 */
export const IfcBooleanResult = 1041;

/**
 * The abstract entity IfcBoundaryCondition is the supertype of all boundary conditions that can be applied to structural connection definitions, either directly for the connection (e.g. the joint) or for the relation between a structural member and the connection.
 */
export const IfcBoundaryCondition = 1042;

/**
 * An IfcBoundaryCurve defines a curve acting as the boundary of a surface.
 */
export const IfcBoundaryCurve = 1043;

/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export const IfcBoundaryEdgeCondition = 1044;

/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export const IfcBoundaryFaceCondition = 1045;

/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export const IfcBoundaryNodeCondition = 1046;

/**
 * Describes linearly elastic support conditions or connection conditions, including linearly elastic warping restraints.
 */
export const IfcBoundaryNodeConditionWarping = 1047;

/**
 * An IfcBoundedCurve is a curve of finite length.
 */
export const IfcBoundedCurve = 1048;

/**
 * An IfcBoundedSurface is a surface of finite area.
 */
export const IfcBoundedSurface = 1049;

/**
 * The IfcBoundingBox defines an orthogonal box oriented parallel to the axes of the object coordinate system in which it is defined. It is defined by a Corner being a three-dimensional Cartesian point and three length measures defining the X, Y and Z parameters of the box in the direction of the positive axes.
 */
export const IfcBoundingBox = 1050;

/**
 * The IfcBoxedHalfSpace is used (as its supertype IfcHalfSpaceSolid) only within Boolean operations. It divides the domain into exactly two subsets, where the domain in question is that of the attribute Enclosure.
 */
export const IfcBoxedHalfSpace = 1051;

/**
 * The IfcBSplineCurve is a spline curve parameterized by spline functions.
 */
export const IfcBSplineCurve = 1052;

/**
 * The IfcBSplineCurveWithKnots is a spline curve parameterized by spline functions for which the knot values are explicitly given.
 */
export const IfcBSplineCurveWithKnots = 1053;

/**
 * The IfcBSplineSurface is a general form of rational or polynomial parametric surface.
 */
export const IfcBSplineSurface = 1054;

/**
 * The IfcBSplineSurfaceWithKnots is a general form of rational or polynomial parametric surface in which the knot values are explicitly given.
 */
export const IfcBSplineSurfaceWithKnots = 1055;

/**
 * A building represents a structure that provides shelter for its occupants or contents and stands in one place. The building is also used to provide a basic element within the spatial structure hierarchy for the components of a building project (together with site, storey, and space).
 */
export const IfcBuilding = 1056;

/**
 * IfcBuildingElementPart represents major components as subordinate parts of a building element. Typical usage examples include precast concrete sandwich walls, where the layers may have different geometry representations. In this case the layered material representation does not sufficiently describe the element. Each layer is represented by an own instance of the IfcBuildingElementPart with its own geometry description.
 */
export const IfcBuildingElementPart = 1057;

/**
 * The building element part type defines lists of commonly shared property set definitions and representation maps of parts of a building element.
 */
export const IfcBuildingElementPartType = 1058;

/**
 * The IfcBuildingElementProxy is a proxy definition that provides the same functionality as subtypes of IfcBuildingElement, but without having a predefined meaning of the special type of building element, it represents.
 */
export const IfcBuildingElementProxy = 1059;

/**
 * IfcBuildingElementProxyType defines a list of commonly shared property set definitions of a building element proxy and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcBuildingElementProxyType = 1060;

/**
 * The building storey has an elevation and typically represents a (nearly) horizontal aggregation of spaces that are vertically bound.
 */
export const IfcBuildingStorey = 1061;

/**
 * A building system is a group by which building elements are grouped according to a kdtree3 function within the facility.
 */
export const IfcBuildingSystem = 1062;

/**
 * A burner is a device that converts fuel into heat through combustion. It includes gas, oil, and wood burners.
 */
export const IfcBurner = 1063;

/**
 * The energy conversion device type IfcBurnerType defines commonly shared information for occurrences of burners. The set of shared information may include:
 */
export const IfcBurnerType = 1064;

/**
 * A cable carrier fitting is a fitting that is placed at junction or transition in a cable carrier system.
 */
export const IfcCableCarrierFitting = 1065;

/**
 * The flow fitting type IfcCableCarrierFittingType defines commonly shared information for occurrences of cable carrier fittings. The set of shared information may include:
 */
export const IfcCableCarrierFittingType = 1066;

/**
 * A cable carrier segment is a flow segment that is specifically used to carry and support cabling.
 */
export const IfcCableCarrierSegment = 1067;

/**
 * The flow segment type IfcCableCarrierSegmentType defines commonly shared information for occurrences of cable carrier segments. The set of shared information may include:
 */
export const IfcCableCarrierSegmentType = 1068;

/**
 * A cable fitting is a fitting that is placed at a junction, transition or termination in a cable system.
 */
export const IfcCableFitting = 1069;

/**
 * The flow fitting type IfcCableFittingType defines commonly shared information for occurrences of cable fittings. The set of shared information may include:
 */
export const IfcCableFittingType = 1070;

/**
 * A cable segment is a flow segment used to carry electrical power, data, or telecommunications signals.
 */
export const IfcCableSegment = 1071;

/**
 * The flow segment type IfcCableSegmentType defines commonly shared information for occurrences of cable segments. The set of shared information may include:
 */
export const IfcCableSegmentType = 1072;

/**
 * An IfcCartesianPoint defines a point by coordinates in an orthogonal, right-handed Cartesian coordinate system. For the purpose of this specification only two and three dimensional Cartesian points are used.
 */
export const IfcCartesianPoint = 1073;

/**
 * The IfcCartesianPointList is the abstract supertype of list of points.
 */
export const IfcCartesianPointList = 1074;

/**
 * The IfcCartesianPointList2D defines an ordered collection of two-dimentional Cartesian points. Each Cartesian point is provided as an two-dimensional point by a fixed list of two coordinates. The attribute CoordList is a two-dimensional list, where
 */
export const IfcCartesianPointList2D = 1075;

/**
 * The IfcCartesianPointList3D defines an ordered collection of three-dimentional Cartesian points. Each Cartesian point is provided as an three-dimensional point by a fixed list of three coordinates. The attribute CoordList is a two-dimensional list, where
 */
export const IfcCartesianPointList3D = 1076;

/**
 * An IfcCartesianTransformationOperator defines an abstract supertype of different kinds of geometric transformations.
 */
export const IfcCartesianTransformationOperator = 1077;

/**
 * An IfcCartesianTransformationOperator2D defines a geometric transformation in two-dimensional space.
 */
export const IfcCartesianTransformationOperator2D = 1078;

/**
 * A Cartesian transformation operator 2d non uniform defines a geometric transformation in two-dimensional space composed of translation, rotation, mirroring and non uniform scaling. Non uniform scaling is given by two different scaling factors:
 */
export const IfcCartesianTransformationOperator2DnonUniform = 1079;

/**
 * An IfcCartesianTransformationOperator defines a geometric transformation in three-dimensional space.
 */
export const IfcCartesianTransformationOperator3D = 1080;

/**
 * A Cartesian transformation operator 3d non uniform defines a geometric transformation in three-dimensional space composed of translation, rotation, mirroring and non uniform scaling. Non uniform scaling is given by three different scaling factors:
 */
export const IfcCartesianTransformationOperator3DnonUniform = 1081;

/**
 * The profile IfcCenterLineProfileDef defines an arbitrary two-dimensional open, not self intersecting profile for the use within the swept solid geometry. It is given by an area defined by applying a constant thickness to a centerline, generating an area from which the solid can be constructed.
 */
export const IfcCenterLineProfileDef = 1082;

/**
 * A chiller is a device used to remove heat from a liquid via a vapor-compression or absorption refrigeration cycle to cool a fluid, typically water or a mixture of water and glycol. The chilled fluid is then used to cool and dehumidify air in a building.
 */
export const IfcChiller = 1083;

/**
 * The energy conversion device type IfcChillerType defines commonly shared information for occurrences of chillers. The set of shared information may include:
 */
export const IfcChillerType = 1084;

/**
 * Chimneys are typically vertical, or as near as vertical, parts of the construction of a building and part of the building fabric. Often constructed by pre-cast or insitu concrete, today seldom by bricks.
 */
export const IfcChimney = 1085;

/**
 * The building element type IfcChimneyType defines commonly shared information for occurrences of chimneys. The set of shared information may include:
 */
export const IfcChimneyType = 1086;

/**
 * An IfcCircle is a curve consisting of a set of points having equal distance from the center.
 */
export const IfcCircle = 1087;

/**
 * IfcCircleHollowProfileDef defines a section profile that provides the defining parameters of a circular hollow section (tube) to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration.The centre of the position coordinate system is in the profile's centre of the bounding box (for symmetric profiles identical with the centre of gravity).
 */
export const IfcCircleHollowProfileDef = 1088;

/**
 * IfcCircleProfileDef defines a circle as the profile definition used by the swept surface geometry or by the swept area solid. It is given by its Radius attribute and placed within the 2D position coordinate system, established by the Position attribute.
 */
export const IfcCircleProfileDef = 1089;

/**
 * An IfcCivilElement is a generalization of all elements within a civil engineering works that cannot be represented as BuildingElements, DistributionElements or GeographicElements. Depending on the context of the construction project, included building work, such as buildings or factories, are represented as a collection of IfcBuildingElement's, distribution systems, such as piping or drainage, are represented as a collection of IfcDistributionElement's, and other geographic elements, such as trees, light posts, traffic signs etc. are represented as IfcGeographicElement's.
 */
export const IfcCivilElement = 1090;

/**
 * An IfcCivilElementType is used to define an element specification of an element used within civil engineering works. Civil element types include for different types of element that may be used to represent information for construction works external to a building. IfcCivilElementType's may include:
 */
export const IfcCivilElementType = 1091;

/**
 * An IfcClassification is used for the arrangement of objects into a class or category according to a kdtree3 purpose or their possession of kdtree3 characteristics. A classification in the sense of IfcClassification is taxonomy, or taxonomic scheme, arranged in a hierarchical structure. A category of objects relates to other categories in a generalization-specialization relationship. Therefore the classification items in an classification are organized in a tree structure.
 */
export const IfcClassification = 1092;

/**
 * An IfcClassificationReference is a reference into a classification system or source (see IfcClassification) for a specific classification key (or notation).
 */
export const IfcClassificationReference = 1093;

/**
 *
 */
export const IfcClosedShell = 1094;

/**
 * A coil is a device used to provide heat transfer between non-mixing media. A kdtree3 example is a cooling coil, which utilizes a finned coil in which circulates chilled water, antifreeze, or refrigerant that is used to remove heat from air moving across the surface of the coil. A coil may be used either for heating or cooling purposes by placing a series of tubes (the coil) carrying a heating or cooling fluid into an airstream. The coil may be constructed from tubes bundled in a serpentine form or from finned tubes that give a extended heat transfer surface.
 */
export const IfcCoil = 1095;

/**
 * The energy conversion device type IfcCoilType defines commonly shared information for occurrences of coils. The set of shared information may include:
 */
export const IfcCoilType = 1096;

/**
 *
 */
export const IfcColourRgb = 1097;

/**
 * The IfcColourRgbList defines an ordered collection of RGB colour values. Each colour value is a fixed list of three colour components (red, green, blue). The attribute ColourList is a two-dimensional list, where:
 */
export const IfcColourRgbList = 1098;

/**
 *
 */
export const IfcColourSpecification = 1099;

/**
 * <An IfcColumn is a vertical structural member which often is aligned with a structural grid intersection. It represents a vertical, or nearly vertical, structural member that transmits, through compression, the weight of the structure above to other structural elements below. It represents such a member from an architectural point of view. It is not required to be load bearing.
 */
export const IfcColumn = 1100;

/**
 * The standard column, IfcColumnStandardCase, defines a column with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcColumnStandardCase handles all cases of columns, that:
 */
export const IfcColumnStandardCase = 1101;

/**
 * The element type IfcColumnType defines commonly shared information for occurrences of columns. The set of shared information may include:
 */
export const IfcColumnType = 1102;

/**
 * A communications appliance transmits and receives electronic or digital information as data or sound.
 */
export const IfcCommunicationsAppliance = 1103;

/**
 * The flow terminal type IfcCommunicationsApplianceType defines commonly shared information for occurrences of communications appliances. The set of shared information may include:
 */
export const IfcCommunicationsApplianceType = 1104;

/**
 * IfcComplexProperty is used to define complex properties to be handled completely within a property set. The included set of properties may be a mixed or consistent collection of IfcProperty subtypes. This enables the definition of a set of properties to be included as a single 'property' entry in an IfcPropertySet. The definition of such an IfcComplexProperty can be reused in many different IfcPropertySet's.
 */
export const IfcComplexProperty = 1105;

/**
 * The IfcComplexPropertyTemplate defines the template for all complex properties, either the IfcComplexProperty's, or the IfcPhysicalComplexQuantity's. The individual complex property templates are interpreted according to their Name attribute and and optional UsageName attribute.
 */
export const IfcComplexPropertyTemplate = 1106;

/**
 * An IfcCompositeCurve is a continuous curve composed of curve segments.
 */
export const IfcCompositeCurve = 1107;

/**
 * The IfcCompositeCurveOnSurface is a collection of segments, based on p-curves. i.e. a curve which lies on the basis of a surface and is defined in the parameter space of that surface. The p-curve segment is a special type of a composite curve segment and shall only be used to bound a surface.
 */
export const IfcCompositeCurveOnSurface = 1108;

/**
 * An IfcCompositeCurveSegment is a bounded curve constructed for the sole purpose to be a segment within an IfcCompositeCurve.
 */
export const IfcCompositeCurveSegment = 1109;

/**
 * The IfcCompositeProfileDef defines the profile by composition of other profiles. The composition is given by a set of at least two other profile definitions. Any profile definition (except for another composite profile) can be used to construct the composite.
 */
export const IfcCompositeProfileDef = 1110;

/**
 * A compressor is a device that compresses a fluid typically used in a refrigeration circuit.
 */
export const IfcCompressor = 1111;

/**
 * The flow moving device type IfcCompressorType defines commonly shared information for occurrences of compressors. The set of shared information may include:
 */
export const IfcCompressorType = 1112;

/**
 * A condenser is a device that is used to dissipate heat, typically by condensing a substance such as a refrigerant from its gaseous to its liquid state.
 */
export const IfcCondenser = 1113;

/**
 * The energy conversion device type IfcCondenserType defines commonly shared information for occurrences of condensers. The set of shared information may include:
 */
export const IfcCondenserType = 1114;

/**
 * An IfcConic is a parameterized planar curve.
 */
export const IfcConic = 1115;

/**
 *
 */
export const IfcConnectedFaceSet = 1116;

/**
 * IfcConnectionCurveGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a curve or at an edge with curve geometry associated. It is envisioned as a control that applies to the element connection relationships.
 */
export const IfcConnectionCurveGeometry = 1117;

/**
 * IfcConnectionGeometry is used to describe the geometric and topological constraints that facilitate the physical connection of two objects. It is envisioned as a control that applies to the element connection relationships.
 */
export const IfcConnectionGeometry = 1118;

/**
 * IfcConnectionPointEccentricity is used to describe the geometric constraints that facilitate the physical connection of two objects at a point or vertex point with associated point coordinates. There is a physical distance, or eccentricity, etween the connection points of both object. The eccentricity can be either given by:
 */
export const IfcConnectionPointEccentricity = 1119;

/**
 * IfcConnectionPointGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a point (here IfcCartesianPoint) or at an vertex with point coordinates associated. It is envisioned as a control that applies to the element connection relationships.
 */
export const IfcConnectionPointGeometry = 1120;

/**
 * IfcConnectionSurfaceGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a surface or at a face with surface geometry associated. It is envisioned as a control that applies to the element connection relationships.
 */
export const IfcConnectionSurfaceGeometry = 1121;

/**
 * IfcConnectionVolumeGeometry is used to describe the geometric constraints that facilitate the physical connection (or overlap) of two objects at a volume defined by a solid or closed shell. It is envisioned as a control that applies to the element connection or interference relationships.
 */
export const IfcConnectionVolumeGeometry = 1122;

/**
 * An IfcConstraint is used to define a constraint or limiting value or boundary condition that may be applied to an object or to the value of a property.
 */
export const IfcConstraint = 1123;

/**
 * IfcConstructionEquipmentResource is usage of construction equipment to assist in the performance of construction. Construction Equipment resources are wholly or partially consumed or occupied in the performance of construction.
 */
export const IfcConstructionEquipmentResource = 1124;

/**
 * The resource type IfcConstructionEquipmentType defines commonly shared information for occurrences of construction equipment resources. The set of shared information may include:
 */
export const IfcConstructionEquipmentResourceType = 1125;

/**
 * IfcConstructionMaterialResource identifies a material resource type in a construction project.
 */
export const IfcConstructionMaterialResource = 1126;

/**
 * The resource type IfcConstructionMaterialType defines commonly shared information for occurrences of construction material resources. The set of shared information may include:
 */
export const IfcConstructionMaterialResourceType = 1127;

/**
 * IfcConstructionProductResource defines the role of a product that is consumed (wholly or partially), or occupied in the performance of construction.
 */
export const IfcConstructionProductResource = 1128;

/**
 * The resource type IfcConstructionProductType defines commonly shared information for occurrences of construction product resources. The set of shared information may include:
 */
export const IfcConstructionProductResourceType = 1129;

/**
 * IfcConstructionResource is an abstract generalization of the different resources used in construction projects, mainly labour, material, equipment and product resources, plus subcontracted resources and aggregations such as a crew resource.
 */
export const IfcConstructionResource = 1130;

/**
 * IfcConstructionResourceType is an abstract generalization of the different resource types used in construction projects, mainly labor, material, equipment and product resource types, plus subcontracted resource types and aggregations such as a crew resource type.
 */
export const IfcConstructionResourceType = 1131;

/**
 * IfcContext is the generalization of a project context in which objects, type objects, property sets, and properties are defined. The IfcProject as subtype of IfcContext provides the context for all information on a construction project, it may include one or several IfcProjectLibrary's as subtype of IfcContext to register the included libraries for the project. A library of products that is referenced is declared within the IfcProjectLibrary as the context of that library.
 */
export const IfcContext = 1132;

/**
 *
 */
export const IfcContextDependentUnit = 1133;

/**
 * IfcControl is the abstract generalization of all concepts that control or constrain the utilization of products, processes, or resources in general. It can be seen as a regulation, cost schedule, request or order, or other requirements applied to a product, process or resource whose requirements and provisions must be fulfilled.
 */
export const IfcControl = 1134;

/**
 * A controller is a device that monitors inputs and controls outputs within a building automation system.
 */
export const IfcController = 1135;

/**
 * The distribution control element type IfcControllerType defines commonly shared information for occurrences of controllers. The set of shared information may include:
 */
export const IfcControllerType = 1136;

/**
 * An IfcConversionBasedUnit is used to define a unit that has a conversion rate to a base unit. To identify some commonly used conversion based units, the standard designations (case insensitive) for the Name attribute are indicated in Table 696.
 */
export const IfcConversionBasedUnit = 1137;

/**
 * IfcConversionBasedUnitWithOffset is a unit which is converted from another unit by applying a conversion factor and an offset.
 */
export const IfcConversionBasedUnitWithOffset = 1138;

/**
 * A cooled beam (or chilled beam) is a device typically used to cool air by circulating a fluid such as chilled water through exposed finned tubes above a space. Typically mounted overhead near or within a ceiling, the cooled beam uses convection to cool the space below it by acting as a heat sink for the naturally rising warm air of the space. Once cooled, the air naturally drops back to the floor where the cycle begins again.
 */
export const IfcCooledBeam = 1139;

/**
 * The energy conversion device type IfcCooledBeamType defines commonly shared information for occurrences of cooled beams. The set of shared information may include:
 */
export const IfcCooledBeamType = 1140;

/**
 * A cooling tower is a device which rejects heat to ambient air by circulating a fluid such as water through it to reduce its temperature by partial evaporation.
 */
export const IfcCoolingTower = 1141;

/**
 * The energy conversion device type IfcCoolingTowerType defines commonly shared information for occurrences of cooling towers. The set of shared information may include:
 */
export const IfcCoolingTowerType = 1142;

/**
 * The coordinate operation is an abstract supertype to handle any operation (transformation or conversion) between two coordinate reference systems. It is meant to provide expandability for future versions, since currently only the conversion of a local engineering coordinate system into a map coordinate reference system is dealt with by the subtype IfcMapConversion.
 */
export const IfcCoordinateOperation = 1143;

/**
 * The IfcCoordinateReferenceSystem is a definition of a coordinate reference system by means of qualified identifiers only. The interpretation of the identifier is expected to be well-known to the receiving software.
 */
export const IfcCoordinateReferenceSystem = 1144;

/**
 * An IfcCostItem describes a cost or financial value together with descriptive information that describes its context in a form that enables it to be used within a cost schedule. An IfcCostItem can be used to represent the cost of goods and services, the execution of works by a process, lifecycle cost and more.
 */
export const IfcCostItem = 1145;

/**
 * An IfcCostSchedule brings together instances of IfcCostItem either for the purpose of identifying purely cost information as in an estimate for constructions costs or for including cost information within another presentation form such as a work order.
 */
export const IfcCostSchedule = 1146;

/**
 * IfcCostValue is an amount of money or a value that affects an amount of money.
 */
export const IfcCostValue = 1147;

/**
 * A covering is an element which covers some part of another element and is fully dependent on that other element. The IfcCovering defines the occurrence of a covering type, that (if given) is expressed by the IfcCoveringType.
 */
export const IfcCovering = 1148;

/**
 * The element type IfcCoveringType defines commonly shared information for occurrences of coverings. The set of shared information may include:
 */
export const IfcCoveringType = 1149;

/**
 * IfcCrewResource represents a collection of internal resources used in construction processes.
 */
export const IfcCrewResource = 1150;

/**
 * The resource type IfcCrewResourceType defines commonly shared information for occurrences of crew resources. The set of shared information may include:
 */
export const IfcCrewResourceType = 1151;

/**
 * IfcCsgPrimitive3D is an abstract supertype of all three dimensional primitives used as either tree root item, or as Boolean results within a CSG solid model. All 3D CSG primitives are defined within a three-dimensional placement coordinate system.
 */
export const IfcCsgPrimitive3D = 1152;

/**
 * An IfcCsgSolid is the representation of a 3D shape using constructive solid geometry model. It is represented by a single 3D CSG primitive, or as a result of a Boolean operation. The operants of a Boolean operation can be Boolean operations themselves forming a CSG tree. The following volumes can be parts of the CSG tree:
 */
export const IfcCsgSolid = 1153;

/**
 * IfcCShapeProfileDef defines a section profile that provides the defining parameters of a C-shaped section to be used by the swept area solid. This section is typically produced by cold forming steel. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export const IfcCShapeProfileDef = 1154;

/**
 * IfcCurrencyRelationship defines the rate of exchange that applies between two designated currencies at a particular time and as published by a particular source.
 */
export const IfcCurrencyRelationship = 1155;

/**
 * A curtain wall is an exterior wall of a building which is an assembly of components, hung from the edge of the floor/roof structure rather than bearing on a floor. Curtain wall is represented as a building element assembly and implemented as a subtype of IfcBuildingElement that uses an IfcRelAggregates relationship.
 */
export const IfcCurtainWall = 1156;

/**
 * The building element type IfcCurtainWallType defines commonly shared information for occurrences of curtain walls. The set of shared information may include:
 */
export const IfcCurtainWallType = 1157;

/**
 * An IfcCurve is a curve in two-dimensional or three-dimensional space. It includes definitions for bounded and unbounded curves.
 */
export const IfcCurve = 1158;

/**
 * The IfcCurveBoundedPlane is a parametric planar surface with curved boundaries defined by one or more boundary curves. The bounded plane is defined to be the portion of the basis surface in the direction of N x T from any point on the boundary, where N is the surface normal and T the boundary curve tangent vector at this point. The region so defined shall be arcwise connected.
 */
export const IfcCurveBoundedPlane = 1159;

/**
 * The IfcCurveBoundedSurface is a parametric surface with boundaries defined by p-curves, that is, a curve which lies on the basis of a surface and is defined in the parameter space of that surface. The p-curve is a special type of a composite curve segment and shall only be used to bound a surface.
 */
export const IfcCurveBoundedSurface = 1160;

/**
 * An IfcCurveStyle provides the style table for presentation information assigned to geometric curves. The style is defined by a color, a font and a width. The IfcCurveStyle defines curve patterns as model patterns, that is, the distance between visible and invisible segments of curve patterns are given in model space dimensions (that have to be scaled using the target plot scale).
 */
export const IfcCurveStyle = 1161;

/**
 *
 */
export const IfcCurveStyleFont = 1162;

/**
 * The IfcCurveStyleFontAndScaling allows for the reuse of the same curve style definition in several sizes. The definition of the CurveFontScale is the scaling of a base curve style pattern to be used as a new or derived curve style pattern.
 */
export const IfcCurveStyleFontAndScaling = 1163;

/**
 *
 */
export const IfcCurveStyleFontPattern = 1164;

/**
 * The cylindrical surface is a surface unbounded in the direction of z. Bounded cylindrical surfaces are defined by using a subtype of IfcBoundedSurface with BasisSurface being a cylindrical surface.
 */
export const IfcCylindricalSurface = 1165;

/**
 * A damper typically participates in an HVAC duct distribution system and is used to control or modulate the flow of air.
 */
export const IfcDamper = 1166;

/**
 * The flow controller type IfcDamperType defines commonly shared information for occurrences of dampers. The set of shared information may include:
 */
export const IfcDamperType = 1167;

/**
 * IfcDerivedProfileDef defines the profile by transformation from the parent profile. The transformation is given by a two dimensional transformation operator. Transformation includes translation, rotation, mirror and scaling. The latter can be uniform or non uniform. The derived profiles may be used to define swept surfaces, swept area solids or sectioned spines.
 */
export const IfcDerivedProfileDef = 1168;

/**
 *
 */
export const IfcDerivedUnit = 1169;

/**
 *
 */
export const IfcDerivedUnitElement = 1170;

/**
 *
 */
export const IfcDimensionalExponents = 1171;

/**
 * The IfcDirection provides a direction in two or three dimensional space depending on the number of DirectionRatio's provided. The IfcDirection does not imply a vector length, and the direction ratios does not have to be normalized.
 */
export const IfcDirection = 1172;

/**
 * A discrete accessory is a representation of different kinds of accessories included in or added to elements.
 */
export const IfcDiscreteAccessory = 1173;

/**
 * The element component type IfcDiscreteAccessoryType defines commonly shared information for occurrences of discrete accessorys. The set of shared information may include:
 */
export const IfcDiscreteAccessoryType = 1174;

/**
 * A distribution chamber element defines a place at which distribution systems and their constituent elements may be inspected or through which they may travel.
 */
export const IfcDistributionChamberElement = 1175;

/**
 * The distribution flow element type IfcDistributionChamberElementType defines commonly shared information for occurrences of distribution chamber elements. The set of shared information may include:
 */
export const IfcDistributionChamberElementType = 1176;

/**
 * A distribution circuit is a partition of a distribution system that is conditionally switched such as an electrical circuit.
 */
export const IfcDistributionCircuit = 1177;

/**
 * The distribution element IfcDistributionControlElement defines occurrence elements of a building automation control system that are used to impart control over elements of a distribution system.
 */
export const IfcDistributionControlElement = 1178;

/**
 * The element type IfcDistributionControlElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export const IfcDistributionControlElementType = 1179;

/**
 * This IfcDistributionElement is a generalization of all elements that participate in a distribution system. Typical examples of IfcDistributionElement's are (among others):
 */
export const IfcDistributionElement = 1180;

/**
 * The IfcDistributionElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcDistributionElementType = 1181;

/**
 * The distribution element IfcDistributionFlowElement defines occurrence elements of a distribution system that facilitate the distribution of energy or matter, such as air, water or power.
 */
export const IfcDistributionFlowElement = 1182;

/**
 * The element type IfcDistributionFlowElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export const IfcDistributionFlowElementType = 1183;

/**
 * A distribution port is an inlet or outlet of a product through which a particular substance may flow.
 */
export const IfcDistributionPort = 1184;

/**
 * A distribution system is a network designed to receive, store, maintain, distribute, or control the flow of a distribution media. A kdtree3 example is a heating hot water system that consists of a pump, a tank, and an interconnected piping system for distributing hot water to terminals.
 */
export const IfcDistributionSystem = 1185;

/**
 * IfcDocumentInformation captures "metadata" of an external document. The actual content of the document is not defined in this specification; instead, it can be found following the Location attribute.
 */
export const IfcDocumentInformation = 1186;

/**
 * An IfcDocumentInformationRelationship is a relationship entity that enables a document to have the ability to reference other documents. It is used to describe relationships in which one document may reference one or more other sub documents or where a document is used as a replacement for another document (but where both the original and the replacing document need to be retained).
 */
export const IfcDocumentInformationRelationship = 1187;

/**
 * An IfcDocumentReference is a reference to the location of a document. The reference is given by a system interpretable Location attribute (a URL string) where the document can be found, and an optional inherited internal reference Identification, which refers to a system interpretable position within the document. The optional inherited Name attribute is meant to have meaning for human readers. Optional document metadata can also be captured through reference to IfcDocumentInformation.
 */
export const IfcDocumentReference = 1188;

/**
 * The door is a built element that is predominately used to provide controlled access for people, goods, animals and vehicles. It includes constructions with hinged, pivoted, sliding, and additionally revolving and folding operations. REMOVE: A door consists of a lining and one or several panels.
 */
export const IfcDoor = 1189;

/**
 * The door lining is the frame which enables the door leaf to be fixed in position. The door lining is used to hang the door leaf. The parameters of the door lining define the geometrically relevant parameter of the lining.
 */
export const IfcDoorLiningProperties = 1190;

/**
 * A door panel is normally a door leaf that opens to allow people or goods to pass. The parameters of the door panel define the geometrically relevant parameter of the panel,
 */
export const IfcDoorPanelProperties = 1191;

/**
 * The standard door, IfcDoorStandardCase, defines a door with certain constraints for the provision of operation types, opening directions, frame and lining parameters, and with certain constraints for the geometric representation. The IfcDoorStandardCase handles all cases of doors, that:
 */
export const IfcDoorStandardCase = 1192;

/**
 * Definition: The door style, IfcDoorStyle, defines a particular style of doors, which may be included into the spatial context of the building model through instances of IfcDoor. A door style defines the overall parameter of the door style and refers to the particular parameter of the lining and one (or several) panels through the IfcDoorLiningProperties and the IfcDoorPanelProperties.
 */
export const IfcDoorStyle = 1193;

/**
 * The element type IfcDoorType defines commonly shared information for occurrences of doors. The set of shared information may include:
 */
export const IfcDoorType = 1194;

/**
 * The draughting pre defined colour is a pre defined colour for the purpose to identify a colour by name. Allowable names are:
 */
export const IfcDraughtingPreDefinedColour = 1195;

/**
 * The draughting predefined curve font type defines a selection of widely used curve fonts for draughting purposes by name.
 */
export const IfcDraughtingPreDefinedCurveFont = 1196;

/**
 * A duct fitting is a junction or transition in a ducted flow distribution system or used to connect duct segments, resulting in changes in flow characteristics to the fluid such as direction and flow rate.
 */
export const IfcDuctFitting = 1197;

/**
 * The flow fitting type IfcDuctFittingType defines commonly shared information for occurrences of duct fittings. The set of shared information may include:
 */
export const IfcDuctFittingType = 1198;

/**
 * A duct segment is used to typically join two sections of duct network.
 */
export const IfcDuctSegment = 1199;

/**
 * The flow segment type IfcDuctSegmentType defines commonly shared information for occurrences of duct segments. The set of shared information may include:
 */
export const IfcDuctSegmentType = 1200;

/**
 * A duct silencer is a device that is typically installed inside a duct distribution system for the purpose of reducing the noise levels from air movement, fan noise, etc. in the adjacent space or downstream of the duct silencer device.
 */
export const IfcDuctSilencer = 1201;

/**
 * The flow treatment device type IfcDuctSilencerType defines commonly shared information for occurrences of duct silencers. The set of shared information may include:
 */
export const IfcDuctSilencerType = 1202;

/**
 * An IfcEdge defines two vertices being connected topologically. The geometric representation of the connection between the two vertices defaults to a straight line if no curve geometry is assigned using the subtype IfcEdgeCurve. The IfcEdge can therefore be used to exchange straight edges without an associated geometry provided by IfcLine or IfcPolyline thought IfcEdgeCurve.EdgeGeometry.
 */
export const IfcEdge = 1203;

/**
 * An IfcEdgeCurve defines two vertices being connected topologically including the geometric representation of the connection.
 */
export const IfcEdgeCurve = 1204;

/**
 *
 */
export const IfcEdgeLoop = 1205;

/**
 * An electric appliance is a device intended for consumer usage that is powered by electricity.
 */
export const IfcElectricAppliance = 1206;

/**
 * The flow terminal type IfcElectricApplianceType defines commonly shared information for occurrences of electric appliances. The set of shared information may include:
 */
export const IfcElectricApplianceType = 1207;

/**
 * A distribution board is a flow controller in which instances of electrical devices are brought together at a single place for a particular purpose.
 */
export const IfcElectricDistributionBoard = 1208;

/**
 * The flow controller type IfcElectricDistributionBoardType defines commonly shared information for occurrences of electric distribution boards. The set of shared information may include:
 */
export const IfcElectricDistributionBoardType = 1209;

/**
 * An electric flow storage device is a device in which electrical energy is stored and from which energy may be progressively released.
 */
export const IfcElectricFlowStorageDevice = 1210;

/**
 * The flow storage device type IfcElectricFlowStorageDeviceType defines commonly shared information for occurrences of electric flow storage devices. The set of shared information may include:
 */
export const IfcElectricFlowStorageDeviceType = 1211;

/**
 * An electric generator is an engine that is a machine for converting mechanical energy into electrical energy.
 */
export const IfcElectricGenerator = 1212;

/**
 * The energy conversion device type IfcElectricGeneratorType defines commonly shared information for occurrences of electric generators. The set of shared information may include:
 */
export const IfcElectricGeneratorType = 1213;

/**
 * An electric motor is an engine that is a machine for converting electrical energy into mechanical energy.
 */
export const IfcElectricMotor = 1214;

/**
 * The energy conversion device type IfcElectricMotorType defines commonly shared information for occurrences of electric motors. The set of shared information may include:
 */
export const IfcElectricMotorType = 1215;

/**
 * An electric time control is a device that applies control to the provision or flow of electrical energy over time.
 */
export const IfcElectricTimeControl = 1216;

/**
 * The flow controller type IfcElectricTimeControlType defines commonly shared information for occurrences of electric time controls. The set of shared information may include:
 */
export const IfcElectricTimeControlType = 1217;

/**
 * An element is a generalization of all components that make up an AEC product.
 */
export const IfcElement = 1218;

/**
 * An IfcElementarySurface in the kdtree3 supertype of analytical surfaces.
 */
export const IfcElementarySurface = 1219;

/**
 * The IfcElementAssembly represents complex element assemblies aggregated from several elements, such as discrete elements, building elements, or other elements.
 */
export const IfcElementAssembly = 1220;

/**
 * The IfcElementAssemblyType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcElementAssemblyType = 1221;

/**
 * An element component is a representation for minor items included in, added to or connecting to or between elements, which usually are not of interest from the overall building structure viewpoint. However, these small parts may have vital and load carrying functions within the construction. These items do not provide any actual space boundaries. Typical examples of _IfcElementComponent_s include different kinds of fasteners and various accessories.
 */
export const IfcElementComponent = 1222;

/**
 * The element type IfcElementComponentType defines commonly shared information for occurrences of element components. The set of shared information may include:
 */
export const IfcElementComponentType = 1223;

/**
 * An IfcElementQuantity defines a set of derived measures of an element's physical property. Elements could be spatial structure elements (like buildings, storeys, or spaces) or building elements (like walls, slabs, finishes). The IfcElementQuantity gets assigned to the element by using the IfcRelDefinesByProperties relationship.
 */
export const IfcElementQuantity = 1224;

/**
 * IfcElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcElementType = 1225;

/**
 * An IfcEllipse is a curve consisting of a set of points whose distances to two fixed points add to the same constant.
 */
export const IfcEllipse = 1226;

/**
 * IfcEllipseProfileDef defines an ellipse as the profile definition used by the swept surface geometry or the swept area solid. It is given by its semi axis attributes and placed within the 2D position coordinate system, established by the Position attribute.
 */
export const IfcEllipseProfileDef = 1227;

/**
 * The distribution flow element IfcEnergyConversionDevice defines the occurrence of a device used to perform energy conversion or heat transfer and typically participates in a flow distribution system. Its type is defined by IfcEnergyConversionDeviceType or its subtypes.
 */
export const IfcEnergyConversionDevice = 1228;

/**
 * The element type IfcEnergyConversionType defines a list of commonly shared property set definitions of an energy conversion device and an optional set of product representations. It is used to define an energy conversion device specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcEnergyConversionDeviceType = 1229;

/**
 * An engine is a device that converts fuel into mechanical energy through combustion.
 */
export const IfcEngine = 1230;

/**
 * The energy conversion device type IfcEngineType defines commonly shared information for occurrences of engines. The set of shared information may include:
 */
export const IfcEngineType = 1231;

/**
 * An evaporative cooler is a device that cools air by saturating it with water vapor.
 */
export const IfcEvaporativeCooler = 1232;

/**
 * The energy conversion device type IfcEvaporativeCoolerType defines commonly shared information for occurrences of evaporative coolers. The set of shared information may include:
 */
export const IfcEvaporativeCoolerType = 1233;

/**
 * An evaporator is a device in which a liquid refrigerent is vaporized and absorbs heat from the surrounding fluid.
 */
export const IfcEvaporator = 1234;

/**
 * The energy conversion device type IfcEvaporatorType defines commonly shared information for occurrences of evaporators. The set of shared information may include:
 */
export const IfcEvaporatorType = 1235;

/**
 * An IfcEvent is something that happens that triggers an action or response.
 */
export const IfcEvent = 1236;

/**
 * IfcEventTime captures the time-related information about an event including the different types of event dates (i.e. actual, scheduled, early, and late).
 */
export const IfcEventTime = 1237;

/**
 * An IfcEventType defines a particular type of event that may be specified.
 */
export const IfcEventType = 1238;

/**
 * The IfcExtendedProperties is an abstract supertype of all extensible property collections that are applicable to certain characterized entities. Instantiable subtypes of IfcExtendedProperties assign the property collection to a particular characterized entity.
 */
export const IfcExtendedProperties = 1239;

/**
 * An IfcExternalInformation is the identification of an information source that is not explicitly represented in the current model or in the project database (as an implementation of the current model). The IfcExternalInformation identifies the external source (classification, document, or library), but not the particular items such as a dictionary entry, a classification notation, or a document reference within the external source
 */
export const IfcExternalInformation = 1240;

/**
 *
 */
export const IfcExternallyDefinedHatchStyle = 1241;

/**
 * IfcExternallyDefinedSurfaceStyle is a definition of a surface style through referencing an external source, such as a material library for rendering information.
 */
export const IfcExternallyDefinedSurfaceStyle = 1242;

/**
 *
 */
export const IfcExternallyDefinedTextFont = 1243;

/**
 * An IfcExternalReference is the identification of information that is not explicitly represented in the current model or in the project database (as an implementation of the current model). Such information may be contained in classifications, documents or libraries. The IfcExternalReference identifies a particular item, such as a dictionary entry, a classification notation, or a document reference within the external source.
 */
export const IfcExternalReference = 1244;

/**
 * IfcExternalReferenceRelationship is a relationship entity that enables objects from the IfcResourceObjectSelect to have the ability to be tagged by external references.
 */
export const IfcExternalReferenceRelationship = 1245;

/**
 * The external spatial element defines external regions at the building site. Those regions can be defined:
 */
export const IfcExternalSpatialElement = 1246;

/**
 * The external spatial structure element is an abstract entity provided for different kind of external spaces, regions, and volumes.
 */
export const IfcExternalSpatialStructureElement = 1247;

/**
 * The IfcExtrudedAreaSolid is defined by sweeping a cross section provided by a profile definition. The direction of the extrusion is given by the ExtrudedDirection attribute and the length of the extrusion is given by the Depth attribute. If the planar area has inner boundaries (holes defined), then those holes shall be swept into holes of the solid.
 */
export const IfcExtrudedAreaSolid = 1248;

/**
 * IfcExtrudedAreaSolidTapered is defined by sweeping a cross section along a linear spine. The cross section may change along the sweep from the shape of the start cross section into the shape of the end cross section. The resulting solid is bounded by three or more faces: A start face, an end face (each defined by start and end planes and sections), and one or more lateral faces. Each lateral face is a ruled surface defined by a pair of corresponding edges of the start and end section.
 */
export const IfcExtrudedAreaSolidTapered = 1249;

/**
 * An IfcFace is topological entity used to define surface, bounded by loops, of a shell.
 */
export const IfcFace = 1250;

/**
 * The IfcFaceBasedSurfaceModel represents the a shape by connected face sets. The connected faces have a dimensionality 2 and are placed in a coordinate space of dimensionality 3.
 */
export const IfcFaceBasedSurfaceModel = 1251;

/**
 *
 */
export const IfcFaceBound = 1252;

/**
 *
 */
export const IfcFaceOuterBound = 1253;

/**
 * The IfcFaceSurface defines the underlying geometry of the associated surface to the face.
 */
export const IfcFaceSurface = 1254;

/**
 * The IfcFacetedBrep is a manifold solid brep with the restriction that all faces are planar and bounded polygons.
 */
export const IfcFacetedBrep = 1255;

/**
 * The IfcFacetedBrepWithVoids is a specialization of a faceted B-rep which contains one or more voids in its interior. The voids are represented as closed shells which are defined so that the shell normal point into the void.
 */
export const IfcFacetedBrepWithVoids = 1256;

/**
 * Defines forces at which a support or connection fails.
 */
export const IfcFailureConnectionCondition = 1257;

/**
 * A fan is a device which imparts mechanical work on a gas. A typical usage of a fan is to induce airflow in a building services air distribution system.
 */
export const IfcFan = 1258;

/**
 * The flow moving device type IfcFanType defines commonly shared information for occurrences of fans. The set of shared information may include:
 */
export const IfcFanType = 1259;

/**
 * Representations of fixing parts which are used as fasteners to connect or join elements with other elements. Excluded are mechanical fasteners which are modeled by a separate entity (IfcMechanicalFastener).
 */
export const IfcFastener = 1260;

/**
 * The element component type IfcFastenerType defines commonly shared information for occurrences of fasteners. The set of shared information may include:
 */
export const IfcFastenerType = 1261;

/**
 * A feature element is a generalization of all existence dependent elements which modify the shape and appearance of the associated master element. The IfcFeatureElement offers the ability to handle shape modifiers as semantic objects within the IFC object model.
 */
export const IfcFeatureElement = 1262;

/**
 * A feature element addition is a specialization of the general feature element, that represents an existence dependent element which modifies the shape and appearance of the associated master element. The IfcFeatureElementAddition offers the ability to handle shape modifiers as semantic objects within the IFC object model that add to the shape of the master element.
 */
export const IfcFeatureElementAddition = 1263;

/**
 * The IfcFeatureElementSubtraction is specialization of the general feature element, that represents an existence dependent elements which modifies the shape and appearance of the associated master element. The IfcFeatureElementSubtraction offers the ability to handle shape modifiers as semantic objects within the IFC object model that subtract from the shape of the master element.
 */
export const IfcFeatureElementSubtraction = 1264;

/**
 * An IfcFillAreaStyle provides the style table for presentation information assigned to annotation fill areas or surfaces for hatching and tiling. The _IfcFillAreaStyle_defines hatches as model hatches, that is, the distance between hatch lines, or the curve patterns of hatch lines are given in model space dimensions (that have to be scaled using the target plot scale). The IfcFillAreaStyle allows for the following combinations of defining the style of hatching and tiling:
 */
export const IfcFillAreaStyle = 1265;

/**
 * The IfcFillAreaStyleHatching is used to define simple, vector-based hatching patterns, based on styled straight lines. The curve font, color and thickness is given by the HatchLineAppearance, the angle by the HatchLineAngle and the distance to the next hatch line by StartOfNextHatchLine, being either an offset distance or a vector.
 */
export const IfcFillAreaStyleHatching = 1266;

/**
 * The IfcFillAreaStyleTiles defines the filling of an IfcAnnotationFillArea by recurring patterns of styled two dimensional geometry, called a tile. The recurrence pattern is determined by two vectors, that multiply the tile in regular form.
 */
export const IfcFillAreaStyleTiles = 1267;

/**
 * A filter is an apparatus used to remove particulate or gaseous matter from fluids and gases.
 */
export const IfcFilter = 1268;

/**
 * The flow treatment device type IfcFilterType defines commonly shared information for occurrences of filters. The set of shared information may include:
 */
export const IfcFilterType = 1269;

/**
 * A fire suppression terminal has the purpose of delivering a fluid (gas or liquid) that will suppress a fire.
 */
export const IfcFireSuppressionTerminal = 1270;

/**
 * The flow terminal type IfcFireSuppressionTerminalType defines commonly shared information for occurrences of fire suppression terminals. The set of shared information may include:
 */
export const IfcFireSuppressionTerminalType = 1271;

/**
 * An IfcFixedReferenceSweptAreaSolid is a type of swept area solid which is the result of sweeping an area along a Directrix. The swept area is provided by a subtype of IfcProfileDef. The profile is placed by an implicit cartesian transformation operator at the start point of the sweep, where the profile normal agrees to the tangent of the directrix at this point, and the profile''s x-axis agrees to the FixedReference direction. The orientation of the curve during the sweeping operation is controlled by the FixedReference direction.
 */
export const IfcFixedReferenceSweptAreaSolid = 1272;

/**
 * The distribution flow element IfcFlowController defines the occurrence of elements of a distribution system that are used to regulate flow through a distribution system. Examples include dampers, valves, switches, and relays. Its type is defined by IfcFlowControllerType or subtypes.
 */
export const IfcFlowController = 1273;

/**
 * The element type IfcFlowControllerType defines a list of commonly shared property set definitions of a flow controller and an optional set of product representations. It is used to define a flow controller specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowControllerType = 1274;

/**
 * The distribution flow element IfcFlowFitting defines the occurrence of a junction or transition in a flow distribution system, such as an elbow or tee. Its type is defined by IfcFlowFittingType or its subtypes.
 */
export const IfcFlowFitting = 1275;

/**
 * The element type IfcFlowFittingType defines a list of commonly shared property set definitions of a flow fitting and an optional set of product representations. It is used to define a flow fitting specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowFittingType = 1276;

/**
 * A flow instrument reads and displays the value of a particular property of a system at a point, or displays the difference in the value of a property between two points.
 */
export const IfcFlowInstrument = 1277;

/**
 * The distribution control element type IfcFlowInstrumentType defines commonly shared information for occurrences of flow instruments. The set of shared information may include:
 */
export const IfcFlowInstrumentType = 1278;

/**
 * A flow meter is a device that is used to measure the flow rate in a system.
 */
export const IfcFlowMeter = 1279;

/**
 * The flow controller type IfcFlowMeterType defines commonly shared information for occurrences of flow meters. The set of shared information may include:
 */
export const IfcFlowMeterType = 1280;

/**
 * The distribution flow element IfcFlowMovingDevice defines the occurrence of an apparatus used to distribute, circulate or perform conveyance of fluids, including liquids and gases (such as a pump or fan), and typically participates in a flow distribution system. Its type is defined by IfcFlowMovingDeviceType or its subtypes.
 */
export const IfcFlowMovingDevice = 1281;

/**
 * The element type IfcFlowMovingDeviceType defines a list of commonly shared property set definitions of a flow moving device and an optional set of product representations. It is used to define a flow moving device specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowMovingDeviceType = 1282;

/**
 * The distribution flow element IfcFlowSegment defines the occurrence of a segment of a flow distribution system.
 */
export const IfcFlowSegment = 1283;

/**
 * The element type IfcFlowSegmentType defines a list of commonly shared property set definitions of a flow segment and an optional set of product representations. It is used to define a flow segment specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowSegmentType = 1284;

/**
 * The distribution flow element IfcFlowStorageDevice defines the occurrence of a device that participates in a distribution system and is used for temporary storage (such as a tank). Its type is defined by IfcFlowStorageDeviceType or its subtypes.
 */
export const IfcFlowStorageDevice = 1285;

/**
 * The element type IfcFlowStorageDeviceType defines a list of commonly shared property set definitions of a flow storage device and an optional set of product representations. It is used to define a flow storage device specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowStorageDeviceType = 1286;

/**
 * The distribution flow element IfcFlowTerminal defines the occurrence of a permanently attached element that acts as a terminus or beginning of a distribution system (such as an air outlet, drain, water closet, or sink). A terminal is typically a point at which a system interfaces with an external environment. Its type is defined by IfcFlowTerminalType or its subtypes.
 */
export const IfcFlowTerminal = 1287;

/**
 * The element type IfcFlowTerminalType defines a list of commonly shared property set definitions of a flow terminal and an optional set of product representations. It is used to define a flow terminal specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowTerminalType = 1288;

/**
 * The distribution flow element IfcFlowTreatmentDevice defines the occurrence of a device typically used to remove unwanted matter from a fluid, either liquid or gas, and typically participates in a flow distribution system. Its type is defined by IfcFlowTreatmentDeviceType or its subtypes.
 */
export const IfcFlowTreatmentDevice = 1289;

/**
 * The element type IfcFlowTreatmentDeviceType defines a list of commonly shared property set definitions of a flow treatment device and an optional set of product representations. It is used to define a flow treatment device specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export const IfcFlowTreatmentDeviceType = 1290;

/**
 * A footing is a part of the foundation of a structure that spreads and transmits the load to the soil. A footing is also characterized as shallow foundation, where the loads are transfered to the ground near the surface.
 */
export const IfcFooting = 1291;

/**
 * The building element type IfcFootingType defines commonly shared information for occurrences of footings. The set of shared information may include:
 */
export const IfcFootingType = 1292;

/**
 * A furnishing element is a generalization of all furniture related objects. Furnishing objects are characterized as being
 */
export const IfcFurnishingElement = 1293;

/**
 * IfcFurnishingElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export const IfcFurnishingElementType = 1294;

/**
 * Furniture defines complete furnishings such as a table, desk, chair, or cabinet, which may or may not be permanently attached to a building structure.
 */
export const IfcFurniture = 1295;

/**
 * The furnishing element type IfcFurnitureType defines commonly shared information for occurrences of furnitures. The set of shared information may include:
 */
export const IfcFurnitureType = 1296;

/**
 * An IfcGeographicElement is a generalization of all elements within a geographical landscape. It includes occurrences of typical geographical elements, often referred to as features, such as trees or terrain. Common type information behind several occurrences of IfcGeographicElement is provided by the IfcGeographicElementType.
 */
export const IfcGeographicElement = 1297;

/**
 * An IfcGeographicElementType is used to define an element specification of a geographic element (i.e. the specific product information, that is kdtree3 to all occurrences of that product type). Geographic element types include for different types of element that may be used to represent information within a geographical landscape external to a building. Within the world of geographic information they are referred to generally as ''features''. IfcGeographicElementType''s include:
 */
export const IfcGeographicElementType = 1298;

/**
 * The IfcGeometricCurveSet is used for the exchange of shape representation consisting of an collection of (2D or 3D) points and curves only.
 */
export const IfcGeometricCurveSet = 1299;

/**
 * The IfcGeometricRepresentationContext defines the context that applies to several shape representations of products within a project. It defines the type of the context in which the shape representation is defined, and the numeric precision applicable to the geometric representation items defined in this context. In addition it can be used to offset the project coordinate system from a global point of origin, using the WorldCoordinateSystem attribute. The main representation context may also provide the true north direction, see Figure 426.
 */
export const IfcGeometricRepresentationContext = 1300;

/**
 * An IfcGeometricRepresentationItem is the kdtree3 supertype of all geometric items used within a representation. It is positioned within a geometric coordinate system, directly or indirectly through intervening items.
 */
export const IfcGeometricRepresentationItem = 1301;

/**
 * IfcGeometricRepresentationSubContext defines the context that applies to several shape representations of a product being a sub context, sharing the WorldCoordinateSystem, CoordinateSpaceDimension, Precision and TrueNorth attributes with the parent IfcGeometricRepresentationContext.
 */
export const IfcGeometricRepresentationSubContext = 1302;

/**
 * The IfcGeometricSet is used for the exchange of shape representation consisting of (2D or 3D) points, curves, and surfaces, which do not have a topological structure (such as connected face sets or shells), are not tessellated and are not solid models (such as swept solids, CSG or Brep).
 */
export const IfcGeometricSet = 1303;

/**
 * IfcGrid ia a planar design grid defined in 3D space used as an aid in locating structural and design elements. The position of the grid (ObjectPlacement) is defined by a 3D coordinate system (and thereby the design grid can be used in plan, section or in any position relative to the world coordinate system). The position can be relative to the object placement of other products or grids. The XY plane of the 3D coordinate system is used to place the grid axes, which are 2D curves (for example, line, circle, arc, polyline).
 */
export const IfcGrid = 1304;

/**
 * An individual axis, IfcGridAxis, is defined in the context of a design grid. The axis definition is based on a curve of dimensionality 2. The grid axis is positioned within the XY plane of the position coordinate system defined by the IfcGrid.
 */
export const IfcGridAxis = 1305;

/**
 * IfcGridPlacement provides a specialization of IfcObjectPlacement in which the placement and axis direction of the object coordinate system is defined by a reference to the design grid as defined in IfcGrid.
 */
export const IfcGridPlacement = 1306;

/**
 * IfcGroup is an generalization of any arbitrary group. A group is a logical collection of objects. It does not have its own position, nor can it hold its own shape representation. Therefore a group is an aggregation under some non-geometrical / topological grouping aspects.
 */
export const IfcGroup = 1307;

/**
 * A half space solid divides the domain into two by a base surface. Normally, the base surface is a plane and devides the infinitive space into two and indicates the side of the half-space by agreeing or disagreeing to the normal of the plane.
 */
export const IfcHalfSpaceSolid = 1308;

/**
 * A heat exchanger is a device used to provide heat transfer between non-mixing media such as plate and shell and tube heat exchangers.
 */
export const IfcHeatExchanger = 1309;

/**
 * The energy conversion device type IfcHeatExchangerType defines commonly shared information for occurrences of heat exchangers. The set of shared information may include:
 */
export const IfcHeatExchangerType = 1310;

/**
 * A humidifier is a device that adds moisture into the air.
 */
export const IfcHumidifier = 1311;

/**
 * The energy conversion device type IfcHumidifierType defines commonly shared information for occurrences of humidifiers. The set of shared information may include:
 */
export const IfcHumidifierType = 1312;

/**
 * An IfcImageTexture provides a 2-dimensional texture that can be applied to a surface of an geometric item and that provides lighting parameters of a surface onto which it is mapped. The texture is provided as an image file at an external location for which an URL is provided.
 */
export const IfcImageTexture = 1313;

/**
 * The IfcIndexedColourMap provides the assignment of colour information to individual faces. It is used for colouring faces of tessellated face sets. The IfcIndexedColourMap defines an index into an indexed list of colour information. The Colours are a two-dimensional list of colours provided by three RGB values. The ColourIndex attribute corresponds to the CoordIndex of the IfcTessellatedFaceSet defining the corresponding index list of faces. The Opacity attribute provides the alpha channel for all faces of the tessellated face set.
 */
export const IfcIndexedColourMap = 1314;

/**
 * The IfcIndexedPolyCurve is a bounded curve with only linear and circular arc segments defined by a Cartesian point list and an optional list of segments, providing indices into the Cartesian point list. In the case that the list of Segments is not provided, all points in the IfcCartesianPointList are connected by straight line segments in the order they appear in the IfcCartesianPointList.
 */
export const IfcIndexedPolyCurve = 1315;

/**
 * The IfcIndexedPolygonalFace is a compact representation of a planar face being part of a face set. The vertices of the polygonal planar face are provided by 3 or more Cartesian points, defined by indices that point into an IfcCartesianPointList3D, either direcly, or via the PnIndex, if provided at IfcPolygonalFaceSet.
 */
export const IfcIndexedPolygonalFace = 1316;

/**
 * The IfcIndexedPolygonalFaceWithVoids is a compact representation of a planar face with inner loops, being part of a face set.
 */
export const IfcIndexedPolygonalFaceWithVoids = 1317;

/**
 * The IfcIndexedTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to faces of tessellated face sets.
 */
export const IfcIndexedTextureMap = 1318;

/**
 * The IfcIndexedTriangleTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to triangles of the IfcTriangulatedFaceSet.
 */
export const IfcIndexedTriangleTextureMap = 1319;

/**
 * An interceptor is a device designed and installed in order to separate and retain deleterious, hazardous or undesirable matter while permitting normal sewage or liquids to discharge into a collection system by gravity.
 */
export const IfcInterceptor = 1320;

/**
 * The flow treatment device type IfcInterceptorType defines commonly shared information for occurrences of interceptors. The set of shared information may include:
 */
export const IfcInterceptorType = 1321;

/**
 * An IfcIntersectionCurve is a 3-dimensional curve that has two additional representations provided by two pcurves defined within two distinct and intersecting surfaces.
 */
export const IfcIntersectionCurve = 1322;

/**
 * An inventory is a list of items within an enterprise.
 */
export const IfcInventory = 1323;

/**
 * In an irregular time series, unpredictable bursts of data arrive at unspecified points in time, or most time stamps cannot be characterized by a repeating pattern.
 */
export const IfcIrregularTimeSeries = 1324;

/**
 * The IfcIrregularTimeSeriesValue describes a value (or set of values) at a particular time point.
 */
export const IfcIrregularTimeSeriesValue = 1325;

/**
 * IfcIShapeProfileDef defines a section profile that provides the defining parameters of an 'I' or 'H' section. The I-shape profile has values for its overall depth, width and its web and flange thicknesses. Additionally a fillet radius, flange edge radius, and flange slope may be given. This profile definition represents an I-section which is symmetrical about its major and minor axes; top and bottom flanges are equal and centred on the web.
 */
export const IfcIShapeProfileDef = 1326;

/**
 * A junction box is an enclosure within which cables are connected.
 */
export const IfcJunctionBox = 1327;

/**
 * The flow fitting type IfcJunctionBoxType defines commonly shared information for occurrences of junction boxs. The set of shared information may include:
 */
export const IfcJunctionBoxType = 1328;

/**
 * An IfcLaborResource is used in construction with particular skills or crafts required to perform certain types of construction or management related work.
 */
export const IfcLaborResource = 1329;

/**
 * The resource type IfcLaborResourceType defines commonly shared information for occurrences of labour resources. The set of shared information may include:
 */
export const IfcLaborResourceType = 1330;

/**
 * IfcLagTime describes the time parameters that may exist within a sequence relationship between two processes.
 */
export const IfcLagTime = 1331;

/**
 * A lamp is an artificial light source such as a light bulb or tube.
 */
export const IfcLamp = 1332;

/**
 * The flow terminal type IfcLampType defines commonly shared information for occurrences of lamps. The set of shared information may include:
 */
export const IfcLampType = 1333;

/**
 * An IfcLibraryInformation describes a library where a library is a structured store of information, normally organized in a manner which allows information lookup through an index or reference value. IfcLibraryInformation provides the library Name and optional Description, Version, VersionDate and Publisher attributes. A Location may be added for electronic access to the library.
 */
export const IfcLibraryInformation = 1334;

/**
 * An IfcLibraryReference is a reference into a library of information by Location (provided as a URI). It also provides an optional inherited Identification key to allow more specific references to library sections or tables. The inherited Name attribute allows for a human interpretable identification of the library item. Also, general information on the library from which the reference is taken, is given by the ReferencedLibrary relation which identifies the relevant occurrence of IfcLibraryInformation.
 */
export const IfcLibraryReference = 1335;

/**
 * IfcLightDistributionData defines the luminous intensity of a light source given at a particular main plane angle. It is based on some standardized light distribution curves; the MainPlaneAngle is either the
 */
export const IfcLightDistributionData = 1336;

/**
 * A light fixture is a container that is designed for the purpose of housing one or more lamps and optionally devices that control, restrict or vary their emission.
 */
export const IfcLightFixture = 1337;

/**
 * The flow terminal type IfcLightFixtureType defines commonly shared information for occurrences of light fixtures. The set of shared information may include:
 */
export const IfcLightFixtureType = 1338;

/**
 * IfcLightIntensityDistribution defines the the luminous intensity of a light source that changes according to the direction of the ray. It is based on some standardized light distribution curves, which are defined by the LightDistributionCurve attribute.
 */
export const IfcLightIntensityDistribution = 1339;

/**
 *
 */
export const IfcLightSource = 1340;

/**
 *
 */
export const IfcLightSourceAmbient = 1341;

/**
 *
 */
export const IfcLightSourceDirectional = 1342;

/**
 * IfcLightSourceGoniometric defines a light source for which exact lighting data is available. It specifies the type of a light emitter, defines the position and orientation of a light distribution curve and the data concerning lamp and photometric information.
 */
export const IfcLightSourceGoniometric = 1343;

/**
 *
 */
export const IfcLightSourcePositional = 1344;

/**
 *
 */
export const IfcLightSourceSpot = 1345;

/**
 * The IfcLine is an unbounded line parameterized by an IfcCartesianPoint and an IfcVector. The magnitude of the IfcVector affects the parameterization of the line, but it does not bound the line.
 */
export const IfcLine = 1346;

/**
 * An IfcLocalPlacement defines the relative placement of a product in relation to the placement of another product or the absolute placement of a product within the geometric representation context of the project.
 */
export const IfcLocalPlacement = 1347;

/**
 *
 */
export const IfcLoop = 1348;

/**
 * IfcLShapeProfileDef defines a section profile that provides the defining parameters of an L-shaped section (equilateral L profiles are also covered by this entity) to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The shorter leg has the same direction as the positive Position.P[1]-axis, the longer or equal leg the same as the positive Position.P[2]-axis. The centre of the position coordinate system is in the profiles centre of the bounding box.
 */
export const IfcLShapeProfileDef = 1349;

/**
 * The IfcManifoldSolidBrep is a solid represented as a collection of connected surfaces that delimit the solid from the surrounding non-solid.
 */
export const IfcManifoldSolidBrep = 1350;

/**
 * The map conversion deals with transforming the local engineering coordinate system, often called world coordinate system, into the coordinate reference system of the underlying map.
 */
export const IfcMapConversion = 1351;

/**
 * The IfcMappedItem is the inserted instance of a source definition (to be compared with a block / shared cell / macro definition). The instance is inserted by applying a Cartesian transformation operator as the MappingTarget.
 */
export const IfcMappedItem = 1352;

/**
 * IfcMaterial is a homogeneous or inhomogeneous substance that can be used to form elements (physical products or their components).
 */
export const IfcMaterial = 1353;

/**
 * IfcMaterialClassificationRelationship is a relationship assigning classifications to materials.
 */
export const IfcMaterialClassificationRelationship = 1354;

/**
 * IfcMaterialConstituent is a single and identifiable part of an element which is constructed of a number of part (one or more) each having an individual material. The association of the material constituent to the part is provided by a keyword as value of the Name attribute. In order to identify and distinguish the part of the shape representation to which the material constituent applies the IfcProductDefinitionShape of the element has to include instances of IfcShapeAspect, using the same keyword for their Name attribute.
 */
export const IfcMaterialConstituent = 1355;

/**
 * IfcMaterialConstituentSet is a collection of individual material constituents, each assigning a material to a part of an element. The parts are only identified by a keyword (as opposed to an IfcMaterialLayerSet or IfcMaterialProfileSet where each part has an individual shape parameter (layer thickness or layer profile).
 */
export const IfcMaterialConstituentSet = 1356;

/**
 * IfcMaterialDefinition is a general supertype for all material related information items in IFC that have kdtree3 material related properties that may include association of material with some shape parameters or assignments to identified parts of a component.
 */
export const IfcMaterialDefinition = 1357;

/**
 * IfcMaterialDefinitionRepresentation defines presentation information relating to IfcMaterial. It allows for multiple presentations of the same material for different geometric representation contexts.
 */
export const IfcMaterialDefinitionRepresentation = 1358;

/**
 * IfcMaterialLayer is a single and identifiable part of an element which is constructed of a number of layers (one or more). Each IfcMaterialLayer has a constant thickness and is located relative to the referencing IfcMaterialLayerSet along the material layer set base (MlsBase).
 */
export const IfcMaterialLayer = 1359;

/**
 * The IfcMaterialLayerSet is a designation by which materials of an element constructed of a number of material layers is known and through which the relative positioning of individual layers can be expressed.
 */
export const IfcMaterialLayerSet = 1360;

/**
 * The IfcMaterialLayerSetUsage determines the usage of IfcMaterialLayerSet in terms of its location and orientation relative to the associated element geometry. The location of material layer set shall be compatible with the building element geometry (that is, material layers shall fit inside the element geometry). The rules to ensure the compatibility depend on the type of the building element.
 */
export const IfcMaterialLayerSetUsage = 1361;

/**
 * IfcMaterialLayerWithOffsets is a specialization of IfcMaterialLayer enabling definition of offset values along edges (within the material layer set usage in parent layer set).
 */
export const IfcMaterialLayerWithOffsets = 1362;

/**
 * IfcMaterialList is a list of the different materials that are used in an element.
 */
export const IfcMaterialList = 1363;

/**
 * IfcMaterialProfile is a single and identifiable cross section of an element which is constructed of a number of profiles (one or more).
 */
export const IfcMaterialProfile = 1364;

/**
 * The IfcMaterialProfileSet is a designation by which individual material(s) of a prismatic element (for example, beam or column) constructed of a single or multiple material profiles is known.
 */
export const IfcMaterialProfileSet = 1365;

/**
 * IfcMaterialProfileSetUsage determines the usage of IfcMaterialProfileSet in terms of its location relative to the associated element geometry. The location of a material profile set shall be compatible with the building element geometry (that is, material profiles shall fit inside the element geometry). The rules to ensure the compatibility depend on the type of the building element. For building elements with shape representations which are based on extruded solids, this is accomplished by referring to the identical profile definition in the shape model as in the material profile set.
 */
export const IfcMaterialProfileSetUsage = 1366;

/**
 * IfcMaterialProfileSetUsageTapering specifies dual material profile sets in association with tapered prismatic (beam- or column-like) elements.
 */
export const IfcMaterialProfileSetUsageTapering = 1367;

/**
 * IfcMaterialProfileWithOffsets is a specialization of IfcMaterialProfile with additional longitudinal offsets .
 */
export const IfcMaterialProfileWithOffsets = 1368;

/**
 * The IfcMaterialProperties assigns a set of material properties to associated material definitions. The set may be identified by a Name and a Description. The IfcProperty (instantiable subtypes) is used to express the individual material properties by name, description, value and unit.
 */
export const IfcMaterialProperties = 1369;

/**
 * IfcMaterialRelationship defines a relationship between part and whole in material definitions (as in composite materials). The parts, expressed by the set of RelatedMaterials, are material constituents of which a single material aggregate is composed.
 */
export const IfcMaterialRelationship = 1370;

/**
 * IfcMaterialUsageDefinition is a general supertype for all material related information items in IFC that have occurrence specific assignment parameters to assign a set of materials with shape parameters to a reference geometry item of that component.
 */
export const IfcMaterialUsageDefinition = 1371;

/**
 *
 */
export const IfcMeasureWithUnit = 1372;

/**
 * A mechanical fasteners connecting building elements or parts mechanically. A single instance of this class may represent one or many of actual mechanical fasteners, for example an array of bolts or a row of nails.
 */
export const IfcMechanicalFastener = 1373;

/**
 * The element component type IfcMechanicalFastenerType defines commonly shared information for occurrences of mechanical fasteners. The set of shared information may include:
 */
export const IfcMechanicalFastenerType = 1374;

/**
 * A medical device is attached to a medical piping system and operates upon medical gases to perform a specific function. Medical gases include medical air, medical vacuum, oxygen, carbon dioxide, nitrogen, and nitrous oxide.
 */
export const IfcMedicalDevice = 1375;

/**
 * The flow terminal type IfcMedicalDeviceType defines commonly shared information for occurrences of medical devices. The set of shared information may include:
 */
export const IfcMedicalDeviceType = 1376;

/**
 * An IfcMember is a structural member designed to carry loads between or beyond points of support. It is not required to be load bearing. The orientation of the member (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to IfcBeam and IfcColumn). An IfcMember represents a linear structural element from an architectural or structural modeling point of view and shall be used if it cannot be expressed more specifically as either an IfcBeam or an IfcColumn.
 */
export const IfcMember = 1377;

/**
 * The standard member, IfcMemberStandardCase, defines a member with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcMemberStandardCase handles all cases of members, that:
 */
export const IfcMemberStandardCase = 1378;

/**
 * The element type IfcMemberType defines commonly shared information for occurrences of members. Members are predominately linear building elements, often forming part of a structural system. The orientation of the member (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to beam and column). The set of shared information may include:
 */
export const IfcMemberType = 1379;

/**
 * An IfcMetric is used to capture quantitative resultant metrics that can be applied to objectives.
 */
export const IfcMetric = 1380;

/**
 * The IfcMirroredProfileDef defines the profile by mirroring the parent profile about the y axis of the parent profile coordinate system. That is, left and right of the parent profile are swapped.
 */
export const IfcMirroredProfileDef = 1381;

/**
 * IfcMonetaryUnit is a unit to define currency for money.
 */
export const IfcMonetaryUnit = 1382;

/**
 * A motor connection provides the means for connecting a motor as the driving device to the driven device.
 */
export const IfcMotorConnection = 1383;

/**
 * The energy conversion device type IfcMotorConnectionType defines commonly shared information for occurrences of motor connections. The set of shared information may include:
 */
export const IfcMotorConnectionType = 1384;

/**
 *
 */
export const IfcNamedUnit = 1385;

/**
 * An IfcObject is the generalization of any semantically treated thing or process. Objects are things as they appear - i.e. occurrences.
 */
export const IfcObject = 1386;

/**
 * An IfcObjectDefinition is the generalization of any semantically treated thing or process, either being a type or an occurrences. Object defintions can be named, using the inherited Name attribute, which should be a user recognizable label for the object occurrance. Further explanations to the object can be given using the inherited Description attribute. A context is a specific kind of object definition as it provides the project or library context in which object types and object occurrences are defined.
 */
export const IfcObjectDefinition = 1387;

/**
 * An IfcObjective captures qualitative information for an objective-based constraint.
 */
export const IfcObjective = 1388;

/**
 * IfcObjectPlacement is an abstract supertype for the special types defining the object coordinate system. The IfcObjectPlacement has to be provided for each product that has a shape representation.
 */
export const IfcObjectPlacement = 1389;

/**
 * An occupant is a type of actor that defines the form of occupancy of a property.
 */
export const IfcOccupant = 1390;

/**
 * An IfcOffsetCurve2D is a curve defined by an offset in 2D space from its BasisCurve.
 */
export const IfcOffsetCurve2D = 1391;

/**
 * An IfcOffsetCurve3D is a curve defined by an offset in 3D space from its BasisCurve.
 */
export const IfcOffsetCurve3D = 1392;

/**
 * The opening element stands for opening, recess or chase, all reflecting voids. It represents a void within any element that has physical manifestation. Openings can be inserted into walls, slabs, beams, columns, or other elements.
 */
export const IfcOpeningElement = 1393;

/**
 * The standard opening, IfcOpeningStandardCase, defines an opening with certain constraints for the dimension parameters, position within the voided element, and with certain constraints for the geometric representation. The IfcOpeningStandardCase handles all cases of openings, that:
 */
export const IfcOpeningStandardCase = 1394;

/**
 *
 */
export const IfcOpenShell = 1395;

/**
 * A named and structured grouping with a corporate identity.
 */
export const IfcOrganization = 1396;

/**
 * The IfcOrganizationRelationship establishes an association between one relating organization and one or more related organizations.
 */
export const IfcOrganizationRelationship = 1397;

/**
 * The IfcOrientedEdge represents an IfcEdge with an Orientation flag applied. It allows to reuse the same IfcEdge when traversed exactly twice, once forwards and once backwards.
 */
export const IfcOrientedEdge = 1398;

/**
 * The IfcOuterBoundaryCurve defines the outer boundary of a bounded surface.
 */
export const IfcOuterBoundaryCurve = 1399;

/**
 * An outlet is a device installed at a point to receive one or more inserted plugs for electrical power or communications.
 */
export const IfcOutlet = 1400;

/**
 * The flow terminal type IfcOutletType defines commonly shared information for occurrences of outlets. The set of shared information may include:
 */
export const IfcOutletType = 1401;

/**
 * IfcOwnerHistory defines all history and identification related information. In order to provide fast access it is directly attached to all independent objects, relationships and properties.
 */
export const IfcOwnerHistory = 1402;

/**
 * The parameterized profile definition defines a 2D position coordinate system to which the parameters of the different profiles relate to. All profiles are defined centric to the origin of the position coordinate system, or more specific, the origin [0.,0.] shall be in the center of the bounding box of the profile.
 */
export const IfcParameterizedProfileDef = 1403;

/**
 *
 */
export const IfcPath = 1404;

/**
 * The IfcPcurve is a curve defined within the parameter space of its reference surface.
 */
export const IfcPcurve = 1405;

/**
 * IfcPerformanceHistory is used to document the actual performance of an occurrence instance over time. It includes machine-measured data from building automation systems and human-specified data such as task and resource usage. The data may represent actual conditions, predictions, or simulations.
 */
export const IfcPerformanceHistory = 1406;

/**
 * This entity is a description of a panel within a door or window (as fillers for opening) which allows for air flow. It is given by its properties (IfcPermeableCoveringProperties). A permeable covering is a casement, such as a component, fixed or opening, consisting essentially of a frame and the infilling. The infilling is normally a grill, a louver or a screen. The way of operation is defined in the operation type.
 */
export const IfcPermeableCoveringProperties = 1407;

/**
 * A permit is a permission to perform work in places and on artifacts where regulatory, security or other access restrictions apply.
 */
export const IfcPermit = 1408;

/**
 * This entity represents an individual human being.
 */
export const IfcPerson = 1409;

/**
 * This entity represents a person acting on behalf of an organization.
 */
export const IfcPersonAndOrganization = 1410;

/**
 * The complex physical quantity, IfcPhysicalComplexQuantity, is an entity that holds a set of single quantity measure value (as defined at the subtypes of IfcPhysicalSimpleQuantity), that all apply to a given component or aspect of the element.
 */
export const IfcPhysicalComplexQuantity = 1411;

/**
 * The physical quantity, IfcPhysicalQuantity, is an abstract entity that holds a complex or simple quantity measure together with a semantic definition of the usage for the single or several measure value.
 */
export const IfcPhysicalQuantity = 1412;

/**
 * The physical quantity, IfcPhysicalSimpleQuantity, is an entity that holds a single quantity measure value (as defined at the subtypes of IfcPhysicalSimpleQuantity) together with a semantic definition of the usage for the measure value.
 */
export const IfcPhysicalSimpleQuantity = 1413;

/**
 * A pile is a slender timber, concrete, or steel structural element, driven, jetted, or otherwise embedded on end in the ground for the purpose of supporting a load. A pile is also characterized as deep foundation, where the loads are transfered to deeper subsurface layers.
 */
export const IfcPile = 1414;

/**
 * The building element type IfcPileType defines commonly shared information for occurrences of piles. The set of shared information may include:
 */
export const IfcPileType = 1415;

/**
 * A pipe fitting is a junction or transition in a piping flow distribution system used to connect pipe segments, resulting in changes in flow characteristics to the fluid such as direction or flow rate.
 */
export const IfcPipeFitting = 1416;

/**
 * The flow fitting type IfcPipeFittingType defines commonly shared information for occurrences of pipe fittings. The set of shared information may include:
 */
export const IfcPipeFittingType = 1417;

/**
 * A pipe segment is used to typically join two sections of a piping network.
 */
export const IfcPipeSegment = 1418;

/**
 * The flow segment type IfcPipeSegmentType defines commonly shared information for occurrences of pipe segments. The set of shared information may include:
 */
export const IfcPipeSegmentType = 1419;

/**
 * An IfcPixelTexture provides a 2D image-based texture map as an explicit array of pixel values (list of Pixel binary attributes). In contrary to the IfcImageTexture the IfcPixelTexture holds a 2 dimensional list of pixel color (and opacity) directly, instead of referencing to an URL.
 */
export const IfcPixelTexture = 1420;

/**
 * An IfcPlacement is an abstract supertype of placement subtypes that define the location of an item, or an entire shape representation, and provide its orientation. All placement subtypes define right-handed Cartesian coordinate systems and do not allow mirroring.
 */
export const IfcPlacement = 1421;

/**
 * A planar box specifies an arbitrary rectangular box and its location in a two dimensional Cartesian coordinate system. If the planar box is used within a three-dimensional coordinate system, it defines the rectangular box within the XY plane.
 */
export const IfcPlanarBox = 1422;

/**
 * The planar extent defines the extent along the two axes of the two-dimensional coordinate system, independently of its position. If the planar extent is used within a three-dimensional coordinate system, it defines the extent along the x and y axes.
 */
export const IfcPlanarExtent = 1423;

/**
 * The planar surface is an unbounded surface in the direction of x and y. Bounded planar surfaces are defined by using a subtype of IfcBoundedSurface with BasisSurface being a plane.
 */
export const IfcPlane = 1424;

/**
 * An IfcPlate is a planar and often flat part with constant thickness. A plate may carry loads between or beyond points of support, or provide stiffening. The location of the plate (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to IfcWall and IfcSlab (as floor slab)).
 */
export const IfcPlate = 1425;

/**
 * The standard plate, IfcPlateStandardCase, defines a plate with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcPlateStandardCase handles all cases of plates, that:
 */
export const IfcPlateStandardCase = 1426;

/**
 * The element type IfcPlateType defines commonly shared information for occurrences of plates. The set of shared information may include:
 */
export const IfcPlateType = 1427;

/**
 * The IfcPoint is the abstract generalisation of all point representations within a Cartesian coordinate system.
 */
export const IfcPoint = 1428;

/**
 * The IfcPointOnCurve is a point defined by a parameter value of its defining curve.
 */
export const IfcPointOnCurve = 1429;

/**
 * The IfcPointOnSurface is a point defined by two parameter value of its defining surface.
 */
export const IfcPointOnSurface = 1430;

/**
 * The polygonal bounded half space is a special subtype of a half space solid, where the material of the half space used in Boolean expressions is bounded by a polygonal boundary. The base surface of the half space is positioned by its normal relative to the object coordinate system (as defined at the supertype IfcHalfSpaceSolid), and its polygonal (with or without arc segments) boundary is defined in the XY plane of the position coordinate system established by the Position attribute, the subtraction body is extruded perpendicular to the XY plane of the position coordinate system, that is, into the direction of the positive Z axis defined by the Position attribute.
 */
export const IfcPolygonalBoundedHalfSpace = 1431;

/**
 * The IfcPolygonalFaceSet is a tessellated face set with all faces being bound by polygons. The planar faces are constructed by implicit polylines defined by three or more Cartesian points. Each planar face is defined by an instance of IfcIndexedPolygonalFace, or in case of faces with inner loops by IfcIndexedPolygonalFaceWithVoids.
 */
export const IfcPolygonalFaceSet = 1432;

/**
 * The IfcPolyline is a bounded curve with only linear segments defined by a list of Cartesian points. If the first and the last Cartesian point in the list are identical, then the polyline is a closed curve, otherwise it is an open curve.
 */
export const IfcPolyline = 1433;

/**
 *
 */
export const IfcPolyLoop = 1434;

/**
 * A port provides the means for an element to connect to other elements.
 */
export const IfcPort = 1435;

/**
 * This entity represents an address for delivery of paper based mail and other postal deliveries.
 */
export const IfcPostalAddress = 1436;

/**
 * The pre defined colour determines those qualified names which can be used to identify a colour that is in scope of the current data exchange specification (in contrary to colour specification which defines the colour directly by its colour components).
 */
export const IfcPreDefinedColour = 1437;

/**
 *
 */
export const IfcPreDefinedCurveFont = 1438;

/**
 * A pre defined item is a qualified name given to a style or font which is determined within the data exchange specification by convention on using the Name attribute value (in contrary to externally defined items, which are agreed by an external source).
 */
export const IfcPreDefinedItem = 1439;

/**
 * The IfcPreDefinedProperties is an abstract supertype of all predefined property collections that have explicit attributes, each representing a property. Instantiable subtypes are assigned to specific characterised entities.
 */
export const IfcPreDefinedProperties = 1440;

/**
 * IfcPreDefinedPropertySet is a generalization of all statically defined property sets that are assigned to an object or type object. The statically or pre-defined property sets are entities with a fixed list of attributes having particular defined data types.
 */
export const IfcPreDefinedPropertySet = 1441;

/**
 * The pre defined text font determines those qualified names which can be used for fonts that are in scope of the current data exchange specification (in contrary to externally defined text fonts). There are two choices:
 */
export const IfcPreDefinedTextFont = 1442;

/**
 * The IfcPresentationItem is the abstract supertype of all entities used for presentation appearance definitions.
 */
export const IfcPresentationItem = 1443;

/**
 * The presentation layer assignment provides the layer name (and optionally a description and an identifier) for a collection of geometric representation items. The IfcPresentationLayerAssignment corresponds to the term "CAD RendererLayer" and is used mainly for grouping and visibility control.
 */
export const IfcPresentationLayerAssignment = 1444;

/**
 * An IfcPresentationLayerAssignmentWithStyle extends the presentation layer assignment with capabilities to define visibility control, access control and kdtree3 style information.
 */
export const IfcPresentationLayerWithStyle = 1445;

/**
 * The IfcPresentationStyle is an abstract generalization of style table for presentation information assigned to geometric representation items. It includes styles for curves, areas, surfaces, and text. Style information may include colour, hatching, rendering, and text fonts.
 */
export const IfcPresentationStyle = 1446;

/**
 * Assignment of style information to a styled item.
 */
export const IfcPresentationStyleAssignment = 1447;

/**
 * An IfcProcedure is a logical set of actions to be taken in response to an event or to cause an event to occur.
 */
export const IfcProcedure = 1448;

/**
 * An IfcProcedureType defines a particular type of procedure that may be specified.
 */
export const IfcProcedureType = 1449;

/**
 * IfcProcess is defined as one individual activity or event, that is ordered in time, that has sequence relationships with other processes, which transforms input in output, and may connect to other other processes through input output relationships. An IfcProcess can be an activity (or task), or an event. It takes usually place in building construction with the intent of designing, costing, acquiring, constructing, or maintaining products or other and similar tasks or procedures. Figure 131 illustrates process relationships.
 */
export const IfcProcess = 1450;

/**
 * The IfcProduct is an abstract representation of any object that relates to a geometric or spatial context. An IfcProduct occurs at a specific location in space if it has a geometric representation assigned. It can be placed relatively to other products, but ultimately relative to the project coordinate system. The ObjectPlacement attribute establishes the coordinate system in which all points and directions used by the geometric representation items under Representation are founded. The Representation is provided by an IfcProductDefinitionShape being either a geometric shape representation, or a topology representation (with or without underlying geometry of the topological items).
 */
export const IfcProduct = 1451;

/**
 * The IfcProductDefinitionShape defines all shape relevant information about an IfcProduct. It allows for multiple geometric shape representations of the same product. The shape relevant information includes:
 */
export const IfcProductDefinitionShape = 1452;

/**
 * IfcProductRepresentation defines a representation of a product, including its (geometric or topological) representation. A product can have zero, one or many geometric representations, and a single geometric representation can be shared among various products using mapped representations.
 */
export const IfcProductRepresentation = 1453;

/**
 * IfcProfileDef is the supertype of all definitions of standard and arbitrary profiles within IFC. It is used to define a standard set of commonly used section profiles by their parameters or by their explicit curve geometry.
 */
export const IfcProfileDef = 1454;

/**
 * This is a collection of properties applicable to section profile definitions.
 */
export const IfcProfileProperties = 1455;

/**
 * IfcProject indicates the undertaking of some design, engineering, construction, or maintenance activities leading towards a product. The project establishes the context for information to be exchanged or shared, and it may represent a construction project but does not have to. The IfcProject's main purpose in an exchange structure is to provide the root instance and the context for all other information items included.
 */
export const IfcProject = 1456;

/**
 * IfcProjectedCRS is a coordinate reference system of the map to which the map translation of the local engineering coordinate system of the construction or facility engineering project relates. The MapProjection and MapZone attributes uniquely identify the projection to the underlying geographic coordinate reference system, provided that they are well-known in the receiving application. The projected coordinate reference system is assumed to be a 2D or 3D right-handed Cartesian coordinate system, the optional MapUnit attribute can be used determine the length unit used by the map.
 */
export const IfcProjectedCRS = 1457;

/**
 * The projection element is a specialization of the general feature element to represent projections applied to building elements. It represents a solid attached to any element that has physical manifestation.
 */
export const IfcProjectionElement = 1458;

/**
 * An IfcProjectLibrary collects all library elements that are included within a referenced project data set.
 */
export const IfcProjectLibrary = 1459;

/**
 * A project order is a directive to purchase products and/or perform work, such as for construction or facilities management.
 */
export const IfcProjectOrder = 1460;

/**
 * IfcProperty is an abstract generalization for all types of properties that can be associated with IFC objects through the property set mechanism.
 */
export const IfcProperty = 1461;

/**
 * The IfcPropertyAbstraction is an abstract supertype of all property related entities defined as dependent resource entities within the specification. It may have an external reference to a dictionary or library that provides additional information about its definition. Instantiable subtypes have property name, value and other instance information.
 */
export const IfcPropertyAbstraction = 1462;

/**
 * A property with a bounded value, IfcPropertyBoundedValue, defines a property object which has a maximum of two (numeric or descriptive) values assigned, the first value specifying the upper bound and the second value specifying the lower bound. It defines a property - value bound (min-max) combination for which the property Name, an optional Description, the optional UpperBoundValue with measure type, the optional LowerBoundValue with measure type, and the optional Unit is given. A set point value can be provided in addition to the upper and lower bound values for operational value setting.
 */
export const IfcPropertyBoundedValue = 1463;

/**
 * IfcPropertyDefinition defines the generalization of all characteristics (i.e. a grouping of individual properties), that may be assigned to objects. Currently, subtypes of IfcPropertyDefinition include property set occurrences, property set templates, and property templates.
 */
export const IfcPropertyDefinition = 1464;

/**
 * An IfcPropertyDependencyRelationship describes an identified dependency between the value of one property and that of another.
 */
export const IfcPropertyDependencyRelationship = 1465;

/**
 * A property with an enumerated value, IfcPropertyEnumeratedValue, defines a property object which has a value assigned that is chosen from an enumeration. It defines a property - value combination for which the property Name, an optional Description, the optional EnumerationValues with measure type and optionally an Unit is given.
 */
export const IfcPropertyEnumeratedValue = 1466;

/**
 * IfcPropertyEnumeration is a collection of simple or measure values that define a prescribed set of alternatives from which 'enumeration values' are selected. This enables inclusion of enumeration values in property sets. IfcPropertyEnumeration provides a name for the enumeration as well as a list of unique (numeric or descriptive) values (that may have a measure type assigned). The entity defines the list of potential enumerators to be exchanged together (or separately) with properties of type IfcPropertyEnumeratedValue that selects their actual property values from this enumeration.
 */
export const IfcPropertyEnumeration = 1467;

/**
 * An IfcPropertyListValue defines a property that has several (numeric or descriptive) values assigned, these values are given by an ordered list. It defines a property - list value combination for which the property Name, an optional Description, the optional ListValues with measure type and optionally an Unit is given. An IfcPropertyListValue is a list of values. The order in which values appear is significant. All list members shall be of the same type.
 */
export const IfcPropertyListValue = 1468;

/**
 * The IfcPropertyReferenceValue allows a property value to be of type of an resource level entity. The applicable entities that can be used as value references are given by the IfcObjectReferenceSelect.
 */
export const IfcPropertyReferenceValue = 1469;

/**
 * The IfcPropertySet is a container that holds properties within a property tree. These properties are interpreted according to their name attribute. Each individual property has a significant name string. Some property sets are included in the specification of this standard and have a predefined set of properties indicated by assigning a significant name. These property sets are listed under "property sets" within this specification. Property sets applicable to certain objects are listed in the object specification. The naming convention "Pset_Xxx" applies to all those property sets that are defined as part of this specification and it shall be used as the value of the Name attribute.
 */
export const IfcPropertySet = 1470;

/**
 * IfcPropertySetDefinition is a generalization of all individual property sets that can be assigned to an object or type object. The property set definition can be either:
 */
export const IfcPropertySetDefinition = 1471;

/**
 * IfcPropertySetTemplate defines the template for all dynamically extensible property sets represented by IfcPropertySet. The property set template is a container of property templates within a property tree. The individual property templates are interpreted according to their Name attribute and shall have no values assigned.
 */
export const IfcPropertySetTemplate = 1472;

/**
 * The property with a single value IfcPropertySingleValue defines a property object which has a single (numeric or descriptive) value assigned. It defines a property - single value combination for which the property Name, an optional Description, and an optional NominalValue with measure type is provided. In addition, the default unit as specified within the project unit context can be overriden by assigning an Unit.
 */
export const IfcPropertySingleValue = 1473;

/**
 * IfcPropertyTableValue is a property with a value range defined by a property object which has two lists of (numeric or descriptive) values assigned. The values specify a table with two columns. The defining values provide the first column and establish the scope for the defined values (the second column). An optional Expression attribute may give the equation used for deriving the range value, which is for information purposes only.
 */
export const IfcPropertyTableValue = 1474;

/**
 * The IfcPropertyTemplate is an abstract supertype comprising the templates for all dynamically extensible properties, either as an IfcComplexPropertyTemplate, or an IfcSimplePropertyTemplate. These templates determine the structure of:
 */
export const IfcPropertyTemplate = 1475;

/**
 * IfcPropertyTemplateDefinition is a generalization of all property and property set templates. Templates define the collection, types, names, applicable measure types and units of individual properties used in a project. The property template definition can be either:
 */
export const IfcPropertyTemplateDefinition = 1476;

/**
 * A protective device breaks an electrical circuit when a stated electric current that passes through it is exceeded.
 */
export const IfcProtectiveDevice = 1477;

/**
 * A protective device tripping unit breaks an electrical circuit at a separate breaking unit when a stated electric current that passes through the unit is exceeded.
 */
export const IfcProtectiveDeviceTrippingUnit = 1478;

/**
 * The distribution control element type IfcProtectiveDeviceTrippingUnitType defines commonly shared information for occurrences of protective device tripping units. The set of shared information may include:
 */
export const IfcProtectiveDeviceTrippingUnitType = 1479;

/**
 * The flow controller type IfcProtectiveDeviceType defines commonly shared information for occurrences of protective devices. The set of shared information may include:
 */
export const IfcProtectiveDeviceType = 1480;

/**
 * IfcProxy is intended to be a kind of a container for wrapping objects which are defined by associated properties, which may or may not have a geometric representation and placement in space. A proxy may have a semantic meaning, defined by the Name attribute, and property definitions, attached through the property assignment relationship, which definition may be outside of the definitions given by the current release of IFC.
 */
export const IfcProxy = 1481;

/**
 * A pump is a device which imparts mechanical work on fluids or slurries to move them through a channel or pipeline. A typical use of a pump is to circulate chilled water or heating hot water in a building services distribution system.
 */
export const IfcPump = 1482;

/**
 * The flow moving device type IfcPumpType defines commonly shared information for occurrences of pumps. The set of shared information may include:
 */
export const IfcPumpType = 1483;

/**
 * IfcQuantityArea is a physical quantity that defines a derived area measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityArea = 1484;

/**
 * IfcQuantityCount is a physical quantity that defines a derived count measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityCount = 1485;

/**
 * IfcQuantityLength is a physical quantity that defines a derived length measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityLength = 1486;

/**
 * IfcQuantitySet is the the abstract supertype for all quantity sets attached to objects. The quantity set is a container class that holds the individual quantities within a quantity tree. These quantities are interpreted according to their name attribute and classified according to their measure type. Some quantity sets are included in the IFC specification and have a predefined set of quantities indicated by assigning a significant name. These quantity sets are listed as "quantity sets" within this specification. Quantity sets applicable to certain objects are listed in the object specification.
 */
export const IfcQuantitySet = 1487;

/**
 * IfcQuantityTime is an element quantity that defines a time measure to provide a property of time related to an element. It is normally given by the recipe information of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityTime = 1488;

/**
 * IfcQuantityVolume is a physical quantity that defines a derived volume measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityVolume = 1489;

/**
 * IfcQuantityWeight is a physical element quantity that defines a derived weight measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export const IfcQuantityWeight = 1490;

/**
 * The railing is a frame assembly adjacent to human or vehicle circulation spaces and at some space boundaries where it is used in lieu of walls or to complement walls. Designed as an optional physical support, or to prevent injury or damage, either by falling or collision.
 */
export const IfcRailing = 1491;

/**
 * The building element type IfcRailingType defines commonly shared information for occurrences of railings. The set of shared information may include:
 */
export const IfcRailingType = 1492;

/**
 * A ramp is a vertical passageway which provides a human or vehicle circulation link between one floor level and another floor level at a different elevation. It may include a landing as an intermediate floor slab. A ramp normally does not include steps.
 */
export const IfcRamp = 1493;

/**
 * A ramp comprises a single inclined segment, or several inclined segments that are connected by a horizontal segment, refered to as a landing. A ramp flight is the single inclined segment and part of the ramp construction. In case of single flight ramps, the ramp flight and the ramp are identical.
 */
export const IfcRampFlight = 1494;

/**
 * The building element type IfcRampFlightType defines commonly shared information for occurrences of ramp flights. The set of shared information may include:
 */
export const IfcRampFlightType = 1495;

/**
 * The building element type IfcRampType defines commonly shared information for occurrences of ramps. The set of shared information may include:
 */
export const IfcRampType = 1496;

/**
 * A rational B-spline curve with knots is a B-spline curve described in terms of control points and basic functions. It describes weights in addition to the control points defined at the supertype IfcBSplineCurve.
 */
export const IfcRationalBSplineCurveWithKnots = 1497;

/**
 * A rational B-spline surface with knots is a piecewise parametric rational surface described in terms of control points, and associated weight values.
 */
export const IfcRationalBSplineSurfaceWithKnots = 1498;

/**
 * IfcRectangleHollowProfileDef defines a section profile that provides the defining parameters of a rectangular (or square) hollow section to be used by the swept surface geometry or the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. A square hollow section can be defined by equal values for h and b. The centre of the position coordinate system is in the profiles centre of the bounding box (for symmetric profiles identical with the centre of gravity). Normally, the longer sides are parallel to the y-axis, the shorter sides parallel to the x-axis.
 */
export const IfcRectangleHollowProfileDef = 1499;

/**
 * IfcRectangleProfileDef defines a rectangle as the profile definition used by the swept surface geometry or the swept area solid. It is given by its X extent and its Y extent, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system.
 */
export const IfcRectangleProfileDef = 1500;

/**
 * The IfcRectangularPyramid is a Construction Solid SceneGeometry (CSG) 3D primitive. It is a solid with a rectangular base and a point called apex as the top. The tapers from the base to the top. The axis from the center of the base to the apex is perpendicular to the base. The inherited Position attribute defines the IfcAxisPlacement3D and provides the location and orientation of the pyramid:
 */
export const IfcRectangularPyramid = 1501;

/**
 * The IfcRectangularTrimmedSurface is a surface created by bounding its BasisSurface along two pairs of parallel curves defined within the parametric space of the referenced surface.
 */
export const IfcRectangularTrimmedSurface = 1502;

/**
 * IfcRecurrencePattern defines repetitive time periods on the basis of regular recurrences such as each Monday in a week, or every third Tuesday in a month. The population of the remaining attributes such as DayComponent, Position, and Interval depend on the specified recurrence type.
 */
export const IfcRecurrencePattern = 1503;

/**
 * This entity is used to refer to a value of an attribute on an instance. It may refer to the value of a scalar attribute or a value within a collection-based attribute. Referenced attributes may be direct values, object references, collections, inverse object references, and inverse collections. References may be chained to form a path of object-attribute references.
 */
export const IfcReference = 1504;

/**
 * In a regular time series, the data arrives predictably at predefined intervals. In a regular time series there is no need to store multiple time stamps and the algorithms for analyzing the time series are therefore significantly simpler. Using the start time provided in the supertype, the time step is used to identify the frequency of the occurrences of the list of values.
 */
export const IfcRegularTimeSeries = 1505;

/**
 * IfcReinforcementProperties defines the set of properties for a specific combination of reinforcement bar steel grade, bar type and effective depth.
 */
export const IfcReinforcementBarProperties = 1506;

/**
 * IfcReinforcementDefinitionProperties defines the cross section properties of reinforcement included in reinforced concrete building elements. The property set definition may be used both in conjunction with insitu and precast structures.
 */
export const IfcReinforcementDefinitionProperties = 1507;

/**
 * A reinforcing bar is usually made of steel with manufactured deformations in the surface, and used in concrete and masonry construction to provide additional strength. A single instance of this class may represent one or many of actual rebars, for example a row of rebars.
 */
export const IfcReinforcingBar = 1508;

/**
 * The reinforcing element type IfcReinforcingBarType defines commonly shared information for occurrences of reinforcing bars. The set of shared information may include:
 */
export const IfcReinforcingBarType = 1509;

/**
 * A reinforcing element represents bars, wires, strands, meshes, tendons, and other components embedded in concrete in such a manner that the reinforcement and the concrete act together in resisting forces.
 */
export const IfcReinforcingElement = 1510;

/**
 * The element component type IfcReinforcingElementType defines commonly shared information for occurrences of reinforcing elements. The set of shared information may include:
 */
export const IfcReinforcingElementType = 1511;

/**
 * A reinforcing mesh is a series of longitudinal and transverse wires or bars of various gauges, arranged at right angles to each other and welded at all points of intersection; usually used for concrete slab reinforcement. It is also known as welded wire fabric. In scope are plane meshes as well as bent meshes.
 */
export const IfcReinforcingMesh = 1512;

/**
 * The reinforcing element type IfcReinforcingMeshType defines commonly shared information for occurrences of reinforcing meshs. The set of shared information may include:
 */
export const IfcReinforcingMeshType = 1513;

/**
 * The aggregation relationship IfcRelAggregates is a special type of the general composition/decomposition (or whole/part) relationship IfcRelDecomposes. The aggregation relationship can be applied to all subtypes of IfcObjectDefinition.
 */
export const IfcRelAggregates = 1514;

/**
 * The assignment relationship, IfcRelAssigns, is a generalization of "link" relationships among instances of IfcObject and its various 1st level subtypes. A link denotes the specific association through which one object (the client) applies the services of other objects (the suppliers), or through which one object may navigate to other objects.
 */
export const IfcRelAssigns = 1515;

/**
 * The objectified relationship IfcRelAssignsToActor handles the assignment of objects (subtypes of IfcObject) to an actor (subtypes of IfcActor).
 */
export const IfcRelAssignsToActor = 1516;

/**
 * The objectified relationship IfcRelAssignsToControl handles the assignment of a control (represented by subtypes of IfcControl) to other objects (represented by subtypes of IfcObject, with the exception of controls).
 */
export const IfcRelAssignsToControl = 1517;

/**
 * The objectified relationship IfcRelAssignsToGroup handles the assignment of object definitions (individual object occurrences as subtypes of IfcObject, and object types as subtypes of IfcTypeObject) to a group (subtypes of IfcGroup).
 */
export const IfcRelAssignsToGroup = 1518;

/**
 * The objectified relationship IfcRelAssignsToGroupByFactor is a specialization of the general grouping mechanism. It allows to add a factor to define the ratio that applies to the assignment of object definitions (individual object occurrences as subtypes of IfcObject and object types as subtypes of IfcTypeObject) to a group (subtypes of IfcGroup).
 */
export const IfcRelAssignsToGroupByFactor = 1519;

/**
 * The objectified relationship IfcRelAssignsToProcess handles the assignment of one or many objects to a process or activity. An object can be a product that is the item the process operates on. Processes and activities can operate on things other than products, and can operate in ways other than input and output.
 */
export const IfcRelAssignsToProcess = 1520;

/**
 * The objectified relationship IfcRelAssignsToProduct handles the assignment of objects (subtypes of IfcObject) to a product (subtypes of IfcProduct). The Name attribute should be used to classify the usage of the IfcRelAssignsToProduct objectified relationship. The following Name values are proposed:
 */
export const IfcRelAssignsToProduct = 1521;

/**
 * The objectified relationship IfcRelAssignsToResource handles the assignment of objects (as subtypes of IfcObject), acting as a resource usage or consumption, to a resource (as subtypes of IfcResource).
 */
export const IfcRelAssignsToResource = 1522;

/**
 * The association relationship IfcRelAssociates refers to sources of information (most notably a classification, library, document, approval, contraint, or material). The information associated may reside internally or externally of the project data. There is no dependency implied by the association.
 */
export const IfcRelAssociates = 1523;

/**
 * The entity IfcRelAssociatesApproval is used to apply approval information defined by IfcApproval, in IfcApprovalResource schema, to subtypes of IfcRoot.
 */
export const IfcRelAssociatesApproval = 1524;

/**
 * The objectified relationship IfcRelAssociatesClassification handles the assignment of a classification item (items of the select IfcClassificationSelect) to objects occurrences (subtypes of IfcObject) or object types (subtypes of IfcTypeObject).
 */
export const IfcRelAssociatesClassification = 1525;

/**
 * The entity IfcRelAssociatesConstraint is used to apply constraint information defined by IfcConstraint, in the IfcConstraintResource schema, to subtypes of IfcRoot.
 */
export const IfcRelAssociatesConstraint = 1526;

/**
 * The objectified relationship (IfcRelAssociatesDocument) handles the assignment of a document information (items of the select IfcDocumentSelect) to objects occurrences (subtypes of IfcObject) or object types (subtypes of IfcTypeObject).
 */
export const IfcRelAssociatesDocument = 1527;

/**
 * The objectified relationship (IfcRelAssociatesLibrary) handles the assignment of a library item (items of the select IfcLibrarySelect) to subtypes of IfcObjectDefinition or IfcPropertyDefinition.
 */
export const IfcRelAssociatesLibrary = 1528;

/**
 * IfcRelAssociatesMaterial is an objectified relationship between a material definition and elements or element types to which this material definition applies.
 */
export const IfcRelAssociatesMaterial = 1529;

/**
 * IfcRelationship is the abstract generalization of all objectified relationships in IFC. Objectified relationships are the preferred way to handle relationships among objects. This allows to keep relationship specific properties directly at the relationship and opens the possibility to later handle relationship specific behavior.
 */
export const IfcRelationship = 1530;

/**
 * IfcRelConnects is a connectivity relationship that connects objects under some criteria. As a general connectivity it does not imply constraints, however subtypes of the relationship define the applicable object types for the connectivity relationship and the semantics of the particular connectivity.
 */
export const IfcRelConnects = 1531;

/**
 * The IfcRelConnectsElements objectified relationship provides the generalization of the connectivity between elements. It is a 1 to 1 relationship. The concept of two elements being physically or logically connected is described independently from the connecting elements. The connectivity may be related to the shape representation of the connected entities by providing a connection geometry.
 */
export const IfcRelConnectsElements = 1532;

/**
 * The IfcRelConnectsPathElements relationship provides the connectivity information between two elements, which have path information.
 */
export const IfcRelConnectsPathElements = 1533;

/**
 * An IfcRelConnectsPorts relationship defines the relationship that is made between two ports at their point of connection. It may include the connection geometry between two ports.
 */
export const IfcRelConnectsPorts = 1534;

/**
 * IfcRelConnectsPortToElement is a relationship between a distribution element and dynamically connected ports where connections are realised to other distribution elements.
 */
export const IfcRelConnectsPortToElement = 1535;

/**
 * The IfcRelConnectsStructuralActivity relationship connects a structural activity (either an action or reaction) to a structural member, structural connection, or element.
 */
export const IfcRelConnectsStructuralActivity = 1536;

/**
 * The entity IfcRelConnectsStructuralMember defines all needed properties describing the connection between structural members and structural connection objects (nodes or supports).
 */
export const IfcRelConnectsStructuralMember = 1537;

/**
 * The entity IfcRelConnectsWithEccentricity adds the definition of eccentricity to the connection between a structural member and a structural connection (representing either a node or support).
 */
export const IfcRelConnectsWithEccentricity = 1538;

/**
 * IfcRelConnectsWithRealizingElements defines a generic relationship that is made between two elements that require the realization of that relationship by means of further realizing elements.
 */
export const IfcRelConnectsWithRealizingElements = 1539;

/**
 * This objectified relationship, IfcRelContainedInSpatialStructure, is used to assign elements to a certain level of the spatial project structure. Any element can only be assigned once to a certain level of the spatial structure. The question, which level is relevant for which type of element, can only be answered within the context of a particular project and might vary within the various regions.
 */
export const IfcRelContainedInSpatialStructure = 1540;

/**
 * The IfcRelCoversBldgElements relationship is an objectified relationship between an element and one to many coverings, which cover that element.
 */
export const IfcRelCoversBldgElements = 1541;

/**
 * The objectified relationship, IfcRelCoversSpace, relates a space object to one or many coverings, which faces (or is assigned to) the space.
 */
export const IfcRelCoversSpaces = 1542;

/**
 * The objectified relationship IfcRelDeclares handles the declaration of objects (subtypes of IfcObject) or properties (subtypes of IfcPropertyDefinition) to a project or project library (represented by IfcProject, or IfcProjectLibrary).
 */
export const IfcRelDeclares = 1543;

/**
 * The decomposition relationship, IfcRelDecomposes, defines the general concept of elements being composed or decomposed. The decomposition relationship denotes a whole/part hierarchy with the ability to navigate from the whole (the composition) to the parts and vice versa.
 */
export const IfcRelDecomposes = 1544;

/**
 * A generic and abstract relationship which subtypes are used to:
 */
export const IfcRelDefines = 1545;

/**
 * The objectified relationship IfcRelDefinesByObject defines the relationship between an object taking part in an object type decomposition and an object occurrences taking part in an occurrence decomposition of that type.
 */
export const IfcRelDefinesByObject = 1546;

/**
 * The objectified relationship IfcRelDefinesByProperties defines the relationships between property set definitions and objects. Properties are aggregated in property sets. Property sets can be either directly assigned to occurrence objects using this relationship, or assigned to an object type and assigned via that type to occurrence objects. The assignment of an IfcPropertySet to an IfcTypeObject is not handled via this objectified relationship, but through the direct relationship HasPropertySets at IfcTypeObject.
 */
export const IfcRelDefinesByProperties = 1547;

/**
 * The objectified relationship IfcRelDefinesByTemplate defines the relationships between property set template and property sets. Common information about property sets, e.g. the applicable name, description, contained properties, is defined by the property set template and assigned to all property sets.
 */
export const IfcRelDefinesByTemplate = 1548;

/**
 * The objectified relationship IfcRelDefinesByType defines the relationship between an object type and object occurrences. The IfcRelDefinesByType is a 1-to-N relationship, as it allows for the assignment of one type information to a single or to many objects. Those objects then share the same object type, and the property sets and properties assigned to the object type.
 */
export const IfcRelDefinesByType = 1549;

/**
 * IfcRelFillsElement is an objectified relationship between an opening element and an element that fills (or partially fills) the opening element. It is an one-to-one relationship.
 */
export const IfcRelFillsElement = 1550;

/**
 * This objectified relationship between a distribution flow element occurrence and one-to-many control element occurrences indicates that the control element(s) sense or control some aspect of the flow element. It is applied to IfcDistributionFlowElement and IfcDistributionControlElement.
 */
export const IfcRelFlowControlElements = 1551;

/**
 * The IfcRelInterferesElements objectified relationship indicates that two elements interfere. Interference is a spatial overlap between the two elements. It is a 1 to 1 relationship. The concept of two elements interfering physically or logically is described independently from the elements. The interference may be related to the shape representation of the entities by providing an interference geometry.
 */
export const IfcRelInterferesElements = 1552;

/**
 * The nesting relationship IfcRelNests is a special type of the general composition/decomposition (or whole/part) relationship IfcRelDecomposes. The nesting relationship can be applied to all non physical subtypes of object and object types, namely processes, controls (like cost items), and resources. It can also be applied to physical subtypes of object and object types, namely elements having ports. The nesting implies an order among the nested parts.
 */
export const IfcRelNests = 1553;

/**
 * The IfcRelProjectsElement is an objectified relationship between an element and one projection element that creates a modifier to the shape of the element. The relationship is defined to be a 1:1 relationship, if an element has more than one projection, several relationship objects have to be used, each pointing to a different projection element. The IfcRelProjectsElement establishes an aggregation relationship between the main element and a sub ordinary addition feature.
 */
export const IfcRelProjectsElement = 1554;

/**
 * The objectified relationship, IfcRelReferencedInSpatialStructure is used to assign elements in addition to those levels of the project spatial\S\ structure, in which they are referenced, but not primarily contained. It is also used to connect a system to the relevant spatial element that it serves.
 */
export const IfcRelReferencedInSpatialStructure = 1555;

/**
 * IfcRelSequence is a sequential relationship between processes where one process must occur before the other in time and where the timing of the relationship may be described as a type of sequence. The relating process (IfcRelSequence.RelatingProcess) is considered to be the predecessor in the relationship (has precedence) whilst the related process (IfcRelSequence.RelatedProcess) is the successor.
 */
export const IfcRelSequence = 1556;

/**
 * The IfcRelServicesBuildings is an objectified relationship that defines the relationship between a system and the sites, buildings, storeys, spaces, or spatial zones, it serves. Examples of systems are:
 */
export const IfcRelServicesBuildings = 1557;

/**
 * The space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary to the surrounding elements.
 */
export const IfcRelSpaceBoundary = 1558;

/**
 * The 1st level space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary1stLevel to the surrounding elements. 1st level space boundaries are characterizeda by:
 */
export const IfcRelSpaceBoundary1stLevel = 1559;

/**
 * The 2nd level space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary2ndLevel to the surrounding elements. 2nd level space boundaries are characterized by:
 */
export const IfcRelSpaceBoundary2ndLevel = 1560;

/**
 * IfcRelVoidsElement is an objectified relationship between a building element and one opening element that creates a void in the element. It is a one-to-one relationship. This relationship implies a Boolean operation of subtraction between the geometric bodies of the element and the opening.
 */
export const IfcRelVoidsElement = 1561;

/**
 * The IfcReparametrisedCompositeCurveSegment is geometrically identical to a IfcCompositeCurveSegment but with the additional capability of reparametrization.
 */
export const IfcReparametrisedCompositeCurveSegment = 1562;

/**
 * The IfcRepresentation defines the general concept of representing product properties and in particular the product shape.
 */
export const IfcRepresentation = 1563;

/**
 * The IfcRepresentationContext defines the context to which the IfcRepresentation of a product is related.
 */
export const IfcRepresentationContext = 1564;

/**
 * The IfcRepresentationItem is used within an IfcRepresentation (directly or indirectly through other IfcRepresentationItem's) to represent an IfcProductRepresentation. Most commonly these IfcRepresentationItem's are geometric or topological representation items, that can (but not need to) have presentation style infomation assigned.
 */
export const IfcRepresentationItem = 1565;

/**
 * An IfcRepresentationMap defines the base definition (also referred to as block, cell or macro) called MappedRepresentation within the MappingOrigin. The MappingOrigin defines the coordinate system in which the MappedRepresentation is defined.
 */
export const IfcRepresentationMap = 1566;

/**
 * IfcResource contains the information needed to represent the costs, schedule, and other impacts from the use of a thing in a process. It is not intended to use IfcResource to model the general properties of the things themselves, while an optional linkage from IfcResource to the things to be used can be specified (specifically, the relationship from subtypes of IfcResource to IfcProduct through the IfcRelAssignsToResource relationship).
 */
export const IfcResource = 1567;

/**
 * An IfcResourceApprovalRelationship is used for associating an approval to resource objects. A single approval might be given to one or many items via IfcResourceObjectSelect.
 */
export const IfcResourceApprovalRelationship = 1568;

/**
 * An IfcResourceConstraintRelationship is a relationship entity that enables a constraint to be related to one or more resource level objects.
 */
export const IfcResourceConstraintRelationship = 1569;

/**
 * IfcResourceLevelRelationship is an abstract base entity for relationships between resource-level entities.
 */
export const IfcResourceLevelRelationship = 1570;

/**
 * IfcResourceTime captures the time-related information about a construction resource.
 */
export const IfcResourceTime = 1571;

/**
 * An IfcRevolvedAreaSolid is a solid created by revolving a cross section provided by a profile definition about an axis.
 */
export const IfcRevolvedAreaSolid = 1572;

/**
 * IfcRevolvedAreaSolidTapered is defined by revolving a cross section along a circular arc. The cross section may change along the revolving sweep from the shape of the start cross section into the shape of the end cross section. Corresponding vertices of the start and end cross sections are then connected. The bounded surface may have holes which will sweep into holes in the solid.
 */
export const IfcRevolvedAreaSolidTapered = 1573;

/**
 * The IfcRightCircularCone is a Construction Solid SceneGeometry (CSG) 3D primitive. It is a solid with a circular base and a point called apex as the top. The tapers from the base to the top. The axis from the center of the circular base to the apex is perpendicular to the base. The inherited Position attribute defines the IfcAxisPlacement3D and provides the location and orientation of the cone:
 */
export const IfcRightCircularCone = 1574;

/**
 * The IfcRightCircularCylinder is a Construction Solid SceneGeometry (CSG) 3D primitive. It is a solid with a circular base and top. The cylindrical surface between if formed by points at a fixed distance from the axis of the cylinder. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export const IfcRightCircularCylinder = 1575;

/**
 * A roof is the covering of the top part of a building, it protects the building against the effects of wheather.
 */
export const IfcRoof = 1576;

/**
 * The building element type IfcRoofType defines commonly shared information for occurrences of roofs. The set of shared information may include:
 */
export const IfcRoofType = 1577;

/**
 * IfcRoot is the most abstract and root class for all entity definitions that roots in the kernel or in subsequent layers of the IFC specification. It is therefore the kdtree3 supertype of all IFC entities, beside those defined in an IFC resource schema. All entities that are subtypes of IfcRoot can be used independently, whereas resource schema entities, that are not subtypes of IfcRoot, are not supposed to be independent entities.
 */
export const IfcRoot = 1578;

/**
 * IfcRoundedRectangleProfileDef defines a rectangle with equally rounded corners as the profile definition used by the swept surface geometry or the swept area solid. It is given by the X extent, the Y extent, and the radius for the rounded corners, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system, that is, in the center of the bounding box.
 */
export const IfcRoundedRectangleProfileDef = 1579;

/**
 * A sanitary terminal is a fixed appliance or terminal usually supplied with water and used for drinking, cleaning or foul water disposal or that is an item of equipment directly used with such an appliance or terminal.
 */
export const IfcSanitaryTerminal = 1580;

/**
 * The flow terminal type IfcSanitaryTerminalType defines commonly shared information for occurrences of sanitary terminals. The set of shared information may include:
 */
export const IfcSanitaryTerminalType = 1581;

/**
 * IfcSchedulingTime is the abstract supertype of entities that capture time-related information of processes.
 */
export const IfcSchedulingTime = 1582;

/**
 * An IfcSeamCurve is a 3-dimensional curve that has additional representations provided by exactly two distinct pcurves describing the same curve at the two extreme ends of a closed parametric surface.
 */
export const IfcSeamCurve = 1583;

/**
 * An IfcSectionedSpine is a representation of the shape of a three dimensional object composed by a number of planar cross sections, and a spine curve. The shape is defined between the first element of cross sections and the last element of the cross sections. A sectioned spine may be used to represent a surface or a solid but the interpolation of the shape between the cross sections is not defined.
 */
export const IfcSectionedSpine = 1584;

/**
 * IfcSectionProperties defines the cross section properties for a single longitudinal piece of a cross section. It is a special-purpose helper class for IfcSectionReinforcementProperties.
 */
export const IfcSectionProperties = 1585;

/**
 * IfcSectionReinforcementProperties defines the cross section properties of reinforcement for a single longitudinal piece of a cross section with a specific reinforcement usage type.
 */
export const IfcSectionReinforcementProperties = 1586;

/**
 * A sensor is a device that measures a physical quantity and converts it into a signal which can be read by an observer or by an instrument.
 */
export const IfcSensor = 1587;

/**
 * The distribution control element type IfcSensorType defines commonly shared information for occurrences of sensors. The set of shared information may include:
 */
export const IfcSensorType = 1588;

/**
 * Shading devices are purpose built devices to protect from the sunlight, from natural light, or screening them from view. Shading devices can form part of the facade or can be mounted inside the building, they can be fixed or operable.
 */
export const IfcShadingDevice = 1589;

/**
 * The building element type IfcShadingDeviceType defines commonly shared information for occurrences of shading devices. The set of shared information may include:
 */
export const IfcShadingDeviceType = 1590;

/**
 * IfcShapeAspect allows for grouping of shape representation items that represent aspects (or components) of the shape of a product. Thereby shape representations of components of the product shape represent a distinctive part to a product that can be explicitly addressed.
 */
export const IfcShapeAspect = 1591;

/**
 * IfcShapeModel represents the concept of a particular geometric and/or topological representation of a product's shape or a product component's shape within a representation context. This representation context has to be a geometric representation context (with the exception of topology representations without associated geometry). The two subtypes are IfcShapeRepresentation to cover geometric models that represent a shape, and IfcTopologyRepresentation to cover the conectivity of a product or product component. The topology may or may not have geometry associated.
 */
export const IfcShapeModel = 1592;

/**
 * The IfcShapeRepresentation represents the concept of a particular geometric representation of a product or a product component within a specific geometric representation context. The inherited attribute RepresentationType is used to define the geometric model used for the shape representation (e.g. 'SweptSolid', or 'Brep'), the inherited attribute RepresentationIdentifier is used to denote the kind of the representation captured by the IfcShapeRepresentation (e.g. 'Axis', 'Body', etc.).
 */
export const IfcShapeRepresentation = 1593;

/**
 * An IfcShellBasedSurfaceModel represents the shape by a set of open or closed shells. The connected faces within the shell have a dimensionality 2 and are placed in a coordinate space of dimensionality 3.
 */
export const IfcShellBasedSurfaceModel = 1594;

/**
 * IfcSimpleProperty is a generalization of a single property object. The various subtypes of IfcSimpleProperty establish different ways in which a property value can be set.
 */
export const IfcSimpleProperty = 1595;

/**
 * The IfcSimplePropertyTemplate defines the template for all dynamically extensible properties, either the subtypes of IfcSimpleProperty, or the subtypes of IfcPhysicalSimpleQuantity. The individual property templates are interpreted according to their Name attribute and may have a predefined template type, property units, and property measure types. The correct interpretation of the attributes:
 */
export const IfcSimplePropertyTemplate = 1596;

/**
 * A site is a defined area of land, possibly covered with water, on which the project construction is to be completed. A site may be used to erect, retrofit or turn down building(s), or for other construction related developments.
 */
export const IfcSite = 1597;

/**
 * The IfcSIUnit covers both standard base SI units such as meter and second, and derived SI units such as Pascal, square meter and cubic meter.
 */
export const IfcSIUnit = 1598;

/**
 * A slab is a component of the construction that may enclose a space vertically. The slab may provide the lower support (floor) or upper construction (roof slab) in any space in a building.
 */
export const IfcSlab = 1599;

/**
 * The IfcSlabElementedCase defines a slab with certain constraints for the provision of its components. The IfcSlabElementedCase handles all cases of slabs, that are decomposed into parts:
 */
export const IfcSlabElementedCase = 1600;

/**
 * The standard slab, IfcSlabStandardCase, defines a slab with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcSlabStandardCase handles all cases of slabs, that:
 */
export const IfcSlabStandardCase = 1601;

/**
 * The element type IfcSlabType defines commonly shared information for occurrences of slabs. The set of shared information may include:
 */
export const IfcSlabType = 1602;

/**
 * Describes slippage in support conditions or connection conditions. Slippage means that a relative displacement may occur in a support or connection before support or connection reactions are awoken.
 */
export const IfcSlippageConnectionCondition = 1603;

/**
 * A solar device converts solar radiation into other energy such as electric current or thermal energy.
 */
export const IfcSolarDevice = 1604;

/**
 * The energy conversion device type IfcSolarDeviceType defines commonly shared information for occurrences of solar devices. The set of shared information may include:
 */
export const IfcSolarDeviceType = 1605;

/**
 * An IfcSolidModel represents the 3D shape by different types of solid model representations. It is the kdtree3 abstract supertype of Boundary representation, CSG representation, Sweeping representation and other suitable solid representation schemes.
 */
export const IfcSolidModel = 1606;

/**
 * A space represents an area or volume bounded actually or theoretically. Spaces are areas or volumes that provide for certain functions within a building.
 */
export const IfcSpace = 1607;

/**
 * Space heaters utilize a combination of radiation and/or natural convection using a heating source such as electricity, steam or hot water to heat a limited space or area. Examples of space heaters include radiators, convectors, baseboard and finned-tube heaters.
 */
export const IfcSpaceHeater = 1608;

/**
 * The flow terminal type IfcSpaceHeaterType defines commonly shared information for occurrences of space heaters. The set of shared information may include:
 */
export const IfcSpaceHeaterType = 1609;

/**
 * A space represents an area or volume bounded actually or theoretically. Spaces are areas or volumes that provide for certain functions within a building.
 */
export const IfcSpaceType = 1610;

/**
 * A spatial element is the generalization of all spatial elements that might be used to define a spatial structure or to define spatial zones.
 */
export const IfcSpatialElement = 1611;

/**
 * IfcSpatialElementType defines a list of commonly shared property set definitions of a spatial structure element and an optional set of product representations. It is used to define a spatial element specification (the specific element information, that is kdtree3 to all occurrences of that element type).
 */
export const IfcSpatialElementType = 1612;

/**
 * A spatial structure element is the generalization of all spatial elements that might be used to define a spatial structure. That spatial structure is often used to provide a project structure to organize a building project.
 */
export const IfcSpatialStructureElement = 1613;

/**
 * The element type (IfcSpatialStructureElementType) defines a list of commonly shared property set definitions of a spatial structure element and an optional set of product representations. It is used to define an element specification (i.e. the specific element information, that is kdtree3 to all occurrences of that element type).
 */
export const IfcSpatialStructureElementType = 1614;

/**
 * A spatial zone is a non-hierarchical and potentially overlapping decomposition of the project under some functional consideration. A spatial zone might be used to represent a thermal zone, a construction zone, a lighting zone, a usable area zone. A spatial zone might have its independent placement and shape representation.
 */
export const IfcSpatialZone = 1615;

/**
 * The IfcSpatialZoneType defines a list of commonly shared property set definitions of a space and an optional set of product representations. It is used to define a space specification (i.e. the specific space information, that is kdtree3 to all occurrences of that space type).
 */
export const IfcSpatialZoneType = 1616;

/**
 * The IfcSphere is a Construction Solid SceneGeometry (CSG) 3D primitive. It is a solid where all points at the surface have the same distance from the center point. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export const IfcSphere = 1617;

/**
 * The IfcSphericalSurface is a bounded elementary surface. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export const IfcSphericalSurface = 1618;

/**
 * A stack terminal is placed at the top of a ventilating stack (such as to prevent ingress by birds or rainwater) or rainwater pipe (to act as a collector or hopper for discharge from guttering).
 */
export const IfcStackTerminal = 1619;

/**
 * The flow terminal type IfcStackTerminalType defines commonly shared information for occurrences of stack terminals. The set of shared information may include:
 */
export const IfcStackTerminalType = 1620;

/**
 * A stair is a vertical passageway allowing occupants to walk (step) from one floor level to another floor level at a different elevation. It may include a landing as an intermediate floor slab.
 */
export const IfcStair = 1621;

/**
 * A stair flight is an assembly of building components in a single "run" of stair steps (not interrupted by a landing). The stair steps and any stringers are included in the stair flight. A winder is also regarded a part of a stair flight.
 */
export const IfcStairFlight = 1622;

/**
 * The building element type IfcStairFlightType defines commonly shared information for occurrences of stair flights. The set of shared information may include:
 */
export const IfcStairFlightType = 1623;

/**
 * The building element type IfcStairType defines commonly shared information for occurrences of stairs. The set of shared information may include:
 */
export const IfcStairType = 1624;

/**
 * A structural action is a structural activity that acts upon a structural item or building element.
 */
export const IfcStructuralAction = 1625;

/**
 * The abstract entity IfcStructuralActivity combines the definition of actions (such as forces, displacements, etc.) and reactions (support reactions, internal forces, deflections, etc.) which are specified by using the basic load definitions from the IfcStructuralLoadResource.
 */
export const IfcStructuralActivity = 1626;

/**
 * The IfcStructuralAnalysisModel is used to assemble all information needed to represent a structural analysis model. It encompasses certain general properties (such as analysis type), references to all contained structural members, structural supports or connections, as well as loads and the respective load results.
 */
export const IfcStructuralAnalysisModel = 1627;

/**
 * An IfcStructuralConnection represents a structural connection object (node connection, edge connection, or surface connection) or supports.
 */
export const IfcStructuralConnection = 1628;

/**
 * Describe more rarely needed connection properties.
 */
export const IfcStructuralConnectionCondition = 1629;

/**
 * A structural curve action defines an action which is distributed over a curve. A curve action may be connected with a curve member or curve connection, or surface member or surface connection.
 */
export const IfcStructuralCurveAction = 1630;

/**
 * Instances of IfcStructuralCurveConnection describe edge 'nodes', i.e. edges where two or more surface members are joined, or edge supports. Edge curves may be straight or curved.
 */
export const IfcStructuralCurveConnection = 1631;

/**
 * Instances of IfcStructuralCurveMember describe edge members, i.e. structural analysis idealizations of beams, columns, rods etc.. Curve members may be straight or curved.
 */
export const IfcStructuralCurveMember = 1632;

/**
 * This entity describes edge members with varying profile properties. Each instance of IfcStructuralCurveMemberVarying is composed of two or more instances of IfcStructuralCurveMember with differing profile properties. These subordinate members relate to the instance of IfcStructuralCurveMemberVarying by IfcRelAggregates.
 */
export const IfcStructuralCurveMemberVarying = 1633;

/**
 * This entity defines a reaction which occurs distributed over a curve. A curve reaction may be connected with a curve member or curve connection, or surface member or surface connection.
 */
export const IfcStructuralCurveReaction = 1634;

/**
 * The abstract entity IfcStructuralItem is the generalization of structural members and structural connections, that is, analysis idealizations of elements in the building model. It defines the relation between structural members and connections with structural activities (actions and reactions).
 */
export const IfcStructuralItem = 1635;

/**
 * This entity defines an action with constant value which is distributed over a curve.
 */
export const IfcStructuralLinearAction = 1636;

/**
 * This abstract entity is the supertype of all loads (actions or reactions) or of certain requirements resulting from structural analysis, or certain provisions which influence structural analysis.
 */
export const IfcStructuralLoad = 1637;

/**
 * A load case is a load group, commonly used to group loads from the same action source.
 */
export const IfcStructuralLoadCase = 1638;

/**
 * This class combines one or more load or result values in a 1- or 2-dimensional configuration.
 */
export const IfcStructuralLoadConfiguration = 1639;

/**
 * The entity IfcStructuralLoadGroup is used to structure the physical impacts. By using the grouping features inherited from IfcGroup, instances of IfcStructuralAction (or its subclasses) and of IfcStructuralLoadGroup can be used to define load groups, load cases and load combinations. (See also IfcLoadGroupTypeEnum.)
 */
export const IfcStructuralLoadGroup = 1640;

/**
 * An instance of the entity IfcStructuralLoadLinearForce shall be used to define actions on curves.
 */
export const IfcStructuralLoadLinearForce = 1641;

/**
 * Abstract superclass of simple load or result classes.
 */
export const IfcStructuralLoadOrResult = 1642;

/**
 * An instance of the entity IfcStructuralLoadPlanarForce shall be used to define actions on faces.
 */
export const IfcStructuralLoadPlanarForce = 1643;

/**
 * Instances of the entity IfcStructuralLoadSingleDisplacement shall be used to define displacements.
 */
export const IfcStructuralLoadSingleDisplacement = 1644;

/**
 * Defines a displacement with warping.
 */
export const IfcStructuralLoadSingleDisplacementDistortion = 1645;

/**
 * Instances of the entity IfcStructuralLoadSingleForce shall be used to define the forces and moments of an action operating on a single point.
 */
export const IfcStructuralLoadSingleForce = 1646;

/**
 * Instances of the entity IfcStructuralLoadSingleForceWarping, as a subtype of IfcStructuralLoadSingleForce, shall be used to define an action operation on a single point. In addition to forces and moments defined by its supertype a warping moment can be defined.
 */
export const IfcStructuralLoadSingleForceWarping = 1647;

/**
 * The abstract entity IfcStructuralLoadStatic is the supertype of all static loads (actions or reactions) which can be defined. Within scope are single i.e. concentrated forces and moments, linear i.e. one-dimensionally distributed forces and moments, planar i.e. two-dimensionally distributed forces, furthermore displacements and temperature loads.
 */
export const IfcStructuralLoadStatic = 1648;

/**
 * An instance of the entity IfcStructuralLoadTemperature shall be used to define actions which are caused by a temperature change. As shown in Figure 430, the change of temperature is given with a constant value which is applied to the complete section and values for temperature differences between outer fibres of the section.
 */
export const IfcStructuralLoadTemperature = 1649;

/**
 * The abstract entity IfcStructuralMember is the superclass of all structural items which represent the idealized structural behavior of building elements.
 */
export const IfcStructuralMember = 1650;

/**
 * This entity defines an action with constant value which is distributed over a surface.
 */
export const IfcStructuralPlanarAction = 1651;

/**
 * This entity defines an action which acts on a point. A point action is typically connected with a point connection. It may also be connected with a curve member or curve connection, or surface member or surface connection.
 */
export const IfcStructuralPointAction = 1652;

/**
 * Instances of IfcStructuralPointConnection describe structural nodes or point supports.
 */
export const IfcStructuralPointConnection = 1653;

/**
 * This entity defines a reaction which occurs at a point. A point reaction is typically connected with a point connection. It may also be connected with a curve member or curve connection, or surface member or surface connection.
 */
export const IfcStructuralPointReaction = 1654;

/**
 * A structural reaction is a structural activity that results from a structural action imposed to a structural item or building element. Examples are support reactions, internal forces, and deflections.
 */
export const IfcStructuralReaction = 1655;

/**
 * Instances of the entity IfcStructuralResultGroup are used to group results of structural analysis calculations and to capture the connection to the underlying basic load group. The basic functionality for grouping inherited from IfcGroup is used to collect instances from IfcStructuralReaction or its respective subclasses.
 */
export const IfcStructuralResultGroup = 1656;

/**
 * This entity defines an action which is distributed over a surface. A surface action may be connected with a surface member or surface connection.
 */
export const IfcStructuralSurfaceAction = 1657;

/**
 * Instances of IfcStructuralSurfaceConnection describe face 'nodes', i.e. faces where two or more surface members are joined, or face supports. Face surfaces may be planar or curved.
 */
export const IfcStructuralSurfaceConnection = 1658;

/**
 * Instances of IfcStructuralSurfaceMember describe face members, that is, structural analysis idealizations of slabs, walls, and shells. Surface members may be planar or curved.
 */
export const IfcStructuralSurfaceMember = 1659;

/**
 * This entity describes surface members with varying section properties. The properties are provided by means of Pset_StructuralSurfaceMemberVaryingThickness via IfcRelDefinesByProperties, or by means of aggregation: An instance of IfcStructuralSurfaceMemberVarying may be composed of two or more instances of IfcStructuralSurfaceMember with differing section properties. These subordinate members relate to the instance of IfcStructuralSurfaceMemberVarying by IfcRelAggregates.
 */
export const IfcStructuralSurfaceMemberVarying = 1660;

/**
 * This entity defines a reaction which occurs distributed over a surface. A surface reaction may be connected with a surface member or surface connection.
 */
export const IfcStructuralSurfaceReaction = 1661;

/**
 * The IfcStyledItem holds presentation style information for products, either explicitly for an IfcGeometricRepresentationItem being part of an IfcShapeRepresentation assigned to a product, or by assigning presentation information to IfcMaterial being assigned as other representation for a product.
 */
export const IfcStyledItem = 1662;

/**
 * The IfcStyledRepresentation represents the concept of a styled presentation being a representation of a product or a product component, like material. within a representation context. This representation context does not need to be (but may be) a geometric representation context.
 */
export const IfcStyledRepresentation = 1663;

/**
 * IfcStyleModel represents the concept of a particular presentation style defined for a material (or other characteristic) of a product or a product component within a representation context. This representation context may (but has not to be) a geometric representation context.
 */
export const IfcStyleModel = 1664;

/**
 * IfcSubContractResource is a construction resource needed in a construction process that represents a sub-contractor.
 */
export const IfcSubContractResource = 1665;

/**
 * The resource type IfcSubContractResourceType defines commonly shared information for occurrences of subcontract resources. The set of shared information may include:
 */
export const IfcSubContractResourceType = 1666;

/**
 *
 */
export const IfcSubedge = 1667;

/**
 * An IfcSurface is a 2-dimensional representation item positioned in 3-dimensional space. 2-dimensional means that each point at the surface can be defined by a 2-dimensional coordinate system, usually by u and v coordinates.
 */
export const IfcSurface = 1668;

/**
 * An IfcSurfaceCurve is a 3-dimensional curve that has additional representations provided by one or two pcurves.
 */
export const IfcSurfaceCurve = 1669;

/**
 * The IfcSurfaceCurveSweptAreaSolid is the result of sweeping an area along a directrix that lies on a reference surface. The swept area is provided by a subtype of IfcProfileDef. The profile is placed by an implicit cartesian transformation operator at the start point of the sweep, where the profile normal agrees to the tangent of the directrix at this point, and the profile''s x-axis agrees to the surface normal. At any point along the directrix, the swept profile origin lies on the directrix, the profile''s normal points towards the tangent of the directrix, and the profile''s x-axis is identical to the surface normal at this point.
 */
export const IfcSurfaceCurveSweptAreaSolid = 1670;

/**
 * A surface feature is a modification at (onto, or into) of the surface of an element. Parts of the surface of the entire surface may be affected. The volume and mass of the element may be increased, remain unchanged, or be decreased by the surface feature, depending on manufacturing technology. However, any increase or decrease of volume is small compared to the total volume of the element.
 */
export const IfcSurfaceFeature = 1671;

/**
 * The IfcSurfaceOfLinearExtrusion is a surface derived by sweeping a curve along a vector.
 */
export const IfcSurfaceOfLinearExtrusion = 1672;

/**
 * The IfcSurfaceOfRevolution is a surface derived by rotating a curve about an axis.
 */
export const IfcSurfaceOfRevolution = 1673;

/**
 * Describes required or provided reinforcement area of surface members.
 */
export const IfcSurfaceReinforcementArea = 1674;

/**
 * IfcSurfaceStyle is an assignment of one or many surface style elements to a surface, defined by subtypes of IfcSurface, IfcFaceBasedSurfaceModel, IfcShellBasedSurfaceModel, or by subtypes of IfcSolidModel. The positive direction of the surface normal relates to the positive side. In case of solids the outside of the solid is to be taken as positive side.
 */
export const IfcSurfaceStyle = 1675;

/**
 * IfcSurfaceStyleLighting is a container class for properties for calculation of physically exact illuminance related to a particular surface style.
 */
export const IfcSurfaceStyleLighting = 1676;

/**
 * IfcSurfaceStyleRefraction extends the surface style lighting, or the surface style rendering definition for properties for calculation of physically exact illuminance by adding seldomly used properties. Currently this includes the refraction index (by which the light ray refracts when passing through a prism) and the dispersion factor (or Abbe constant) which takes into account the wavelength dependency of the refraction.
 */
export const IfcSurfaceStyleRefraction = 1677;

/**
 * IfcSurfaceStyleRendering holds the properties for visualization related to a particular surface side style. It allows rendering properties to be defined by:
 */
export const IfcSurfaceStyleRendering = 1678;

/**
 * The IfcSurfaceStyleShading allows for colour information and transparency used for shading and simple rendering. The surface colour is used for colouring or simple shading of the assigned surfaces and the transparency for identifying translucency, where 0.0 is completely opaque, and 1.0 is completely transparent.
 */
export const IfcSurfaceStyleShading = 1679;

/**
 * The entity IfcSurfaceStyleWithTextures allows to include image textures in surface styles. These image textures can be applied repeating across the surface or mapped with a particular scale upon the surface.
 */
export const IfcSurfaceStyleWithTextures = 1680;

/**
 * An IfcSurfaceTexture provides a 2-dimensional image-based texture map. It can either be given by referencing an external image file through an URL reference (IfcImageTexture), including the image file as a blob (long binary) into the data set (IfcBlobTexture), or by explicitly including an array of pixels (IfcPixelTexture).
 */
export const IfcSurfaceTexture = 1681;

/**
 * An IfcSweptAreaSolid represents the 3D shape by a sweeping representation scheme allowing a two dimensional planar cross section to sweep through space.
 */
export const IfcSweptAreaSolid = 1682;

/**
 * An IfcSweptDiskSolid represents the 3D shape by a sweeping representation scheme allowing a two dimensional circularly bounded plane to sweep along a three dimensional Directrix through space.
 */
export const IfcSweptDiskSolid = 1683;

/**
 * The IfcSweptDiskSolidPolygonal is a IfcSweptDiskSolid where the Directrix is restricted to be provided by an poly line only. An optional FilletRadius attribute can be asserted, it is then applied as a fillet to all transitions between the segments of the poly line.
 */
export const IfcSweptDiskSolidPolygonal = 1684;

/**
 * An IfcSweptSurface is a surface defined by sweeping a curve. The swept surface is defined by a open or closed curve, represented by a subtype if IfcProfileDef, that is provided as a two-dimensional curve on an implicit plane, and by the sweeping operation.
 */
export const IfcSweptSurface = 1685;

/**
 * A switch is used in a cable distribution system (electrical circuit) to control or modulate the flow of electricity.
 */
export const IfcSwitchingDevice = 1686;

/**
 * The flow controller type IfcSwitchingDeviceType defines commonly shared information for occurrences of switching devices. The set of shared information may include:
 */
export const IfcSwitchingDeviceType = 1687;

/**
 * A system is an organized combination of related parts within an AEC product, composed for a kdtree3 purpose or function or to provide a service. A system is essentially a functionally related aggregation of products. The grouping relationship to one or several instances of IfcProduct (the system members) is handled by IfcRelAssignsToGroup.
 */
export const IfcSystem = 1688;

/**
 * A system furniture element defines components of modular furniture which are not directly placed in a building structure but aggregated inside furniture.
 */
export const IfcSystemFurnitureElement = 1689;

/**
 * The furnishing element type IfcSystemFurnitureElementType defines commonly shared information for occurrences of system furniture elements. The set of shared information may include:
 */
export const IfcSystemFurnitureElementType = 1690;

/**
 * An IfcTable is a data structure for the provision of information in the form of rows and columns. Each instance may have IfcTableColumn instances that define the name, description and units for each column. The rows of information are stored as a list of IfcTableRow objects.
 */
export const IfcTable = 1691;

/**
 * An IfcTableColumn is a data structure that captures column information for use in an IfcTable. Each instance defines the identifier, name, description, and units of measure that are applicable to the columnar data associated with the IfcTableRow objects.
 */
export const IfcTableColumn = 1692;

/**
 * IfcTableRow contains data for a single row within an IfcTable.
 */
export const IfcTableRow = 1693;

/**
 * A tank is a vessel or container in which a fluid or gas is stored for later use.
 */
export const IfcTank = 1694;

/**
 * The flow storage device type IfcTankType defines commonly shared information for occurrences of tanks. The set of shared information may include:
 */
export const IfcTankType = 1695;

/**
 * An IfcTask is an identifiable unit of work to be carried out in a construction project.
 */
export const IfcTask = 1696;

/**
 * IfcTaskTime captures the time-related information about a task including the different types (actual or scheduled) of starting and ending times.
 */
export const IfcTaskTime = 1697;

/**
 * IfcTaskTimeRecurring is a recurring instance of IfcTaskTime for handling regularly scheduled or repetitive tasks.
 */
export const IfcTaskTimeRecurring = 1698;

/**
 * An IfcTaskType defines a particular type of task that may be specified for use within a work control.
 */
export const IfcTaskType = 1699;

/**
 * This entity represents an address to which telephone, electronic mail and other forms of telecommunications should be addressed.
 */
export const IfcTelecomAddress = 1700;

/**
 * A tendon is a steel element such as a wire, cable, bar, rod, or strand used to impart prestress to concrete when the element is tensioned.
 */
export const IfcTendon = 1701;

/**
 * A tendon anchor is the end connection for tendons in prestressed or posttensioned concrete.
 */
export const IfcTendonAnchor = 1702;

/**
 * The reinforcing element type IfcTendonAnchorType defines commonly shared information for occurrences of tendon anchors. The set of shared information may include:
 */
export const IfcTendonAnchorType = 1703;

/**
 * The reinforcing element type IfcTendonType defines commonly shared information for occurrences of tendons. The set of shared information may include:
 */
export const IfcTendonType = 1704;

/**
 * The IfcTessellatedFaceSet is a boundary representation topological model limited to planar faces and straight edges. It may represent an approximation of an analytical surface or solid that may be provided in addition to its tessellation as a separate shape representation. The IfcTessellatedFaceSet provides a compact data representation of an connected face set using indices into ordered lists of vertices, normals, colours, and texture maps.
 */
export const IfcTessellatedFaceSet = 1705;

/**
 * The IfcTessellatedItem is the abstract supertype of all tessellated geometric models.
 */
export const IfcTessellatedItem = 1706;

/**
 * The text literal is a geometric representation item which describes a text string using a string literal and additional position and path information. The text size and appearance is determined by the IfcTextStyle that is associated to the IfcTextLiteral through an IfcStyledItem.
 */
export const IfcTextLiteral = 1707;

/**
 * The text literal with extent is a text literal with the additional explicit information of the planar extent. An alignment attribute defines how the text box is aligned to the placement and how it may expand if additional lines of text need to be added.
 */
export const IfcTextLiteralWithExtent = 1708;

/**
 * The IfcTextStyle is a presentation style for annotations that place a text in model space. The IfcTextStyle provides the text style for presentation information assigned to IfcTextLiteral's. The style is defined by color, text font characteristics, and text box characteristics.
 */
export const IfcTextStyle = 1709;

/**
 *
 */
export const IfcTextStyleFontModel = 1710;

/**
 * The IfcTextStyleForDefinedFont combines the text font color with an optional background color, that fills the text box, defined by the planar extent given to the text literal.
 */
export const IfcTextStyleForDefinedFont = 1711;

/**
 * The IfcTextStyleTextModel combines all text style properties, that affect the presentation of a text literal within a given extent. It includes the spacing between characters and words, the horizontal and vertical alignment of the text within the planar box of the extent, decorations (like underline), transformations of the literal (like uppercase), and the height of each text line within a multi-line text block.
 */
export const IfcTextStyleTextModel = 1712;

/**
 * The IfcTextureCoordinate is an abstract supertype of the different kinds to apply texture coordinates to geometries. For vertex based geometries an explicit assignment of 2D texture vertices to the 3D geometry points is supported by the subtype IfcTextureMap, in addition there can be a procedural description of how texture coordinates shall be applied to geometric items. If no IfcTextureCoordinate is provided for the IfcSurfaceTexture, the default mapping shall be used.
 */
export const IfcTextureCoordinate = 1713;

/**
 * The IfcTextureCoordinateGenerator describes a procedurally defined mapping function with input parameter to map 2D texture coordinates to 3D geometry vertices. The allowable Mode values and input Parameter need to be agreed upon in view definitions and implementer agreements.
 */
export const IfcTextureCoordinateGenerator = 1714;

/**
 * An IfcTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to surfaces of vertex based geometry models, such as
 */
export const IfcTextureMap = 1715;

/**
 * An IfcTextureVertex is a list of 2 (S, T) texture coordinates.
 */
export const IfcTextureVertex = 1716;

/**
 * The IfcTextureVertexList defines an ordered collection of texture vertices. Each texture vertex is a two-dimensional vertex provided by a fixed list of two texture coordinates. The attribute TexCoordsList is a two-dimensional list, where
 */
export const IfcTextureVertexList = 1717;

/**
 * IfcTimePeriod defines a time period given by a start and end time. Both time definitions consider the time zone and allow for the daylight savings offset.
 */
export const IfcTimePeriod = 1718;

/**
 * A time series is a set of a time-stamped data entries. It allows a natural association of data collected over intervals of time. Time series can be regular or irregular. In regular time series data arrive predictably at predefined intervals. In irregular time series some or all time stamps do not follow a repetitive pattern and unpredictable bursts of data may arrive at unspecified points in time.
 */
export const IfcTimeSeries = 1719;

/**
 * A time series value is a list of values that comprise the time series. At least one value must be supplied. Applications are expected to normalize values by applying the following three rules:
 */
export const IfcTimeSeriesValue = 1720;

/**
 *
 */
export const IfcTopologicalRepresentationItem = 1721;

/**
 * IfcTopologyRepresentation represents the concept of a particular topological representation of a product or a product component within a representation context. This representation context does not need to be (but may be) a geometric representation context. Several representation types for shape representation are included as predefined types:
 */
export const IfcTopologyRepresentation = 1722;

/**
 * The IfcToroidalSurface is a bounded elementary surface. It is constructed by completely revolving a circle around an axis line. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export const IfcToroidalSurface = 1723;

/**
 * A transformer is an inductive stationary device that transfers electrical energy from one circuit to another.
 */
export const IfcTransformer = 1724;

/**
 * The energy conversion device type IfcTransformerType defines commonly shared information for occurrences of transformers. The set of shared information may include:
 */
export const IfcTransformerType = 1725;

/**
 * A transport element is a generalization of all transport related objects that move people, animals or goods within a facility. The IfcTransportElement defines the occurrence of a transport element, that (if given), is expressed by the IfcTransportElementType .
 */
export const IfcTransportElement = 1726;

/**
 * The element type IfcTransportElementType  defines commonly shared information for occurrences of transport elements. The set of shared information may include:
 */
export const IfcTransportElementType = 1727;

/**
 * IfcTrapeziumProfileDef defines a trapezium as the profile definition used by the swept surface geometry or the swept area solid. It is given by its Top X and Bottom X extent and its Y extent as well as by the offset of the Top X extend, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system, that is, in the center of the bounding box.
 */
export const IfcTrapeziumProfileDef = 1728;

/**
 * The IfcTriangulatedFaceSet is a tessellated face set with all faces being bound by triangles. The faces are constructed by implicit polylines defined by three Cartesian points. Depending on the value of the attribute Closed the instance of IfcTriangulatedFaceSet represents:
 */
export const IfcTriangulatedFaceSet = 1729;

/**
 * An IfcTrimmedCurve is a bounded curve that is trimmed at both ends. The trimming points may be provided by a Cartesian point or by a parameter value, based on the parameterization of the BasisCurve. The SenseAgreement attribute indicates whether the direction of the IfcTrimmedCurve agrees with or is opposed to the direction of the BasisCurve.
 */
export const IfcTrimmedCurve = 1730;

/**
 * IfcTShapeProfileDef defines a section profile that provides the defining parameters of a T-shaped section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export const IfcTShapeProfileDef = 1731;

/**
 * A tube bundle is a device consisting of tubes and bundles of tubes used for heat transfer and contained typically within other energy conversion devices, such as a chiller or coil.
 */
export const IfcTubeBundle = 1732;

/**
 * The energy conversion device type IfcTubeBundleType defines commonly shared information for occurrences of tube bundles. The set of shared information may include:
 */
export const IfcTubeBundleType = 1733;

/**
 * The object type defines the specific information about a type, being kdtree3 to all occurrences of this type. It refers to the specific level of the well recognized generic - specific - occurrance modeling paradigm. The IfcTypeObject gets assigned to the individual object instances (the occurrences) via the IfcRelDefinesByType relationship.
 */
export const IfcTypeObject = 1734;

/**
 * IfcTypeProcess defines a specific (or type) definition of a process or activity without being assigned to a schedule or a time. It is used to define a process or activity specification, that is, the specific process or activity information that is kdtree3 to all occurrences that are defined for that process or activity type.
 */
export const IfcTypeProcess = 1735;

/**
 * IfcTypeProduct defines a type definition of a product without being already inserted into a project structure (without having a placement), and not being included in the geometric representation context of the project. It is used to define a product specification, that is, the specific product information that is kdtree3 to all occurrences of that product type.
 */
export const IfcTypeProduct = 1736;

/**
 * IfcTypeResource defines a specific (or type) definition of a resource. It is used to define a resource specification (the specific resource, that is kdtree3 to all occurrences that are defined for that resource) and could act as a resource template.
 */
export const IfcTypeResource = 1737;

/**
 * A unitary control element combines a number of control components into a single product, such as a thermostat or humidistat.
 */
export const IfcUnitaryControlElement = 1738;

/**
 * The distribution control element type IfcUnitaryControlElementType defines commonly shared information for occurrences of unitary control elements. The set of shared information may include:
 */
export const IfcUnitaryControlElementType = 1739;

/**
 * Unitary equipment typically combine a number of components into a single product, such as air handlers, pre-packaged rooftop air-conditioning units, heat pumps, and split systems.
 */
export const IfcUnitaryEquipment = 1740;

/**
 * The energy conversion device type IfcUnitaryEquipmentType defines commonly shared information for occurrences of unitary equipments. The set of shared information may include:
 */
export const IfcUnitaryEquipmentType = 1741;

/**
 * IfcUnitAssignment indicates a set of units which may be assigned. Within an IfcUnitAssigment each unit definition shall be unique; that is, there shall be no redundant unit definitions for the same unit type such as length unit or area unit. For currencies, there shall be only a single IfcMonetaryUnit within an IfcUnitAssignment.
 */
export const IfcUnitAssignment = 1742;

/**
 * IfcUShapeProfileDef defines a section profile that provides the defining parameters of a U-shape (channel) section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export const IfcUShapeProfileDef = 1743;

/**
 * A valve is used in a building services piping distribution system to control or modulate the flow of the fluid.
 */
export const IfcValve = 1744;

/**
 * The flow controller type IfcValveType defines commonly shared information for occurrences of valves. The set of shared information may include:
 */
export const IfcValveType = 1745;

/**
 * An IfcVector is a geometric representation item having both a magnitude and direction. The magnitude of the vector is solely defined by the Magnitude attribute and the direction is solely defined by the Orientation attribute.
 */
export const IfcVector = 1746;

/**
 *
 */
export const IfcVertex = 1747;

/**
 *
 */
export const IfcVertexLoop = 1748;

/**
 *
 */
export const IfcVertexPoint = 1749;

/**
 * A vibration isolator is a device used to minimize the effects of vibration transmissibility in a structure.
 */
export const IfcVibrationIsolator = 1750;

/**
 * The element component type IfcVibrationIsolatorType defines commonly shared information for occurrences of vibration isolators. The set of shared information may include:
 */
export const IfcVibrationIsolatorType = 1751;

/**
 * A virtual element is a special element used to provide imaginary boundaries, such as between two adjacent, but not separated, spaces. Virtual elements are usually not displayed and does not have quantities and other measures. Therefore IfcVirtualElement does not have material information and quantities attached.
 */
export const IfcVirtualElement = 1752;

/**
 * IfcVirtualGridIntersection defines the derived location of the intersection between two grid axes. Offset values may be given to set an offset distance to the grid axis for the calculation of the virtual grid intersection.
 */
export const IfcVirtualGridIntersection = 1753;

/**
 * A voiding feature is a modification of an element which reduces its volume. Such a feature may be manufactured in different ways, for example by cutting, drilling, or milling of members made of various materials, or by inlays into the formwork of cast members made of materials such as concrete.
 */
export const IfcVoidingFeature = 1754;

/**
 * The wall represents a vertical construction that may bound or subdivide spaces. Wall are usually vertical, or nearly vertical, planar elements, often designed to bear structural loads. A wall is however not required to be load bearing.
 */
export const IfcWall = 1755;

/**
 * The IfcWallElementedCase defines a wall with certain constraints for the provision of its components. The IfcWallElementedCase handles all cases of walls, that are decomposed into parts:
 */
export const IfcWallElementedCase = 1756;

/**
 * The IfcWallStandardCase defines a wall with certain constraints for the provision of parameters and with certain constraints for the geometric representation. The IfcWallStandardCase handles all cases of walls, that are extruded vertically:
 */
export const IfcWallStandardCase = 1757;

/**
 * The element type IfcWallType defines commonly shared information for occurrences of walls.
 */
export const IfcWallType = 1758;

/**
 * A waste terminal has the purpose of collecting or intercepting waste from one or more sanitary terminals or other fluid waste generating equipment and discharging it into a single waste/drainage system.
 */
export const IfcWasteTerminal = 1759;

/**
 * The flow terminal type IfcWasteTerminalType defines commonly shared information for occurrences of waste terminals. The set of shared information may include:
 */
export const IfcWasteTerminalType = 1760;

/**
 * The window is a building element that is predominately used to provide natural light and fresh air. It includes vertical opening but also horizontal opening such as skylights or light domes. It includes constructions with swinging, pivoting, sliding, or revolving panels and fixed panels. A window consists of a lining and one or several panels.
 */
export const IfcWindow = 1761;

/**
 * The window lining is the outer frame which enables the window to be fixed in position. The window lining is used to hold the window panels or other casements. The parameter of the IfcWindowLiningProperties define the geometrically relevant parameter of the lining.
 */
export const IfcWindowLiningProperties = 1762;

/**
 * A window panel is a casement, that is, a component, fixed or opening, consisting essentially of a frame and the infilling. The infilling of a window panel is normally glazing. The way of operation is defined in the operation type.
 */
export const IfcWindowPanelProperties = 1763;

/**
 * The standard window, IfcWindowStandardCase, defines a window with certain constraints for the provision of operation types, opening directions, frame and lining parameters, construction types and with certain constraints for the geometric representation. The IfcWindowStandardCase handles all cases of windows, that:
 */
export const IfcWindowStandardCase = 1764;

/**
 * The window style defines a particular style of windows, which may be included into the spatial context of the building model through instances of IfcWindow. A window style defines the overall parameter of the window style and refers to the particular parameter of the lining and one (or several) panels through IfcWindowLiningProperties and IfcWindowPanelProperties.
 */
export const IfcWindowStyle = 1765;

/**
 * The element type IfcWindowType defines commonly shared information for occurrences of windows. The set of shared information may include:
 */
export const IfcWindowType = 1766;

/**
 * An IfcWorkCalendar defines working and non-working time periods for tasks and resources. It enables to define both specific time periods, such as from 7:00 till 12:00 on 25th August 2009, as well as repetitive time periods based on frequently used recurrence patterns, such as each Monday from 7:00 till 12:00 between 1st March 2009 and 31st December 2009.
 */
export const IfcWorkCalendar = 1767;

/**
 * An IfcWorkControl is an abstract supertype which captures information that is kdtree3 to both IfcWorkPlan and IfcWorkSchedule.
 */
export const IfcWorkControl = 1768;

/**
 * An IfcWorkPlan represents work plans in a construction or a facilities management project.
 */
export const IfcWorkPlan = 1769;

/**
 * An IfcWorkSchedule represents a task schedule of a work plan, which in turn can contain a set of schedules for different purposes.
 */
export const IfcWorkSchedule = 1770;

/**
 * IfcWorkTime defines time periods that are used by IfcWorkCalendar for either describing working times or non-working exception times. Besides start and finish dates, a set of time periods can be given by various types of recurrence patterns.
 */
export const IfcWorkTime = 1771;

/**
 * A zone a group of spaces, partial spaces or other zones. Zone structures may not be hierarchical (in contrary to the spatial structure of a project - see IfcSpatialStructureElement), i.e. one individual IfcSpace may be associated with zero, one, or several IfcZone's. IfcSpace's are grouped into an IfcZone by using the objectified relationship IfcRelAssignsToGroup as specified at the supertype IfcGroup.
 */
export const IfcZone = 1772;

/**
 * IfcZShapeProfileDef defines a section profile that provides the defining parameters of a Z-shape section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export const IfcZShapeProfileDef = 1773;

/**
 * Map of type codes for all IFC type names.
 */
export const ifcTypeCodes: { [key: string]: number } = {
    "IfcActionRequest": 1000,
    "IfcActor": 1001,
    "IfcActorRole": 1002,
    "IfcActuator": 1003,
    "IfcActuatorType": 1004,
    "IfcAddress": 1005,
    "IfcAdvancedBrep": 1006,
    "IfcAdvancedBrepWithVoids": 1007,
    "IfcAdvancedFace": 1008,
    "IfcAirTerminal": 1009,
    "IfcAirTerminalBox": 1010,
    "IfcAirTerminalBoxType": 1011,
    "IfcAirTerminalType": 1012,
    "IfcAirToAirHeatRecovery": 1013,
    "IfcAirToAirHeatRecoveryType": 1014,
    "IfcAlarm": 1015,
    "IfcAlarmType": 1016,
    "IfcAnnotation": 1017,
    "IfcAnnotationFillArea": 1018,
    "IfcApplication": 1019,
    "IfcAppliedValue": 1020,
    "IfcApproval": 1021,
    "IfcApprovalRelationship": 1022,
    "IfcArbitraryClosedProfileDef": 1023,
    "IfcArbitraryOpenProfileDef": 1024,
    "IfcArbitraryProfileDefWithVoids": 1025,
    "IfcAsset": 1026,
    "IfcAsymmetricIShapeProfileDef": 1027,
    "IfcAudioVisualAppliance": 1028,
    "IfcAudioVisualApplianceType": 1029,
    "IfcAxis1Placement": 1030,
    "IfcAxis2Placement2D": 1031,
    "IfcAxis2Placement3D": 1032,
    "IfcBeam": 1033,
    "IfcBeamStandardCase": 1034,
    "IfcBeamType": 1035,
    "IfcBlobTexture": 1036,
    "IfcBlock": 1037,
    "IfcBoiler": 1038,
    "IfcBoilerType": 1039,
    "IfcBooleanClippingResult": 1040,
    "IfcBooleanResult": 1041,
    "IfcBoundaryCondition": 1042,
    "IfcBoundaryCurve": 1043,
    "IfcBoundaryEdgeCondition": 1044,
    "IfcBoundaryFaceCondition": 1045,
    "IfcBoundaryNodeCondition": 1046,
    "IfcBoundaryNodeConditionWarping": 1047,
    "IfcBoundedCurve": 1048,
    "IfcBoundedSurface": 1049,
    "IfcBoundingBox": 1050,
    "IfcBoxedHalfSpace": 1051,
    "IfcBSplineCurve": 1052,
    "IfcBSplineCurveWithKnots": 1053,
    "IfcBSplineSurface": 1054,
    "IfcBSplineSurfaceWithKnots": 1055,
    "IfcBuilding": 1056,
    "IfcBuildingElementPart": 1057,
    "IfcBuildingElementPartType": 1058,
    "IfcBuildingElementProxy": 1059,
    "IfcBuildingElementProxyType": 1060,
    "IfcBuildingStorey": 1061,
    "IfcBuildingSystem": 1062,
    "IfcBurner": 1063,
    "IfcBurnerType": 1064,
    "IfcCableCarrierFitting": 1065,
    "IfcCableCarrierFittingType": 1066,
    "IfcCableCarrierSegment": 1067,
    "IfcCableCarrierSegmentType": 1068,
    "IfcCableFitting": 1069,
    "IfcCableFittingType": 1070,
    "IfcCableSegment": 1071,
    "IfcCableSegmentType": 1072,
    "IfcCartesianPoint": 1073,
    "IfcCartesianPointList": 1074,
    "IfcCartesianPointList2D": 1075,
    "IfcCartesianPointList3D": 1076,
    "IfcCartesianTransformationOperator": 1077,
    "IfcCartesianTransformationOperator2D": 1078,
    "IfcCartesianTransformationOperator2DnonUniform": 1079,
    "IfcCartesianTransformationOperator3D": 1080,
    "IfcCartesianTransformationOperator3DnonUniform": 1081,
    "IfcCenterLineProfileDef": 1082,
    "IfcChiller": 1083,
    "IfcChillerType": 1084,
    "IfcChimney": 1085,
    "IfcChimneyType": 1086,
    "IfcCircle": 1087,
    "IfcCircleHollowProfileDef": 1088,
    "IfcCircleProfileDef": 1089,
    "IfcCivilElement": 1090,
    "IfcCivilElementType": 1091,
    "IfcClassification": 1092,
    "IfcClassificationReference": 1093,
    "IfcClosedShell": 1094,
    "IfcCoil": 1095,
    "IfcCoilType": 1096,
    "IfcColourRgb": 1097,
    "IfcColourRgbList": 1098,
    "IfcColourSpecification": 1099,
    "IfcColumn": 1100,
    "IfcColumnStandardCase": 1101,
    "IfcColumnType": 1102,
    "IfcCommunicationsAppliance": 1103,
    "IfcCommunicationsApplianceType": 1104,
    "IfcComplexProperty": 1105,
    "IfcComplexPropertyTemplate": 1106,
    "IfcCompositeCurve": 1107,
    "IfcCompositeCurveOnSurface": 1108,
    "IfcCompositeCurveSegment": 1109,
    "IfcCompositeProfileDef": 1110,
    "IfcCompressor": 1111,
    "IfcCompressorType": 1112,
    "IfcCondenser": 1113,
    "IfcCondenserType": 1114,
    "IfcConic": 1115,
    "IfcConnectedFaceSet": 1116,
    "IfcConnectionCurveGeometry": 1117,
    "IfcConnectionGeometry": 1118,
    "IfcConnectionPointEccentricity": 1119,
    "IfcConnectionPointGeometry": 1120,
    "IfcConnectionSurfaceGeometry": 1121,
    "IfcConnectionVolumeGeometry": 1122,
    "IfcConstraint": 1123,
    "IfcConstructionEquipmentResource": 1124,
    "IfcConstructionEquipmentResourceType": 1125,
    "IfcConstructionMaterialResource": 1126,
    "IfcConstructionMaterialResourceType": 1127,
    "IfcConstructionProductResource": 1128,
    "IfcConstructionProductResourceType": 1129,
    "IfcConstructionResource": 1130,
    "IfcConstructionResourceType": 1131,
    "IfcContext": 1132,
    "IfcContextDependentUnit": 1133,
    "IfcControl": 1134,
    "IfcController": 1135,
    "IfcControllerType": 1136,
    "IfcConversionBasedUnit": 1137,
    "IfcConversionBasedUnitWithOffset": 1138,
    "IfcCooledBeam": 1139,
    "IfcCooledBeamType": 1140,
    "IfcCoolingTower": 1141,
    "IfcCoolingTowerType": 1142,
    "IfcCoordinateOperation": 1143,
    "IfcCoordinateReferenceSystem": 1144,
    "IfcCostItem": 1145,
    "IfcCostSchedule": 1146,
    "IfcCostValue": 1147,
    "IfcCovering": 1148,
    "IfcCoveringType": 1149,
    "IfcCrewResource": 1150,
    "IfcCrewResourceType": 1151,
    "IfcCsgPrimitive3D": 1152,
    "IfcCsgSolid": 1153,
    "IfcCShapeProfileDef": 1154,
    "IfcCurrencyRelationship": 1155,
    "IfcCurtainWall": 1156,
    "IfcCurtainWallType": 1157,
    "IfcCurve": 1158,
    "IfcCurveBoundedPlane": 1159,
    "IfcCurveBoundedSurface": 1160,
    "IfcCurveStyle": 1161,
    "IfcCurveStyleFont": 1162,
    "IfcCurveStyleFontAndScaling": 1163,
    "IfcCurveStyleFontPattern": 1164,
    "IfcCylindricalSurface": 1165,
    "IfcDamper": 1166,
    "IfcDamperType": 1167,
    "IfcDerivedProfileDef": 1168,
    "IfcDerivedUnit": 1169,
    "IfcDerivedUnitElement": 1170,
    "IfcDimensionalExponents": 1171,
    "IfcDirection": 1172,
    "IfcDiscreteAccessory": 1173,
    "IfcDiscreteAccessoryType": 1174,
    "IfcDistributionChamberElement": 1175,
    "IfcDistributionChamberElementType": 1176,
    "IfcDistributionCircuit": 1177,
    "IfcDistributionControlElement": 1178,
    "IfcDistributionControlElementType": 1179,
    "IfcDistributionElement": 1180,
    "IfcDistributionElementType": 1181,
    "IfcDistributionFlowElement": 1182,
    "IfcDistributionFlowElementType": 1183,
    "IfcDistributionPort": 1184,
    "IfcDistributionSystem": 1185,
    "IfcDocumentInformation": 1186,
    "IfcDocumentInformationRelationship": 1187,
    "IfcDocumentReference": 1188,
    "IfcDoor": 1189,
    "IfcDoorLiningProperties": 1190,
    "IfcDoorPanelProperties": 1191,
    "IfcDoorStandardCase": 1192,
    "IfcDoorStyle": 1193,
    "IfcDoorType": 1194,
    "IfcDraughtingPreDefinedColour": 1195,
    "IfcDraughtingPreDefinedCurveFont": 1196,
    "IfcDuctFitting": 1197,
    "IfcDuctFittingType": 1198,
    "IfcDuctSegment": 1199,
    "IfcDuctSegmentType": 1200,
    "IfcDuctSilencer": 1201,
    "IfcDuctSilencerType": 1202,
    "IfcEdge": 1203,
    "IfcEdgeCurve": 1204,
    "IfcEdgeLoop": 1205,
    "IfcElectricAppliance": 1206,
    "IfcElectricApplianceType": 1207,
    "IfcElectricDistributionBoard": 1208,
    "IfcElectricDistributionBoardType": 1209,
    "IfcElectricFlowStorageDevice": 1210,
    "IfcElectricFlowStorageDeviceType": 1211,
    "IfcElectricGenerator": 1212,
    "IfcElectricGeneratorType": 1213,
    "IfcElectricMotor": 1214,
    "IfcElectricMotorType": 1215,
    "IfcElectricTimeControl": 1216,
    "IfcElectricTimeControlType": 1217,
    "IfcElement": 1218,
    "IfcElementarySurface": 1219,
    "IfcElementAssembly": 1220,
    "IfcElementAssemblyType": 1221,
    "IfcElementComponent": 1222,
    "IfcElementComponentType": 1223,
    "IfcElementQuantity": 1224,
    "IfcElementType": 1225,
    "IfcEllipse": 1226,
    "IfcEllipseProfileDef": 1227,
    "IfcEnergyConversionDevice": 1228,
    "IfcEnergyConversionDeviceType": 1229,
    "IfcEngine": 1230,
    "IfcEngineType": 1231,
    "IfcEvaporativeCooler": 1232,
    "IfcEvaporativeCoolerType": 1233,
    "IfcEvaporator": 1234,
    "IfcEvaporatorType": 1235,
    "IfcEvent": 1236,
    "IfcEventTime": 1237,
    "IfcEventType": 1238,
    "IfcExtendedProperties": 1239,
    "IfcExternalInformation": 1240,
    "IfcExternallyDefinedHatchStyle": 1241,
    "IfcExternallyDefinedSurfaceStyle": 1242,
    "IfcExternallyDefinedTextFont": 1243,
    "IfcExternalReference": 1244,
    "IfcExternalReferenceRelationship": 1245,
    "IfcExternalSpatialElement": 1246,
    "IfcExternalSpatialStructureElement": 1247,
    "IfcExtrudedAreaSolid": 1248,
    "IfcExtrudedAreaSolidTapered": 1249,
    "IfcFace": 1250,
    "IfcFaceBasedSurfaceModel": 1251,
    "IfcFaceBound": 1252,
    "IfcFaceOuterBound": 1253,
    "IfcFaceSurface": 1254,
    "IfcFacetedBrep": 1255,
    "IfcFacetedBrepWithVoids": 1256,
    "IfcFailureConnectionCondition": 1257,
    "IfcFan": 1258,
    "IfcFanType": 1259,
    "IfcFastener": 1260,
    "IfcFastenerType": 1261,
    "IfcFeatureElement": 1262,
    "IfcFeatureElementAddition": 1263,
    "IfcFeatureElementSubtraction": 1264,
    "IfcFillAreaStyle": 1265,
    "IfcFillAreaStyleHatching": 1266,
    "IfcFillAreaStyleTiles": 1267,
    "IfcFilter": 1268,
    "IfcFilterType": 1269,
    "IfcFireSuppressionTerminal": 1270,
    "IfcFireSuppressionTerminalType": 1271,
    "IfcFixedReferenceSweptAreaSolid": 1272,
    "IfcFlowController": 1273,
    "IfcFlowControllerType": 1274,
    "IfcFlowFitting": 1275,
    "IfcFlowFittingType": 1276,
    "IfcFlowInstrument": 1277,
    "IfcFlowInstrumentType": 1278,
    "IfcFlowMeter": 1279,
    "IfcFlowMeterType": 1280,
    "IfcFlowMovingDevice": 1281,
    "IfcFlowMovingDeviceType": 1282,
    "IfcFlowSegment": 1283,
    "IfcFlowSegmentType": 1284,
    "IfcFlowStorageDevice": 1285,
    "IfcFlowStorageDeviceType": 1286,
    "IfcFlowTerminal": 1287,
    "IfcFlowTerminalType": 1288,
    "IfcFlowTreatmentDevice": 1289,
    "IfcFlowTreatmentDeviceType": 1290,
    "IfcFooting": 1291,
    "IfcFootingType": 1292,
    "IfcFurnishingElement": 1293,
    "IfcFurnishingElementType": 1294,
    "IfcFurniture": 1295,
    "IfcFurnitureType": 1296,
    "IfcGeographicElement": 1297,
    "IfcGeographicElementType": 1298,
    "IfcGeometricCurveSet": 1299,
    "IfcGeometricRepresentationContext": 1300,
    "IfcGeometricRepresentationItem": 1301,
    "IfcGeometricRepresentationSubContext": 1302,
    "IfcGeometricSet": 1303,
    "IfcGrid": 1304,
    "IfcGridAxis": 1305,
    "IfcGridPlacement": 1306,
    "IfcGroup": 1307,
    "IfcHalfSpaceSolid": 1308,
    "IfcHeatExchanger": 1309,
    "IfcHeatExchangerType": 1310,
    "IfcHumidifier": 1311,
    "IfcHumidifierType": 1312,
    "IfcImageTexture": 1313,
    "IfcIndexedColourMap": 1314,
    "IfcIndexedPolyCurve": 1315,
    "IfcIndexedPolygonalFace": 1316,
    "IfcIndexedPolygonalFaceWithVoids": 1317,
    "IfcIndexedTextureMap": 1318,
    "IfcIndexedTriangleTextureMap": 1319,
    "IfcInterceptor": 1320,
    "IfcInterceptorType": 1321,
    "IfcIntersectionCurve": 1322,
    "IfcInventory": 1323,
    "IfcIrregularTimeSeries": 1324,
    "IfcIrregularTimeSeriesValue": 1325,
    "IfcIShapeProfileDef": 1326,
    "IfcJunctionBox": 1327,
    "IfcJunctionBoxType": 1328,
    "IfcLaborResource": 1329,
    "IfcLaborResourceType": 1330,
    "IfcLagTime": 1331,
    "IfcLamp": 1332,
    "IfcLampType": 1333,
    "IfcLibraryInformation": 1334,
    "IfcLibraryReference": 1335,
    "IfcLightDistributionData": 1336,
    "IfcLightFixture": 1337,
    "IfcLightFixtureType": 1338,
    "IfcLightIntensityDistribution": 1339,
    "IfcLightSource": 1340,
    "IfcLightSourceAmbient": 1341,
    "IfcLightSourceDirectional": 1342,
    "IfcLightSourceGoniometric": 1343,
    "IfcLightSourcePositional": 1344,
    "IfcLightSourceSpot": 1345,
    "IfcLine": 1346,
    "IfcLocalPlacement": 1347,
    "IfcLoop": 1348,
    "IfcLShapeProfileDef": 1349,
    "IfcManifoldSolidBrep": 1350,
    "IfcMapConversion": 1351,
    "IfcMappedItem": 1352,
    "IfcMaterial": 1353,
    "IfcMaterialClassificationRelationship": 1354,
    "IfcMaterialConstituent": 1355,
    "IfcMaterialConstituentSet": 1356,
    "IfcMaterialDefinition": 1357,
    "IfcMaterialDefinitionRepresentation": 1358,
    "IfcMaterialLayer": 1359,
    "IfcMaterialLayerSet": 1360,
    "IfcMaterialLayerSetUsage": 1361,
    "IfcMaterialLayerWithOffsets": 1362,
    "IfcMaterialList": 1363,
    "IfcMaterialProfile": 1364,
    "IfcMaterialProfileSet": 1365,
    "IfcMaterialProfileSetUsage": 1366,
    "IfcMaterialProfileSetUsageTapering": 1367,
    "IfcMaterialProfileWithOffsets": 1368,
    "IfcMaterialProperties": 1369,
    "IfcMaterialRelationship": 1370,
    "IfcMaterialUsageDefinition": 1371,
    "IfcMeasureWithUnit": 1372,
    "IfcMechanicalFastener": 1373,
    "IfcMechanicalFastenerType": 1374,
    "IfcMedicalDevice": 1375,
    "IfcMedicalDeviceType": 1376,
    "IfcMember": 1377,
    "IfcMemberStandardCase": 1378,
    "IfcMemberType": 1379,
    "IfcMetric": 1380,
    "IfcMirroredProfileDef": 1381,
    "IfcMonetaryUnit": 1382,
    "IfcMotorConnection": 1383,
    "IfcMotorConnectionType": 1384,
    "IfcNamedUnit": 1385,
    "IfcObject": 1386,
    "IfcObjectDefinition": 1387,
    "IfcObjective": 1388,
    "IfcObjectPlacement": 1389,
    "IfcOccupant": 1390,
    "IfcOffsetCurve2D": 1391,
    "IfcOffsetCurve3D": 1392,
    "IfcOpeningElement": 1393,
    "IfcOpeningStandardCase": 1394,
    "IfcOpenShell": 1395,
    "IfcOrganization": 1396,
    "IfcOrganizationRelationship": 1397,
    "IfcOrientedEdge": 1398,
    "IfcOuterBoundaryCurve": 1399,
    "IfcOutlet": 1400,
    "IfcOutletType": 1401,
    "IfcOwnerHistory": 1402,
    "IfcParameterizedProfileDef": 1403,
    "IfcPath": 1404,
    "IfcPcurve": 1405,
    "IfcPerformanceHistory": 1406,
    "IfcPermeableCoveringProperties": 1407,
    "IfcPermit": 1408,
    "IfcPerson": 1409,
    "IfcPersonAndOrganization": 1410,
    "IfcPhysicalComplexQuantity": 1411,
    "IfcPhysicalQuantity": 1412,
    "IfcPhysicalSimpleQuantity": 1413,
    "IfcPile": 1414,
    "IfcPileType": 1415,
    "IfcPipeFitting": 1416,
    "IfcPipeFittingType": 1417,
    "IfcPipeSegment": 1418,
    "IfcPipeSegmentType": 1419,
    "IfcPixelTexture": 1420,
    "IfcPlacement": 1421,
    "IfcPlanarBox": 1422,
    "IfcPlanarExtent": 1423,
    "IfcPlane": 1424,
    "IfcPlate": 1425,
    "IfcPlateStandardCase": 1426,
    "IfcPlateType": 1427,
    "IfcPoint": 1428,
    "IfcPointOnCurve": 1429,
    "IfcPointOnSurface": 1430,
    "IfcPolygonalBoundedHalfSpace": 1431,
    "IfcPolygonalFaceSet": 1432,
    "IfcPolyline": 1433,
    "IfcPolyLoop": 1434,
    "IfcPort": 1435,
    "IfcPostalAddress": 1436,
    "IfcPreDefinedColour": 1437,
    "IfcPreDefinedCurveFont": 1438,
    "IfcPreDefinedItem": 1439,
    "IfcPreDefinedProperties": 1440,
    "IfcPreDefinedPropertySet": 1441,
    "IfcPreDefinedTextFont": 1442,
    "IfcPresentationItem": 1443,
    "IfcPresentationLayerAssignment": 1444,
    "IfcPresentationLayerWithStyle": 1445,
    "IfcPresentationStyle": 1446,
    "IfcPresentationStyleAssignment": 1447,
    "IfcProcedure": 1448,
    "IfcProcedureType": 1449,
    "IfcProcess": 1450,
    "IfcProduct": 1451,
    "IfcProductDefinitionShape": 1452,
    "IfcProductRepresentation": 1453,
    "IfcProfileDef": 1454,
    "IfcProfileProperties": 1455,
    "IfcProject": 1456,
    "IfcProjectedCRS": 1457,
    "IfcProjectionElement": 1458,
    "IfcProjectLibrary": 1459,
    "IfcProjectOrder": 1460,
    "IfcProperty": 1461,
    "IfcPropertyAbstraction": 1462,
    "IfcPropertyBoundedValue": 1463,
    "IfcPropertyDefinition": 1464,
    "IfcPropertyDependencyRelationship": 1465,
    "IfcPropertyEnumeratedValue": 1466,
    "IfcPropertyEnumeration": 1467,
    "IfcPropertyListValue": 1468,
    "IfcPropertyReferenceValue": 1469,
    "IfcPropertySet": 1470,
    "IfcPropertySetDefinition": 1471,
    "IfcPropertySetTemplate": 1472,
    "IfcPropertySingleValue": 1473,
    "IfcPropertyTableValue": 1474,
    "IfcPropertyTemplate": 1475,
    "IfcPropertyTemplateDefinition": 1476,
    "IfcProtectiveDevice": 1477,
    "IfcProtectiveDeviceTrippingUnit": 1478,
    "IfcProtectiveDeviceTrippingUnitType": 1479,
    "IfcProtectiveDeviceType": 1480,
    "IfcProxy": 1481,
    "IfcPump": 1482,
    "IfcPumpType": 1483,
    "IfcQuantityArea": 1484,
    "IfcQuantityCount": 1485,
    "IfcQuantityLength": 1486,
    "IfcQuantitySet": 1487,
    "IfcQuantityTime": 1488,
    "IfcQuantityVolume": 1489,
    "IfcQuantityWeight": 1490,
    "IfcRailing": 1491,
    "IfcRailingType": 1492,
    "IfcRamp": 1493,
    "IfcRampFlight": 1494,
    "IfcRampFlightType": 1495,
    "IfcRampType": 1496,
    "IfcRationalBSplineCurveWithKnots": 1497,
    "IfcRationalBSplineSurfaceWithKnots": 1498,
    "IfcRectangleHollowProfileDef": 1499,
    "IfcRectangleProfileDef": 1500,
    "IfcRectangularPyramid": 1501,
    "IfcRectangularTrimmedSurface": 1502,
    "IfcRecurrencePattern": 1503,
    "IfcReference": 1504,
    "IfcRegularTimeSeries": 1505,
    "IfcReinforcementBarProperties": 1506,
    "IfcReinforcementDefinitionProperties": 1507,
    "IfcReinforcingBar": 1508,
    "IfcReinforcingBarType": 1509,
    "IfcReinforcingElement": 1510,
    "IfcReinforcingElementType": 1511,
    "IfcReinforcingMesh": 1512,
    "IfcReinforcingMeshType": 1513,
    "IfcRelAggregates": 1514,
    "IfcRelAssigns": 1515,
    "IfcRelAssignsToActor": 1516,
    "IfcRelAssignsToControl": 1517,
    "IfcRelAssignsToGroup": 1518,
    "IfcRelAssignsToGroupByFactor": 1519,
    "IfcRelAssignsToProcess": 1520,
    "IfcRelAssignsToProduct": 1521,
    "IfcRelAssignsToResource": 1522,
    "IfcRelAssociates": 1523,
    "IfcRelAssociatesApproval": 1524,
    "IfcRelAssociatesClassification": 1525,
    "IfcRelAssociatesConstraint": 1526,
    "IfcRelAssociatesDocument": 1527,
    "IfcRelAssociatesLibrary": 1528,
    "IfcRelAssociatesMaterial": 1529,
    "IfcRelationship": 1530,
    "IfcRelConnects": 1531,
    "IfcRelConnectsElements": 1532,
    "IfcRelConnectsPathElements": 1533,
    "IfcRelConnectsPorts": 1534,
    "IfcRelConnectsPortToElement": 1535,
    "IfcRelConnectsStructuralActivity": 1536,
    "IfcRelConnectsStructuralMember": 1537,
    "IfcRelConnectsWithEccentricity": 1538,
    "IfcRelConnectsWithRealizingElements": 1539,
    "IfcRelContainedInSpatialStructure": 1540,
    "IfcRelCoversBldgElements": 1541,
    "IfcRelCoversSpaces": 1542,
    "IfcRelDeclares": 1543,
    "IfcRelDecomposes": 1544,
    "IfcRelDefines": 1545,
    "IfcRelDefinesByObject": 1546,
    "IfcRelDefinesByProperties": 1547,
    "IfcRelDefinesByTemplate": 1548,
    "IfcRelDefinesByType": 1549,
    "IfcRelFillsElement": 1550,
    "IfcRelFlowControlElements": 1551,
    "IfcRelInterferesElements": 1552,
    "IfcRelNests": 1553,
    "IfcRelProjectsElement": 1554,
    "IfcRelReferencedInSpatialStructure": 1555,
    "IfcRelSequence": 1556,
    "IfcRelServicesBuildings": 1557,
    "IfcRelSpaceBoundary": 1558,
    "IfcRelSpaceBoundary1stLevel": 1559,
    "IfcRelSpaceBoundary2ndLevel": 1560,
    "IfcRelVoidsElement": 1561,
    "IfcReparametrisedCompositeCurveSegment": 1562,
    "IfcRepresentation": 1563,
    "IfcRepresentationContext": 1564,
    "IfcRepresentationItem": 1565,
    "IfcRepresentationMap": 1566,
    "IfcResource": 1567,
    "IfcResourceApprovalRelationship": 1568,
    "IfcResourceConstraintRelationship": 1569,
    "IfcResourceLevelRelationship": 1570,
    "IfcResourceTime": 1571,
    "IfcRevolvedAreaSolid": 1572,
    "IfcRevolvedAreaSolidTapered": 1573,
    "IfcRightCircularCone": 1574,
    "IfcRightCircularCylinder": 1575,
    "IfcRoof": 1576,
    "IfcRoofType": 1577,
    "IfcRoot": 1578,
    "IfcRoundedRectangleProfileDef": 1579,
    "IfcSanitaryTerminal": 1580,
    "IfcSanitaryTerminalType": 1581,
    "IfcSchedulingTime": 1582,
    "IfcSeamCurve": 1583,
    "IfcSectionedSpine": 1584,
    "IfcSectionProperties": 1585,
    "IfcSectionReinforcementProperties": 1586,
    "IfcSensor": 1587,
    "IfcSensorType": 1588,
    "IfcShadingDevice": 1589,
    "IfcShadingDeviceType": 1590,
    "IfcShapeAspect": 1591,
    "IfcShapeModel": 1592,
    "IfcShapeRepresentation": 1593,
    "IfcShellBasedSurfaceModel": 1594,
    "IfcSimpleProperty": 1595,
    "IfcSimplePropertyTemplate": 1596,
    "IfcSite": 1597,
    "IfcSIUnit": 1598,
    "IfcSlab": 1599,
    "IfcSlabElementedCase": 1600,
    "IfcSlabStandardCase": 1601,
    "IfcSlabType": 1602,
    "IfcSlippageConnectionCondition": 1603,
    "IfcSolarDevice": 1604,
    "IfcSolarDeviceType": 1605,
    "IfcSolidModel": 1606,
    "IfcSpace": 1607,
    "IfcSpaceHeater": 1608,
    "IfcSpaceHeaterType": 1609,
    "IfcSpaceType": 1610,
    "IfcSpatialElement": 1611,
    "IfcSpatialElementType": 1612,
    "IfcSpatialStructureElement": 1613,
    "IfcSpatialStructureElementType": 1614,
    "IfcSpatialZone": 1615,
    "IfcSpatialZoneType": 1616,
    "IfcSphere": 1617,
    "IfcSphericalSurface": 1618,
    "IfcStackTerminal": 1619,
    "IfcStackTerminalType": 1620,
    "IfcStair": 1621,
    "IfcStairFlight": 1622,
    "IfcStairFlightType": 1623,
    "IfcStairType": 1624,
    "IfcStructuralAction": 1625,
    "IfcStructuralActivity": 1626,
    "IfcStructuralAnalysisModel": 1627,
    "IfcStructuralConnection": 1628,
    "IfcStructuralConnectionCondition": 1629,
    "IfcStructuralCurveAction": 1630,
    "IfcStructuralCurveConnection": 1631,
    "IfcStructuralCurveMember": 1632,
    "IfcStructuralCurveMemberVarying": 1633,
    "IfcStructuralCurveReaction": 1634,
    "IfcStructuralItem": 1635,
    "IfcStructuralLinearAction": 1636,
    "IfcStructuralLoad": 1637,
    "IfcStructuralLoadCase": 1638,
    "IfcStructuralLoadConfiguration": 1639,
    "IfcStructuralLoadGroup": 1640,
    "IfcStructuralLoadLinearForce": 1641,
    "IfcStructuralLoadOrResult": 1642,
    "IfcStructuralLoadPlanarForce": 1643,
    "IfcStructuralLoadSingleDisplacement": 1644,
    "IfcStructuralLoadSingleDisplacementDistortion": 1645,
    "IfcStructuralLoadSingleForce": 1646,
    "IfcStructuralLoadSingleForceWarping": 1647,
    "IfcStructuralLoadStatic": 1648,
    "IfcStructuralLoadTemperature": 1649,
    "IfcStructuralMember": 1650,
    "IfcStructuralPlanarAction": 1651,
    "IfcStructuralPointAction": 1652,
    "IfcStructuralPointConnection": 1653,
    "IfcStructuralPointReaction": 1654,
    "IfcStructuralReaction": 1655,
    "IfcStructuralResultGroup": 1656,
    "IfcStructuralSurfaceAction": 1657,
    "IfcStructuralSurfaceConnection": 1658,
    "IfcStructuralSurfaceMember": 1659,
    "IfcStructuralSurfaceMemberVarying": 1660,
    "IfcStructuralSurfaceReaction": 1661,
    "IfcStyledItem": 1662,
    "IfcStyledRepresentation": 1663,
    "IfcStyleModel": 1664,
    "IfcSubContractResource": 1665,
    "IfcSubContractResourceType": 1666,
    "IfcSubedge": 1667,
    "IfcSurface": 1668,
    "IfcSurfaceCurve": 1669,
    "IfcSurfaceCurveSweptAreaSolid": 1670,
    "IfcSurfaceFeature": 1671,
    "IfcSurfaceOfLinearExtrusion": 1672,
    "IfcSurfaceOfRevolution": 1673,
    "IfcSurfaceReinforcementArea": 1674,
    "IfcSurfaceStyle": 1675,
    "IfcSurfaceStyleLighting": 1676,
    "IfcSurfaceStyleRefraction": 1677,
    "IfcSurfaceStyleRendering": 1678,
    "IfcSurfaceStyleShading": 1679,
    "IfcSurfaceStyleWithTextures": 1680,
    "IfcSurfaceTexture": 1681,
    "IfcSweptAreaSolid": 1682,
    "IfcSweptDiskSolid": 1683,
    "IfcSweptDiskSolidPolygonal": 1684,
    "IfcSweptSurface": 1685,
    "IfcSwitchingDevice": 1686,
    "IfcSwitchingDeviceType": 1687,
    "IfcSystem": 1688,
    "IfcSystemFurnitureElement": 1689,
    "IfcSystemFurnitureElementType": 1690,
    "IfcTable": 1691,
    "IfcTableColumn": 1692,
    "IfcTableRow": 1693,
    "IfcTank": 1694,
    "IfcTankType": 1695,
    "IfcTask": 1696,
    "IfcTaskTime": 1697,
    "IfcTaskTimeRecurring": 1698,
    "IfcTaskType": 1699,
    "IfcTelecomAddress": 1700,
    "IfcTendon": 1701,
    "IfcTendonAnchor": 1702,
    "IfcTendonAnchorType": 1703,
    "IfcTendonType": 1704,
    "IfcTessellatedFaceSet": 1705,
    "IfcTessellatedItem": 1706,
    "IfcTextLiteral": 1707,
    "IfcTextLiteralWithExtent": 1708,
    "IfcTextStyle": 1709,
    "IfcTextStyleFontModel": 1710,
    "IfcTextStyleForDefinedFont": 1711,
    "IfcTextStyleTextModel": 1712,
    "IfcTextureCoordinate": 1713,
    "IfcTextureCoordinateGenerator": 1714,
    "IfcTextureMap": 1715,
    "IfcTextureVertex": 1716,
    "IfcTextureVertexList": 1717,
    "IfcTimePeriod": 1718,
    "IfcTimeSeries": 1719,
    "IfcTimeSeriesValue": 1720,
    "IfcTopologicalRepresentationItem": 1721,
    "IfcTopologyRepresentation": 1722,
    "IfcToroidalSurface": 1723,
    "IfcTransformer": 1724,
    "IfcTransformerType": 1725,
    "IfcTransportElement": 1726,
    "IfcTransportElementType": 1727,
    "IfcTrapeziumProfileDef": 1728,
    "IfcTriangulatedFaceSet": 1729,
    "IfcTrimmedCurve": 1730,
    "IfcTShapeProfileDef": 1731,
    "IfcTubeBundle": 1732,
    "IfcTubeBundleType": 1733,
    "IfcTypeObject": 1734,
    "IfcTypeProcess": 1735,
    "IfcTypeProduct": 1736,
    "IfcTypeResource": 1737,
    "IfcUnitaryControlElement": 1738,
    "IfcUnitaryControlElementType": 1739,
    "IfcUnitaryEquipment": 1740,
    "IfcUnitaryEquipmentType": 1741,
    "IfcUnitAssignment": 1742,
    "IfcUShapeProfileDef": 1743,
    "IfcValve": 1744,
    "IfcValveType": 1745,
    "IfcVector": 1746,
    "IfcVertex": 1747,
    "IfcVertexLoop": 1748,
    "IfcVertexPoint": 1749,
    "IfcVibrationIsolator": 1750,
    "IfcVibrationIsolatorType": 1751,
    "IfcVirtualElement": 1752,
    "IfcVirtualGridIntersection": 1753,
    "IfcVoidingFeature": 1754,
    "IfcWall": 1755,
    "IfcWallElementedCase": 1756,
    "IfcWallStandardCase": 1757,
    "IfcWallType": 1758,
    "IfcWasteTerminal": 1759,
    "IfcWasteTerminalType": 1760,
    "IfcWindow": 1761,
    "IfcWindowLiningProperties": 1762,
    "IfcWindowPanelProperties": 1763,
    "IfcWindowStandardCase": 1764,
    "IfcWindowStyle": 1765,
    "IfcWindowType": 1766,
    "IfcWorkCalendar": 1767,
    "IfcWorkControl": 1768,
    "IfcWorkPlan": 1769,
    "IfcWorkSchedule": 1770,
    "IfcWorkTime": 1771,
    "IfcZone": 1772,
    "IfcZShapeProfileDef": 1773
};

/**
 * Map of type names for all IFC type codes.
 */
export const ifcTypeNames: { [key: number]: string } = {
    1000: "IfcActionRequest",
    1001: "IfcActor",
    1002: "IfcActorRole",
    1003: "IfcActuator",
    1004: "IfcActuatorType",
    1005: "IfcAddress",
    1006: "IfcAdvancedBrep",
    1007: "IfcAdvancedBrepWithVoids",
    1008: "IfcAdvancedFace",
    1009: "IfcAirTerminal",
    1010: "IfcAirTerminalBox",
    1011: "IfcAirTerminalBoxType",
    1012: "IfcAirTerminalType",
    1013: "IfcAirToAirHeatRecovery",
    1014: "IfcAirToAirHeatRecoveryType",
    1015: "IfcAlarm",
    1016: "IfcAlarmType",
    1017: "IfcAnnotation",
    1018: "IfcAnnotationFillArea",
    1019: "IfcApplication",
    1020: "IfcAppliedValue",
    1021: "IfcApproval",
    1022: "IfcApprovalRelationship",
    1023: "IfcArbitraryClosedProfileDef",
    1024: "IfcArbitraryOpenProfileDef",
    1025: "IfcArbitraryProfileDefWithVoids",
    1026: "IfcAsset",
    1027: "IfcAsymmetricIShapeProfileDef",
    1028: "IfcAudioVisualAppliance",
    1029: "IfcAudioVisualApplianceType",
    1030: "IfcAxis1Placement",
    1031: "IfcAxis2Placement2D",
    1032: "IfcAxis2Placement3D",
    1033: "IfcBeam",
    1034: "IfcBeamStandardCase",
    1035: "IfcBeamType",
    1036: "IfcBlobTexture",
    1037: "IfcBlock",
    1038: "IfcBoiler",
    1039: "IfcBoilerType",
    1040: "IfcBooleanClippingResult",
    1041: "IfcBooleanResult",
    1042: "IfcBoundaryCondition",
    1043: "IfcBoundaryCurve",
    1044: "IfcBoundaryEdgeCondition",
    1045: "IfcBoundaryFaceCondition",
    1046: "IfcBoundaryNodeCondition",
    1047: "IfcBoundaryNodeConditionWarping",
    1048: "IfcBoundedCurve",
    1049: "IfcBoundedSurface",
    1050: "IfcBoundingBox",
    1051: "IfcBoxedHalfSpace",
    1052: "IfcBSplineCurve",
    1053: "IfcBSplineCurveWithKnots",
    1054: "IfcBSplineSurface",
    1055: "IfcBSplineSurfaceWithKnots",
    1056: "IfcBuilding",
    1057: "IfcBuildingElementPart",
    1058: "IfcBuildingElementPartType",
    1059: "IfcBuildingElementProxy",
    1060: "IfcBuildingElementProxyType",
    1061: "IfcBuildingStorey",
    1062: "IfcBuildingSystem",
    1063: "IfcBurner",
    1064: "IfcBurnerType",
    1065: "IfcCableCarrierFitting",
    1066: "IfcCableCarrierFittingType",
    1067: "IfcCableCarrierSegment",
    1068: "IfcCableCarrierSegmentType",
    1069: "IfcCableFitting",
    1070: "IfcCableFittingType",
    1071: "IfcCableSegment",
    1072: "IfcCableSegmentType",
    1073: "IfcCartesianPoint",
    1074: "IfcCartesianPointList",
    1075: "IfcCartesianPointList2D",
    1076: "IfcCartesianPointList3D",
    1077: "IfcCartesianTransformationOperator",
    1078: "IfcCartesianTransformationOperator2D",
    1079: "IfcCartesianTransformationOperator2DnonUniform",
    1080: "IfcCartesianTransformationOperator3D",
    1081: "IfcCartesianTransformationOperator3DnonUniform",
    1082: "IfcCenterLineProfileDef",
    1083: "IfcChiller",
    1084: "IfcChillerType",
    1085: "IfcChimney",
    1086: "IfcChimneyType",
    1087: "IfcCircle",
    1088: "IfcCircleHollowProfileDef",
    1089: "IfcCircleProfileDef",
    1090: "IfcCivilElement",
    1091: "IfcCivilElementType",
    1092: "IfcClassification",
    1093: "IfcClassificationReference",
    1094: "IfcClosedShell",
    1095: "IfcCoil",
    1096: "IfcCoilType",
    1097: "IfcColourRgb",
    1098: "IfcColourRgbList",
    1099: "IfcColourSpecification",
    1100: "IfcColumn",
    1101: "IfcColumnStandardCase",
    1102: "IfcColumnType",
    1103: "IfcCommunicationsAppliance",
    1104: "IfcCommunicationsApplianceType",
    1105: "IfcComplexProperty",
    1106: "IfcComplexPropertyTemplate",
    1107: "IfcCompositeCurve",
    1108: "IfcCompositeCurveOnSurface",
    1109: "IfcCompositeCurveSegment",
    1110: "IfcCompositeProfileDef",
    1111: "IfcCompressor",
    1112: "IfcCompressorType",
    1113: "IfcCondenser",
    1114: "IfcCondenserType",
    1115: "IfcConic",
    1116: "IfcConnectedFaceSet",
    1117: "IfcConnectionCurveGeometry",
    1118: "IfcConnectionGeometry",
    1119: "IfcConnectionPointEccentricity",
    1120: "IfcConnectionPointGeometry",
    1121: "IfcConnectionSurfaceGeometry",
    1122: "IfcConnectionVolumeGeometry",
    1123: "IfcConstraint",
    1124: "IfcConstructionEquipmentResource",
    1125: "IfcConstructionEquipmentResourceType",
    1126: "IfcConstructionMaterialResource",
    1127: "IfcConstructionMaterialResourceType",
    1128: "IfcConstructionProductResource",
    1129: "IfcConstructionProductResourceType",
    1130: "IfcConstructionResource",
    1131: "IfcConstructionResourceType",
    1132: "IfcContext",
    1133: "IfcContextDependentUnit",
    1134: "IfcControl",
    1135: "IfcController",
    1136: "IfcControllerType",
    1137: "IfcConversionBasedUnit",
    1138: "IfcConversionBasedUnitWithOffset",
    1139: "IfcCooledBeam",
    1140: "IfcCooledBeamType",
    1141: "IfcCoolingTower",
    1142: "IfcCoolingTowerType",
    1143: "IfcCoordinateOperation",
    1144: "IfcCoordinateReferenceSystem",
    1145: "IfcCostItem",
    1146: "IfcCostSchedule",
    1147: "IfcCostValue",
    1148: "IfcCovering",
    1149: "IfcCoveringType",
    1150: "IfcCrewResource",
    1151: "IfcCrewResourceType",
    1152: "IfcCsgPrimitive3D",
    1153: "IfcCsgSolid",
    1154: "IfcCShapeProfileDef",
    1155: "IfcCurrencyRelationship",
    1156: "IfcCurtainWall",
    1157: "IfcCurtainWallType",
    1158: "IfcCurve",
    1159: "IfcCurveBoundedPlane",
    1160: "IfcCurveBoundedSurface",
    1161: "IfcCurveStyle",
    1162: "IfcCurveStyleFont",
    1163: "IfcCurveStyleFontAndScaling",
    1164: "IfcCurveStyleFontPattern",
    1165: "IfcCylindricalSurface",
    1166: "IfcDamper",
    1167: "IfcDamperType",
    1168: "IfcDerivedProfileDef",
    1169: "IfcDerivedUnit",
    1170: "IfcDerivedUnitElement",
    1171: "IfcDimensionalExponents",
    1172: "IfcDirection",
    1173: "IfcDiscreteAccessory",
    1174: "IfcDiscreteAccessoryType",
    1175: "IfcDistributionChamberElement",
    1176: "IfcDistributionChamberElementType",
    1177: "IfcDistributionCircuit",
    1178: "IfcDistributionControlElement",
    1179: "IfcDistributionControlElementType",
    1180: "IfcDistributionElement",
    1181: "IfcDistributionElementType",
    1182: "IfcDistributionFlowElement",
    1183: "IfcDistributionFlowElementType",
    1184: "IfcDistributionPort",
    1185: "IfcDistributionSystem",
    1186: "IfcDocumentInformation",
    1187: "IfcDocumentInformationRelationship",
    1188: "IfcDocumentReference",
    1189: "IfcDoor",
    1190: "IfcDoorLiningProperties",
    1191: "IfcDoorPanelProperties",
    1192: "IfcDoorStandardCase",
    1193: "IfcDoorStyle",
    1194: "IfcDoorType",
    1195: "IfcDraughtingPreDefinedColour",
    1196: "IfcDraughtingPreDefinedCurveFont",
    1197: "IfcDuctFitting",
    1198: "IfcDuctFittingType",
    1199: "IfcDuctSegment",
    1200: "IfcDuctSegmentType",
    1201: "IfcDuctSilencer",
    1202: "IfcDuctSilencerType",
    1203: "IfcEdge",
    1204: "IfcEdgeCurve",
    1205: "IfcEdgeLoop",
    1206: "IfcElectricAppliance",
    1207: "IfcElectricApplianceType",
    1208: "IfcElectricDistributionBoard",
    1209: "IfcElectricDistributionBoardType",
    1210: "IfcElectricFlowStorageDevice",
    1211: "IfcElectricFlowStorageDeviceType",
    1212: "IfcElectricGenerator",
    1213: "IfcElectricGeneratorType",
    1214: "IfcElectricMotor",
    1215: "IfcElectricMotorType",
    1216: "IfcElectricTimeControl",
    1217: "IfcElectricTimeControlType",
    1218: "IfcElement",
    1219: "IfcElementarySurface",
    1220: "IfcElementAssembly",
    1221: "IfcElementAssemblyType",
    1222: "IfcElementComponent",
    1223: "IfcElementComponentType",
    1224: "IfcElementQuantity",
    1225: "IfcElementType",
    1226: "IfcEllipse",
    1227: "IfcEllipseProfileDef",
    1228: "IfcEnergyConversionDevice",
    1229: "IfcEnergyConversionDeviceType",
    1230: "IfcEngine",
    1231: "IfcEngineType",
    1232: "IfcEvaporativeCooler",
    1233: "IfcEvaporativeCoolerType",
    1234: "IfcEvaporator",
    1235: "IfcEvaporatorType",
    1236: "IfcEvent",
    1237: "IfcEventTime",
    1238: "IfcEventType",
    1239: "IfcExtendedProperties",
    1240: "IfcExternalInformation",
    1241: "IfcExternallyDefinedHatchStyle",
    1242: "IfcExternallyDefinedSurfaceStyle",
    1243: "IfcExternallyDefinedTextFont",
    1244: "IfcExternalReference",
    1245: "IfcExternalReferenceRelationship",
    1246: "IfcExternalSpatialElement",
    1247: "IfcExternalSpatialStructureElement",
    1248: "IfcExtrudedAreaSolid",
    1249: "IfcExtrudedAreaSolidTapered",
    1250: "IfcFace",
    1251: "IfcFaceBasedSurfaceModel",
    1252: "IfcFaceBound",
    1253: "IfcFaceOuterBound",
    1254: "IfcFaceSurface",
    1255: "IfcFacetedBrep",
    1256: "IfcFacetedBrepWithVoids",
    1257: "IfcFailureConnectionCondition",
    1258: "IfcFan",
    1259: "IfcFanType",
    1260: "IfcFastener",
    1261: "IfcFastenerType",
    1262: "IfcFeatureElement",
    1263: "IfcFeatureElementAddition",
    1264: "IfcFeatureElementSubtraction",
    1265: "IfcFillAreaStyle",
    1266: "IfcFillAreaStyleHatching",
    1267: "IfcFillAreaStyleTiles",
    1268: "IfcFilter",
    1269: "IfcFilterType",
    1270: "IfcFireSuppressionTerminal",
    1271: "IfcFireSuppressionTerminalType",
    1272: "IfcFixedReferenceSweptAreaSolid",
    1273: "IfcFlowController",
    1274: "IfcFlowControllerType",
    1275: "IfcFlowFitting",
    1276: "IfcFlowFittingType",
    1277: "IfcFlowInstrument",
    1278: "IfcFlowInstrumentType",
    1279: "IfcFlowMeter",
    1280: "IfcFlowMeterType",
    1281: "IfcFlowMovingDevice",
    1282: "IfcFlowMovingDeviceType",
    1283: "IfcFlowSegment",
    1284: "IfcFlowSegmentType",
    1285: "IfcFlowStorageDevice",
    1286: "IfcFlowStorageDeviceType",
    1287: "IfcFlowTerminal",
    1288: "IfcFlowTerminalType",
    1289: "IfcFlowTreatmentDevice",
    1290: "IfcFlowTreatmentDeviceType",
    1291: "IfcFooting",
    1292: "IfcFootingType",
    1293: "IfcFurnishingElement",
    1294: "IfcFurnishingElementType",
    1295: "IfcFurniture",
    1296: "IfcFurnitureType",
    1297: "IfcGeographicElement",
    1298: "IfcGeographicElementType",
    1299: "IfcGeometricCurveSet",
    1300: "IfcGeometricRepresentationContext",
    1301: "IfcGeometricRepresentationItem",
    1302: "IfcGeometricRepresentationSubContext",
    1303: "IfcGeometricSet",
    1304: "IfcGrid",
    1305: "IfcGridAxis",
    1306: "IfcGridPlacement",
    1307: "IfcGroup",
    1308: "IfcHalfSpaceSolid",
    1309: "IfcHeatExchanger",
    1310: "IfcHeatExchangerType",
    1311: "IfcHumidifier",
    1312: "IfcHumidifierType",
    1313: "IfcImageTexture",
    1314: "IfcIndexedColourMap",
    1315: "IfcIndexedPolyCurve",
    1316: "IfcIndexedPolygonalFace",
    1317: "IfcIndexedPolygonalFaceWithVoids",
    1318: "IfcIndexedTextureMap",
    1319: "IfcIndexedTriangleTextureMap",
    1320: "IfcInterceptor",
    1321: "IfcInterceptorType",
    1322: "IfcIntersectionCurve",
    1323: "IfcInventory",
    1324: "IfcIrregularTimeSeries",
    1325: "IfcIrregularTimeSeriesValue",
    1326: "IfcIShapeProfileDef",
    1327: "IfcJunctionBox",
    1328: "IfcJunctionBoxType",
    1329: "IfcLaborResource",
    1330: "IfcLaborResourceType",
    1331: "IfcLagTime",
    1332: "IfcLamp",
    1333: "IfcLampType",
    1334: "IfcLibraryInformation",
    1335: "IfcLibraryReference",
    1336: "IfcLightDistributionData",
    1337: "IfcLightFixture",
    1338: "IfcLightFixtureType",
    1339: "IfcLightIntensityDistribution",
    1340: "IfcLightSource",
    1341: "IfcLightSourceAmbient",
    1342: "IfcLightSourceDirectional",
    1343: "IfcLightSourceGoniometric",
    1344: "IfcLightSourcePositional",
    1345: "IfcLightSourceSpot",
    1346: "IfcLine",
    1347: "IfcLocalPlacement",
    1348: "IfcLoop",
    1349: "IfcLShapeProfileDef",
    1350: "IfcManifoldSolidBrep",
    1351: "IfcMapConversion",
    1352: "IfcMappedItem",
    1353: "IfcMaterial",
    1354: "IfcMaterialClassificationRelationship",
    1355: "IfcMaterialConstituent",
    1356: "IfcMaterialConstituentSet",
    1357: "IfcMaterialDefinition",
    1358: "IfcMaterialDefinitionRepresentation",
    1359: "IfcMaterialLayer",
    1360: "IfcMaterialLayerSet",
    1361: "IfcMaterialLayerSetUsage",
    1362: "IfcMaterialLayerWithOffsets",
    1363: "IfcMaterialList",
    1364: "IfcMaterialProfile",
    1365: "IfcMaterialProfileSet",
    1366: "IfcMaterialProfileSetUsage",
    1367: "IfcMaterialProfileSetUsageTapering",
    1368: "IfcMaterialProfileWithOffsets",
    1369: "IfcMaterialProperties",
    1370: "IfcMaterialRelationship",
    1371: "IfcMaterialUsageDefinition",
    1372: "IfcMeasureWithUnit",
    1373: "IfcMechanicalFastener",
    1374: "IfcMechanicalFastenerType",
    1375: "IfcMedicalDevice",
    1376: "IfcMedicalDeviceType",
    1377: "IfcMember",
    1378: "IfcMemberStandardCase",
    1379: "IfcMemberType",
    1380: "IfcMetric",
    1381: "IfcMirroredProfileDef",
    1382: "IfcMonetaryUnit",
    1383: "IfcMotorConnection",
    1384: "IfcMotorConnectionType",
    1385: "IfcNamedUnit",
    1386: "IfcObject",
    1387: "IfcObjectDefinition",
    1388: "IfcObjective",
    1389: "IfcObjectPlacement",
    1390: "IfcOccupant",
    1391: "IfcOffsetCurve2D",
    1392: "IfcOffsetCurve3D",
    1393: "IfcOpeningElement",
    1394: "IfcOpeningStandardCase",
    1395: "IfcOpenShell",
    1396: "IfcOrganization",
    1397: "IfcOrganizationRelationship",
    1398: "IfcOrientedEdge",
    1399: "IfcOuterBoundaryCurve",
    1400: "IfcOutlet",
    1401: "IfcOutletType",
    1402: "IfcOwnerHistory",
    1403: "IfcParameterizedProfileDef",
    1404: "IfcPath",
    1405: "IfcPcurve",
    1406: "IfcPerformanceHistory",
    1407: "IfcPermeableCoveringProperties",
    1408: "IfcPermit",
    1409: "IfcPerson",
    1410: "IfcPersonAndOrganization",
    1411: "IfcPhysicalComplexQuantity",
    1412: "IfcPhysicalQuantity",
    1413: "IfcPhysicalSimpleQuantity",
    1414: "IfcPile",
    1415: "IfcPileType",
    1416: "IfcPipeFitting",
    1417: "IfcPipeFittingType",
    1418: "IfcPipeSegment",
    1419: "IfcPipeSegmentType",
    1420: "IfcPixelTexture",
    1421: "IfcPlacement",
    1422: "IfcPlanarBox",
    1423: "IfcPlanarExtent",
    1424: "IfcPlane",
    1425: "IfcPlate",
    1426: "IfcPlateStandardCase",
    1427: "IfcPlateType",
    1428: "IfcPoint",
    1429: "IfcPointOnCurve",
    1430: "IfcPointOnSurface",
    1431: "IfcPolygonalBoundedHalfSpace",
    1432: "IfcPolygonalFaceSet",
    1433: "IfcPolyline",
    1434: "IfcPolyLoop",
    1435: "IfcPort",
    1436: "IfcPostalAddress",
    1437: "IfcPreDefinedColour",
    1438: "IfcPreDefinedCurveFont",
    1439: "IfcPreDefinedItem",
    1440: "IfcPreDefinedProperties",
    1441: "IfcPreDefinedPropertySet",
    1442: "IfcPreDefinedTextFont",
    1443: "IfcPresentationItem",
    1444: "IfcPresentationLayerAssignment",
    1445: "IfcPresentationLayerWithStyle",
    1446: "IfcPresentationStyle",
    1447: "IfcPresentationStyleAssignment",
    1448: "IfcProcedure",
    1449: "IfcProcedureType",
    1450: "IfcProcess",
    1451: "IfcProduct",
    1452: "IfcProductDefinitionShape",
    1453: "IfcProductRepresentation",
    1454: "IfcProfileDef",
    1455: "IfcProfileProperties",
    1456: "IfcProject",
    1457: "IfcProjectedCRS",
    1458: "IfcProjectionElement",
    1459: "IfcProjectLibrary",
    1460: "IfcProjectOrder",
    1461: "IfcProperty",
    1462: "IfcPropertyAbstraction",
    1463: "IfcPropertyBoundedValue",
    1464: "IfcPropertyDefinition",
    1465: "IfcPropertyDependencyRelationship",
    1466: "IfcPropertyEnumeratedValue",
    1467: "IfcPropertyEnumeration",
    1468: "IfcPropertyListValue",
    1469: "IfcPropertyReferenceValue",
    1470: "IfcPropertySet",
    1471: "IfcPropertySetDefinition",
    1472: "IfcPropertySetTemplate",
    1473: "IfcPropertySingleValue",
    1474: "IfcPropertyTableValue",
    1475: "IfcPropertyTemplate",
    1476: "IfcPropertyTemplateDefinition",
    1477: "IfcProtectiveDevice",
    1478: "IfcProtectiveDeviceTrippingUnit",
    1479: "IfcProtectiveDeviceTrippingUnitType",
    1480: "IfcProtectiveDeviceType",
    1481: "IfcProxy",
    1482: "IfcPump",
    1483: "IfcPumpType",
    1484: "IfcQuantityArea",
    1485: "IfcQuantityCount",
    1486: "IfcQuantityLength",
    1487: "IfcQuantitySet",
    1488: "IfcQuantityTime",
    1489: "IfcQuantityVolume",
    1490: "IfcQuantityWeight",
    1491: "IfcRailing",
    1492: "IfcRailingType",
    1493: "IfcRamp",
    1494: "IfcRampFlight",
    1495: "IfcRampFlightType",
    1496: "IfcRampType",
    1497: "IfcRationalBSplineCurveWithKnots",
    1498: "IfcRationalBSplineSurfaceWithKnots",
    1499: "IfcRectangleHollowProfileDef",
    1500: "IfcRectangleProfileDef",
    1501: "IfcRectangularPyramid",
    1502: "IfcRectangularTrimmedSurface",
    1503: "IfcRecurrencePattern",
    1504: "IfcReference",
    1505: "IfcRegularTimeSeries",
    1506: "IfcReinforcementBarProperties",
    1507: "IfcReinforcementDefinitionProperties",
    1508: "IfcReinforcingBar",
    1509: "IfcReinforcingBarType",
    1510: "IfcReinforcingElement",
    1511: "IfcReinforcingElementType",
    1512: "IfcReinforcingMesh",
    1513: "IfcReinforcingMeshType",
    1514: "IfcRelAggregates",
    1515: "IfcRelAssigns",
    1516: "IfcRelAssignsToActor",
    1517: "IfcRelAssignsToControl",
    1518: "IfcRelAssignsToGroup",
    1519: "IfcRelAssignsToGroupByFactor",
    1520: "IfcRelAssignsToProcess",
    1521: "IfcRelAssignsToProduct",
    1522: "IfcRelAssignsToResource",
    1523: "IfcRelAssociates",
    1524: "IfcRelAssociatesApproval",
    1525: "IfcRelAssociatesClassification",
    1526: "IfcRelAssociatesConstraint",
    1527: "IfcRelAssociatesDocument",
    1528: "IfcRelAssociatesLibrary",
    1529: "IfcRelAssociatesMaterial",
    1530: "IfcRelationship",
    1531: "IfcRelConnects",
    1532: "IfcRelConnectsElements",
    1533: "IfcRelConnectsPathElements",
    1534: "IfcRelConnectsPorts",
    1535: "IfcRelConnectsPortToElement",
    1536: "IfcRelConnectsStructuralActivity",
    1537: "IfcRelConnectsStructuralMember",
    1538: "IfcRelConnectsWithEccentricity",
    1539: "IfcRelConnectsWithRealizingElements",
    1540: "IfcRelContainedInSpatialStructure",
    1541: "IfcRelCoversBldgElements",
    1542: "IfcRelCoversSpaces",
    1543: "IfcRelDeclares",
    1544: "IfcRelDecomposes",
    1545: "IfcRelDefines",
    1546: "IfcRelDefinesByObject",
    1547: "IfcRelDefinesByProperties",
    1548: "IfcRelDefinesByTemplate",
    1549: "IfcRelDefinesByType",
    1550: "IfcRelFillsElement",
    1551: "IfcRelFlowControlElements",
    1552: "IfcRelInterferesElements",
    1553: "IfcRelNests",
    1554: "IfcRelProjectsElement",
    1555: "IfcRelReferencedInSpatialStructure",
    1556: "IfcRelSequence",
    1557: "IfcRelServicesBuildings",
    1558: "IfcRelSpaceBoundary",
    1559: "IfcRelSpaceBoundary1stLevel",
    1560: "IfcRelSpaceBoundary2ndLevel",
    1561: "IfcRelVoidsElement",
    1562: "IfcReparametrisedCompositeCurveSegment",
    1563: "IfcRepresentation",
    1564: "IfcRepresentationContext",
    1565: "IfcRepresentationItem",
    1566: "IfcRepresentationMap",
    1567: "IfcResource",
    1568: "IfcResourceApprovalRelationship",
    1569: "IfcResourceConstraintRelationship",
    1570: "IfcResourceLevelRelationship",
    1571: "IfcResourceTime",
    1572: "IfcRevolvedAreaSolid",
    1573: "IfcRevolvedAreaSolidTapered",
    1574: "IfcRightCircularCone",
    1575: "IfcRightCircularCylinder",
    1576: "IfcRoof",
    1577: "IfcRoofType",
    1578: "IfcRoot",
    1579: "IfcRoundedRectangleProfileDef",
    1580: "IfcSanitaryTerminal",
    1581: "IfcSanitaryTerminalType",
    1582: "IfcSchedulingTime",
    1583: "IfcSeamCurve",
    1584: "IfcSectionedSpine",
    1585: "IfcSectionProperties",
    1586: "IfcSectionReinforcementProperties",
    1587: "IfcSensor",
    1588: "IfcSensorType",
    1589: "IfcShadingDevice",
    1590: "IfcShadingDeviceType",
    1591: "IfcShapeAspect",
    1592: "IfcShapeModel",
    1593: "IfcShapeRepresentation",
    1594: "IfcShellBasedSurfaceModel",
    1595: "IfcSimpleProperty",
    1596: "IfcSimplePropertyTemplate",
    1597: "IfcSite",
    1598: "IfcSIUnit",
    1599: "IfcSlab",
    1600: "IfcSlabElementedCase",
    1601: "IfcSlabStandardCase",
    1602: "IfcSlabType",
    1603: "IfcSlippageConnectionCondition",
    1604: "IfcSolarDevice",
    1605: "IfcSolarDeviceType",
    1606: "IfcSolidModel",
    1607: "IfcSpace",
    1608: "IfcSpaceHeater",
    1609: "IfcSpaceHeaterType",
    1610: "IfcSpaceType",
    1611: "IfcSpatialElement",
    1612: "IfcSpatialElementType",
    1613: "IfcSpatialStructureElement",
    1614: "IfcSpatialStructureElementType",
    1615: "IfcSpatialZone",
    1616: "IfcSpatialZoneType",
    1617: "IfcSphere",
    1618: "IfcSphericalSurface",
    1619: "IfcStackTerminal",
    1620: "IfcStackTerminalType",
    1621: "IfcStair",
    1622: "IfcStairFlight",
    1623: "IfcStairFlightType",
    1624: "IfcStairType",
    1625: "IfcStructuralAction",
    1626: "IfcStructuralActivity",
    1627: "IfcStructuralAnalysisModel",
    1628: "IfcStructuralConnection",
    1629: "IfcStructuralConnectionCondition",
    1630: "IfcStructuralCurveAction",
    1631: "IfcStructuralCurveConnection",
    1632: "IfcStructuralCurveMember",
    1633: "IfcStructuralCurveMemberVarying",
    1634: "IfcStructuralCurveReaction",
    1635: "IfcStructuralItem",
    1636: "IfcStructuralLinearAction",
    1637: "IfcStructuralLoad",
    1638: "IfcStructuralLoadCase",
    1639: "IfcStructuralLoadConfiguration",
    1640: "IfcStructuralLoadGroup",
    1641: "IfcStructuralLoadLinearForce",
    1642: "IfcStructuralLoadOrResult",
    1643: "IfcStructuralLoadPlanarForce",
    1644: "IfcStructuralLoadSingleDisplacement",
    1645: "IfcStructuralLoadSingleDisplacementDistortion",
    1646: "IfcStructuralLoadSingleForce",
    1647: "IfcStructuralLoadSingleForceWarping",
    1648: "IfcStructuralLoadStatic",
    1649: "IfcStructuralLoadTemperature",
    1650: "IfcStructuralMember",
    1651: "IfcStructuralPlanarAction",
    1652: "IfcStructuralPointAction",
    1653: "IfcStructuralPointConnection",
    1654: "IfcStructuralPointReaction",
    1655: "IfcStructuralReaction",
    1656: "IfcStructuralResultGroup",
    1657: "IfcStructuralSurfaceAction",
    1658: "IfcStructuralSurfaceConnection",
    1659: "IfcStructuralSurfaceMember",
    1660: "IfcStructuralSurfaceMemberVarying",
    1661: "IfcStructuralSurfaceReaction",
    1662: "IfcStyledItem",
    1663: "IfcStyledRepresentation",
    1664: "IfcStyleModel",
    1665: "IfcSubContractResource",
    1666: "IfcSubContractResourceType",
    1667: "IfcSubedge",
    1668: "IfcSurface",
    1669: "IfcSurfaceCurve",
    1670: "IfcSurfaceCurveSweptAreaSolid",
    1671: "IfcSurfaceFeature",
    1672: "IfcSurfaceOfLinearExtrusion",
    1673: "IfcSurfaceOfRevolution",
    1674: "IfcSurfaceReinforcementArea",
    1675: "IfcSurfaceStyle",
    1676: "IfcSurfaceStyleLighting",
    1677: "IfcSurfaceStyleRefraction",
    1678: "IfcSurfaceStyleRendering",
    1679: "IfcSurfaceStyleShading",
    1680: "IfcSurfaceStyleWithTextures",
    1681: "IfcSurfaceTexture",
    1682: "IfcSweptAreaSolid",
    1683: "IfcSweptDiskSolid",
    1684: "IfcSweptDiskSolidPolygonal",
    1685: "IfcSweptSurface",
    1686: "IfcSwitchingDevice",
    1687: "IfcSwitchingDeviceType",
    1688: "IfcSystem",
    1689: "IfcSystemFurnitureElement",
    1690: "IfcSystemFurnitureElementType",
    1691: "IfcTable",
    1692: "IfcTableColumn",
    1693: "IfcTableRow",
    1694: "IfcTank",
    1695: "IfcTankType",
    1696: "IfcTask",
    1697: "IfcTaskTime",
    1698: "IfcTaskTimeRecurring",
    1699: "IfcTaskType",
    1700: "IfcTelecomAddress",
    1701: "IfcTendon",
    1702: "IfcTendonAnchor",
    1703: "IfcTendonAnchorType",
    1704: "IfcTendonType",
    1705: "IfcTessellatedFaceSet",
    1706: "IfcTessellatedItem",
    1707: "IfcTextLiteral",
    1708: "IfcTextLiteralWithExtent",
    1709: "IfcTextStyle",
    1710: "IfcTextStyleFontModel",
    1711: "IfcTextStyleForDefinedFont",
    1712: "IfcTextStyleTextModel",
    1713: "IfcTextureCoordinate",
    1714: "IfcTextureCoordinateGenerator",
    1715: "IfcTextureMap",
    1716: "IfcTextureVertex",
    1717: "IfcTextureVertexList",
    1718: "IfcTimePeriod",
    1719: "IfcTimeSeries",
    1720: "IfcTimeSeriesValue",
    1721: "IfcTopologicalRepresentationItem",
    1722: "IfcTopologyRepresentation",
    1723: "IfcToroidalSurface",
    1724: "IfcTransformer",
    1725: "IfcTransformerType",
    1726: "IfcTransportElement",
    1727: "IfcTransportElementType",
    1728: "IfcTrapeziumProfileDef",
    1729: "IfcTriangulatedFaceSet",
    1730: "IfcTrimmedCurve",
    1731: "IfcTShapeProfileDef",
    1732: "IfcTubeBundle",
    1733: "IfcTubeBundleType",
    1734: "IfcTypeObject",
    1735: "IfcTypeProcess",
    1736: "IfcTypeProduct",
    1737: "IfcTypeResource",
    1738: "IfcUnitaryControlElement",
    1739: "IfcUnitaryControlElementType",
    1740: "IfcUnitaryEquipment",
    1741: "IfcUnitaryEquipmentType",
    1742: "IfcUnitAssignment",
    1743: "IfcUShapeProfileDef",
    1744: "IfcValve",
    1745: "IfcValveType",
    1746: "IfcVector",
    1747: "IfcVertex",
    1748: "IfcVertexLoop",
    1749: "IfcVertexPoint",
    1750: "IfcVibrationIsolator",
    1751: "IfcVibrationIsolatorType",
    1752: "IfcVirtualElement",
    1753: "IfcVirtualGridIntersection",
    1754: "IfcVoidingFeature",
    1755: "IfcWall",
    1756: "IfcWallElementedCase",
    1757: "IfcWallStandardCase",
    1758: "IfcWallType",
    1759: "IfcWasteTerminal",
    1760: "IfcWasteTerminalType",
    1761: "IfcWindow",
    1762: "IfcWindowLiningProperties",
    1763: "IfcWindowPanelProperties",
    1764: "IfcWindowStandardCase",
    1765: "IfcWindowStyle",
    1766: "IfcWindowType",
    1767: "IfcWorkCalendar",
    1768: "IfcWorkControl",
    1769: "IfcWorkPlan",
    1770: "IfcWorkSchedule",
    1771: "IfcWorkTime",
    1772: "IfcZone",
    1773: "IfcZShapeProfileDef"
};
