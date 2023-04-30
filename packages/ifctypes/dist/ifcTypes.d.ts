/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdatatypes.svg)](https://badge.fury.io/js/%40xeokit%2Fdatatypes)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/datatypes/badge)](https://www.jsdelivr.com/package/npm/@xeokit/datatypes)
 *
 * <img style="padding-top:20px; padding-bottom: 10px;" src="media://images/ifc_logo.png"/>
 *
 * # xeokit IFC Data Types
 *
 * * Defines numeric constants for IFC entity and relationship types.
 * * Use with {@link "@xeokit/data"} to assign IFC types to {@link @xeokit/data!DataObject | DataObjects} and
 * {@link @xeokit/data!Relationship | Relationships} and treat them as IFC elements.
 * * Use with {@link "@xeokit/treeview"} to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating IFC element hierachies.
 * * Supports IFC versions 2x3 and 4.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/datatypes
 * ````
 *
 * @module @xeokit/ifcTypes
 */
/**
 * A request is the act or instance of asking for something, such as a request for information, bid submission, or performance of work.
 */
export declare const IfcActionRequest = 1000;
/**
 * The IfcActor defines all actors or human agents involved in a project during its full life cycle. It facilitates the use of person and organization definitions in the resource part of the IFC object model. This includes name, address, telecommunication addresses, and roles.
 */
export declare const IfcActor = 1001;
/**
 * This entity indicates a role which is performed by an actor, either a person, an organization or a person related to an organization.
 */
export declare const IfcActorRole: number;
/**
 * An actuator is a mechanical device for moving or controlling a mechanism or system. An actuator takes energy, usually created by air, electricity, or liquid, and converts that into some kind of motion.
 */
export declare const IfcActuator = 1003;
/**
 * The distribution control element type IfcActuatorType defines commonly shared information for occurrences of actuators. The set of shared information may include:
 */
export declare const IfcActuatorType = 1004;
/**
 * This abstract entity represents various kinds of postal and telecom addresses.
 */
export declare const IfcAddress = 1005;
/**
 * An advanced B-rep is a boundary representation model in which all faces, edges and vertices are explicitly represented. It is a solid with explicit topology and elementary or free-form geometry. The faces of the B-rep are of type IfcAdvancedFace. An advanced B-rep has to meet the same topological constraints as the manifold solid B-rep.
 */
export declare const IfcAdvancedBrep = 1006;
/**
 * The IfcAdvancedBrepWithVoids is a specialization of an advanced B-rep which contains one or more voids in its interior. The voids are represented as closed shells which are defined so that the shell normal point into the void.
 */
export declare const IfcAdvancedBrepWithVoids = 1007;
/**
 * An advanced face is a specialization of a face surface that has to meet requirements on using particular topological and geometric representation items for the definition of the faces, edges and vertices.
 */
export declare const IfcAdvancedFace = 1008;
/**
 * An air terminal is a terminating or origination point for the transfer of air between distribution system(s) and one or more spaces. It can also be used for the transfer of air between adjacent spaces.
 */
export declare const IfcAirTerminal = 1009;
/**
 * An air terminal box typically participates in an HVAC duct distribution system and is used to control or modulate the amount of air delivered to its downstream ductwork. An air terminal box type is often referred to as an "air flow regulator".
 */
export declare const IfcAirTerminalBox = 1010;
/**
 * The flow controller type IfcAirTerminalBoxType defines commonly shared information for occurrences of air terminal boxes. The set of shared information may include:
 */
export declare const IfcAirTerminalBoxType = 1011;
/**
 * The flow terminal type IfcAirTerminalType defines commonly shared information for occurrences of air terminals. The set of shared information may include:
 */
export declare const IfcAirTerminalType = 1012;
/**
 * An air-to-air heat recovery device employs a counter-flow heat exchanger between inbound and outbound air flow. It is typically used to transfer heat from warmer air in one chamber to cooler air in the second chamber (i.e., typically used to recover heat from the conditioned air being exhausted and the outside air being supplied to a building), resulting in energy savings from reduced heating (or cooling) requirements.
 */
export declare const IfcAirToAirHeatRecovery = 1013;
/**
 * The energy conversion device type IfcAirToAirHeatRecoveryType defines commonly shared information for occurrences of air to air heat recoverys. The set of shared information may include:
 */
export declare const IfcAirToAirHeatRecoveryType = 1014;
/**
 * An alarm is a device that signals the existence of a condition or situation that is outside the boundaries of normal expectation or that activates such a device.
 */
export declare const IfcAlarm = 1015;
/**
 * The distribution control element type IfcAlarmType defines commonly shared information for occurrences of alarms. The set of shared information may include:
 */
export declare const IfcAlarmType = 1016;
/**
 * An annotation is an information element within the geometric (and spatial) context of a project, that adds a note or meaning to the objects which constitutes the project model. Annotations include additional points, curves, text, dimensioning, hatching and other forms of graphical notes. It also includes virtual or symbolic representations of additional model components, not representing products or spatial structures, such as event elements, survey points, contour lines or similar.
 */
export declare const IfcAnnotation = 1017;
/**
 * The IfcAnnotationFillArea defines an area by a definite OuterBoundary, that might include InnerBoundaries. The areas defined by the InnerBoundaries are excluded from applying the fill area style. The InnerBoundaries shall not intersect with the OuterBoundary nor being outside of the OuterBoundary.
 */
export declare const IfcAnnotationFillArea = 1018;
/**
 * IfcApplication holds the information about an IFC compliant application developed by an application developer. The IfcApplication utilizes a short identifying name as provided by the application developer.
 */
export declare const IfcApplication = 1019;
/**
 * This entity captures a value driven by a formula, with additional qualifications including unit basis, valid date range, and categorization.
 */
export declare const IfcAppliedValue = 1020;
/**
 * An IfcApproval represents information about approval processes such as for a plan, a design, a proposal, or a change order in a construction or facilities management project. IfcApproval is referenced by IfcRelAssociatesApproval in IfcControlExtension schema, and thereby can be related to all subtypes of IfcRoot. An approval may also be given to resource objects using IfcResourceApprovalRelationship
 */
export declare const IfcApproval = 1021;
/**
 * An IfcApprovalRelationship associates approvals (one relating approval and one or more related approvals), each having different status or level as the approval process or the approved objects evolve.
 */
export declare const IfcApprovalRelationship = 1022;
/**
 * The closed profile IfcArbitraryClosedProfileDef defines an arbitrary two-dimensional profile for the use within the swept surface geometry, the swept area solid or a sectioned spine. It is given by an outer boundary from which the surface or solid can be constructed.
 */
export declare const IfcArbitraryClosedProfileDef = 1023;
/**
 * The open profile IfcArbitraryOpenProfileDef defines an arbitrary two-dimensional open profile for the use within the swept surface geometry. It is given by an open boundary from which the surface can be constructed.
 */
export declare const IfcArbitraryOpenProfileDef = 1024;
/**
 * The IfcArbitraryProfileDefWithVoids defines an arbitrary closed two-dimensional profile with holes. It is given by an outer boundary and inner boundaries. A kdtree3 usage of IfcArbitraryProfileDefWithVoids is as the cross section for the creation of swept surfaces or swept solids.
 */
export declare const IfcArbitraryProfileDefWithVoids = 1025;
/**
 * An asset is a uniquely identifiable grouping of elements acting as a single entity that has a financial value or that can be operated on as a single unit.
 */
export declare const IfcAsset = 1026;
/**
 * IfcAsymmetricIShapeProfileDef defines a section profile that provides the defining parameters of a singly symmetric I-shaped section. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export declare const IfcAsymmetricIShapeProfileDef = 1027;
/**
 * An audio-visual appliance is a device that displays, captures, transmits, or receives audio or video.
 */
export declare const IfcAudioVisualAppliance = 1028;
/**
 * The flow terminal type IfcAudioVisualApplianceType defines commonly shared information for occurrences of audio visual appliances. The set of shared information may include:
 */
export declare const IfcAudioVisualApplianceType = 1029;
/**
 * The IfcAxis1Placement provides location and direction of a single axis.
 */
export declare const IfcAxis1Placement = 1030;
/**
 * The IfcAxis2Placement2D provides location and orientation to place items in a two-dimensional space. The attribute RefDirection defines the x axis, the y axis is derived. If the attribute RefDirection is not given, the placement defaults to P[1] (x-axis) as [1.,0.] and P[2] (y-axis) as [0.,1.].
 */
export declare const IfcAxis2Placement2D = 1031;
/**
 * The IfcAxis2Placement3D provides location and orientations to place items in a three-dimensional space. The attribute Axis defines the Z direction, RefDirection the X direction. The Y direction is derived.
 */
export declare const IfcAxis2Placement3D = 1032;
/**
 * An IfcBeam is a horizontal, or nearly horizontal, structural member that is capable of withstanding load primarily by resisting bending. It represents such a member from an architectural point of view. It is not required to be load bearing.
 */
export declare const IfcBeam = 1033;
/**
 * The standard beam, IfcBeamStandardCase, defines a beam with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcBeamStandardCase handles all cases of beams, that:
 */
export declare const IfcBeamStandardCase = 1034;
/**
 * The element type IfcBeamType defines commonly shared information for occurrences of beams. The set of shared information may include:
 */
export declare const IfcBeamType = 1035;
/**
 * An IfcBlobTexture provides a 2-dimensional distribution of the lighting parameters of a surface onto which it is mapped. The texture itself is given as a single binary blob, representing the content of a pixel format file. The file format of the pixel file is given by the RasterFormat attribute and allowable formats are guided by where rule SupportedRasterFormat.
 */
export declare const IfcBlobTexture = 1036;
/**
 * The IfcBlock is a Construction Solid Geometry (CSG) 3D primitive. It is defined by a position and a positve distance along the three orthogonal axes. The inherited Position attribute has the IfcAxisPlacement3D type and provides:
 */
export declare const IfcBlock = 1037;
/**
 * A boiler is a closed, pressure-rated vessel in which water or other fluid is heated using an energy source such as natural gas, heating oil, or electricity. The fluid in the vessel is then circulated out of the boiler for use in various processes or heating applications.
 */
export declare const IfcBoiler = 1038;
/**
 * The energy conversion device type IfcBoilerType defines commonly shared information for occurrences of boilers. The set of shared information may include:
 */
export declare const IfcBoilerType = 1039;
/**
 * A clipping result is defined as a special subtype of the general IfcBooleanResult. It constrains the operands and the operator of the Boolean result.
 */
export declare const IfcBooleanClippingResult = 1040;
/**
 * The IfcBooleanResult is the result of applying a Boolean operation to two operands being solids.
 */
export declare const IfcBooleanResult = 1041;
/**
 * The abstract entity IfcBoundaryCondition is the supertype of all boundary conditions that can be applied to structural connection definitions, either directly for the connection (e.g. the joint) or for the relation between a structural member and the connection.
 */
export declare const IfcBoundaryCondition = 1042;
/**
 * An IfcBoundaryCurve defines a curve acting as the boundary of a surface.
 */
export declare const IfcBoundaryCurve = 1043;
/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export declare const IfcBoundaryEdgeCondition = 1044;
/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export declare const IfcBoundaryFaceCondition = 1045;
/**
 * Describes linearly elastic support conditions or connection conditions.
 */
export declare const IfcBoundaryNodeCondition = 1046;
/**
 * Describes linearly elastic support conditions or connection conditions, including linearly elastic warping restraints.
 */
export declare const IfcBoundaryNodeConditionWarping = 1047;
/**
 * An IfcBoundedCurve is a curve of finite length.
 */
export declare const IfcBoundedCurve = 1048;
/**
 * An IfcBoundedSurface is a surface of finite area.
 */
export declare const IfcBoundedSurface = 1049;
/**
 * The IfcBoundingBox defines an orthogonal box oriented parallel to the axes of the object coordinate system in which it is defined. It is defined by a Corner being a three-dimensional Cartesian point and three length measures defining the X, Y and Z parameters of the box in the direction of the positive axes.
 */
export declare const IfcBoundingBox = 1050;
/**
 * The IfcBoxedHalfSpace is used (as its supertype IfcHalfSpaceSolid) only within Boolean operations. It divides the domain into exactly two subsets, where the domain in question is that of the attribute Enclosure.
 */
export declare const IfcBoxedHalfSpace = 1051;
/**
 * The IfcBSplineCurve is a spline curve parameterized by spline functions.
 */
export declare const IfcBSplineCurve = 1052;
/**
 * The IfcBSplineCurveWithKnots is a spline curve parameterized by spline functions for which the knot values are explicitly given.
 */
export declare const IfcBSplineCurveWithKnots = 1053;
/**
 * The IfcBSplineSurface is a general form of rational or polynomial parametric surface.
 */
export declare const IfcBSplineSurface = 1054;
/**
 * The IfcBSplineSurfaceWithKnots is a general form of rational or polynomial parametric surface in which the knot values are explicitly given.
 */
export declare const IfcBSplineSurfaceWithKnots = 1055;
/**
 * A building represents a structure that provides shelter for its occupants or contents and stands in one place. The building is also used to provide a basic element within the spatial structure hierarchy for the components of a building project (together with site, storey, and space).
 */
export declare const IfcBuilding = 1056;
/**
 * IfcBuildingElementPart represents major components as subordinate parts of a building element. Typical usage examples include precast concrete sandwich walls, where the layers may have different geometry representations. In this case the layered material representation does not sufficiently describe the element. Each layer is represented by an own instance of the IfcBuildingElementPart with its own geometry description.
 */
export declare const IfcBuildingElementPart = 1057;
/**
 * The building element part type defines lists of commonly shared property set definitions and representation maps of parts of a building element.
 */
export declare const IfcBuildingElementPartType = 1058;
/**
 * The IfcBuildingElementProxy is a proxy definition that provides the same functionality as subtypes of IfcBuildingElement, but without having a predefined meaning of the special type of building element, it represents.
 */
export declare const IfcBuildingElementProxy = 1059;
/**
 * IfcBuildingElementProxyType defines a list of commonly shared property set definitions of a building element proxy and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcBuildingElementProxyType = 1060;
/**
 * The building storey has an elevation and typically represents a (nearly) horizontal aggregation of spaces that are vertically bound.
 */
export declare const IfcBuildingStorey = 1061;
/**
 * A building system is a group by which building elements are grouped according to a kdtree3 function within the facility.
 */
export declare const IfcBuildingSystem = 1062;
/**
 * A burner is a device that converts fuel into heat through combustion. It includes gas, oil, and wood burners.
 */
export declare const IfcBurner = 1063;
/**
 * The energy conversion device type IfcBurnerType defines commonly shared information for occurrences of burners. The set of shared information may include:
 */
export declare const IfcBurnerType = 1064;
/**
 * A cable carrier fitting is a fitting that is placed at junction or transition in a cable carrier system.
 */
export declare const IfcCableCarrierFitting = 1065;
/**
 * The flow fitting type IfcCableCarrierFittingType defines commonly shared information for occurrences of cable carrier fittings. The set of shared information may include:
 */
export declare const IfcCableCarrierFittingType = 1066;
/**
 * A cable carrier segment is a flow segment that is specifically used to carry and support cabling.
 */
export declare const IfcCableCarrierSegment = 1067;
/**
 * The flow segment type IfcCableCarrierSegmentType defines commonly shared information for occurrences of cable carrier segments. The set of shared information may include:
 */
export declare const IfcCableCarrierSegmentType = 1068;
/**
 * A cable fitting is a fitting that is placed at a junction, transition or termination in a cable system.
 */
export declare const IfcCableFitting = 1069;
/**
 * The flow fitting type IfcCableFittingType defines commonly shared information for occurrences of cable fittings. The set of shared information may include:
 */
export declare const IfcCableFittingType = 1070;
/**
 * A cable segment is a flow segment used to carry electrical power, data, or telecommunications signals.
 */
export declare const IfcCableSegment = 1071;
/**
 * The flow segment type IfcCableSegmentType defines commonly shared information for occurrences of cable segments. The set of shared information may include:
 */
export declare const IfcCableSegmentType = 1072;
/**
 * An IfcCartesianPoint defines a point by coordinates in an orthogonal, right-handed Cartesian coordinate system. For the purpose of this specification only two and three dimensional Cartesian points are used.
 */
export declare const IfcCartesianPoint = 1073;
/**
 * The IfcCartesianPointList is the abstract supertype of list of points.
 */
export declare const IfcCartesianPointList = 1074;
/**
 * The IfcCartesianPointList2D defines an ordered collection of two-dimentional Cartesian points. Each Cartesian point is provided as an two-dimensional point by a fixed list of two coordinates. The attribute CoordList is a two-dimensional list, where
 */
export declare const IfcCartesianPointList2D = 1075;
/**
 * The IfcCartesianPointList3D defines an ordered collection of three-dimentional Cartesian points. Each Cartesian point is provided as an three-dimensional point by a fixed list of three coordinates. The attribute CoordList is a two-dimensional list, where
 */
export declare const IfcCartesianPointList3D = 1076;
/**
 * An IfcCartesianTransformationOperator defines an abstract supertype of different kinds of geometric transformations.
 */
export declare const IfcCartesianTransformationOperator = 1077;
/**
 * An IfcCartesianTransformationOperator2D defines a geometric transformation in two-dimensional space.
 */
export declare const IfcCartesianTransformationOperator2D = 1078;
/**
 * A Cartesian transformation operator 2d non uniform defines a geometric transformation in two-dimensional space composed of translation, rotation, mirroring and non uniform scaling. Non uniform scaling is given by two different scaling factors:
 */
export declare const IfcCartesianTransformationOperator2DnonUniform = 1079;
/**
 * An IfcCartesianTransformationOperator defines a geometric transformation in three-dimensional space.
 */
export declare const IfcCartesianTransformationOperator3D = 1080;
/**
 * A Cartesian transformation operator 3d non uniform defines a geometric transformation in three-dimensional space composed of translation, rotation, mirroring and non uniform scaling. Non uniform scaling is given by three different scaling factors:
 */
export declare const IfcCartesianTransformationOperator3DnonUniform = 1081;
/**
 * The profile IfcCenterLineProfileDef defines an arbitrary two-dimensional open, not self intersecting profile for the use within the swept solid geometry. It is given by an area defined by applying a constant thickness to a centerline, generating an area from which the solid can be constructed.
 */
export declare const IfcCenterLineProfileDef = 1082;
/**
 * A chiller is a device used to remove heat from a liquid via a vapor-compression or absorption refrigeration cycle to cool a fluid, typically water or a mixture of water and glycol. The chilled fluid is then used to cool and dehumidify air in a building.
 */
export declare const IfcChiller = 1083;
/**
 * The energy conversion device type IfcChillerType defines commonly shared information for occurrences of chillers. The set of shared information may include:
 */
export declare const IfcChillerType = 1084;
/**
 * Chimneys are typically vertical, or as near as vertical, parts of the construction of a building and part of the building fabric. Often constructed by pre-cast or insitu concrete, today seldom by bricks.
 */
export declare const IfcChimney = 1085;
/**
 * The building element type IfcChimneyType defines commonly shared information for occurrences of chimneys. The set of shared information may include:
 */
export declare const IfcChimneyType = 1086;
/**
 * An IfcCircle is a curve consisting of a set of points having equal distance from the center.
 */
export declare const IfcCircle = 1087;
/**
 * IfcCircleHollowProfileDef defines a section profile that provides the defining parameters of a circular hollow section (tube) to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration.The centre of the position coordinate system is in the profile's centre of the bounding box (for symmetric profiles identical with the centre of gravity).
 */
export declare const IfcCircleHollowProfileDef = 1088;
/**
 * IfcCircleProfileDef defines a circle as the profile definition used by the swept surface geometry or by the swept area solid. It is given by its Radius attribute and placed within the 2D position coordinate system, established by the Position attribute.
 */
export declare const IfcCircleProfileDef = 1089;
/**
 * An IfcCivilElement is a generalization of all elements within a civil engineering works that cannot be represented as BuildingElements, DistributionElements or GeographicElements. Depending on the context of the construction project, included building work, such as buildings or factories, are represented as a collection of IfcBuildingElement's, distribution systems, such as piping or drainage, are represented as a collection of IfcDistributionElement's, and other geographic elements, such as trees, light posts, traffic signs etc. are represented as IfcGeographicElement's.
 */
export declare const IfcCivilElement = 1090;
/**
 * An IfcCivilElementType is used to define an element specification of an element used within civil engineering works. Civil element types include for different types of element that may be used to represent information for construction works external to a building. IfcCivilElementType's may include:
 */
export declare const IfcCivilElementType = 1091;
/**
 * An IfcClassification is used for the arrangement of objects into a class or category according to a kdtree3 purpose or their possession of kdtree3 characteristics. A classification in the sense of IfcClassification is taxonomy, or taxonomic scheme, arranged in a hierarchical structure. A category of objects relates to other categories in a generalization-specialization relationship. Therefore the classification items in an classification are organized in a tree structure.
 */
export declare const IfcClassification = 1092;
/**
 * An IfcClassificationReference is a reference into a classification system or source (see IfcClassification) for a specific classification key (or notation).
 */
export declare const IfcClassificationReference = 1093;
/**
 *
 */
export declare const IfcClosedShell = 1094;
/**
 * A coil is a device used to provide heat transfer between non-mixing media. A kdtree3 example is a cooling coil, which utilizes a finned coil in which circulates chilled water, antifreeze, or refrigerant that is used to remove heat from air moving across the surface of the coil. A coil may be used either for heating or cooling purposes by placing a series of tubes (the coil) carrying a heating or cooling fluid into an airstream. The coil may be constructed from tubes bundled in a serpentine form or from finned tubes that give a extended heat transfer surface.
 */
export declare const IfcCoil = 1095;
/**
 * The energy conversion device type IfcCoilType defines commonly shared information for occurrences of coils. The set of shared information may include:
 */
export declare const IfcCoilType = 1096;
/**
 *
 */
export declare const IfcColourRgb = 1097;
/**
 * The IfcColourRgbList defines an ordered collection of RGB colour values. Each colour value is a fixed list of three colour components (red, green, blue). The attribute ColourList is a two-dimensional list, where:
 */
export declare const IfcColourRgbList = 1098;
/**
 *
 */
export declare const IfcColourSpecification = 1099;
/**
 * <An IfcColumn is a vertical structural member which often is aligned with a structural grid intersection. It represents a vertical, or nearly vertical, structural member that transmits, through compression, the weight of the structure above to other structural elements below. It represents such a member from an architectural point of view. It is not required to be load bearing.
 */
export declare const IfcColumn = 1100;
/**
 * The standard column, IfcColumnStandardCase, defines a column with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcColumnStandardCase handles all cases of columns, that:
 */
export declare const IfcColumnStandardCase = 1101;
/**
 * The element type IfcColumnType defines commonly shared information for occurrences of columns. The set of shared information may include:
 */
export declare const IfcColumnType = 1102;
/**
 * A communications appliance transmits and receives electronic or digital information as data or sound.
 */
export declare const IfcCommunicationsAppliance = 1103;
/**
 * The flow terminal type IfcCommunicationsApplianceType defines commonly shared information for occurrences of communications appliances. The set of shared information may include:
 */
export declare const IfcCommunicationsApplianceType = 1104;
/**
 * IfcComplexProperty is used to define complex properties to be handled completely within a property set. The included set of properties may be a mixed or consistent collection of IfcProperty subtypes. This enables the definition of a set of properties to be included as a single 'property' entry in an IfcPropertySet. The definition of such an IfcComplexProperty can be reused in many different IfcPropertySet's.
 */
export declare const IfcComplexProperty = 1105;
/**
 * The IfcComplexPropertyTemplate defines the template for all complex properties, either the IfcComplexProperty's, or the IfcPhysicalComplexQuantity's. The individual complex property templates are interpreted according to their Name attribute and and optional UsageName attribute.
 */
export declare const IfcComplexPropertyTemplate = 1106;
/**
 * An IfcCompositeCurve is a continuous curve composed of curve segments.
 */
export declare const IfcCompositeCurve = 1107;
/**
 * The IfcCompositeCurveOnSurface is a collection of segments, based on p-curves. i.e. a curve which lies on the basis of a surface and is defined in the parameter space of that surface. The p-curve segment is a special type of a composite curve segment and shall only be used to bound a surface.
 */
export declare const IfcCompositeCurveOnSurface = 1108;
/**
 * An IfcCompositeCurveSegment is a bounded curve constructed for the sole purpose to be a segment within an IfcCompositeCurve.
 */
export declare const IfcCompositeCurveSegment = 1109;
/**
 * The IfcCompositeProfileDef defines the profile by composition of other profiles. The composition is given by a set of at least two other profile definitions. Any profile definition (except for another composite profile) can be used to construct the composite.
 */
export declare const IfcCompositeProfileDef = 1110;
/**
 * A compressor is a device that compresses a fluid typically used in a refrigeration circuit.
 */
export declare const IfcCompressor = 1111;
/**
 * The flow moving device type IfcCompressorType defines commonly shared information for occurrences of compressors. The set of shared information may include:
 */
export declare const IfcCompressorType = 1112;
/**
 * A condenser is a device that is used to dissipate heat, typically by condensing a substance such as a refrigerant from its gaseous to its liquid state.
 */
export declare const IfcCondenser = 1113;
/**
 * The energy conversion device type IfcCondenserType defines commonly shared information for occurrences of condensers. The set of shared information may include:
 */
export declare const IfcCondenserType = 1114;
/**
 * An IfcConic is a parameterized planar curve.
 */
export declare const IfcConic = 1115;
/**
 *
 */
export declare const IfcConnectedFaceSet = 1116;
/**
 * IfcConnectionCurveGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a curve or at an edge with curve geometry associated. It is envisioned as a control that applies to the element connection relationships.
 */
export declare const IfcConnectionCurveGeometry = 1117;
/**
 * IfcConnectionGeometry is used to describe the geometric and topological constraints that facilitate the physical connection of two objects. It is envisioned as a control that applies to the element connection relationships.
 */
export declare const IfcConnectionGeometry = 1118;
/**
 * IfcConnectionPointEccentricity is used to describe the geometric constraints that facilitate the physical connection of two objects at a point or vertex point with associated point coordinates. There is a physical distance, or eccentricity, etween the connection points of both object. The eccentricity can be either given by:
 */
export declare const IfcConnectionPointEccentricity = 1119;
/**
 * IfcConnectionPointGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a point (here IfcCartesianPoint) or at an vertex with point coordinates associated. It is envisioned as a control that applies to the element connection relationships.
 */
export declare const IfcConnectionPointGeometry = 1120;
/**
 * IfcConnectionSurfaceGeometry is used to describe the geometric constraints that facilitate the physical connection of two objects at a surface or at a face with surface geometry associated. It is envisioned as a control that applies to the element connection relationships.
 */
export declare const IfcConnectionSurfaceGeometry = 1121;
/**
 * IfcConnectionVolumeGeometry is used to describe the geometric constraints that facilitate the physical connection (or overlap) of two objects at a volume defined by a solid or closed shell. It is envisioned as a control that applies to the element connection or interference relationships.
 */
export declare const IfcConnectionVolumeGeometry = 1122;
/**
 * An IfcConstraint is used to define a constraint or limiting value or boundary condition that may be applied to an object or to the value of a property.
 */
export declare const IfcConstraint = 1123;
/**
 * IfcConstructionEquipmentResource is usage of construction equipment to assist in the performance of construction. Construction Equipment resources are wholly or partially consumed or occupied in the performance of construction.
 */
export declare const IfcConstructionEquipmentResource = 1124;
/**
 * The resource type IfcConstructionEquipmentType defines commonly shared information for occurrences of construction equipment resources. The set of shared information may include:
 */
export declare const IfcConstructionEquipmentResourceType = 1125;
/**
 * IfcConstructionMaterialResource identifies a material resource type in a construction project.
 */
export declare const IfcConstructionMaterialResource = 1126;
/**
 * The resource type IfcConstructionMaterialType defines commonly shared information for occurrences of construction material resources. The set of shared information may include:
 */
export declare const IfcConstructionMaterialResourceType = 1127;
/**
 * IfcConstructionProductResource defines the role of a product that is consumed (wholly or partially), or occupied in the performance of construction.
 */
export declare const IfcConstructionProductResource = 1128;
/**
 * The resource type IfcConstructionProductType defines commonly shared information for occurrences of construction product resources. The set of shared information may include:
 */
export declare const IfcConstructionProductResourceType = 1129;
/**
 * IfcConstructionResource is an abstract generalization of the different resources used in construction projects, mainly labour, material, equipment and product resources, plus subcontracted resources and aggregations such as a crew resource.
 */
export declare const IfcConstructionResource = 1130;
/**
 * IfcConstructionResourceType is an abstract generalization of the different resource types used in construction projects, mainly labor, material, equipment and product resource types, plus subcontracted resource types and aggregations such as a crew resource type.
 */
export declare const IfcConstructionResourceType = 1131;
/**
 * IfcContext is the generalization of a project context in which objects, type objects, property sets, and properties are defined. The IfcProject as subtype of IfcContext provides the context for all information on a construction project, it may include one or several IfcProjectLibrary's as subtype of IfcContext to register the included libraries for the project. A library of products that is referenced is declared within the IfcProjectLibrary as the context of that library.
 */
export declare const IfcContext = 1132;
/**
 *
 */
export declare const IfcContextDependentUnit = 1133;
/**
 * IfcControl is the abstract generalization of all concepts that control or constrain the utilization of products, processes, or resources in general. It can be seen as a regulation, cost schedule, request or order, or other requirements applied to a product, process or resource whose requirements and provisions must be fulfilled.
 */
export declare const IfcControl = 1134;
/**
 * A controller is a device that monitors inputs and controls outputs within a building automation system.
 */
export declare const IfcController = 1135;
/**
 * The distribution control element type IfcControllerType defines commonly shared information for occurrences of controllers. The set of shared information may include:
 */
export declare const IfcControllerType = 1136;
/**
 * An IfcConversionBasedUnit is used to define a unit that has a conversion rate to a base unit. To identify some commonly used conversion based units, the standard designations (case insensitive) for the Name attribute are indicated in Table 696.
 */
export declare const IfcConversionBasedUnit = 1137;
/**
 * IfcConversionBasedUnitWithOffset is a unit which is converted from another unit by applying a conversion factor and an offset.
 */
export declare const IfcConversionBasedUnitWithOffset = 1138;
/**
 * A cooled beam (or chilled beam) is a device typically used to cool air by circulating a fluid such as chilled water through exposed finned tubes above a space. Typically mounted overhead near or within a ceiling, the cooled beam uses convection to cool the space below it by acting as a heat sink for the naturally rising warm air of the space. Once cooled, the air naturally drops back to the floor where the cycle begins again.
 */
export declare const IfcCooledBeam = 1139;
/**
 * The energy conversion device type IfcCooledBeamType defines commonly shared information for occurrences of cooled beams. The set of shared information may include:
 */
export declare const IfcCooledBeamType = 1140;
/**
 * A cooling tower is a device which rejects heat to ambient air by circulating a fluid such as water through it to reduce its temperature by partial evaporation.
 */
export declare const IfcCoolingTower = 1141;
/**
 * The energy conversion device type IfcCoolingTowerType defines commonly shared information for occurrences of cooling towers. The set of shared information may include:
 */
export declare const IfcCoolingTowerType = 1142;
/**
 * The coordinate operation is an abstract supertype to handle any operation (transformation or conversion) between two coordinate reference systems. It is meant to provide expandability for future versions, since currently only the conversion of a local engineering coordinate system into a map coordinate reference system is dealt with by the subtype IfcMapConversion.
 */
export declare const IfcCoordinateOperation = 1143;
/**
 * The IfcCoordinateReferenceSystem is a definition of a coordinate reference system by means of qualified identifiers only. The interpretation of the identifier is expected to be well-known to the receiving software.
 */
export declare const IfcCoordinateReferenceSystem = 1144;
/**
 * An IfcCostItem describes a cost or financial value together with descriptive information that describes its context in a form that enables it to be used within a cost schedule. An IfcCostItem can be used to represent the cost of goods and services, the execution of works by a process, lifecycle cost and more.
 */
export declare const IfcCostItem = 1145;
/**
 * An IfcCostSchedule brings together instances of IfcCostItem either for the purpose of identifying purely cost information as in an estimate for constructions costs or for including cost information within another presentation form such as a work order.
 */
export declare const IfcCostSchedule = 1146;
/**
 * IfcCostValue is an amount of money or a value that affects an amount of money.
 */
export declare const IfcCostValue = 1147;
/**
 * A covering is an element which covers some part of another element and is fully dependent on that other element. The IfcCovering defines the occurrence of a covering type, that (if given) is expressed by the IfcCoveringType.
 */
export declare const IfcCovering = 1148;
/**
 * The element type IfcCoveringType defines commonly shared information for occurrences of coverings. The set of shared information may include:
 */
export declare const IfcCoveringType = 1149;
/**
 * IfcCrewResource represents a collection of internal resources used in construction processes.
 */
export declare const IfcCrewResource = 1150;
/**
 * The resource type IfcCrewResourceType defines commonly shared information for occurrences of crew resources. The set of shared information may include:
 */
export declare const IfcCrewResourceType = 1151;
/**
 * IfcCsgPrimitive3D is an abstract supertype of all three dimensional primitives used as either tree root item, or as Boolean results within a CSG solid model. All 3D CSG primitives are defined within a three-dimensional placement coordinate system.
 */
export declare const IfcCsgPrimitive3D = 1152;
/**
 * An IfcCsgSolid is the representation of a 3D shape using constructive solid geometry model. It is represented by a single 3D CSG primitive, or as a result of a Boolean operation. The operants of a Boolean operation can be Boolean operations themselves forming a CSG tree. The following volumes can be parts of the CSG tree:
 */
export declare const IfcCsgSolid = 1153;
/**
 * IfcCShapeProfileDef defines a section profile that provides the defining parameters of a C-shaped section to be used by the swept area solid. This section is typically produced by cold forming steel. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export declare const IfcCShapeProfileDef = 1154;
/**
 * IfcCurrencyRelationship defines the rate of exchange that applies between two designated currencies at a particular time and as published by a particular source.
 */
export declare const IfcCurrencyRelationship = 1155;
/**
 * A curtain wall is an exterior wall of a building which is an assembly of components, hung from the edge of the floor/roof structure rather than bearing on a floor. Curtain wall is represented as a building element assembly and implemented as a subtype of IfcBuildingElement that uses an IfcRelAggregates relationship.
 */
export declare const IfcCurtainWall = 1156;
/**
 * The building element type IfcCurtainWallType defines commonly shared information for occurrences of curtain walls. The set of shared information may include:
 */
export declare const IfcCurtainWallType = 1157;
/**
 * An IfcCurve is a curve in two-dimensional or three-dimensional space. It includes definitions for bounded and unbounded curves.
 */
export declare const IfcCurve = 1158;
/**
 * The IfcCurveBoundedPlane is a parametric planar surface with curved boundaries defined by one or more boundary curves. The bounded plane is defined to be the portion of the basis surface in the direction of N x T from any point on the boundary, where N is the surface normal and T the boundary curve tangent vector at this point. The region so defined shall be arcwise connected.
 */
export declare const IfcCurveBoundedPlane = 1159;
/**
 * The IfcCurveBoundedSurface is a parametric surface with boundaries defined by p-curves, that is, a curve which lies on the basis of a surface and is defined in the parameter space of that surface. The p-curve is a special type of a composite curve segment and shall only be used to bound a surface.
 */
export declare const IfcCurveBoundedSurface = 1160;
/**
 * An IfcCurveStyle provides the style table for presentation information assigned to geometric curves. The style is defined by a color, a font and a width. The IfcCurveStyle defines curve patterns as model patterns, that is, the distance between visible and invisible segments of curve patterns are given in model space dimensions (that have to be scaled using the target plot scale).
 */
export declare const IfcCurveStyle = 1161;
/**
 *
 */
export declare const IfcCurveStyleFont = 1162;
/**
 * The IfcCurveStyleFontAndScaling allows for the reuse of the same curve style definition in several sizes. The definition of the CurveFontScale is the scaling of a base curve style pattern to be used as a new or derived curve style pattern.
 */
export declare const IfcCurveStyleFontAndScaling = 1163;
/**
 *
 */
export declare const IfcCurveStyleFontPattern = 1164;
/**
 * The cylindrical surface is a surface unbounded in the direction of z. Bounded cylindrical surfaces are defined by using a subtype of IfcBoundedSurface with BasisSurface being a cylindrical surface.
 */
export declare const IfcCylindricalSurface = 1165;
/**
 * A damper typically participates in an HVAC duct distribution system and is used to control or modulate the flow of air.
 */
export declare const IfcDamper = 1166;
/**
 * The flow controller type IfcDamperType defines commonly shared information for occurrences of dampers. The set of shared information may include:
 */
export declare const IfcDamperType = 1167;
/**
 * IfcDerivedProfileDef defines the profile by transformation from the parent profile. The transformation is given by a two dimensional transformation operator. Transformation includes translation, rotation, mirror and scaling. The latter can be uniform or non uniform. The derived profiles may be used to define swept surfaces, swept area solids or sectioned spines.
 */
export declare const IfcDerivedProfileDef = 1168;
/**
 *
 */
export declare const IfcDerivedUnit = 1169;
/**
 *
 */
export declare const IfcDerivedUnitElement = 1170;
/**
 *
 */
export declare const IfcDimensionalExponents = 1171;
/**
 * The IfcDirection provides a direction in two or three dimensional space depending on the number of DirectionRatio's provided. The IfcDirection does not imply a vector length, and the direction ratios does not have to be normalized.
 */
export declare const IfcDirection = 1172;
/**
 * A discrete accessory is a representation of different kinds of accessories included in or added to elements.
 */
export declare const IfcDiscreteAccessory = 1173;
/**
 * The element component type IfcDiscreteAccessoryType defines commonly shared information for occurrences of discrete accessorys. The set of shared information may include:
 */
export declare const IfcDiscreteAccessoryType = 1174;
/**
 * A distribution chamber element defines a place at which distribution systems and their constituent elements may be inspected or through which they may travel.
 */
export declare const IfcDistributionChamberElement = 1175;
/**
 * The distribution flow element type IfcDistributionChamberElementType defines commonly shared information for occurrences of distribution chamber elements. The set of shared information may include:
 */
export declare const IfcDistributionChamberElementType = 1176;
/**
 * A distribution circuit is a partition of a distribution system that is conditionally switched such as an electrical circuit.
 */
export declare const IfcDistributionCircuit = 1177;
/**
 * The distribution element IfcDistributionControlElement defines occurrence elements of a building automation control system that are used to impart control over elements of a distribution system.
 */
export declare const IfcDistributionControlElement = 1178;
/**
 * The element type IfcDistributionControlElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcDistributionControlElementType = 1179;
/**
 * This IfcDistributionElement is a generalization of all elements that participate in a distribution system. Typical examples of IfcDistributionElement's are (among others):
 */
export declare const IfcDistributionElement = 1180;
/**
 * The IfcDistributionElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcDistributionElementType = 1181;
/**
 * The distribution element IfcDistributionFlowElement defines occurrence elements of a distribution system that facilitate the distribution of energy or matter, such as air, water or power.
 */
export declare const IfcDistributionFlowElement = 1182;
/**
 * The element type IfcDistributionFlowElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcDistributionFlowElementType = 1183;
/**
 * A distribution port is an inlet or outlet of a product through which a particular substance may flow.
 */
export declare const IfcDistributionPort = 1184;
/**
 * A distribution system is a network designed to receive, store, maintain, distribute, or control the flow of a distribution media. A kdtree3 example is a heating hot water system that consists of a pump, a tank, and an interconnected piping system for distributing hot water to terminals.
 */
export declare const IfcDistributionSystem = 1185;
/**
 * IfcDocumentInformation captures "metadata" of an external document. The actual content of the document is not defined in this specification; instead, it can be found following the Location attribute.
 */
export declare const IfcDocumentInformation = 1186;
/**
 * An IfcDocumentInformationRelationship is a relationship entity that enables a document to have the ability to reference other documents. It is used to describe relationships in which one document may reference one or more other sub documents or where a document is used as a replacement for another document (but where both the original and the replacing document need to be retained).
 */
export declare const IfcDocumentInformationRelationship = 1187;
/**
 * An IfcDocumentReference is a reference to the location of a document. The reference is given by a system interpretable Location attribute (a URL string) where the document can be found, and an optional inherited internal reference Identification, which refers to a system interpretable position within the document. The optional inherited Name attribute is meant to have meaning for human readers. Optional document metadata can also be captured through reference to IfcDocumentInformation.
 */
export declare const IfcDocumentReference = 1188;
/**
 * The door is a built element that is predominately used to provide controlled access for people, goods, animals and vehicles. It includes constructions with hinged, pivoted, sliding, and additionally revolving and folding operations. REMOVE: A door consists of a lining and one or several panels.
 */
export declare const IfcDoor = 1189;
/**
 * The door lining is the frame which enables the door leaf to be fixed in position. The door lining is used to hang the door leaf. The parameters of the door lining define the geometrically relevant parameter of the lining.
 */
export declare const IfcDoorLiningProperties = 1190;
/**
 * A door panel is normally a door leaf that opens to allow people or goods to pass. The parameters of the door panel define the geometrically relevant parameter of the panel,
 */
export declare const IfcDoorPanelProperties = 1191;
/**
 * The standard door, IfcDoorStandardCase, defines a door with certain constraints for the provision of operation types, opening directions, frame and lining parameters, and with certain constraints for the geometric representation. The IfcDoorStandardCase handles all cases of doors, that:
 */
export declare const IfcDoorStandardCase = 1192;
/**
 * Definition: The door style, IfcDoorStyle, defines a particular style of doors, which may be included into the spatial context of the building model through instances of IfcDoor. A door style defines the overall parameter of the door style and refers to the particular parameter of the lining and one (or several) panels through the IfcDoorLiningProperties and the IfcDoorPanelProperties.
 */
export declare const IfcDoorStyle = 1193;
/**
 * The element type IfcDoorType defines commonly shared information for occurrences of doors. The set of shared information may include:
 */
export declare const IfcDoorType = 1194;
/**
 * The draughting pre defined colour is a pre defined colour for the purpose to identify a colour by name. Allowable names are:
 */
export declare const IfcDraughtingPreDefinedColour = 1195;
/**
 * The draughting predefined curve font type defines a selection of widely used curve fonts for draughting purposes by name.
 */
export declare const IfcDraughtingPreDefinedCurveFont = 1196;
/**
 * A duct fitting is a junction or transition in a ducted flow distribution system or used to connect duct segments, resulting in changes in flow characteristics to the fluid such as direction and flow rate.
 */
export declare const IfcDuctFitting = 1197;
/**
 * The flow fitting type IfcDuctFittingType defines commonly shared information for occurrences of duct fittings. The set of shared information may include:
 */
export declare const IfcDuctFittingType = 1198;
/**
 * A duct segment is used to typically join two sections of duct network.
 */
export declare const IfcDuctSegment = 1199;
/**
 * The flow segment type IfcDuctSegmentType defines commonly shared information for occurrences of duct segments. The set of shared information may include:
 */
export declare const IfcDuctSegmentType = 1200;
/**
 * A duct silencer is a device that is typically installed inside a duct distribution system for the purpose of reducing the noise levels from air movement, fan noise, etc. in the adjacent space or downstream of the duct silencer device.
 */
export declare const IfcDuctSilencer = 1201;
/**
 * The flow treatment device type IfcDuctSilencerType defines commonly shared information for occurrences of duct silencers. The set of shared information may include:
 */
export declare const IfcDuctSilencerType = 1202;
/**
 * An IfcEdge defines two vertices being connected topologically. The geometric representation of the connection between the two vertices defaults to a straight line if no curve geometry is assigned using the subtype IfcEdgeCurve. The IfcEdge can therefore be used to exchange straight edges without an associated geometry provided by IfcLine or IfcPolyline thought IfcEdgeCurve.EdgeGeometry.
 */
export declare const IfcEdge = 1203;
/**
 * An IfcEdgeCurve defines two vertices being connected topologically including the geometric representation of the connection.
 */
export declare const IfcEdgeCurve = 1204;
/**
 *
 */
export declare const IfcEdgeLoop = 1205;
/**
 * An electric appliance is a device intended for consumer usage that is powered by electricity.
 */
export declare const IfcElectricAppliance = 1206;
/**
 * The flow terminal type IfcElectricApplianceType defines commonly shared information for occurrences of electric appliances. The set of shared information may include:
 */
export declare const IfcElectricApplianceType = 1207;
/**
 * A distribution board is a flow controller in which instances of electrical devices are brought together at a single place for a particular purpose.
 */
export declare const IfcElectricDistributionBoard = 1208;
/**
 * The flow controller type IfcElectricDistributionBoardType defines commonly shared information for occurrences of electric distribution boards. The set of shared information may include:
 */
export declare const IfcElectricDistributionBoardType = 1209;
/**
 * An electric flow storage device is a device in which electrical energy is stored and from which energy may be progressively released.
 */
export declare const IfcElectricFlowStorageDevice = 1210;
/**
 * The flow storage device type IfcElectricFlowStorageDeviceType defines commonly shared information for occurrences of electric flow storage devices. The set of shared information may include:
 */
export declare const IfcElectricFlowStorageDeviceType = 1211;
/**
 * An electric generator is an engine that is a machine for converting mechanical energy into electrical energy.
 */
export declare const IfcElectricGenerator = 1212;
/**
 * The energy conversion device type IfcElectricGeneratorType defines commonly shared information for occurrences of electric generators. The set of shared information may include:
 */
export declare const IfcElectricGeneratorType = 1213;
/**
 * An electric motor is an engine that is a machine for converting electrical energy into mechanical energy.
 */
export declare const IfcElectricMotor = 1214;
/**
 * The energy conversion device type IfcElectricMotorType defines commonly shared information for occurrences of electric motors. The set of shared information may include:
 */
export declare const IfcElectricMotorType = 1215;
/**
 * An electric time control is a device that applies control to the provision or flow of electrical energy over time.
 */
export declare const IfcElectricTimeControl = 1216;
/**
 * The flow controller type IfcElectricTimeControlType defines commonly shared information for occurrences of electric time controls. The set of shared information may include:
 */
export declare const IfcElectricTimeControlType = 1217;
/**
 * An element is a generalization of all components that make up an AEC product.
 */
export declare const IfcElement = 1218;
/**
 * An IfcElementarySurface in the kdtree3 supertype of analytical surfaces.
 */
export declare const IfcElementarySurface = 1219;
/**
 * The IfcElementAssembly represents complex element assemblies aggregated from several elements, such as discrete elements, building elements, or other elements.
 */
export declare const IfcElementAssembly = 1220;
/**
 * The IfcElementAssemblyType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcElementAssemblyType = 1221;
/**
 * An element component is a representation for minor items included in, added to or connecting to or between elements, which usually are not of interest from the overall building structure viewpoint. However, these small parts may have vital and load carrying functions within the construction. These items do not provide any actual space boundaries. Typical examples of _IfcElementComponent_s include different kinds of fasteners and various accessories.
 */
export declare const IfcElementComponent = 1222;
/**
 * The element type IfcElementComponentType defines commonly shared information for occurrences of element components. The set of shared information may include:
 */
export declare const IfcElementComponentType = 1223;
/**
 * An IfcElementQuantity defines a set of derived measures of an element's physical property. Elements could be spatial structure elements (like buildings, storeys, or spaces) or building elements (like walls, slabs, finishes). The IfcElementQuantity gets assigned to the element by using the IfcRelDefinesByProperties relationship.
 */
export declare const IfcElementQuantity = 1224;
/**
 * IfcElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcElementType = 1225;
/**
 * An IfcEllipse is a curve consisting of a set of points whose distances to two fixed points add to the same constant.
 */
export declare const IfcEllipse = 1226;
/**
 * IfcEllipseProfileDef defines an ellipse as the profile definition used by the swept surface geometry or the swept area solid. It is given by its semi axis attributes and placed within the 2D position coordinate system, established by the Position attribute.
 */
export declare const IfcEllipseProfileDef = 1227;
/**
 * The distribution flow element IfcEnergyConversionDevice defines the occurrence of a device used to perform energy conversion or heat transfer and typically participates in a flow distribution system. Its type is defined by IfcEnergyConversionDeviceType or its subtypes.
 */
export declare const IfcEnergyConversionDevice = 1228;
/**
 * The element type IfcEnergyConversionType defines a list of commonly shared property set definitions of an energy conversion device and an optional set of product representations. It is used to define an energy conversion device specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcEnergyConversionDeviceType = 1229;
/**
 * An engine is a device that converts fuel into mechanical energy through combustion.
 */
export declare const IfcEngine = 1230;
/**
 * The energy conversion device type IfcEngineType defines commonly shared information for occurrences of engines. The set of shared information may include:
 */
export declare const IfcEngineType = 1231;
/**
 * An evaporative cooler is a device that cools air by saturating it with water vapor.
 */
export declare const IfcEvaporativeCooler = 1232;
/**
 * The energy conversion device type IfcEvaporativeCoolerType defines commonly shared information for occurrences of evaporative coolers. The set of shared information may include:
 */
export declare const IfcEvaporativeCoolerType = 1233;
/**
 * An evaporator is a device in which a liquid refrigerent is vaporized and absorbs heat from the surrounding fluid.
 */
export declare const IfcEvaporator = 1234;
/**
 * The energy conversion device type IfcEvaporatorType defines commonly shared information for occurrences of evaporators. The set of shared information may include:
 */
export declare const IfcEvaporatorType = 1235;
/**
 * An IfcEvent is something that happens that triggers an action or response.
 */
export declare const IfcEvent = 1236;
/**
 * IfcEventTime captures the time-related information about an event including the different types of event dates (i.e. actual, scheduled, early, and late).
 */
export declare const IfcEventTime = 1237;
/**
 * An IfcEventType defines a particular type of event that may be specified.
 */
export declare const IfcEventType = 1238;
/**
 * The IfcExtendedProperties is an abstract supertype of all extensible property collections that are applicable to certain characterized entities. Instantiable subtypes of IfcExtendedProperties assign the property collection to a particular characterized entity.
 */
export declare const IfcExtendedProperties = 1239;
/**
 * An IfcExternalInformation is the identification of an information source that is not explicitly represented in the current model or in the project database (as an implementation of the current model). The IfcExternalInformation identifies the external source (classification, document, or library), but not the particular items such as a dictionary entry, a classification notation, or a document reference within the external source
 */
export declare const IfcExternalInformation = 1240;
/**
 *
 */
export declare const IfcExternallyDefinedHatchStyle = 1241;
/**
 * IfcExternallyDefinedSurfaceStyle is a definition of a surface style through referencing an external source, such as a material library for rendering information.
 */
export declare const IfcExternallyDefinedSurfaceStyle = 1242;
/**
 *
 */
export declare const IfcExternallyDefinedTextFont = 1243;
/**
 * An IfcExternalReference is the identification of information that is not explicitly represented in the current model or in the project database (as an implementation of the current model). Such information may be contained in classifications, documents or libraries. The IfcExternalReference identifies a particular item, such as a dictionary entry, a classification notation, or a document reference within the external source.
 */
export declare const IfcExternalReference = 1244;
/**
 * IfcExternalReferenceRelationship is a relationship entity that enables objects from the IfcResourceObjectSelect to have the ability to be tagged by external references.
 */
export declare const IfcExternalReferenceRelationship = 1245;
/**
 * The external spatial element defines external regions at the building site. Those regions can be defined:
 */
export declare const IfcExternalSpatialElement = 1246;
/**
 * The external spatial structure element is an abstract entity provided for different kind of external spaces, regions, and volumes.
 */
export declare const IfcExternalSpatialStructureElement = 1247;
/**
 * The IfcExtrudedAreaSolid is defined by sweeping a cross section provided by a profile definition. The direction of the extrusion is given by the ExtrudedDirection attribute and the length of the extrusion is given by the Depth attribute. If the planar area has inner boundaries (holes defined), then those holes shall be swept into holes of the solid.
 */
export declare const IfcExtrudedAreaSolid = 1248;
/**
 * IfcExtrudedAreaSolidTapered is defined by sweeping a cross section along a linear spine. The cross section may change along the sweep from the shape of the start cross section into the shape of the end cross section. The resulting solid is bounded by three or more faces: A start face, an end face (each defined by start and end planes and sections), and one or more lateral faces. Each lateral face is a ruled surface defined by a pair of corresponding edges of the start and end section.
 */
export declare const IfcExtrudedAreaSolidTapered = 1249;
/**
 * An IfcFace is topological entity used to define surface, bounded by loops, of a shell.
 */
export declare const IfcFace = 1250;
/**
 * The IfcFaceBasedSurfaceModel represents the a shape by connected face sets. The connected faces have a dimensionality 2 and are placed in a coordinate space of dimensionality 3.
 */
export declare const IfcFaceBasedSurfaceModel = 1251;
/**
 *
 */
export declare const IfcFaceBound = 1252;
/**
 *
 */
export declare const IfcFaceOuterBound = 1253;
/**
 * The IfcFaceSurface defines the underlying geometry of the associated surface to the face.
 */
export declare const IfcFaceSurface = 1254;
/**
 * The IfcFacetedBrep is a manifold solid brep with the restriction that all faces are planar and bounded polygons.
 */
export declare const IfcFacetedBrep = 1255;
/**
 * The IfcFacetedBrepWithVoids is a specialization of a faceted B-rep which contains one or more voids in its interior. The voids are represented as closed shells which are defined so that the shell normal point into the void.
 */
export declare const IfcFacetedBrepWithVoids = 1256;
/**
 * Defines forces at which a support or connection fails.
 */
export declare const IfcFailureConnectionCondition = 1257;
/**
 * A fan is a device which imparts mechanical work on a gas. A typical usage of a fan is to induce airflow in a building services air distribution system.
 */
export declare const IfcFan = 1258;
/**
 * The flow moving device type IfcFanType defines commonly shared information for occurrences of fans. The set of shared information may include:
 */
export declare const IfcFanType = 1259;
/**
 * Representations of fixing parts which are used as fasteners to connect or join elements with other elements. Excluded are mechanical fasteners which are modeled by a separate entity (IfcMechanicalFastener).
 */
export declare const IfcFastener = 1260;
/**
 * The element component type IfcFastenerType defines commonly shared information for occurrences of fasteners. The set of shared information may include:
 */
export declare const IfcFastenerType = 1261;
/**
 * A feature element is a generalization of all existence dependent elements which modify the shape and appearance of the associated master element. The IfcFeatureElement offers the ability to handle shape modifiers as semantic objects within the IFC object model.
 */
export declare const IfcFeatureElement = 1262;
/**
 * A feature element addition is a specialization of the general feature element, that represents an existence dependent element which modifies the shape and appearance of the associated master element. The IfcFeatureElementAddition offers the ability to handle shape modifiers as semantic objects within the IFC object model that add to the shape of the master element.
 */
export declare const IfcFeatureElementAddition = 1263;
/**
 * The IfcFeatureElementSubtraction is specialization of the general feature element, that represents an existence dependent elements which modifies the shape and appearance of the associated master element. The IfcFeatureElementSubtraction offers the ability to handle shape modifiers as semantic objects within the IFC object model that subtract from the shape of the master element.
 */
export declare const IfcFeatureElementSubtraction = 1264;
/**
 * An IfcFillAreaStyle provides the style table for presentation information assigned to annotation fill areas or surfaces for hatching and tiling. The _IfcFillAreaStyle_defines hatches as model hatches, that is, the distance between hatch lines, or the curve patterns of hatch lines are given in model space dimensions (that have to be scaled using the target plot scale). The IfcFillAreaStyle allows for the following combinations of defining the style of hatching and tiling:
 */
export declare const IfcFillAreaStyle = 1265;
/**
 * The IfcFillAreaStyleHatching is used to define simple, vector-based hatching patterns, based on styled straight lines. The curve font, color and thickness is given by the HatchLineAppearance, the angle by the HatchLineAngle and the distance to the next hatch line by StartOfNextHatchLine, being either an offset distance or a vector.
 */
export declare const IfcFillAreaStyleHatching = 1266;
/**
 * The IfcFillAreaStyleTiles defines the filling of an IfcAnnotationFillArea by recurring patterns of styled two dimensional geometry, called a tile. The recurrence pattern is determined by two vectors, that multiply the tile in regular form.
 */
export declare const IfcFillAreaStyleTiles = 1267;
/**
 * A filter is an apparatus used to remove particulate or gaseous matter from fluids and gases.
 */
export declare const IfcFilter = 1268;
/**
 * The flow treatment device type IfcFilterType defines commonly shared information for occurrences of filters. The set of shared information may include:
 */
export declare const IfcFilterType = 1269;
/**
 * A fire suppression terminal has the purpose of delivering a fluid (gas or liquid) that will suppress a fire.
 */
export declare const IfcFireSuppressionTerminal = 1270;
/**
 * The flow terminal type IfcFireSuppressionTerminalType defines commonly shared information for occurrences of fire suppression terminals. The set of shared information may include:
 */
export declare const IfcFireSuppressionTerminalType = 1271;
/**
 * An IfcFixedReferenceSweptAreaSolid is a type of swept area solid which is the result of sweeping an area along a Directrix. The swept area is provided by a subtype of IfcProfileDef. The profile is placed by an implicit cartesian transformation operator at the start point of the sweep, where the profile normal agrees to the tangent of the directrix at this point, and the profile''s x-axis agrees to the FixedReference direction. The orientation of the curve during the sweeping operation is controlled by the FixedReference direction.
 */
export declare const IfcFixedReferenceSweptAreaSolid = 1272;
/**
 * The distribution flow element IfcFlowController defines the occurrence of elements of a distribution system that are used to regulate flow through a distribution system. Examples include dampers, valves, switches, and relays. Its type is defined by IfcFlowControllerType or subtypes.
 */
export declare const IfcFlowController = 1273;
/**
 * The element type IfcFlowControllerType defines a list of commonly shared property set definitions of a flow controller and an optional set of product representations. It is used to define a flow controller specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowControllerType = 1274;
/**
 * The distribution flow element IfcFlowFitting defines the occurrence of a junction or transition in a flow distribution system, such as an elbow or tee. Its type is defined by IfcFlowFittingType or its subtypes.
 */
export declare const IfcFlowFitting = 1275;
/**
 * The element type IfcFlowFittingType defines a list of commonly shared property set definitions of a flow fitting and an optional set of product representations. It is used to define a flow fitting specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowFittingType = 1276;
/**
 * A flow instrument reads and displays the value of a particular property of a system at a point, or displays the difference in the value of a property between two points.
 */
export declare const IfcFlowInstrument = 1277;
/**
 * The distribution control element type IfcFlowInstrumentType defines commonly shared information for occurrences of flow instruments. The set of shared information may include:
 */
export declare const IfcFlowInstrumentType = 1278;
/**
 * A flow meter is a device that is used to measure the flow rate in a system.
 */
export declare const IfcFlowMeter = 1279;
/**
 * The flow controller type IfcFlowMeterType defines commonly shared information for occurrences of flow meters. The set of shared information may include:
 */
export declare const IfcFlowMeterType = 1280;
/**
 * The distribution flow element IfcFlowMovingDevice defines the occurrence of an apparatus used to distribute, circulate or perform conveyance of fluids, including liquids and gases (such as a pump or fan), and typically participates in a flow distribution system. Its type is defined by IfcFlowMovingDeviceType or its subtypes.
 */
export declare const IfcFlowMovingDevice = 1281;
/**
 * The element type IfcFlowMovingDeviceType defines a list of commonly shared property set definitions of a flow moving device and an optional set of product representations. It is used to define a flow moving device specification (i.e. the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowMovingDeviceType = 1282;
/**
 * The distribution flow element IfcFlowSegment defines the occurrence of a segment of a flow distribution system.
 */
export declare const IfcFlowSegment = 1283;
/**
 * The element type IfcFlowSegmentType defines a list of commonly shared property set definitions of a flow segment and an optional set of product representations. It is used to define a flow segment specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowSegmentType = 1284;
/**
 * The distribution flow element IfcFlowStorageDevice defines the occurrence of a device that participates in a distribution system and is used for temporary storage (such as a tank). Its type is defined by IfcFlowStorageDeviceType or its subtypes.
 */
export declare const IfcFlowStorageDevice = 1285;
/**
 * The element type IfcFlowStorageDeviceType defines a list of commonly shared property set definitions of a flow storage device and an optional set of product representations. It is used to define a flow storage device specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowStorageDeviceType = 1286;
/**
 * The distribution flow element IfcFlowTerminal defines the occurrence of a permanently attached element that acts as a terminus or beginning of a distribution system (such as an air outlet, drain, water closet, or sink). A terminal is typically a point at which a system interfaces with an external environment. Its type is defined by IfcFlowTerminalType or its subtypes.
 */
export declare const IfcFlowTerminal = 1287;
/**
 * The element type IfcFlowTerminalType defines a list of commonly shared property set definitions of a flow terminal and an optional set of product representations. It is used to define a flow terminal specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowTerminalType = 1288;
/**
 * The distribution flow element IfcFlowTreatmentDevice defines the occurrence of a device typically used to remove unwanted matter from a fluid, either liquid or gas, and typically participates in a flow distribution system. Its type is defined by IfcFlowTreatmentDeviceType or its subtypes.
 */
export declare const IfcFlowTreatmentDevice = 1289;
/**
 * The element type IfcFlowTreatmentDeviceType defines a list of commonly shared property set definitions of a flow treatment device and an optional set of product representations. It is used to define a flow treatment device specification (the specific product information that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFlowTreatmentDeviceType = 1290;
/**
 * A footing is a part of the foundation of a structure that spreads and transmits the load to the soil. A footing is also characterized as shallow foundation, where the loads are transfered to the ground near the surface.
 */
export declare const IfcFooting = 1291;
/**
 * The building element type IfcFootingType defines commonly shared information for occurrences of footings. The set of shared information may include:
 */
export declare const IfcFootingType = 1292;
/**
 * A furnishing element is a generalization of all furniture related objects. Furnishing objects are characterized as being
 */
export declare const IfcFurnishingElement = 1293;
/**
 * IfcFurnishingElementType defines a list of commonly shared property set definitions of an element and an optional set of product representations. It is used to define an element specification (the specific product information, that is kdtree3 to all occurrences of that product type).
 */
export declare const IfcFurnishingElementType = 1294;
/**
 * Furniture defines complete furnishings such as a table, desk, chair, or cabinet, which may or may not be permanently attached to a building structure.
 */
export declare const IfcFurniture = 1295;
/**
 * The furnishing element type IfcFurnitureType defines commonly shared information for occurrences of furnitures. The set of shared information may include:
 */
export declare const IfcFurnitureType = 1296;
/**
 * An IfcGeographicElement is a generalization of all elements within a geographical landscape. It includes occurrences of typical geographical elements, often referred to as features, such as trees or terrain. Common type information behind several occurrences of IfcGeographicElement is provided by the IfcGeographicElementType.
 */
export declare const IfcGeographicElement = 1297;
/**
 * An IfcGeographicElementType is used to define an element specification of a geographic element (i.e. the specific product information, that is kdtree3 to all occurrences of that product type). Geographic element types include for different types of element that may be used to represent information within a geographical landscape external to a building. Within the world of geographic information they are referred to generally as ''features''. IfcGeographicElementType''s include:
 */
export declare const IfcGeographicElementType = 1298;
/**
 * The IfcGeometricCurveSet is used for the exchange of shape representation consisting of an collection of (2D or 3D) points and curves only.
 */
export declare const IfcGeometricCurveSet = 1299;
/**
 * The IfcGeometricRepresentationContext defines the context that applies to several shape representations of products within a project. It defines the type of the context in which the shape representation is defined, and the numeric precision applicable to the geometric representation items defined in this context. In addition it can be used to offset the project coordinate system from a global point of origin, using the WorldCoordinateSystem attribute. The main representation context may also provide the true north direction, see Figure 426.
 */
export declare const IfcGeometricRepresentationContext = 1300;
/**
 * An IfcGeometricRepresentationItem is the kdtree3 supertype of all geometric items used within a representation. It is positioned within a geometric coordinate system, directly or indirectly through intervening items.
 */
export declare const IfcGeometricRepresentationItem = 1301;
/**
 * IfcGeometricRepresentationSubContext defines the context that applies to several shape representations of a product being a sub context, sharing the WorldCoordinateSystem, CoordinateSpaceDimension, Precision and TrueNorth attributes with the parent IfcGeometricRepresentationContext.
 */
export declare const IfcGeometricRepresentationSubContext = 1302;
/**
 * The IfcGeometricSet is used for the exchange of shape representation consisting of (2D or 3D) points, curves, and surfaces, which do not have a topological structure (such as connected face sets or shells), are not tessellated and are not solid models (such as swept solids, CSG or Brep).
 */
export declare const IfcGeometricSet = 1303;
/**
 * IfcGrid ia a planar design grid defined in 3D space used as an aid in locating structural and design elements. The position of the grid (ObjectPlacement) is defined by a 3D coordinate system (and thereby the design grid can be used in plan, section or in any position relative to the world coordinate system). The position can be relative to the object placement of other products or grids. The XY plane of the 3D coordinate system is used to place the grid axes, which are 2D curves (for example, line, circle, arc, polyline).
 */
export declare const IfcGrid = 1304;
/**
 * An individual axis, IfcGridAxis, is defined in the context of a design grid. The axis definition is based on a curve of dimensionality 2. The grid axis is positioned within the XY plane of the position coordinate system defined by the IfcGrid.
 */
export declare const IfcGridAxis = 1305;
/**
 * IfcGridPlacement provides a specialization of IfcObjectPlacement in which the placement and axis direction of the object coordinate system is defined by a reference to the design grid as defined in IfcGrid.
 */
export declare const IfcGridPlacement = 1306;
/**
 * IfcGroup is an generalization of any arbitrary group. A group is a logical collection of objects. It does not have its own position, nor can it hold its own shape representation. Therefore a group is an aggregation under some non-geometrical / topological grouping aspects.
 */
export declare const IfcGroup = 1307;
/**
 * A half space solid divides the domain into two by a base surface. Normally, the base surface is a plane and devides the infinitive space into two and indicates the side of the half-space by agreeing or disagreeing to the normal of the plane.
 */
export declare const IfcHalfSpaceSolid = 1308;
/**
 * A heat exchanger is a device used to provide heat transfer between non-mixing media such as plate and shell and tube heat exchangers.
 */
export declare const IfcHeatExchanger = 1309;
/**
 * The energy conversion device type IfcHeatExchangerType defines commonly shared information for occurrences of heat exchangers. The set of shared information may include:
 */
export declare const IfcHeatExchangerType = 1310;
/**
 * A humidifier is a device that adds moisture into the air.
 */
export declare const IfcHumidifier = 1311;
/**
 * The energy conversion device type IfcHumidifierType defines commonly shared information for occurrences of humidifiers. The set of shared information may include:
 */
export declare const IfcHumidifierType = 1312;
/**
 * An IfcImageTexture provides a 2-dimensional texture that can be applied to a surface of an geometric item and that provides lighting parameters of a surface onto which it is mapped. The texture is provided as an image file at an external location for which an URL is provided.
 */
export declare const IfcImageTexture = 1313;
/**
 * The IfcIndexedColourMap provides the assignment of colour information to individual faces. It is used for colouring faces of tessellated face sets. The IfcIndexedColourMap defines an index into an indexed list of colour information. The Colours are a two-dimensional list of colours provided by three RGB values. The ColourIndex attribute corresponds to the CoordIndex of the IfcTessellatedFaceSet defining the corresponding index list of faces. The Opacity attribute provides the alpha channel for all faces of the tessellated face set.
 */
export declare const IfcIndexedColourMap = 1314;
/**
 * The IfcIndexedPolyCurve is a bounded curve with only linear and circular arc segments defined by a Cartesian point list and an optional list of segments, providing indices into the Cartesian point list. In the case that the list of Segments is not provided, all points in the IfcCartesianPointList are connected by straight line segments in the order they appear in the IfcCartesianPointList.
 */
export declare const IfcIndexedPolyCurve = 1315;
/**
 * The IfcIndexedPolygonalFace is a compact representation of a planar face being part of a face set. The vertices of the polygonal planar face are provided by 3 or more Cartesian points, defined by indices that point into an IfcCartesianPointList3D, either direcly, or via the PnIndex, if provided at IfcPolygonalFaceSet.
 */
export declare const IfcIndexedPolygonalFace = 1316;
/**
 * The IfcIndexedPolygonalFaceWithVoids is a compact representation of a planar face with inner loops, being part of a face set.
 */
export declare const IfcIndexedPolygonalFaceWithVoids = 1317;
/**
 * The IfcIndexedTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to faces of tessellated face sets.
 */
export declare const IfcIndexedTextureMap = 1318;
/**
 * The IfcIndexedTriangleTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to triangles of the IfcTriangulatedFaceSet.
 */
export declare const IfcIndexedTriangleTextureMap = 1319;
/**
 * An interceptor is a device designed and installed in order to separate and retain deleterious, hazardous or undesirable matter while permitting normal sewage or liquids to discharge into a collection system by gravity.
 */
export declare const IfcInterceptor = 1320;
/**
 * The flow treatment device type IfcInterceptorType defines commonly shared information for occurrences of interceptors. The set of shared information may include:
 */
export declare const IfcInterceptorType = 1321;
/**
 * An IfcIntersectionCurve is a 3-dimensional curve that has two additional representations provided by two pcurves defined within two distinct and intersecting surfaces.
 */
export declare const IfcIntersectionCurve = 1322;
/**
 * An inventory is a list of items within an enterprise.
 */
export declare const IfcInventory = 1323;
/**
 * In an irregular time series, unpredictable bursts of data arrive at unspecified points in time, or most time stamps cannot be characterized by a repeating pattern.
 */
export declare const IfcIrregularTimeSeries = 1324;
/**
 * The IfcIrregularTimeSeriesValue describes a value (or set of values) at a particular time point.
 */
export declare const IfcIrregularTimeSeriesValue = 1325;
/**
 * IfcIShapeProfileDef defines a section profile that provides the defining parameters of an 'I' or 'H' section. The I-shape profile has values for its overall depth, width and its web and flange thicknesses. Additionally a fillet radius, flange edge radius, and flange slope may be given. This profile definition represents an I-section which is symmetrical about its major and minor axes; top and bottom flanges are equal and centred on the web.
 */
export declare const IfcIShapeProfileDef = 1326;
/**
 * A junction box is an enclosure within which cables are connected.
 */
export declare const IfcJunctionBox = 1327;
/**
 * The flow fitting type IfcJunctionBoxType defines commonly shared information for occurrences of junction boxs. The set of shared information may include:
 */
export declare const IfcJunctionBoxType = 1328;
/**
 * An IfcLaborResource is used in construction with particular skills or crafts required to perform certain types of construction or management related work.
 */
export declare const IfcLaborResource = 1329;
/**
 * The resource type IfcLaborResourceType defines commonly shared information for occurrences of labour resources. The set of shared information may include:
 */
export declare const IfcLaborResourceType = 1330;
/**
 * IfcLagTime describes the time parameters that may exist within a sequence relationship between two processes.
 */
export declare const IfcLagTime = 1331;
/**
 * A lamp is an artificial light source such as a light bulb or tube.
 */
export declare const IfcLamp = 1332;
/**
 * The flow terminal type IfcLampType defines commonly shared information for occurrences of lamps. The set of shared information may include:
 */
export declare const IfcLampType = 1333;
/**
 * An IfcLibraryInformation describes a library where a library is a structured store of information, normally organized in a manner which allows information lookup through an index or reference value. IfcLibraryInformation provides the library Name and optional Description, Version, VersionDate and Publisher attributes. A Location may be added for electronic access to the library.
 */
export declare const IfcLibraryInformation = 1334;
/**
 * An IfcLibraryReference is a reference into a library of information by Location (provided as a URI). It also provides an optional inherited Identification key to allow more specific references to library sections or tables. The inherited Name attribute allows for a human interpretable identification of the library item. Also, general information on the library from which the reference is taken, is given by the ReferencedLibrary relation which identifies the relevant occurrence of IfcLibraryInformation.
 */
export declare const IfcLibraryReference = 1335;
/**
 * IfcLightDistributionData defines the luminous intensity of a light source given at a particular main plane angle. It is based on some standardized light distribution curves; the MainPlaneAngle is either the
 */
export declare const IfcLightDistributionData = 1336;
/**
 * A light fixture is a container that is designed for the purpose of housing one or more lamps and optionally devices that control, restrict or vary their emission.
 */
export declare const IfcLightFixture = 1337;
/**
 * The flow terminal type IfcLightFixtureType defines commonly shared information for occurrences of light fixtures. The set of shared information may include:
 */
export declare const IfcLightFixtureType = 1338;
/**
 * IfcLightIntensityDistribution defines the the luminous intensity of a light source that changes according to the direction of the ray. It is based on some standardized light distribution curves, which are defined by the LightDistributionCurve attribute.
 */
export declare const IfcLightIntensityDistribution = 1339;
/**
 *
 */
export declare const IfcLightSource = 1340;
/**
 *
 */
export declare const IfcLightSourceAmbient = 1341;
/**
 *
 */
export declare const IfcLightSourceDirectional = 1342;
/**
 * IfcLightSourceGoniometric defines a light source for which exact lighting data is available. It specifies the type of a light emitter, defines the position and orientation of a light distribution curve and the data concerning lamp and photometric information.
 */
export declare const IfcLightSourceGoniometric = 1343;
/**
 *
 */
export declare const IfcLightSourcePositional = 1344;
/**
 *
 */
export declare const IfcLightSourceSpot = 1345;
/**
 * The IfcLine is an unbounded line parameterized by an IfcCartesianPoint and an IfcVector. The magnitude of the IfcVector affects the parameterization of the line, but it does not bound the line.
 */
export declare const IfcLine = 1346;
/**
 * An IfcLocalPlacement defines the relative placement of a product in relation to the placement of another product or the absolute placement of a product within the geometric representation context of the project.
 */
export declare const IfcLocalPlacement = 1347;
/**
 *
 */
export declare const IfcLoop = 1348;
/**
 * IfcLShapeProfileDef defines a section profile that provides the defining parameters of an L-shaped section (equilateral L profiles are also covered by this entity) to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The shorter leg has the same direction as the positive Position.P[1]-axis, the longer or equal leg the same as the positive Position.P[2]-axis. The centre of the position coordinate system is in the profiles centre of the bounding box.
 */
export declare const IfcLShapeProfileDef = 1349;
/**
 * The IfcManifoldSolidBrep is a solid represented as a collection of connected surfaces that delimit the solid from the surrounding non-solid.
 */
export declare const IfcManifoldSolidBrep = 1350;
/**
 * The map conversion deals with transforming the local engineering coordinate system, often called world coordinate system, into the coordinate reference system of the underlying map.
 */
export declare const IfcMapConversion = 1351;
/**
 * The IfcMappedItem is the inserted instance of a source definition (to be compared with a block / shared cell / macro definition). The instance is inserted by applying a Cartesian transformation operator as the MappingTarget.
 */
export declare const IfcMappedItem = 1352;
/**
 * IfcMaterial is a homogeneous or inhomogeneous substance that can be used to form elements (physical products or their components).
 */
export declare const IfcMaterial = 1353;
/**
 * IfcMaterialClassificationRelationship is a relationship assigning classifications to materials.
 */
export declare const IfcMaterialClassificationRelationship = 1354;
/**
 * IfcMaterialConstituent is a single and identifiable part of an element which is constructed of a number of part (one or more) each having an individual material. The association of the material constituent to the part is provided by a keyword as value of the Name attribute. In order to identify and distinguish the part of the shape representation to which the material constituent applies the IfcProductDefinitionShape of the element has to include instances of IfcShapeAspect, using the same keyword for their Name attribute.
 */
export declare const IfcMaterialConstituent = 1355;
/**
 * IfcMaterialConstituentSet is a collection of individual material constituents, each assigning a material to a part of an element. The parts are only identified by a keyword (as opposed to an IfcMaterialLayerSet or IfcMaterialProfileSet where each part has an individual shape parameter (layer thickness or layer profile).
 */
export declare const IfcMaterialConstituentSet = 1356;
/**
 * IfcMaterialDefinition is a general supertype for all material related information items in IFC that have kdtree3 material related properties that may include association of material with some shape parameters or assignments to identified parts of a component.
 */
export declare const IfcMaterialDefinition = 1357;
/**
 * IfcMaterialDefinitionRepresentation defines presentation information relating to IfcMaterial. It allows for multiple presentations of the same material for different geometric representation contexts.
 */
export declare const IfcMaterialDefinitionRepresentation = 1358;
/**
 * IfcMaterialLayer is a single and identifiable part of an element which is constructed of a number of layers (one or more). Each IfcMaterialLayer has a constant thickness and is located relative to the referencing IfcMaterialLayerSet along the material layer set base (MlsBase).
 */
export declare const IfcMaterialLayer = 1359;
/**
 * The IfcMaterialLayerSet is a designation by which materials of an element constructed of a number of material layers is known and through which the relative positioning of individual layers can be expressed.
 */
export declare const IfcMaterialLayerSet = 1360;
/**
 * The IfcMaterialLayerSetUsage determines the usage of IfcMaterialLayerSet in terms of its location and orientation relative to the associated element geometry. The location of material layer set shall be compatible with the building element geometry (that is, material layers shall fit inside the element geometry). The rules to ensure the compatibility depend on the type of the building element.
 */
export declare const IfcMaterialLayerSetUsage = 1361;
/**
 * IfcMaterialLayerWithOffsets is a specialization of IfcMaterialLayer enabling definition of offset values along edges (within the material layer set usage in parent layer set).
 */
export declare const IfcMaterialLayerWithOffsets = 1362;
/**
 * IfcMaterialList is a list of the different materials that are used in an element.
 */
export declare const IfcMaterialList = 1363;
/**
 * IfcMaterialProfile is a single and identifiable cross section of an element which is constructed of a number of profiles (one or more).
 */
export declare const IfcMaterialProfile = 1364;
/**
 * The IfcMaterialProfileSet is a designation by which individual material(s) of a prismatic element (for example, beam or column) constructed of a single or multiple material profiles is known.
 */
export declare const IfcMaterialProfileSet = 1365;
/**
 * IfcMaterialProfileSetUsage determines the usage of IfcMaterialProfileSet in terms of its location relative to the associated element geometry. The location of a material profile set shall be compatible with the building element geometry (that is, material profiles shall fit inside the element geometry). The rules to ensure the compatibility depend on the type of the building element. For building elements with shape representations which are based on extruded solids, this is accomplished by referring to the identical profile definition in the shape model as in the material profile set.
 */
export declare const IfcMaterialProfileSetUsage = 1366;
/**
 * IfcMaterialProfileSetUsageTapering specifies dual material profile sets in association with tapered prismatic (beam- or column-like) elements.
 */
export declare const IfcMaterialProfileSetUsageTapering = 1367;
/**
 * IfcMaterialProfileWithOffsets is a specialization of IfcMaterialProfile with additional longitudinal offsets .
 */
export declare const IfcMaterialProfileWithOffsets = 1368;
/**
 * The IfcMaterialProperties assigns a set of material properties to associated material definitions. The set may be identified by a Name and a Description. The IfcProperty (instantiable subtypes) is used to express the individual material properties by name, description, value and unit.
 */
export declare const IfcMaterialProperties = 1369;
/**
 * IfcMaterialRelationship defines a relationship between part and whole in material definitions (as in composite materials). The parts, expressed by the set of RelatedMaterials, are material constituents of which a single material aggregate is composed.
 */
export declare const IfcMaterialRelationship = 1370;
/**
 * IfcMaterialUsageDefinition is a general supertype for all material related information items in IFC that have occurrence specific assignment parameters to assign a set of materials with shape parameters to a reference geometry item of that component.
 */
export declare const IfcMaterialUsageDefinition = 1371;
/**
 *
 */
export declare const IfcMeasureWithUnit = 1372;
/**
 * A mechanical fasteners connecting building elements or parts mechanically. A single instance of this class may represent one or many of actual mechanical fasteners, for example an array of bolts or a row of nails.
 */
export declare const IfcMechanicalFastener = 1373;
/**
 * The element component type IfcMechanicalFastenerType defines commonly shared information for occurrences of mechanical fasteners. The set of shared information may include:
 */
export declare const IfcMechanicalFastenerType = 1374;
/**
 * A medical device is attached to a medical piping system and operates upon medical gases to perform a specific function. Medical gases include medical air, medical vacuum, oxygen, carbon dioxide, nitrogen, and nitrous oxide.
 */
export declare const IfcMedicalDevice = 1375;
/**
 * The flow terminal type IfcMedicalDeviceType defines commonly shared information for occurrences of medical devices. The set of shared information may include:
 */
export declare const IfcMedicalDeviceType = 1376;
/**
 * An IfcMember is a structural member designed to carry loads between or beyond points of support. It is not required to be load bearing. The orientation of the member (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to IfcBeam and IfcColumn). An IfcMember represents a linear structural element from an architectural or structural modeling point of view and shall be used if it cannot be expressed more specifically as either an IfcBeam or an IfcColumn.
 */
export declare const IfcMember = 1377;
/**
 * The standard member, IfcMemberStandardCase, defines a member with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcMemberStandardCase handles all cases of members, that:
 */
export declare const IfcMemberStandardCase = 1378;
/**
 * The element type IfcMemberType defines commonly shared information for occurrences of members. Members are predominately linear building elements, often forming part of a structural system. The orientation of the member (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to beam and column). The set of shared information may include:
 */
export declare const IfcMemberType = 1379;
/**
 * An IfcMetric is used to capture quantitative resultant metrics that can be applied to objectives.
 */
export declare const IfcMetric = 1380;
/**
 * The IfcMirroredProfileDef defines the profile by mirroring the parent profile about the y axis of the parent profile coordinate system. That is, left and right of the parent profile are swapped.
 */
export declare const IfcMirroredProfileDef = 1381;
/**
 * IfcMonetaryUnit is a unit to define currency for money.
 */
export declare const IfcMonetaryUnit = 1382;
/**
 * A motor connection provides the means for connecting a motor as the driving device to the driven device.
 */
export declare const IfcMotorConnection = 1383;
/**
 * The energy conversion device type IfcMotorConnectionType defines commonly shared information for occurrences of motor connections. The set of shared information may include:
 */
export declare const IfcMotorConnectionType = 1384;
/**
 *
 */
export declare const IfcNamedUnit = 1385;
/**
 * An IfcObject is the generalization of any semantically treated thing or process. Objects are things as they appear - i.e. occurrences.
 */
export declare const IfcObject = 1386;
/**
 * An IfcObjectDefinition is the generalization of any semantically treated thing or process, either being a type or an occurrences. Object defintions can be named, using the inherited Name attribute, which should be a user recognizable label for the object occurrance. Further explanations to the object can be given using the inherited Description attribute. A context is a specific kind of object definition as it provides the project or library context in which object types and object occurrences are defined.
 */
export declare const IfcObjectDefinition = 1387;
/**
 * An IfcObjective captures qualitative information for an objective-based constraint.
 */
export declare const IfcObjective = 1388;
/**
 * IfcObjectPlacement is an abstract supertype for the special types defining the object coordinate system. The IfcObjectPlacement has to be provided for each product that has a shape representation.
 */
export declare const IfcObjectPlacement = 1389;
/**
 * An occupant is a type of actor that defines the form of occupancy of a property.
 */
export declare const IfcOccupant = 1390;
/**
 * An IfcOffsetCurve2D is a curve defined by an offset in 2D space from its BasisCurve.
 */
export declare const IfcOffsetCurve2D = 1391;
/**
 * An IfcOffsetCurve3D is a curve defined by an offset in 3D space from its BasisCurve.
 */
export declare const IfcOffsetCurve3D = 1392;
/**
 * The opening element stands for opening, recess or chase, all reflecting voids. It represents a void within any element that has physical manifestation. Openings can be inserted into walls, slabs, beams, columns, or other elements.
 */
export declare const IfcOpeningElement = 1393;
/**
 * The standard opening, IfcOpeningStandardCase, defines an opening with certain constraints for the dimension parameters, position within the voided element, and with certain constraints for the geometric representation. The IfcOpeningStandardCase handles all cases of openings, that:
 */
export declare const IfcOpeningStandardCase = 1394;
/**
 *
 */
export declare const IfcOpenShell = 1395;
/**
 * A named and structured grouping with a corporate identity.
 */
export declare const IfcOrganization = 1396;
/**
 * The IfcOrganizationRelationship establishes an association between one relating organization and one or more related organizations.
 */
export declare const IfcOrganizationRelationship = 1397;
/**
 * The IfcOrientedEdge represents an IfcEdge with an Orientation flag applied. It allows to reuse the same IfcEdge when traversed exactly twice, once forwards and once backwards.
 */
export declare const IfcOrientedEdge = 1398;
/**
 * The IfcOuterBoundaryCurve defines the outer boundary of a bounded surface.
 */
export declare const IfcOuterBoundaryCurve = 1399;
/**
 * An outlet is a device installed at a point to receive one or more inserted plugs for electrical power or communications.
 */
export declare const IfcOutlet = 1400;
/**
 * The flow terminal type IfcOutletType defines commonly shared information for occurrences of outlets. The set of shared information may include:
 */
export declare const IfcOutletType = 1401;
/**
 * IfcOwnerHistory defines all history and identification related information. In order to provide fast access it is directly attached to all independent objects, relationships and properties.
 */
export declare const IfcOwnerHistory = 1402;
/**
 * The parameterized profile definition defines a 2D position coordinate system to which the parameters of the different profiles relate to. All profiles are defined centric to the origin of the position coordinate system, or more specific, the origin [0.,0.] shall be in the center of the bounding box of the profile.
 */
export declare const IfcParameterizedProfileDef = 1403;
/**
 *
 */
export declare const IfcPath = 1404;
/**
 * The IfcPcurve is a curve defined within the parameter space of its reference surface.
 */
export declare const IfcPcurve = 1405;
/**
 * IfcPerformanceHistory is used to document the actual performance of an occurrence instance over time. It includes machine-measured data from building automation systems and human-specified data such as task and resource usage. The data may represent actual conditions, predictions, or simulations.
 */
export declare const IfcPerformanceHistory = 1406;
/**
 * This entity is a description of a panel within a door or window (as fillers for opening) which allows for air flow. It is given by its properties (IfcPermeableCoveringProperties). A permeable covering is a casement, such as a component, fixed or opening, consisting essentially of a frame and the infilling. The infilling is normally a grill, a louver or a screen. The way of operation is defined in the operation type.
 */
export declare const IfcPermeableCoveringProperties = 1407;
/**
 * A permit is a permission to perform work in places and on artifacts where regulatory, security or other access restrictions apply.
 */
export declare const IfcPermit = 1408;
/**
 * This entity represents an individual human being.
 */
export declare const IfcPerson = 1409;
/**
 * This entity represents a person acting on behalf of an organization.
 */
export declare const IfcPersonAndOrganization = 1410;
/**
 * The complex physical quantity, IfcPhysicalComplexQuantity, is an entity that holds a set of single quantity measure value (as defined at the subtypes of IfcPhysicalSimpleQuantity), that all apply to a given component or aspect of the element.
 */
export declare const IfcPhysicalComplexQuantity = 1411;
/**
 * The physical quantity, IfcPhysicalQuantity, is an abstract entity that holds a complex or simple quantity measure together with a semantic definition of the usage for the single or several measure value.
 */
export declare const IfcPhysicalQuantity = 1412;
/**
 * The physical quantity, IfcPhysicalSimpleQuantity, is an entity that holds a single quantity measure value (as defined at the subtypes of IfcPhysicalSimpleQuantity) together with a semantic definition of the usage for the measure value.
 */
export declare const IfcPhysicalSimpleQuantity = 1413;
/**
 * A pile is a slender timber, concrete, or steel structural element, driven, jetted, or otherwise embedded on end in the ground for the purpose of supporting a load. A pile is also characterized as deep foundation, where the loads are transfered to deeper subsurface layers.
 */
export declare const IfcPile = 1414;
/**
 * The building element type IfcPileType defines commonly shared information for occurrences of piles. The set of shared information may include:
 */
export declare const IfcPileType = 1415;
/**
 * A pipe fitting is a junction or transition in a piping flow distribution system used to connect pipe segments, resulting in changes in flow characteristics to the fluid such as direction or flow rate.
 */
export declare const IfcPipeFitting = 1416;
/**
 * The flow fitting type IfcPipeFittingType defines commonly shared information for occurrences of pipe fittings. The set of shared information may include:
 */
export declare const IfcPipeFittingType = 1417;
/**
 * A pipe segment is used to typically join two sections of a piping network.
 */
export declare const IfcPipeSegment = 1418;
/**
 * The flow segment type IfcPipeSegmentType defines commonly shared information for occurrences of pipe segments. The set of shared information may include:
 */
export declare const IfcPipeSegmentType = 1419;
/**
 * An IfcPixelTexture provides a 2D image-based texture map as an explicit array of pixel values (list of Pixel binary attributes). In contrary to the IfcImageTexture the IfcPixelTexture holds a 2 dimensional list of pixel color (and opacity) directly, instead of referencing to an URL.
 */
export declare const IfcPixelTexture = 1420;
/**
 * An IfcPlacement is an abstract supertype of placement subtypes that define the location of an item, or an entire shape representation, and provide its orientation. All placement subtypes define right-handed Cartesian coordinate systems and do not allow mirroring.
 */
export declare const IfcPlacement = 1421;
/**
 * A planar box specifies an arbitrary rectangular box and its location in a two dimensional Cartesian coordinate system. If the planar box is used within a three-dimensional coordinate system, it defines the rectangular box within the XY plane.
 */
export declare const IfcPlanarBox = 1422;
/**
 * The planar extent defines the extent along the two axes of the two-dimensional coordinate system, independently of its position. If the planar extent is used within a three-dimensional coordinate system, it defines the extent along the x and y axes.
 */
export declare const IfcPlanarExtent = 1423;
/**
 * The planar surface is an unbounded surface in the direction of x and y. Bounded planar surfaces are defined by using a subtype of IfcBoundedSurface with BasisSurface being a plane.
 */
export declare const IfcPlane = 1424;
/**
 * An IfcPlate is a planar and often flat part with constant thickness. A plate may carry loads between or beyond points of support, or provide stiffening. The location of the plate (being horizontal, vertical or sloped) is not relevant to its definition (in contrary to IfcWall and IfcSlab (as floor slab)).
 */
export declare const IfcPlate = 1425;
/**
 * The standard plate, IfcPlateStandardCase, defines a plate with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcPlateStandardCase handles all cases of plates, that:
 */
export declare const IfcPlateStandardCase = 1426;
/**
 * The element type IfcPlateType defines commonly shared information for occurrences of plates. The set of shared information may include:
 */
export declare const IfcPlateType = 1427;
/**
 * The IfcPoint is the abstract generalisation of all point representations within a Cartesian coordinate system.
 */
export declare const IfcPoint = 1428;
/**
 * The IfcPointOnCurve is a point defined by a parameter value of its defining curve.
 */
export declare const IfcPointOnCurve = 1429;
/**
 * The IfcPointOnSurface is a point defined by two parameter value of its defining surface.
 */
export declare const IfcPointOnSurface = 1430;
/**
 * The polygonal bounded half space is a special subtype of a half space solid, where the material of the half space used in Boolean expressions is bounded by a polygonal boundary. The base surface of the half space is positioned by its normal relative to the object coordinate system (as defined at the supertype IfcHalfSpaceSolid), and its polygonal (with or without arc segments) boundary is defined in the XY plane of the position coordinate system established by the Position attribute, the subtraction body is extruded perpendicular to the XY plane of the position coordinate system, that is, into the direction of the positive Z axis defined by the Position attribute.
 */
export declare const IfcPolygonalBoundedHalfSpace = 1431;
/**
 * The IfcPolygonalFaceSet is a tessellated face set with all faces being bound by polygons. The planar faces are constructed by implicit polylines defined by three or more Cartesian points. Each planar face is defined by an instance of IfcIndexedPolygonalFace, or in case of faces with inner loops by IfcIndexedPolygonalFaceWithVoids.
 */
export declare const IfcPolygonalFaceSet = 1432;
/**
 * The IfcPolyline is a bounded curve with only linear segments defined by a list of Cartesian points. If the first and the last Cartesian point in the list are identical, then the polyline is a closed curve, otherwise it is an open curve.
 */
export declare const IfcPolyline = 1433;
/**
 *
 */
export declare const IfcPolyLoop = 1434;
/**
 * A port provides the means for an element to connect to other elements.
 */
export declare const IfcPort = 1435;
/**
 * This entity represents an address for delivery of paper based mail and other postal deliveries.
 */
export declare const IfcPostalAddress = 1436;
/**
 * The pre defined colour determines those qualified names which can be used to identify a colour that is in scope of the current data exchange specification (in contrary to colour specification which defines the colour directly by its colour components).
 */
export declare const IfcPreDefinedColour = 1437;
/**
 *
 */
export declare const IfcPreDefinedCurveFont = 1438;
/**
 * A pre defined item is a qualified name given to a style or font which is determined within the data exchange specification by convention on using the Name attribute value (in contrary to externally defined items, which are agreed by an external source).
 */
export declare const IfcPreDefinedItem = 1439;
/**
 * The IfcPreDefinedProperties is an abstract supertype of all predefined property collections that have explicit attributes, each representing a property. Instantiable subtypes are assigned to specific characterised entities.
 */
export declare const IfcPreDefinedProperties = 1440;
/**
 * IfcPreDefinedPropertySet is a generalization of all statically defined property sets that are assigned to an object or type object. The statically or pre-defined property sets are entities with a fixed list of attributes having particular defined data types.
 */
export declare const IfcPreDefinedPropertySet = 1441;
/**
 * The pre defined text font determines those qualified names which can be used for fonts that are in scope of the current data exchange specification (in contrary to externally defined text fonts). There are two choices:
 */
export declare const IfcPreDefinedTextFont = 1442;
/**
 * The IfcPresentationItem is the abstract supertype of all entities used for presentation appearance definitions.
 */
export declare const IfcPresentationItem = 1443;
/**
 * The presentation layer assignment provides the layer name (and optionally a description and an identifier) for a collection of geometric representation items. The IfcPresentationLayerAssignment corresponds to the term "CAD Layer" and is used mainly for grouping and visibility control.
 */
export declare const IfcPresentationLayerAssignment = 1444;
/**
 * An IfcPresentationLayerAssignmentWithStyle extends the presentation layer assignment with capabilities to define visibility control, access control and kdtree3 style information.
 */
export declare const IfcPresentationLayerWithStyle = 1445;
/**
 * The IfcPresentationStyle is an abstract generalization of style table for presentation information assigned to geometric representation items. It includes styles for curves, areas, surfaces, and text. Style information may include colour, hatching, rendering, and text fonts.
 */
export declare const IfcPresentationStyle = 1446;
/**
 * Assignment of style information to a styled item.
 */
export declare const IfcPresentationStyleAssignment = 1447;
/**
 * An IfcProcedure is a logical set of actions to be taken in response to an event or to cause an event to occur.
 */
export declare const IfcProcedure = 1448;
/**
 * An IfcProcedureType defines a particular type of procedure that may be specified.
 */
export declare const IfcProcedureType = 1449;
/**
 * IfcProcess is defined as one individual activity or event, that is ordered in time, that has sequence relationships with other processes, which transforms input in output, and may connect to other other processes through input output relationships. An IfcProcess can be an activity (or task), or an event. It takes usually place in building construction with the intent of designing, costing, acquiring, constructing, or maintaining products or other and similar tasks or procedures. Figure 131 illustrates process relationships.
 */
export declare const IfcProcess = 1450;
/**
 * The IfcProduct is an abstract representation of any object that relates to a geometric or spatial context. An IfcProduct occurs at a specific location in space if it has a geometric representation assigned. It can be placed relatively to other products, but ultimately relative to the project coordinate system. The ObjectPlacement attribute establishes the coordinate system in which all points and directions used by the geometric representation items under Representation are founded. The Representation is provided by an IfcProductDefinitionShape being either a geometric shape representation, or a topology representation (with or without underlying geometry of the topological items).
 */
export declare const IfcProduct = 1451;
/**
 * The IfcProductDefinitionShape defines all shape relevant information about an IfcProduct. It allows for multiple geometric shape representations of the same product. The shape relevant information includes:
 */
export declare const IfcProductDefinitionShape = 1452;
/**
 * IfcProductRepresentation defines a representation of a product, including its (geometric or topological) representation. A product can have zero, one or many geometric representations, and a single geometric representation can be shared among various products using mapped representations.
 */
export declare const IfcProductRepresentation = 1453;
/**
 * IfcProfileDef is the supertype of all definitions of standard and arbitrary profiles within IFC. It is used to define a standard set of commonly used section profiles by their parameters or by their explicit curve geometry.
 */
export declare const IfcProfileDef = 1454;
/**
 * This is a collection of properties applicable to section profile definitions.
 */
export declare const IfcProfileProperties = 1455;
/**
 * IfcProject indicates the undertaking of some design, engineering, construction, or maintenance activities leading towards a product. The project establishes the context for information to be exchanged or shared, and it may represent a construction project but does not have to. The IfcProject's main purpose in an exchange structure is to provide the root instance and the context for all other information items included.
 */
export declare const IfcProject = 1456;
/**
 * IfcProjectedCRS is a coordinate reference system of the map to which the map translation of the local engineering coordinate system of the construction or facility engineering project relates. The MapProjection and MapZone attributes uniquely identify the projection to the underlying geographic coordinate reference system, provided that they are well-known in the receiving application. The projected coordinate reference system is assumed to be a 2D or 3D right-handed Cartesian coordinate system, the optional MapUnit attribute can be used determine the length unit used by the map.
 */
export declare const IfcProjectedCRS = 1457;
/**
 * The projection element is a specialization of the general feature element to represent projections applied to building elements. It represents a solid attached to any element that has physical manifestation.
 */
export declare const IfcProjectionElement = 1458;
/**
 * An IfcProjectLibrary collects all library elements that are included within a referenced project data set.
 */
export declare const IfcProjectLibrary = 1459;
/**
 * A project order is a directive to purchase products and/or perform work, such as for construction or facilities management.
 */
export declare const IfcProjectOrder = 1460;
/**
 * IfcProperty is an abstract generalization for all types of properties that can be associated with IFC objects through the property set mechanism.
 */
export declare const IfcProperty = 1461;
/**
 * The IfcPropertyAbstraction is an abstract supertype of all property related entities defined as dependent resource entities within the specification. It may have an external reference to a dictionary or library that provides additional information about its definition. Instantiable subtypes have property name, value and other instance information.
 */
export declare const IfcPropertyAbstraction = 1462;
/**
 * A property with a bounded value, IfcPropertyBoundedValue, defines a property object which has a maximum of two (numeric or descriptive) values assigned, the first value specifying the upper bound and the second value specifying the lower bound. It defines a property - value bound (min-max) combination for which the property Name, an optional Description, the optional UpperBoundValue with measure type, the optional LowerBoundValue with measure type, and the optional Unit is given. A set point value can be provided in addition to the upper and lower bound values for operational value setting.
 */
export declare const IfcPropertyBoundedValue = 1463;
/**
 * IfcPropertyDefinition defines the generalization of all characteristics (i.e. a grouping of individual properties), that may be assigned to objects. Currently, subtypes of IfcPropertyDefinition include property set occurrences, property set templates, and property templates.
 */
export declare const IfcPropertyDefinition = 1464;
/**
 * An IfcPropertyDependencyRelationship describes an identified dependency between the value of one property and that of another.
 */
export declare const IfcPropertyDependencyRelationship = 1465;
/**
 * A property with an enumerated value, IfcPropertyEnumeratedValue, defines a property object which has a value assigned that is chosen from an enumeration. It defines a property - value combination for which the property Name, an optional Description, the optional EnumerationValues with measure type and optionally an Unit is given.
 */
export declare const IfcPropertyEnumeratedValue = 1466;
/**
 * IfcPropertyEnumeration is a collection of simple or measure values that define a prescribed set of alternatives from which 'enumeration values' are selected. This enables inclusion of enumeration values in property sets. IfcPropertyEnumeration provides a name for the enumeration as well as a list of unique (numeric or descriptive) values (that may have a measure type assigned). The entity defines the list of potential enumerators to be exchanged together (or separately) with properties of type IfcPropertyEnumeratedValue that selects their actual property values from this enumeration.
 */
export declare const IfcPropertyEnumeration = 1467;
/**
 * An IfcPropertyListValue defines a property that has several (numeric or descriptive) values assigned, these values are given by an ordered list. It defines a property - list value combination for which the property Name, an optional Description, the optional ListValues with measure type and optionally an Unit is given. An IfcPropertyListValue is a list of values. The order in which values appear is significant. All list members shall be of the same type.
 */
export declare const IfcPropertyListValue = 1468;
/**
 * The IfcPropertyReferenceValue allows a property value to be of type of an resource level entity. The applicable entities that can be used as value references are given by the IfcObjectReferenceSelect.
 */
export declare const IfcPropertyReferenceValue = 1469;
/**
 * The IfcPropertySet is a container that holds properties within a property tree. These properties are interpreted according to their name attribute. Each individual property has a significant name string. Some property sets are included in the specification of this standard and have a predefined set of properties indicated by assigning a significant name. These property sets are listed under "property sets" within this specification. Property sets applicable to certain objects are listed in the object specification. The naming convention "Pset_Xxx" applies to all those property sets that are defined as part of this specification and it shall be used as the value of the Name attribute.
 */
export declare const IfcPropertySet = 1470;
/**
 * IfcPropertySetDefinition is a generalization of all individual property sets that can be assigned to an object or type object. The property set definition can be either:
 */
export declare const IfcPropertySetDefinition = 1471;
/**
 * IfcPropertySetTemplate defines the template for all dynamically extensible property sets represented by IfcPropertySet. The property set template is a container of property templates within a property tree. The individual property templates are interpreted according to their Name attribute and shall have no values assigned.
 */
export declare const IfcPropertySetTemplate = 1472;
/**
 * The property with a single value IfcPropertySingleValue defines a property object which has a single (numeric or descriptive) value assigned. It defines a property - single value combination for which the property Name, an optional Description, and an optional NominalValue with measure type is provided. In addition, the default unit as specified within the project unit context can be overriden by assigning an Unit.
 */
export declare const IfcPropertySingleValue = 1473;
/**
 * IfcPropertyTableValue is a property with a value range defined by a property object which has two lists of (numeric or descriptive) values assigned. The values specify a table with two columns. The defining values provide the first column and establish the scope for the defined values (the second column). An optional Expression attribute may give the equation used for deriving the range value, which is for information purposes only.
 */
export declare const IfcPropertyTableValue = 1474;
/**
 * The IfcPropertyTemplate is an abstract supertype comprising the templates for all dynamically extensible properties, either as an IfcComplexPropertyTemplate, or an IfcSimplePropertyTemplate. These templates determine the structure of:
 */
export declare const IfcPropertyTemplate = 1475;
/**
 * IfcPropertyTemplateDefinition is a generalization of all property and property set templates. Templates define the collection, types, names, applicable measure types and units of individual properties used in a project. The property template definition can be either:
 */
export declare const IfcPropertyTemplateDefinition = 1476;
/**
 * A protective device breaks an electrical circuit when a stated electric current that passes through it is exceeded.
 */
export declare const IfcProtectiveDevice = 1477;
/**
 * A protective device tripping unit breaks an electrical circuit at a separate breaking unit when a stated electric current that passes through the unit is exceeded.
 */
export declare const IfcProtectiveDeviceTrippingUnit = 1478;
/**
 * The distribution control element type IfcProtectiveDeviceTrippingUnitType defines commonly shared information for occurrences of protective device tripping units. The set of shared information may include:
 */
export declare const IfcProtectiveDeviceTrippingUnitType = 1479;
/**
 * The flow controller type IfcProtectiveDeviceType defines commonly shared information for occurrences of protective devices. The set of shared information may include:
 */
export declare const IfcProtectiveDeviceType = 1480;
/**
 * IfcProxy is intended to be a kind of a container for wrapping objects which are defined by associated properties, which may or may not have a geometric representation and placement in space. A proxy may have a semantic meaning, defined by the Name attribute, and property definitions, attached through the property assignment relationship, which definition may be outside of the definitions given by the current release of IFC.
 */
export declare const IfcProxy = 1481;
/**
 * A pump is a device which imparts mechanical work on fluids or slurries to move them through a channel or pipeline. A typical use of a pump is to circulate chilled water or heating hot water in a building services distribution system.
 */
export declare const IfcPump = 1482;
/**
 * The flow moving device type IfcPumpType defines commonly shared information for occurrences of pumps. The set of shared information may include:
 */
export declare const IfcPumpType = 1483;
/**
 * IfcQuantityArea is a physical quantity that defines a derived area measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityArea = 1484;
/**
 * IfcQuantityCount is a physical quantity that defines a derived count measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityCount = 1485;
/**
 * IfcQuantityLength is a physical quantity that defines a derived length measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityLength = 1486;
/**
 * IfcQuantitySet is the the abstract supertype for all quantity sets attached to objects. The quantity set is a container class that holds the individual quantities within a quantity tree. These quantities are interpreted according to their name attribute and classified according to their measure type. Some quantity sets are included in the IFC specification and have a predefined set of quantities indicated by assigning a significant name. These quantity sets are listed as "quantity sets" within this specification. Quantity sets applicable to certain objects are listed in the object specification.
 */
export declare const IfcQuantitySet = 1487;
/**
 * IfcQuantityTime is an element quantity that defines a time measure to provide a property of time related to an element. It is normally given by the recipe information of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityTime = 1488;
/**
 * IfcQuantityVolume is a physical quantity that defines a derived volume measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityVolume = 1489;
/**
 * IfcQuantityWeight is a physical element quantity that defines a derived weight measure to provide an element's physical property. It is normally derived from the physical properties of the element under the specific measure rules given by a method of measurement.
 */
export declare const IfcQuantityWeight = 1490;
/**
 * The railing is a frame assembly adjacent to human or vehicle circulation spaces and at some space boundaries where it is used in lieu of walls or to complement walls. Designed as an optional physical support, or to prevent injury or damage, either by falling or collision.
 */
export declare const IfcRailing = 1491;
/**
 * The building element type IfcRailingType defines commonly shared information for occurrences of railings. The set of shared information may include:
 */
export declare const IfcRailingType = 1492;
/**
 * A ramp is a vertical passageway which provides a human or vehicle circulation link between one floor level and another floor level at a different elevation. It may include a landing as an intermediate floor slab. A ramp normally does not include steps.
 */
export declare const IfcRamp = 1493;
/**
 * A ramp comprises a single inclined segment, or several inclined segments that are connected by a horizontal segment, refered to as a landing. A ramp flight is the single inclined segment and part of the ramp construction. In case of single flight ramps, the ramp flight and the ramp are identical.
 */
export declare const IfcRampFlight = 1494;
/**
 * The building element type IfcRampFlightType defines commonly shared information for occurrences of ramp flights. The set of shared information may include:
 */
export declare const IfcRampFlightType = 1495;
/**
 * The building element type IfcRampType defines commonly shared information for occurrences of ramps. The set of shared information may include:
 */
export declare const IfcRampType = 1496;
/**
 * A rational B-spline curve with knots is a B-spline curve described in terms of control points and basic functions. It describes weights in addition to the control points defined at the supertype IfcBSplineCurve.
 */
export declare const IfcRationalBSplineCurveWithKnots = 1497;
/**
 * A rational B-spline surface with knots is a piecewise parametric rational surface described in terms of control points, and associated weight values.
 */
export declare const IfcRationalBSplineSurfaceWithKnots = 1498;
/**
 * IfcRectangleHollowProfileDef defines a section profile that provides the defining parameters of a rectangular (or square) hollow section to be used by the swept surface geometry or the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. A square hollow section can be defined by equal values for h and b. The centre of the position coordinate system is in the profiles centre of the bounding box (for symmetric profiles identical with the centre of gravity). Normally, the longer sides are parallel to the y-axis, the shorter sides parallel to the x-axis.
 */
export declare const IfcRectangleHollowProfileDef = 1499;
/**
 * IfcRectangleProfileDef defines a rectangle as the profile definition used by the swept surface geometry or the swept area solid. It is given by its X extent and its Y extent, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system.
 */
export declare const IfcRectangleProfileDef = 1500;
/**
 * The IfcRectangularPyramid is a Construction Solid Geometry (CSG) 3D primitive. It is a solid with a rectangular base and a point called apex as the top. The tapers from the base to the top. The axis from the center of the base to the apex is perpendicular to the base. The inherited Position attribute defines the IfcAxisPlacement3D and provides the location and orientation of the pyramid:
 */
export declare const IfcRectangularPyramid = 1501;
/**
 * The IfcRectangularTrimmedSurface is a surface created by bounding its BasisSurface along two pairs of parallel curves defined within the parametric space of the referenced surface.
 */
export declare const IfcRectangularTrimmedSurface = 1502;
/**
 * IfcRecurrencePattern defines repetitive time periods on the basis of regular recurrences such as each Monday in a week, or every third Tuesday in a month. The population of the remaining attributes such as DayComponent, Position, and Interval depend on the specified recurrence type.
 */
export declare const IfcRecurrencePattern = 1503;
/**
 * This entity is used to refer to a value of an attribute on an instance. It may refer to the value of a scalar attribute or a value within a collection-based attribute. Referenced attributes may be direct values, object references, collections, inverse object references, and inverse collections. References may be chained to form a path of object-attribute references.
 */
export declare const IfcReference = 1504;
/**
 * In a regular time series, the data arrives predictably at predefined intervals. In a regular time series there is no need to store multiple time stamps and the algorithms for analyzing the time series are therefore significantly simpler. Using the start time provided in the supertype, the time step is used to identify the frequency of the occurrences of the list of values.
 */
export declare const IfcRegularTimeSeries = 1505;
/**
 * IfcReinforcementProperties defines the set of properties for a specific combination of reinforcement bar steel grade, bar type and effective depth.
 */
export declare const IfcReinforcementBarProperties = 1506;
/**
 * IfcReinforcementDefinitionProperties defines the cross section properties of reinforcement included in reinforced concrete building elements. The property set definition may be used both in conjunction with insitu and precast structures.
 */
export declare const IfcReinforcementDefinitionProperties = 1507;
/**
 * A reinforcing bar is usually made of steel with manufactured deformations in the surface, and used in concrete and masonry construction to provide additional strength. A single instance of this class may represent one or many of actual rebars, for example a row of rebars.
 */
export declare const IfcReinforcingBar = 1508;
/**
 * The reinforcing element type IfcReinforcingBarType defines commonly shared information for occurrences of reinforcing bars. The set of shared information may include:
 */
export declare const IfcReinforcingBarType = 1509;
/**
 * A reinforcing element represents bars, wires, strands, meshes, tendons, and other components embedded in concrete in such a manner that the reinforcement and the concrete act together in resisting forces.
 */
export declare const IfcReinforcingElement = 1510;
/**
 * The element component type IfcReinforcingElementType defines commonly shared information for occurrences of reinforcing elements. The set of shared information may include:
 */
export declare const IfcReinforcingElementType = 1511;
/**
 * A reinforcing mesh is a series of longitudinal and transverse wires or bars of various gauges, arranged at right angles to each other and welded at all points of intersection; usually used for concrete slab reinforcement. It is also known as welded wire fabric. In scope are plane meshes as well as bent meshes.
 */
export declare const IfcReinforcingMesh = 1512;
/**
 * The reinforcing element type IfcReinforcingMeshType defines commonly shared information for occurrences of reinforcing meshs. The set of shared information may include:
 */
export declare const IfcReinforcingMeshType = 1513;
/**
 * The aggregation relationship IfcRelAggregates is a special type of the general composition/decomposition (or whole/part) relationship IfcRelDecomposes. The aggregation relationship can be applied to all subtypes of IfcObjectDefinition.
 */
export declare const IfcRelAggregates = 1514;
/**
 * The assignment relationship, IfcRelAssigns, is a generalization of "link" relationships among instances of IfcObject and its various 1st level subtypes. A link denotes the specific association through which one object (the client) applies the services of other objects (the suppliers), or through which one object may navigate to other objects.
 */
export declare const IfcRelAssigns = 1515;
/**
 * The objectified relationship IfcRelAssignsToActor handles the assignment of objects (subtypes of IfcObject) to an actor (subtypes of IfcActor).
 */
export declare const IfcRelAssignsToActor = 1516;
/**
 * The objectified relationship IfcRelAssignsToControl handles the assignment of a control (represented by subtypes of IfcControl) to other objects (represented by subtypes of IfcObject, with the exception of controls).
 */
export declare const IfcRelAssignsToControl = 1517;
/**
 * The objectified relationship IfcRelAssignsToGroup handles the assignment of object definitions (individual object occurrences as subtypes of IfcObject, and object types as subtypes of IfcTypeObject) to a group (subtypes of IfcGroup).
 */
export declare const IfcRelAssignsToGroup = 1518;
/**
 * The objectified relationship IfcRelAssignsToGroupByFactor is a specialization of the general grouping mechanism. It allows to add a factor to define the ratio that applies to the assignment of object definitions (individual object occurrences as subtypes of IfcObject and object types as subtypes of IfcTypeObject) to a group (subtypes of IfcGroup).
 */
export declare const IfcRelAssignsToGroupByFactor = 1519;
/**
 * The objectified relationship IfcRelAssignsToProcess handles the assignment of one or many objects to a process or activity. An object can be a product that is the item the process operates on. Processes and activities can operate on things other than products, and can operate in ways other than input and output.
 */
export declare const IfcRelAssignsToProcess = 1520;
/**
 * The objectified relationship IfcRelAssignsToProduct handles the assignment of objects (subtypes of IfcObject) to a product (subtypes of IfcProduct). The Name attribute should be used to classify the usage of the IfcRelAssignsToProduct objectified relationship. The following Name values are proposed:
 */
export declare const IfcRelAssignsToProduct = 1521;
/**
 * The objectified relationship IfcRelAssignsToResource handles the assignment of objects (as subtypes of IfcObject), acting as a resource usage or consumption, to a resource (as subtypes of IfcResource).
 */
export declare const IfcRelAssignsToResource = 1522;
/**
 * The association relationship IfcRelAssociates refers to sources of information (most notably a classification, library, document, approval, contraint, or material). The information associated may reside internally or externally of the project data. There is no dependency implied by the association.
 */
export declare const IfcRelAssociates = 1523;
/**
 * The entity IfcRelAssociatesApproval is used to apply approval information defined by IfcApproval, in IfcApprovalResource schema, to subtypes of IfcRoot.
 */
export declare const IfcRelAssociatesApproval = 1524;
/**
 * The objectified relationship IfcRelAssociatesClassification handles the assignment of a classification item (items of the select IfcClassificationSelect) to objects occurrences (subtypes of IfcObject) or object types (subtypes of IfcTypeObject).
 */
export declare const IfcRelAssociatesClassification = 1525;
/**
 * The entity IfcRelAssociatesConstraint is used to apply constraint information defined by IfcConstraint, in the IfcConstraintResource schema, to subtypes of IfcRoot.
 */
export declare const IfcRelAssociatesConstraint = 1526;
/**
 * The objectified relationship (IfcRelAssociatesDocument) handles the assignment of a document information (items of the select IfcDocumentSelect) to objects occurrences (subtypes of IfcObject) or object types (subtypes of IfcTypeObject).
 */
export declare const IfcRelAssociatesDocument = 1527;
/**
 * The objectified relationship (IfcRelAssociatesLibrary) handles the assignment of a library item (items of the select IfcLibrarySelect) to subtypes of IfcObjectDefinition or IfcPropertyDefinition.
 */
export declare const IfcRelAssociatesLibrary = 1528;
/**
 * IfcRelAssociatesMaterial is an objectified relationship between a material definition and elements or element types to which this material definition applies.
 */
export declare const IfcRelAssociatesMaterial = 1529;
/**
 * IfcRelationship is the abstract generalization of all objectified relationships in IFC. Objectified relationships are the preferred way to handle relationships among objects. This allows to keep relationship specific properties directly at the relationship and opens the possibility to later handle relationship specific behavior.
 */
export declare const IfcRelationship = 1530;
/**
 * IfcRelConnects is a connectivity relationship that connects objects under some criteria. As a general connectivity it does not imply constraints, however subtypes of the relationship define the applicable object types for the connectivity relationship and the semantics of the particular connectivity.
 */
export declare const IfcRelConnects = 1531;
/**
 * The IfcRelConnectsElements objectified relationship provides the generalization of the connectivity between elements. It is a 1 to 1 relationship. The concept of two elements being physically or logically connected is described independently from the connecting elements. The connectivity may be related to the shape representation of the connected entities by providing a connection geometry.
 */
export declare const IfcRelConnectsElements = 1532;
/**
 * The IfcRelConnectsPathElements relationship provides the connectivity information between two elements, which have path information.
 */
export declare const IfcRelConnectsPathElements = 1533;
/**
 * An IfcRelConnectsPorts relationship defines the relationship that is made between two ports at their point of connection. It may include the connection geometry between two ports.
 */
export declare const IfcRelConnectsPorts = 1534;
/**
 * IfcRelConnectsPortToElement is a relationship between a distribution element and dynamically connected ports where connections are realised to other distribution elements.
 */
export declare const IfcRelConnectsPortToElement = 1535;
/**
 * The IfcRelConnectsStructuralActivity relationship connects a structural activity (either an action or reaction) to a structural member, structural connection, or element.
 */
export declare const IfcRelConnectsStructuralActivity = 1536;
/**
 * The entity IfcRelConnectsStructuralMember defines all needed properties describing the connection between structural members and structural connection objects (nodes or supports).
 */
export declare const IfcRelConnectsStructuralMember = 1537;
/**
 * The entity IfcRelConnectsWithEccentricity adds the definition of eccentricity to the connection between a structural member and a structural connection (representing either a node or support).
 */
export declare const IfcRelConnectsWithEccentricity = 1538;
/**
 * IfcRelConnectsWithRealizingElements defines a generic relationship that is made between two elements that require the realization of that relationship by means of further realizing elements.
 */
export declare const IfcRelConnectsWithRealizingElements = 1539;
/**
 * This objectified relationship, IfcRelContainedInSpatialStructure, is used to assign elements to a certain level of the spatial project structure. Any element can only be assigned once to a certain level of the spatial structure. The question, which level is relevant for which type of element, can only be answered within the context of a particular project and might vary within the various regions.
 */
export declare const IfcRelContainedInSpatialStructure = 1540;
/**
 * The IfcRelCoversBldgElements relationship is an objectified relationship between an element and one to many coverings, which cover that element.
 */
export declare const IfcRelCoversBldgElements = 1541;
/**
 * The objectified relationship, IfcRelCoversSpace, relates a space object to one or many coverings, which faces (or is assigned to) the space.
 */
export declare const IfcRelCoversSpaces = 1542;
/**
 * The objectified relationship IfcRelDeclares handles the declaration of objects (subtypes of IfcObject) or properties (subtypes of IfcPropertyDefinition) to a project or project library (represented by IfcProject, or IfcProjectLibrary).
 */
export declare const IfcRelDeclares = 1543;
/**
 * The decomposition relationship, IfcRelDecomposes, defines the general concept of elements being composed or decomposed. The decomposition relationship denotes a whole/part hierarchy with the ability to navigate from the whole (the composition) to the parts and vice versa.
 */
export declare const IfcRelDecomposes = 1544;
/**
 * A generic and abstract relationship which subtypes are used to:
 */
export declare const IfcRelDefines = 1545;
/**
 * The objectified relationship IfcRelDefinesByObject defines the relationship between an object taking part in an object type decomposition and an object occurrences taking part in an occurrence decomposition of that type.
 */
export declare const IfcRelDefinesByObject = 1546;
/**
 * The objectified relationship IfcRelDefinesByProperties defines the relationships between property set definitions and objects. Properties are aggregated in property sets. Property sets can be either directly assigned to occurrence objects using this relationship, or assigned to an object type and assigned via that type to occurrence objects. The assignment of an IfcPropertySet to an IfcTypeObject is not handled via this objectified relationship, but through the direct relationship HasPropertySets at IfcTypeObject.
 */
export declare const IfcRelDefinesByProperties = 1547;
/**
 * The objectified relationship IfcRelDefinesByTemplate defines the relationships between property set template and property sets. Common information about property sets, e.g. the applicable name, description, contained properties, is defined by the property set template and assigned to all property sets.
 */
export declare const IfcRelDefinesByTemplate = 1548;
/**
 * The objectified relationship IfcRelDefinesByType defines the relationship between an object type and object occurrences. The IfcRelDefinesByType is a 1-to-N relationship, as it allows for the assignment of one type information to a single or to many objects. Those objects then share the same object type, and the property sets and properties assigned to the object type.
 */
export declare const IfcRelDefinesByType = 1549;
/**
 * IfcRelFillsElement is an objectified relationship between an opening element and an element that fills (or partially fills) the opening element. It is an one-to-one relationship.
 */
export declare const IfcRelFillsElement = 1550;
/**
 * This objectified relationship between a distribution flow element occurrence and one-to-many control element occurrences indicates that the control element(s) sense or control some aspect of the flow element. It is applied to IfcDistributionFlowElement and IfcDistributionControlElement.
 */
export declare const IfcRelFlowControlElements = 1551;
/**
 * The IfcRelInterferesElements objectified relationship indicates that two elements interfere. Interference is a spatial overlap between the two elements. It is a 1 to 1 relationship. The concept of two elements interfering physically or logically is described independently from the elements. The interference may be related to the shape representation of the entities by providing an interference geometry.
 */
export declare const IfcRelInterferesElements = 1552;
/**
 * The nesting relationship IfcRelNests is a special type of the general composition/decomposition (or whole/part) relationship IfcRelDecomposes. The nesting relationship can be applied to all non physical subtypes of object and object types, namely processes, controls (like cost items), and resources. It can also be applied to physical subtypes of object and object types, namely elements having ports. The nesting implies an order among the nested parts.
 */
export declare const IfcRelNests = 1553;
/**
 * The IfcRelProjectsElement is an objectified relationship between an element and one projection element that creates a modifier to the shape of the element. The relationship is defined to be a 1:1 relationship, if an element has more than one projection, several relationship objects have to be used, each pointing to a different projection element. The IfcRelProjectsElement establishes an aggregation relationship between the main element and a sub ordinary addition feature.
 */
export declare const IfcRelProjectsElement = 1554;
/**
 * The objectified relationship, IfcRelReferencedInSpatialStructure is used to assign elements in addition to those levels of the project spatial\S\ structure, in which they are referenced, but not primarily contained. It is also used to connect a system to the relevant spatial element that it serves.
 */
export declare const IfcRelReferencedInSpatialStructure = 1555;
/**
 * IfcRelSequence is a sequential relationship between processes where one process must occur before the other in time and where the timing of the relationship may be described as a type of sequence. The relating process (IfcRelSequence.RelatingProcess) is considered to be the predecessor in the relationship (has precedence) whilst the related process (IfcRelSequence.RelatedProcess) is the successor.
 */
export declare const IfcRelSequence = 1556;
/**
 * The IfcRelServicesBuildings is an objectified relationship that defines the relationship between a system and the sites, buildings, storeys, spaces, or spatial zones, it serves. Examples of systems are:
 */
export declare const IfcRelServicesBuildings = 1557;
/**
 * The space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary to the surrounding elements.
 */
export declare const IfcRelSpaceBoundary = 1558;
/**
 * The 1st level space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary1stLevel to the surrounding elements. 1st level space boundaries are characterizeda by:
 */
export declare const IfcRelSpaceBoundary1stLevel = 1559;
/**
 * The 2nd level space boundary defines the physical or virtual delimiter of a space by the relationship IfcRelSpaceBoundary2ndLevel to the surrounding elements. 2nd level space boundaries are characterized by:
 */
export declare const IfcRelSpaceBoundary2ndLevel = 1560;
/**
 * IfcRelVoidsElement is an objectified relationship between a building element and one opening element that creates a void in the element. It is a one-to-one relationship. This relationship implies a Boolean operation of subtraction between the geometric bodies of the element and the opening.
 */
export declare const IfcRelVoidsElement = 1561;
/**
 * The IfcReparametrisedCompositeCurveSegment is geometrically identical to a IfcCompositeCurveSegment but with the additional capability of reparametrization.
 */
export declare const IfcReparametrisedCompositeCurveSegment = 1562;
/**
 * The IfcRepresentation defines the general concept of representing product properties and in particular the product shape.
 */
export declare const IfcRepresentation = 1563;
/**
 * The IfcRepresentationContext defines the context to which the IfcRepresentation of a product is related.
 */
export declare const IfcRepresentationContext = 1564;
/**
 * The IfcRepresentationItem is used within an IfcRepresentation (directly or indirectly through other IfcRepresentationItem's) to represent an IfcProductRepresentation. Most commonly these IfcRepresentationItem's are geometric or topological representation items, that can (but not need to) have presentation style infomation assigned.
 */
export declare const IfcRepresentationItem = 1565;
/**
 * An IfcRepresentationMap defines the base definition (also referred to as block, cell or macro) called MappedRepresentation within the MappingOrigin. The MappingOrigin defines the coordinate system in which the MappedRepresentation is defined.
 */
export declare const IfcRepresentationMap = 1566;
/**
 * IfcResource contains the information needed to represent the costs, schedule, and other impacts from the use of a thing in a process. It is not intended to use IfcResource to model the general properties of the things themselves, while an optional linkage from IfcResource to the things to be used can be specified (specifically, the relationship from subtypes of IfcResource to IfcProduct through the IfcRelAssignsToResource relationship).
 */
export declare const IfcResource = 1567;
/**
 * An IfcResourceApprovalRelationship is used for associating an approval to resource objects. A single approval might be given to one or many items via IfcResourceObjectSelect.
 */
export declare const IfcResourceApprovalRelationship = 1568;
/**
 * An IfcResourceConstraintRelationship is a relationship entity that enables a constraint to be related to one or more resource level objects.
 */
export declare const IfcResourceConstraintRelationship = 1569;
/**
 * IfcResourceLevelRelationship is an abstract base entity for relationships between resource-level entities.
 */
export declare const IfcResourceLevelRelationship = 1570;
/**
 * IfcResourceTime captures the time-related information about a construction resource.
 */
export declare const IfcResourceTime = 1571;
/**
 * An IfcRevolvedAreaSolid is a solid created by revolving a cross section provided by a profile definition about an axis.
 */
export declare const IfcRevolvedAreaSolid = 1572;
/**
 * IfcRevolvedAreaSolidTapered is defined by revolving a cross section along a circular arc. The cross section may change along the revolving sweep from the shape of the start cross section into the shape of the end cross section. Corresponding vertices of the start and end cross sections are then connected. The bounded surface may have holes which will sweep into holes in the solid.
 */
export declare const IfcRevolvedAreaSolidTapered = 1573;
/**
 * The IfcRightCircularCone is a Construction Solid Geometry (CSG) 3D primitive. It is a solid with a circular base and a point called apex as the top. The tapers from the base to the top. The axis from the center of the circular base to the apex is perpendicular to the base. The inherited Position attribute defines the IfcAxisPlacement3D and provides the location and orientation of the cone:
 */
export declare const IfcRightCircularCone = 1574;
/**
 * The IfcRightCircularCylinder is a Construction Solid Geometry (CSG) 3D primitive. It is a solid with a circular base and top. The cylindrical surface between if formed by points at a fixed distance from the axis of the cylinder. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export declare const IfcRightCircularCylinder = 1575;
/**
 * A roof is the covering of the top part of a building, it protects the building against the effects of wheather.
 */
export declare const IfcRoof = 1576;
/**
 * The building element type IfcRoofType defines commonly shared information for occurrences of roofs. The set of shared information may include:
 */
export declare const IfcRoofType = 1577;
/**
 * IfcRoot is the most abstract and root class for all entity definitions that roots in the kernel or in subsequent layers of the IFC specification. It is therefore the kdtree3 supertype of all IFC entities, beside those defined in an IFC resource schema. All entities that are subtypes of IfcRoot can be used independently, whereas resource schema entities, that are not subtypes of IfcRoot, are not supposed to be independent entities.
 */
export declare const IfcRoot = 1578;
/**
 * IfcRoundedRectangleProfileDef defines a rectangle with equally rounded corners as the profile definition used by the swept surface geometry or the swept area solid. It is given by the X extent, the Y extent, and the radius for the rounded corners, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system, that is, in the center of the bounding box.
 */
export declare const IfcRoundedRectangleProfileDef = 1579;
/**
 * A sanitary terminal is a fixed appliance or terminal usually supplied with water and used for drinking, cleaning or foul water disposal or that is an item of equipment directly used with such an appliance or terminal.
 */
export declare const IfcSanitaryTerminal = 1580;
/**
 * The flow terminal type IfcSanitaryTerminalType defines commonly shared information for occurrences of sanitary terminals. The set of shared information may include:
 */
export declare const IfcSanitaryTerminalType = 1581;
/**
 * IfcSchedulingTime is the abstract supertype of entities that capture time-related information of processes.
 */
export declare const IfcSchedulingTime = 1582;
/**
 * An IfcSeamCurve is a 3-dimensional curve that has additional representations provided by exactly two distinct pcurves describing the same curve at the two extreme ends of a closed parametric surface.
 */
export declare const IfcSeamCurve = 1583;
/**
 * An IfcSectionedSpine is a representation of the shape of a three dimensional object composed by a number of planar cross sections, and a spine curve. The shape is defined between the first element of cross sections and the last element of the cross sections. A sectioned spine may be used to represent a surface or a solid but the interpolation of the shape between the cross sections is not defined.
 */
export declare const IfcSectionedSpine = 1584;
/**
 * IfcSectionProperties defines the cross section properties for a single longitudinal piece of a cross section. It is a special-purpose helper class for IfcSectionReinforcementProperties.
 */
export declare const IfcSectionProperties = 1585;
/**
 * IfcSectionReinforcementProperties defines the cross section properties of reinforcement for a single longitudinal piece of a cross section with a specific reinforcement usage type.
 */
export declare const IfcSectionReinforcementProperties = 1586;
/**
 * A sensor is a device that measures a physical quantity and converts it into a signal which can be read by an observer or by an instrument.
 */
export declare const IfcSensor = 1587;
/**
 * The distribution control element type IfcSensorType defines commonly shared information for occurrences of sensors. The set of shared information may include:
 */
export declare const IfcSensorType = 1588;
/**
 * Shading devices are purpose built devices to protect from the sunlight, from natural light, or screening them from view. Shading devices can form part of the facade or can be mounted inside the building, they can be fixed or operable.
 */
export declare const IfcShadingDevice = 1589;
/**
 * The building element type IfcShadingDeviceType defines commonly shared information for occurrences of shading devices. The set of shared information may include:
 */
export declare const IfcShadingDeviceType = 1590;
/**
 * IfcShapeAspect allows for grouping of shape representation items that represent aspects (or components) of the shape of a product. Thereby shape representations of components of the product shape represent a distinctive part to a product that can be explicitly addressed.
 */
export declare const IfcShapeAspect = 1591;
/**
 * IfcShapeModel represents the concept of a particular geometric and/or topological representation of a product's shape or a product component's shape within a representation context. This representation context has to be a geometric representation context (with the exception of topology representations without associated geometry). The two subtypes are IfcShapeRepresentation to cover geometric models that represent a shape, and IfcTopologyRepresentation to cover the conectivity of a product or product component. The topology may or may not have geometry associated.
 */
export declare const IfcShapeModel = 1592;
/**
 * The IfcShapeRepresentation represents the concept of a particular geometric representation of a product or a product component within a specific geometric representation context. The inherited attribute RepresentationType is used to define the geometric model used for the shape representation (e.g. 'SweptSolid', or 'Brep'), the inherited attribute RepresentationIdentifier is used to denote the kind of the representation captured by the IfcShapeRepresentation (e.g. 'Axis', 'Body', etc.).
 */
export declare const IfcShapeRepresentation = 1593;
/**
 * An IfcShellBasedSurfaceModel represents the shape by a set of open or closed shells. The connected faces within the shell have a dimensionality 2 and are placed in a coordinate space of dimensionality 3.
 */
export declare const IfcShellBasedSurfaceModel = 1594;
/**
 * IfcSimpleProperty is a generalization of a single property object. The various subtypes of IfcSimpleProperty establish different ways in which a property value can be set.
 */
export declare const IfcSimpleProperty = 1595;
/**
 * The IfcSimplePropertyTemplate defines the template for all dynamically extensible properties, either the subtypes of IfcSimpleProperty, or the subtypes of IfcPhysicalSimpleQuantity. The individual property templates are interpreted according to their Name attribute and may have a predefined template type, property units, and property measure types. The correct interpretation of the attributes:
 */
export declare const IfcSimplePropertyTemplate = 1596;
/**
 * A site is a defined area of land, possibly covered with water, on which the project construction is to be completed. A site may be used to erect, retrofit or turn down building(s), or for other construction related developments.
 */
export declare const IfcSite = 1597;
/**
 * The IfcSIUnit covers both standard base SI units such as meter and second, and derived SI units such as Pascal, square meter and cubic meter.
 */
export declare const IfcSIUnit = 1598;
/**
 * A slab is a component of the construction that may enclose a space vertically. The slab may provide the lower support (floor) or upper construction (roof slab) in any space in a building.
 */
export declare const IfcSlab = 1599;
/**
 * The IfcSlabElementedCase defines a slab with certain constraints for the provision of its components. The IfcSlabElementedCase handles all cases of slabs, that are decomposed into parts:
 */
export declare const IfcSlabElementedCase = 1600;
/**
 * The standard slab, IfcSlabStandardCase, defines a slab with certain constraints for the provision of material usage, parameters and with certain constraints for the geometric representation. The IfcSlabStandardCase handles all cases of slabs, that:
 */
export declare const IfcSlabStandardCase = 1601;
/**
 * The element type IfcSlabType defines commonly shared information for occurrences of slabs. The set of shared information may include:
 */
export declare const IfcSlabType = 1602;
/**
 * Describes slippage in support conditions or connection conditions. Slippage means that a relative displacement may occur in a support or connection before support or connection reactions are awoken.
 */
export declare const IfcSlippageConnectionCondition = 1603;
/**
 * A solar device converts solar radiation into other energy such as electric current or thermal energy.
 */
export declare const IfcSolarDevice = 1604;
/**
 * The energy conversion device type IfcSolarDeviceType defines commonly shared information for occurrences of solar devices. The set of shared information may include:
 */
export declare const IfcSolarDeviceType = 1605;
/**
 * An IfcSolidModel represents the 3D shape by different types of solid model representations. It is the kdtree3 abstract supertype of Boundary representation, CSG representation, Sweeping representation and other suitable solid representation schemes.
 */
export declare const IfcSolidModel = 1606;
/**
 * A space represents an area or volume bounded actually or theoretically. Spaces are areas or volumes that provide for certain functions within a building.
 */
export declare const IfcSpace = 1607;
/**
 * Space heaters utilize a combination of radiation and/or natural convection using a heating source such as electricity, steam or hot water to heat a limited space or area. Examples of space heaters include radiators, convectors, baseboard and finned-tube heaters.
 */
export declare const IfcSpaceHeater = 1608;
/**
 * The flow terminal type IfcSpaceHeaterType defines commonly shared information for occurrences of space heaters. The set of shared information may include:
 */
export declare const IfcSpaceHeaterType = 1609;
/**
 * A space represents an area or volume bounded actually or theoretically. Spaces are areas or volumes that provide for certain functions within a building.
 */
export declare const IfcSpaceType = 1610;
/**
 * A spatial element is the generalization of all spatial elements that might be used to define a spatial structure or to define spatial zones.
 */
export declare const IfcSpatialElement = 1611;
/**
 * IfcSpatialElementType defines a list of commonly shared property set definitions of a spatial structure element and an optional set of product representations. It is used to define a spatial element specification (the specific element information, that is kdtree3 to all occurrences of that element type).
 */
export declare const IfcSpatialElementType = 1612;
/**
 * A spatial structure element is the generalization of all spatial elements that might be used to define a spatial structure. That spatial structure is often used to provide a project structure to organize a building project.
 */
export declare const IfcSpatialStructureElement = 1613;
/**
 * The element type (IfcSpatialStructureElementType) defines a list of commonly shared property set definitions of a spatial structure element and an optional set of product representations. It is used to define an element specification (i.e. the specific element information, that is kdtree3 to all occurrences of that element type).
 */
export declare const IfcSpatialStructureElementType = 1614;
/**
 * A spatial zone is a non-hierarchical and potentially overlapping decomposition of the project under some functional consideration. A spatial zone might be used to represent a thermal zone, a construction zone, a lighting zone, a usable area zone. A spatial zone might have its independent placement and shape representation.
 */
export declare const IfcSpatialZone = 1615;
/**
 * The IfcSpatialZoneType defines a list of commonly shared property set definitions of a space and an optional set of product representations. It is used to define a space specification (i.e. the specific space information, that is kdtree3 to all occurrences of that space type).
 */
export declare const IfcSpatialZoneType = 1616;
/**
 * The IfcSphere is a Construction Solid Geometry (CSG) 3D primitive. It is a solid where all points at the surface have the same distance from the center point. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export declare const IfcSphere = 1617;
/**
 * The IfcSphericalSurface is a bounded elementary surface. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export declare const IfcSphericalSurface = 1618;
/**
 * A stack terminal is placed at the top of a ventilating stack (such as to prevent ingress by birds or rainwater) or rainwater pipe (to act as a collector or hopper for discharge from guttering).
 */
export declare const IfcStackTerminal = 1619;
/**
 * The flow terminal type IfcStackTerminalType defines commonly shared information for occurrences of stack terminals. The set of shared information may include:
 */
export declare const IfcStackTerminalType = 1620;
/**
 * A stair is a vertical passageway allowing occupants to walk (step) from one floor level to another floor level at a different elevation. It may include a landing as an intermediate floor slab.
 */
export declare const IfcStair = 1621;
/**
 * A stair flight is an assembly of building components in a single "run" of stair steps (not interrupted by a landing). The stair steps and any stringers are included in the stair flight. A winder is also regarded a part of a stair flight.
 */
export declare const IfcStairFlight = 1622;
/**
 * The building element type IfcStairFlightType defines commonly shared information for occurrences of stair flights. The set of shared information may include:
 */
export declare const IfcStairFlightType = 1623;
/**
 * The building element type IfcStairType defines commonly shared information for occurrences of stairs. The set of shared information may include:
 */
export declare const IfcStairType = 1624;
/**
 * A structural action is a structural activity that acts upon a structural item or building element.
 */
export declare const IfcStructuralAction = 1625;
/**
 * The abstract entity IfcStructuralActivity combines the definition of actions (such as forces, displacements, etc.) and reactions (support reactions, internal forces, deflections, etc.) which are specified by using the basic load definitions from the IfcStructuralLoadResource.
 */
export declare const IfcStructuralActivity = 1626;
/**
 * The IfcStructuralAnalysisModel is used to assemble all information needed to represent a structural analysis model. It encompasses certain general properties (such as analysis type), references to all contained structural members, structural supports or connections, as well as loads and the respective load results.
 */
export declare const IfcStructuralAnalysisModel = 1627;
/**
 * An IfcStructuralConnection represents a structural connection object (node connection, edge connection, or surface connection) or supports.
 */
export declare const IfcStructuralConnection = 1628;
/**
 * Describe more rarely needed connection properties.
 */
export declare const IfcStructuralConnectionCondition = 1629;
/**
 * A structural curve action defines an action which is distributed over a curve. A curve action may be connected with a curve member or curve connection, or surface member or surface connection.
 */
export declare const IfcStructuralCurveAction = 1630;
/**
 * Instances of IfcStructuralCurveConnection describe edge 'nodes', i.e. edges where two or more surface members are joined, or edge supports. Edge curves may be straight or curved.
 */
export declare const IfcStructuralCurveConnection = 1631;
/**
 * Instances of IfcStructuralCurveMember describe edge members, i.e. structural analysis idealizations of beams, columns, rods etc.. Curve members may be straight or curved.
 */
export declare const IfcStructuralCurveMember = 1632;
/**
 * This entity describes edge members with varying profile properties. Each instance of IfcStructuralCurveMemberVarying is composed of two or more instances of IfcStructuralCurveMember with differing profile properties. These subordinate members relate to the instance of IfcStructuralCurveMemberVarying by IfcRelAggregates.
 */
export declare const IfcStructuralCurveMemberVarying = 1633;
/**
 * This entity defines a reaction which occurs distributed over a curve. A curve reaction may be connected with a curve member or curve connection, or surface member or surface connection.
 */
export declare const IfcStructuralCurveReaction = 1634;
/**
 * The abstract entity IfcStructuralItem is the generalization of structural members and structural connections, that is, analysis idealizations of elements in the building model. It defines the relation between structural members and connections with structural activities (actions and reactions).
 */
export declare const IfcStructuralItem = 1635;
/**
 * This entity defines an action with constant value which is distributed over a curve.
 */
export declare const IfcStructuralLinearAction = 1636;
/**
 * This abstract entity is the supertype of all loads (actions or reactions) or of certain requirements resulting from structural analysis, or certain provisions which influence structural analysis.
 */
export declare const IfcStructuralLoad = 1637;
/**
 * A load case is a load group, commonly used to group loads from the same action source.
 */
export declare const IfcStructuralLoadCase = 1638;
/**
 * This class combines one or more load or result values in a 1- or 2-dimensional configuration.
 */
export declare const IfcStructuralLoadConfiguration = 1639;
/**
 * The entity IfcStructuralLoadGroup is used to structure the physical impacts. By using the grouping features inherited from IfcGroup, instances of IfcStructuralAction (or its subclasses) and of IfcStructuralLoadGroup can be used to define load groups, load cases and load combinations. (See also IfcLoadGroupTypeEnum.)
 */
export declare const IfcStructuralLoadGroup = 1640;
/**
 * An instance of the entity IfcStructuralLoadLinearForce shall be used to define actions on curves.
 */
export declare const IfcStructuralLoadLinearForce = 1641;
/**
 * Abstract superclass of simple load or result classes.
 */
export declare const IfcStructuralLoadOrResult = 1642;
/**
 * An instance of the entity IfcStructuralLoadPlanarForce shall be used to define actions on faces.
 */
export declare const IfcStructuralLoadPlanarForce = 1643;
/**
 * Instances of the entity IfcStructuralLoadSingleDisplacement shall be used to define displacements.
 */
export declare const IfcStructuralLoadSingleDisplacement = 1644;
/**
 * Defines a displacement with warping.
 */
export declare const IfcStructuralLoadSingleDisplacementDistortion = 1645;
/**
 * Instances of the entity IfcStructuralLoadSingleForce shall be used to define the forces and moments of an action operating on a single point.
 */
export declare const IfcStructuralLoadSingleForce = 1646;
/**
 * Instances of the entity IfcStructuralLoadSingleForceWarping, as a subtype of IfcStructuralLoadSingleForce, shall be used to define an action operation on a single point. In addition to forces and moments defined by its supertype a warping moment can be defined.
 */
export declare const IfcStructuralLoadSingleForceWarping = 1647;
/**
 * The abstract entity IfcStructuralLoadStatic is the supertype of all static loads (actions or reactions) which can be defined. Within scope are single i.e. concentrated forces and moments, linear i.e. one-dimensionally distributed forces and moments, planar i.e. two-dimensionally distributed forces, furthermore displacements and temperature loads.
 */
export declare const IfcStructuralLoadStatic = 1648;
/**
 * An instance of the entity IfcStructuralLoadTemperature shall be used to define actions which are caused by a temperature change. As shown in Figure 430, the change of temperature is given with a constant value which is applied to the complete section and values for temperature differences between outer fibres of the section.
 */
export declare const IfcStructuralLoadTemperature = 1649;
/**
 * The abstract entity IfcStructuralMember is the superclass of all structural items which represent the idealized structural behavior of building elements.
 */
export declare const IfcStructuralMember = 1650;
/**
 * This entity defines an action with constant value which is distributed over a surface.
 */
export declare const IfcStructuralPlanarAction = 1651;
/**
 * This entity defines an action which acts on a point. A point action is typically connected with a point connection. It may also be connected with a curve member or curve connection, or surface member or surface connection.
 */
export declare const IfcStructuralPointAction = 1652;
/**
 * Instances of IfcStructuralPointConnection describe structural nodes or point supports.
 */
export declare const IfcStructuralPointConnection = 1653;
/**
 * This entity defines a reaction which occurs at a point. A point reaction is typically connected with a point connection. It may also be connected with a curve member or curve connection, or surface member or surface connection.
 */
export declare const IfcStructuralPointReaction = 1654;
/**
 * A structural reaction is a structural activity that results from a structural action imposed to a structural item or building element. Examples are support reactions, internal forces, and deflections.
 */
export declare const IfcStructuralReaction = 1655;
/**
 * Instances of the entity IfcStructuralResultGroup are used to group results of structural analysis calculations and to capture the connection to the underlying basic load group. The basic functionality for grouping inherited from IfcGroup is used to collect instances from IfcStructuralReaction or its respective subclasses.
 */
export declare const IfcStructuralResultGroup = 1656;
/**
 * This entity defines an action which is distributed over a surface. A surface action may be connected with a surface member or surface connection.
 */
export declare const IfcStructuralSurfaceAction = 1657;
/**
 * Instances of IfcStructuralSurfaceConnection describe face 'nodes', i.e. faces where two or more surface members are joined, or face supports. Face surfaces may be planar or curved.
 */
export declare const IfcStructuralSurfaceConnection = 1658;
/**
 * Instances of IfcStructuralSurfaceMember describe face members, that is, structural analysis idealizations of slabs, walls, and shells. Surface members may be planar or curved.
 */
export declare const IfcStructuralSurfaceMember = 1659;
/**
 * This entity describes surface members with varying section properties. The properties are provided by means of Pset_StructuralSurfaceMemberVaryingThickness via IfcRelDefinesByProperties, or by means of aggregation: An instance of IfcStructuralSurfaceMemberVarying may be composed of two or more instances of IfcStructuralSurfaceMember with differing section properties. These subordinate members relate to the instance of IfcStructuralSurfaceMemberVarying by IfcRelAggregates.
 */
export declare const IfcStructuralSurfaceMemberVarying = 1660;
/**
 * This entity defines a reaction which occurs distributed over a surface. A surface reaction may be connected with a surface member or surface connection.
 */
export declare const IfcStructuralSurfaceReaction = 1661;
/**
 * The IfcStyledItem holds presentation style information for products, either explicitly for an IfcGeometricRepresentationItem being part of an IfcShapeRepresentation assigned to a product, or by assigning presentation information to IfcMaterial being assigned as other representation for a product.
 */
export declare const IfcStyledItem = 1662;
/**
 * The IfcStyledRepresentation represents the concept of a styled presentation being a representation of a product or a product component, like material. within a representation context. This representation context does not need to be (but may be) a geometric representation context.
 */
export declare const IfcStyledRepresentation = 1663;
/**
 * IfcStyleModel represents the concept of a particular presentation style defined for a material (or other characteristic) of a product or a product component within a representation context. This representation context may (but has not to be) a geometric representation context.
 */
export declare const IfcStyleModel = 1664;
/**
 * IfcSubContractResource is a construction resource needed in a construction process that represents a sub-contractor.
 */
export declare const IfcSubContractResource = 1665;
/**
 * The resource type IfcSubContractResourceType defines commonly shared information for occurrences of subcontract resources. The set of shared information may include:
 */
export declare const IfcSubContractResourceType = 1666;
/**
 *
 */
export declare const IfcSubedge = 1667;
/**
 * An IfcSurface is a 2-dimensional representation item positioned in 3-dimensional space. 2-dimensional means that each point at the surface can be defined by a 2-dimensional coordinate system, usually by u and v coordinates.
 */
export declare const IfcSurface = 1668;
/**
 * An IfcSurfaceCurve is a 3-dimensional curve that has additional representations provided by one or two pcurves.
 */
export declare const IfcSurfaceCurve = 1669;
/**
 * The IfcSurfaceCurveSweptAreaSolid is the result of sweeping an area along a directrix that lies on a reference surface. The swept area is provided by a subtype of IfcProfileDef. The profile is placed by an implicit cartesian transformation operator at the start point of the sweep, where the profile normal agrees to the tangent of the directrix at this point, and the profile''s x-axis agrees to the surface normal. At any point along the directrix, the swept profile origin lies on the directrix, the profile''s normal points towards the tangent of the directrix, and the profile''s x-axis is identical to the surface normal at this point.
 */
export declare const IfcSurfaceCurveSweptAreaSolid = 1670;
/**
 * A surface feature is a modification at (onto, or into) of the surface of an element. Parts of the surface of the entire surface may be affected. The volume and mass of the element may be increased, remain unchanged, or be decreased by the surface feature, depending on manufacturing technology. However, any increase or decrease of volume is small compared to the total volume of the element.
 */
export declare const IfcSurfaceFeature = 1671;
/**
 * The IfcSurfaceOfLinearExtrusion is a surface derived by sweeping a curve along a vector.
 */
export declare const IfcSurfaceOfLinearExtrusion = 1672;
/**
 * The IfcSurfaceOfRevolution is a surface derived by rotating a curve about an axis.
 */
export declare const IfcSurfaceOfRevolution = 1673;
/**
 * Describes required or provided reinforcement area of surface members.
 */
export declare const IfcSurfaceReinforcementArea = 1674;
/**
 * IfcSurfaceStyle is an assignment of one or many surface style elements to a surface, defined by subtypes of IfcSurface, IfcFaceBasedSurfaceModel, IfcShellBasedSurfaceModel, or by subtypes of IfcSolidModel. The positive direction of the surface normal relates to the positive side. In case of solids the outside of the solid is to be taken as positive side.
 */
export declare const IfcSurfaceStyle = 1675;
/**
 * IfcSurfaceStyleLighting is a container class for properties for calculation of physically exact illuminance related to a particular surface style.
 */
export declare const IfcSurfaceStyleLighting = 1676;
/**
 * IfcSurfaceStyleRefraction extends the surface style lighting, or the surface style rendering definition for properties for calculation of physically exact illuminance by adding seldomly used properties. Currently this includes the refraction index (by which the light ray refracts when passing through a prism) and the dispersion factor (or Abbe constant) which takes into account the wavelength dependency of the refraction.
 */
export declare const IfcSurfaceStyleRefraction = 1677;
/**
 * IfcSurfaceStyleRendering holds the properties for visualization related to a particular surface side style. It allows rendering properties to be defined by:
 */
export declare const IfcSurfaceStyleRendering = 1678;
/**
 * The IfcSurfaceStyleShading allows for colour information and transparency used for shading and simple rendering. The surface colour is used for colouring or simple shading of the assigned surfaces and the transparency for identifying translucency, where 0.0 is completely opaque, and 1.0 is completely transparent.
 */
export declare const IfcSurfaceStyleShading = 1679;
/**
 * The entity IfcSurfaceStyleWithTextures allows to include image textures in surface styles. These image textures can be applied repeating across the surface or mapped with a particular scale upon the surface.
 */
export declare const IfcSurfaceStyleWithTextures = 1680;
/**
 * An IfcSurfaceTexture provides a 2-dimensional image-based texture map. It can either be given by referencing an external image file through an URL reference (IfcImageTexture), including the image file as a blob (long binary) into the data set (IfcBlobTexture), or by explicitly including an array of pixels (IfcPixelTexture).
 */
export declare const IfcSurfaceTexture = 1681;
/**
 * An IfcSweptAreaSolid represents the 3D shape by a sweeping representation scheme allowing a two dimensional planar cross section to sweep through space.
 */
export declare const IfcSweptAreaSolid = 1682;
/**
 * An IfcSweptDiskSolid represents the 3D shape by a sweeping representation scheme allowing a two dimensional circularly bounded plane to sweep along a three dimensional Directrix through space.
 */
export declare const IfcSweptDiskSolid = 1683;
/**
 * The IfcSweptDiskSolidPolygonal is a IfcSweptDiskSolid where the Directrix is restricted to be provided by an poly line only. An optional FilletRadius attribute can be asserted, it is then applied as a fillet to all transitions between the segments of the poly line.
 */
export declare const IfcSweptDiskSolidPolygonal = 1684;
/**
 * An IfcSweptSurface is a surface defined by sweeping a curve. The swept surface is defined by a open or closed curve, represented by a subtype if IfcProfileDef, that is provided as a two-dimensional curve on an implicit plane, and by the sweeping operation.
 */
export declare const IfcSweptSurface = 1685;
/**
 * A switch is used in a cable distribution system (electrical circuit) to control or modulate the flow of electricity.
 */
export declare const IfcSwitchingDevice = 1686;
/**
 * The flow controller type IfcSwitchingDeviceType defines commonly shared information for occurrences of switching devices. The set of shared information may include:
 */
export declare const IfcSwitchingDeviceType = 1687;
/**
 * A system is an organized combination of related parts within an AEC product, composed for a kdtree3 purpose or function or to provide a service. A system is essentially a functionally related aggregation of products. The grouping relationship to one or several instances of IfcProduct (the system members) is handled by IfcRelAssignsToGroup.
 */
export declare const IfcSystem = 1688;
/**
 * A system furniture element defines components of modular furniture which are not directly placed in a building structure but aggregated inside furniture.
 */
export declare const IfcSystemFurnitureElement = 1689;
/**
 * The furnishing element type IfcSystemFurnitureElementType defines commonly shared information for occurrences of system furniture elements. The set of shared information may include:
 */
export declare const IfcSystemFurnitureElementType = 1690;
/**
 * An IfcTable is a data structure for the provision of information in the form of rows and columns. Each instance may have IfcTableColumn instances that define the name, description and units for each column. The rows of information are stored as a list of IfcTableRow objects.
 */
export declare const IfcTable = 1691;
/**
 * An IfcTableColumn is a data structure that captures column information for use in an IfcTable. Each instance defines the identifier, name, description, and units of measure that are applicable to the columnar data associated with the IfcTableRow objects.
 */
export declare const IfcTableColumn = 1692;
/**
 * IfcTableRow contains data for a single row within an IfcTable.
 */
export declare const IfcTableRow = 1693;
/**
 * A tank is a vessel or container in which a fluid or gas is stored for later use.
 */
export declare const IfcTank = 1694;
/**
 * The flow storage device type IfcTankType defines commonly shared information for occurrences of tanks. The set of shared information may include:
 */
export declare const IfcTankType = 1695;
/**
 * An IfcTask is an identifiable unit of work to be carried out in a construction project.
 */
export declare const IfcTask = 1696;
/**
 * IfcTaskTime captures the time-related information about a task including the different types (actual or scheduled) of starting and ending times.
 */
export declare const IfcTaskTime = 1697;
/**
 * IfcTaskTimeRecurring is a recurring instance of IfcTaskTime for handling regularly scheduled or repetitive tasks.
 */
export declare const IfcTaskTimeRecurring = 1698;
/**
 * An IfcTaskType defines a particular type of task that may be specified for use within a work control.
 */
export declare const IfcTaskType = 1699;
/**
 * This entity represents an address to which telephone, electronic mail and other forms of telecommunications should be addressed.
 */
export declare const IfcTelecomAddress = 1700;
/**
 * A tendon is a steel element such as a wire, cable, bar, rod, or strand used to impart prestress to concrete when the element is tensioned.
 */
export declare const IfcTendon = 1701;
/**
 * A tendon anchor is the end connection for tendons in prestressed or posttensioned concrete.
 */
export declare const IfcTendonAnchor = 1702;
/**
 * The reinforcing element type IfcTendonAnchorType defines commonly shared information for occurrences of tendon anchors. The set of shared information may include:
 */
export declare const IfcTendonAnchorType = 1703;
/**
 * The reinforcing element type IfcTendonType defines commonly shared information for occurrences of tendons. The set of shared information may include:
 */
export declare const IfcTendonType = 1704;
/**
 * The IfcTessellatedFaceSet is a boundary representation topological model limited to planar faces and straight edges. It may represent an approximation of an analytical surface or solid that may be provided in addition to its tessellation as a separate shape representation. The IfcTessellatedFaceSet provides a compact data representation of an connected face set using indices into ordered lists of vertices, normals, colours, and texture maps.
 */
export declare const IfcTessellatedFaceSet = 1705;
/**
 * The IfcTessellatedItem is the abstract supertype of all tessellated geometric models.
 */
export declare const IfcTessellatedItem = 1706;
/**
 * The text literal is a geometric representation item which describes a text string using a string literal and additional position and path information. The text size and appearance is determined by the IfcTextStyle that is associated to the IfcTextLiteral through an IfcStyledItem.
 */
export declare const IfcTextLiteral = 1707;
/**
 * The text literal with extent is a text literal with the additional explicit information of the planar extent. An alignment attribute defines how the text box is aligned to the placement and how it may expand if additional lines of text need to be added.
 */
export declare const IfcTextLiteralWithExtent = 1708;
/**
 * The IfcTextStyle is a presentation style for annotations that place a text in model space. The IfcTextStyle provides the text style for presentation information assigned to IfcTextLiteral's. The style is defined by color, text font characteristics, and text box characteristics.
 */
export declare const IfcTextStyle = 1709;
/**
 *
 */
export declare const IfcTextStyleFontModel = 1710;
/**
 * The IfcTextStyleForDefinedFont combines the text font color with an optional background color, that fills the text box, defined by the planar extent given to the text literal.
 */
export declare const IfcTextStyleForDefinedFont = 1711;
/**
 * The IfcTextStyleTextModel combines all text style properties, that affect the presentation of a text literal within a given extent. It includes the spacing between characters and words, the horizontal and vertical alignment of the text within the planar box of the extent, decorations (like underline), transformations of the literal (like uppercase), and the height of each text line within a multi-line text block.
 */
export declare const IfcTextStyleTextModel = 1712;
/**
 * The IfcTextureCoordinate is an abstract supertype of the different kinds to apply texture coordinates to geometries. For vertex based geometries an explicit assignment of 2D texture vertices to the 3D geometry points is supported by the subtype IfcTextureMap, in addition there can be a procedural description of how texture coordinates shall be applied to geometric items. If no IfcTextureCoordinate is provided for the IfcSurfaceTexture, the default mapping shall be used.
 */
export declare const IfcTextureCoordinate = 1713;
/**
 * The IfcTextureCoordinateGenerator describes a procedurally defined mapping function with input parameter to map 2D texture coordinates to 3D geometry vertices. The allowable Mode values and input Parameter need to be agreed upon in view definitions and implementer agreements.
 */
export declare const IfcTextureCoordinateGenerator = 1714;
/**
 * An IfcTextureMap provides the mapping of the 2-dimensional texture coordinates to the surface onto which it is mapped. It is used for mapping the texture to surfaces of vertex based geometry models, such as
 */
export declare const IfcTextureMap = 1715;
/**
 * An IfcTextureVertex is a list of 2 (S, T) texture coordinates.
 */
export declare const IfcTextureVertex = 1716;
/**
 * The IfcTextureVertexList defines an ordered collection of texture vertices. Each texture vertex is a two-dimensional vertex provided by a fixed list of two texture coordinates. The attribute TexCoordsList is a two-dimensional list, where
 */
export declare const IfcTextureVertexList = 1717;
/**
 * IfcTimePeriod defines a time period given by a start and end time. Both time definitions consider the time zone and allow for the daylight savings offset.
 */
export declare const IfcTimePeriod = 1718;
/**
 * A time series is a set of a time-stamped data entries. It allows a natural association of data collected over intervals of time. Time series can be regular or irregular. In regular time series data arrive predictably at predefined intervals. In irregular time series some or all time stamps do not follow a repetitive pattern and unpredictable bursts of data may arrive at unspecified points in time.
 */
export declare const IfcTimeSeries = 1719;
/**
 * A time series value is a list of values that comprise the time series. At least one value must be supplied. Applications are expected to normalize values by applying the following three rules:
 */
export declare const IfcTimeSeriesValue = 1720;
/**
 *
 */
export declare const IfcTopologicalRepresentationItem = 1721;
/**
 * IfcTopologyRepresentation represents the concept of a particular topological representation of a product or a product component within a representation context. This representation context does not need to be (but may be) a geometric representation context. Several representation types for shape representation are included as predefined types:
 */
export declare const IfcTopologyRepresentation = 1722;
/**
 * The IfcToroidalSurface is a bounded elementary surface. It is constructed by completely revolving a circle around an axis line. The inherited Position attribute defines the IfcAxisPlacement3D and provides:
 */
export declare const IfcToroidalSurface = 1723;
/**
 * A transformer is an inductive stationary device that transfers electrical energy from one circuit to another.
 */
export declare const IfcTransformer = 1724;
/**
 * The energy conversion device type IfcTransformerType defines commonly shared information for occurrences of transformers. The set of shared information may include:
 */
export declare const IfcTransformerType = 1725;
/**
 * A transport element is a generalization of all transport related objects that move people, animals or goods within a facility. The IfcTransportElement defines the occurrence of a transport element, that (if given), is expressed by the IfcTransportElementType .
 */
export declare const IfcTransportElement = 1726;
/**
 * The element type IfcTransportElementType  defines commonly shared information for occurrences of transport elements. The set of shared information may include:
 */
export declare const IfcTransportElementType = 1727;
/**
 * IfcTrapeziumProfileDef defines a trapezium as the profile definition used by the swept surface geometry or the swept area solid. It is given by its Top X and Bottom X extent and its Y extent as well as by the offset of the Top X extend, and placed within the 2D position coordinate system, established by the Position attribute. It is placed centric within the position coordinate system, that is, in the center of the bounding box.
 */
export declare const IfcTrapeziumProfileDef = 1728;
/**
 * The IfcTriangulatedFaceSet is a tessellated face set with all faces being bound by triangles. The faces are constructed by implicit polylines defined by three Cartesian points. Depending on the value of the attribute Closed the instance of IfcTriangulatedFaceSet represents:
 */
export declare const IfcTriangulatedFaceSet = 1729;
/**
 * An IfcTrimmedCurve is a bounded curve that is trimmed at both ends. The trimming points may be provided by a Cartesian point or by a parameter value, based on the parameterization of the BasisCurve. The SenseAgreement attribute indicates whether the direction of the IfcTrimmedCurve agrees with or is opposed to the direction of the BasisCurve.
 */
export declare const IfcTrimmedCurve = 1730;
/**
 * IfcTShapeProfileDef defines a section profile that provides the defining parameters of a T-shaped section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export declare const IfcTShapeProfileDef = 1731;
/**
 * A tube bundle is a device consisting of tubes and bundles of tubes used for heat transfer and contained typically within other energy conversion devices, such as a chiller or coil.
 */
export declare const IfcTubeBundle = 1732;
/**
 * The energy conversion device type IfcTubeBundleType defines commonly shared information for occurrences of tube bundles. The set of shared information may include:
 */
export declare const IfcTubeBundleType = 1733;
/**
 * The object type defines the specific information about a type, being kdtree3 to all occurrences of this type. It refers to the specific level of the well recognized generic - specific - occurrance modeling paradigm. The IfcTypeObject gets assigned to the individual object instances (the occurrences) via the IfcRelDefinesByType relationship.
 */
export declare const IfcTypeObject = 1734;
/**
 * IfcTypeProcess defines a specific (or type) definition of a process or activity without being assigned to a schedule or a time. It is used to define a process or activity specification, that is, the specific process or activity information that is kdtree3 to all occurrences that are defined for that process or activity type.
 */
export declare const IfcTypeProcess = 1735;
/**
 * IfcTypeProduct defines a type definition of a product without being already inserted into a project structure (without having a placement), and not being included in the geometric representation context of the project. It is used to define a product specification, that is, the specific product information that is kdtree3 to all occurrences of that product type.
 */
export declare const IfcTypeProduct = 1736;
/**
 * IfcTypeResource defines a specific (or type) definition of a resource. It is used to define a resource specification (the specific resource, that is kdtree3 to all occurrences that are defined for that resource) and could act as a resource template.
 */
export declare const IfcTypeResource = 1737;
/**
 * A unitary control element combines a number of control components into a single product, such as a thermostat or humidistat.
 */
export declare const IfcUnitaryControlElement = 1738;
/**
 * The distribution control element type IfcUnitaryControlElementType defines commonly shared information for occurrences of unitary control elements. The set of shared information may include:
 */
export declare const IfcUnitaryControlElementType = 1739;
/**
 * Unitary equipment typically combine a number of components into a single product, such as air handlers, pre-packaged rooftop air-conditioning units, heat pumps, and split systems.
 */
export declare const IfcUnitaryEquipment = 1740;
/**
 * The energy conversion device type IfcUnitaryEquipmentType defines commonly shared information for occurrences of unitary equipments. The set of shared information may include:
 */
export declare const IfcUnitaryEquipmentType = 1741;
/**
 * IfcUnitAssignment indicates a set of units which may be assigned. Within an IfcUnitAssigment each unit definition shall be unique; that is, there shall be no redundant unit definitions for the same unit type such as length unit or area unit. For currencies, there shall be only a single IfcMonetaryUnit within an IfcUnitAssignment.
 */
export declare const IfcUnitAssignment = 1742;
/**
 * IfcUShapeProfileDef defines a section profile that provides the defining parameters of a U-shape (channel) section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export declare const IfcUShapeProfileDef = 1743;
/**
 * A valve is used in a building services piping distribution system to control or modulate the flow of the fluid.
 */
export declare const IfcValve = 1744;
/**
 * The flow controller type IfcValveType defines commonly shared information for occurrences of valves. The set of shared information may include:
 */
export declare const IfcValveType = 1745;
/**
 * An IfcVector is a geometric representation item having both a magnitude and direction. The magnitude of the vector is solely defined by the Magnitude attribute and the direction is solely defined by the Orientation attribute.
 */
export declare const IfcVector = 1746;
/**
 *
 */
export declare const IfcVertex = 1747;
/**
 *
 */
export declare const IfcVertexLoop = 1748;
/**
 *
 */
export declare const IfcVertexPoint = 1749;
/**
 * A vibration isolator is a device used to minimize the effects of vibration transmissibility in a structure.
 */
export declare const IfcVibrationIsolator = 1750;
/**
 * The element component type IfcVibrationIsolatorType defines commonly shared information for occurrences of vibration isolators. The set of shared information may include:
 */
export declare const IfcVibrationIsolatorType = 1751;
/**
 * A virtual element is a special element used to provide imaginary boundaries, such as between two adjacent, but not separated, spaces. Virtual elements are usually not displayed and does not have quantities and other measures. Therefore IfcVirtualElement does not have material information and quantities attached.
 */
export declare const IfcVirtualElement = 1752;
/**
 * IfcVirtualGridIntersection defines the derived location of the intersection between two grid axes. Offset values may be given to set an offset distance to the grid axis for the calculation of the virtual grid intersection.
 */
export declare const IfcVirtualGridIntersection = 1753;
/**
 * A voiding feature is a modification of an element which reduces its volume. Such a feature may be manufactured in different ways, for example by cutting, drilling, or milling of members made of various materials, or by inlays into the formwork of cast members made of materials such as concrete.
 */
export declare const IfcVoidingFeature = 1754;
/**
 * The wall represents a vertical construction that may bound or subdivide spaces. Wall are usually vertical, or nearly vertical, planar elements, often designed to bear structural loads. A wall is however not required to be load bearing.
 */
export declare const IfcWall = 1755;
/**
 * The IfcWallElementedCase defines a wall with certain constraints for the provision of its components. The IfcWallElementedCase handles all cases of walls, that are decomposed into parts:
 */
export declare const IfcWallElementedCase = 1756;
/**
 * The IfcWallStandardCase defines a wall with certain constraints for the provision of parameters and with certain constraints for the geometric representation. The IfcWallStandardCase handles all cases of walls, that are extruded vertically:
 */
export declare const IfcWallStandardCase = 1757;
/**
 * The element type IfcWallType defines commonly shared information for occurrences of walls.
 */
export declare const IfcWallType = 1758;
/**
 * A waste terminal has the purpose of collecting or intercepting waste from one or more sanitary terminals or other fluid waste generating equipment and discharging it into a single waste/drainage system.
 */
export declare const IfcWasteTerminal = 1759;
/**
 * The flow terminal type IfcWasteTerminalType defines commonly shared information for occurrences of waste terminals. The set of shared information may include:
 */
export declare const IfcWasteTerminalType = 1760;
/**
 * The window is a building element that is predominately used to provide natural light and fresh air. It includes vertical opening but also horizontal opening such as skylights or light domes. It includes constructions with swinging, pivoting, sliding, or revolving panels and fixed panels. A window consists of a lining and one or several panels.
 */
export declare const IfcWindow = 1761;
/**
 * The window lining is the outer frame which enables the window to be fixed in position. The window lining is used to hold the window panels or other casements. The parameter of the IfcWindowLiningProperties define the geometrically relevant parameter of the lining.
 */
export declare const IfcWindowLiningProperties = 1762;
/**
 * A window panel is a casement, that is, a component, fixed or opening, consisting essentially of a frame and the infilling. The infilling of a window panel is normally glazing. The way of operation is defined in the operation type.
 */
export declare const IfcWindowPanelProperties = 1763;
/**
 * The standard window, IfcWindowStandardCase, defines a window with certain constraints for the provision of operation types, opening directions, frame and lining parameters, construction types and with certain constraints for the geometric representation. The IfcWindowStandardCase handles all cases of windows, that:
 */
export declare const IfcWindowStandardCase = 1764;
/**
 * The window style defines a particular style of windows, which may be included into the spatial context of the building model through instances of IfcWindow. A window style defines the overall parameter of the window style and refers to the particular parameter of the lining and one (or several) panels through IfcWindowLiningProperties and IfcWindowPanelProperties.
 */
export declare const IfcWindowStyle = 1765;
/**
 * The element type IfcWindowType defines commonly shared information for occurrences of windows. The set of shared information may include:
 */
export declare const IfcWindowType = 1766;
/**
 * An IfcWorkCalendar defines working and non-working time periods for tasks and resources. It enables to define both specific time periods, such as from 7:00 till 12:00 on 25th August 2009, as well as repetitive time periods based on frequently used recurrence patterns, such as each Monday from 7:00 till 12:00 between 1st March 2009 and 31st December 2009.
 */
export declare const IfcWorkCalendar = 1767;
/**
 * An IfcWorkControl is an abstract supertype which captures information that is kdtree3 to both IfcWorkPlan and IfcWorkSchedule.
 */
export declare const IfcWorkControl = 1768;
/**
 * An IfcWorkPlan represents work plans in a construction or a facilities management project.
 */
export declare const IfcWorkPlan = 1769;
/**
 * An IfcWorkSchedule represents a task schedule of a work plan, which in turn can contain a set of schedules for different purposes.
 */
export declare const IfcWorkSchedule = 1770;
/**
 * IfcWorkTime defines time periods that are used by IfcWorkCalendar for either describing working times or non-working exception times. Besides start and finish dates, a set of time periods can be given by various types of recurrence patterns.
 */
export declare const IfcWorkTime = 1771;
/**
 * A zone is a group of spaces, partial spaces or other zones. Zone structures may not be hierarchical (in contrary to the spatial structure of a project - see IfcSpatialStructureElement), i.e. one individual IfcSpace may be associated with zero, one, or several IfcZone's. IfcSpace's are grouped into an IfcZone by using the objectified relationship IfcRelAssignsToGroup as specified at the supertype IfcGroup.
 */
export declare const IfcZone = 1772;
/**
 * IfcZShapeProfileDef defines a section profile that provides the defining parameters of a Z-shape section to be used by the swept area solid. Its parameters and orientation relative to the position coordinate system are according to the following illustration. The centre of the position coordinate system is in the profile's centre of the bounding box.
 */
export declare const IfcZShapeProfileDef = 1773;
/**
 * Map of names for all supported IFC types.
 */
export declare const typeNames: {
    [key: number]: string;
};
/**
 * Map of type codes for all IFC type names.
 */
export declare const typeCodes: {
    [key: string]: number;
};
