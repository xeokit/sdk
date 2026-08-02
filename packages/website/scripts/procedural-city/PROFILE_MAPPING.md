# Profile To Generator Mapping

This first vertical slice maps only visible urban-structure statistics into the
generator.

| Profile field | Generator behavior |
| --- | --- |
| `roads.segmentLength` | Grid step range and therefore local block dimensions. |
| `roads.arterialSpacing` | Number and spacing of arterial roads. |
| `roads.hierarchyShare` | Local/collector/alley/pedestrian road assignment. |
| `roads.widthByHierarchy` | Rendered road widths. |
| `roads.orientationPeaksDegrees` | Rotation of the generated street lattice. |
| `roads.intersectionDegreeWeights` | Amount of radial/branching streets around civic anchors. |
| `roads.curvature` and `relationships.streetIrregularity` | Street point jitter and block irregularity. |
| `blocks.area` | Minimum accepted block size. |
| `blocks.irregularity` | Extra street/block jitter. |
| `blocks.courtyardFrequency` and `relationships.courtyardProbability` | Perimeter/courtyard block selection and courtyard building massing. |
| `parcels.frontage` | Parcel subdivision count along block frontages. |
| `parcels.buildableCoverage` | Block edge margin and building coverage. |
| `parcels.setbacks` | Building inset from parcel edges. |
| `buildings.levels` | Building floor distribution. |
| `buildings.streetAlignmentProbability` | How tightly buildings sit toward parcel/street edges. |
| `landUse` and `relationships.commercialRoadBias` | Residential, mixed-use, office, hotel and civic usage selection. |
| `publicSpace.openSpaceRatio` and `publicSpace.parkFrequencyPerSquareKm` | Number of generated parks and plazas. |
| `waterways.enabled`, `waterways.width`, `waterways.branchWidth`, `waterways.bridgeSpacing`, `waterways.waterfrontSetback` | River corridor generation, branch width, bridge spacing, and block clearance along the water. |

The profile changes distributions and probabilities only. The seed still
determines the exact fictional city layout.
