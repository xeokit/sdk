/**
 * @author https://github.com/tmarti, with support from https://tribia.com/
 * @license MIT
 */

export function makeClusters(inputData) {

    function countEntityTriangles(entity) {

        let numTriangles = 0;

        entity.meshes.forEach(function (mesh) {
            numTriangles += mesh.numTriangles;
        });

        return numTriangles;
    }

    function scanCellsForEntities(cellSideInMeters, entityFilterFunc) {

        const filterFunc = entityFilterFunc || function (entity) {
            return true;
        };

        const sizeX = inputData.aabbTree.data.maxX - inputData.aabbTree.data.minX;
        const sizeZ = inputData.aabbTree.data.maxZ - inputData.aabbTree.data.minZ;

        const numCellsPerAxisX = 10;
        const numCellsPerAxisZ = 10;

        const stepX = sizeX / numCellsPerAxisX;
        const stepZ = sizeZ / numCellsPerAxisZ;

        const cells = [];

        let x = inputData.aabbTree.data.minX;

        for (let i = 0; i < numCellsPerAxisX; i++, x += stepX) {

            let z = inputData.aabbTree.data.minZ;

            for (let j = 0; j < numCellsPerAxisZ; j++, z += stepZ) {
                cells.push({
                    minX: x,
                    maxX: x + stepX,
                    minY: -100000000.0,
                    maxY: 100000000.0,
                    minZ: z,
                    maxZ: z + stepZ,
                    indexX: i,
                    indexZ: j,
                });
            }
        }

        const scanResult = {
            cellsByEntity: {},
            entitiesByCell: {},
            cellsX: numCellsPerAxisX,
            cellsZ: numCellsPerAxisZ,
        };

        (cells || []).forEach(function (cell) {
            inputData.aabbTree.search(cell).filter(function (x) {
                return filterFunc(x.entity);
            }).forEach(function (x) {
                const id = x.entity.id;
                scanResult.cellsByEntity [id] = scanResult.cellsByEntity [id] || {
                    cells: [],
                    entity: x.entity,
                };
                scanResult.cellsByEntity [id].cells.push(cell);
                const cellId = cell.indexX + "_" + cell.indexZ;
                scanResult.entitiesByCell [cellId] = scanResult.entitiesByCell [cellId] || {
                    entities: [],
                    cell: cell,
                };
                scanResult.entitiesByCell[cellId].entities.push(x.entity);
            });
        });
        return scanResult;
    }

    /**
     * Get maximum cells that clustered entities can use in order to make sure that at least
     * ```minPercentOfClusteredPolygons``` % polygons are clustered.
     * @param {float} minPercentOfClusteredPolygons
     */
    function getMaxCellsPerEntity(minPercentOfClusteredPolygons, cellsByEntity) {
        const trianglesForEntityCellsCount = {};
        let totalTriangles = 0;
        Object.keys(cellsByEntity).forEach(function (entityId) {
            const entityCells = cellsByEntity[entityId].cells;
            const numCellsForEntity = entityCells.length;
            const entity = cellsByEntity[entityId].entity;
            let numTriangles = countEntityTriangles(entity);
            trianglesForEntityCellsCount [numCellsForEntity] = (trianglesForEntityCellsCount [numCellsForEntity] || 0) + numTriangles;
            totalTriangles += numTriangles;
        });

        const cellsCounts = Object.keys(trianglesForEntityCellsCount);

        cellsCounts.sort(function (a, b) {
            return a - b;
        });

        let cellCount = 0;
        let accum = 0.0;

        for (let i = 0; i < cellsCounts.length && accum < minPercentOfClusteredPolygons; i++) {
            cellCount = cellsCounts[i];
            accum += trianglesForEntityCellsCount[cellCount] / totalTriangles;
        }

        return {
            maxCellsPerEntity: cellCount,
            polygonStats: {
                percentClustered: accum,
                numberClustered: Math.round(accum * totalTriangles),
                numberUnclustered: totalTriangles - Math.round(accum * totalTriangles),
            },
        };
    }

    function generateSpiralIndexes(sizeX, sizeY) {

        const state = {
            pos: {
                x: 0,
                y: 0,
            },
            left: 0,
            right: sizeX,
            top: 0,
            bottom: sizeY,
            dir: 0, // 0 right, 1 down, 2 left, 3 up
        };

        function mustTurn() {
            if (state.dir === 0 && (state.pos.x + 1) >= state.right)
                return true;

            if (state.dir === 1 && (state.pos.y + 1) >= state.bottom)
                return true;

            if (state.dir === 2 && (state.pos.x - 1) <= (state.left - 1))
                return true;

            if (state.dir === 3 && (state.pos.y - 1) <= (state.top - 1))
                return true;

            return false;
        }

        function turn() {
            state.dir = (state.dir + 1) % 4;
            if (state.dir == 0) state.left++;
            if (state.dir == 1) state.top++;
            if (state.dir == 2) state.right--;
            if (state.dir == 3) state.bottom--;
        }

        function advance() {
            if (mustTurn()) {
                turn();
            }
            if (state.dir == 0) state.pos.x++;
            if (state.dir == 1) state.pos.y++;
            if (state.dir == 2) state.pos.x--;
            if (state.dir == 3) state.pos.y--;
        }

        const retVal = [];

        for (let len = sizeX * sizeY; retVal.length < len; advance()) {
            retVal.push(state.pos.x + "_" + state.pos.y);
        }

        return retVal;
    }

    function getAllEntitesOnCell(cellId, maxCellsPerEntity, entitiesByCell, cellsByEntity) {
        const ebc = entitiesByCell [cellId] || {
            entities: [],
        };
        return ebc.entities.filter(function (entity) {
            return cellsByEntity [entity.id].cells.length <= maxCellsPerEntity;
        });
    }

    function generateEntityMappings(cellsX, cellsZ, maxCellsPerEntity, entitiesByCell, cellsByEntity, maxPolygonsPerCluster) {
        const processedEntities = {};
        // Create clusters for entities
        const previousState = {
            accumEntities: [],
        };
        const entityClusters = [];
        generateSpiralIndexes(cellsX, cellsZ).forEach(function (cellId) {
            const entities = getAllEntitesOnCell(
                cellId,
                maxCellsPerEntity,
                entitiesByCell,
                cellsByEntity
            ).filter(function (entity) {
                return !(entity.id in processedEntities);
            });

            entities.forEach(function (entity) {
                processedEntities [entity.id] = true;
            });

            entities.sort(function (e1, e2) {
                return countEntityTriangles(e1) - countEntityTriangles(e2);
            });

            const entitiesToProcess = previousState.accumEntities.concat(entities);

            let accumEntities = [];

            let remainingTriangles = maxPolygonsPerCluster;

            let i = 0;
            do {
                for (; i < entitiesToProcess.length; i++) {
                    const entity = entitiesToProcess [i];
                    const numTriangles = countEntityTriangles(entity);

                    if (numTriangles > remainingTriangles) {
                        entityClusters.push(accumEntities);
                        accumEntities = [];
                        remainingTriangles = maxPolygonsPerCluster;
                    }

                    accumEntities.push(entity);
                    remainingTriangles -= numTriangles;
                }
            } while (i < entitiesToProcess.length);

            previousState.accumEntities = accumEntities;
        });

        if (previousState.accumEntities.length) {
            entityClusters.push(previousState.accumEntities);
        }

        // Create shared clusters for unclustered entities
        const unClusteredEntities = [];

        Object.keys(cellsByEntity).forEach(function (entityId) {
            if (!(entityId in processedEntities)) {
                unClusteredEntities.push(cellsByEntity[entityId].entity);
            }
        });

        let remainingTriangles = maxPolygonsPerCluster;
        let accumEntities = [];

        unClusteredEntities.forEach(function (entity) {
            const numTriangles = countEntityTriangles(entity);
            if (numTriangles > remainingTriangles) {
                entityClusters.push(accumEntities);
                accumEntities = [];
                remainingTriangles = maxPolygonsPerCluster;
            }
            accumEntities.push(entity);
            remainingTriangles -= numTriangles;
        });

        if (accumEntities.length) {
            entityClusters.push(accumEntities);
        }

        // Prepare return value
        const entityIdToClusterIdMapping = {};

        entityClusters.forEach(function (cluster, clusterIndex) {
            cluster.forEach(function (entity) {
                entityIdToClusterIdMapping [entity.id] = clusterIndex;
            });
        });

        return {
            clusters: entityClusters,
            entityIdToClusterIdMapping: entityIdToClusterIdMapping,
        };
    }

    function generateClusters(params) {
        const scanResult = scanCellsForEntities(params.cellSideInMeters, params.entityFilterFunc);
        const maxCellsResult = getMaxCellsPerEntity(params.minPercentOfClustredPolygons, scanResult.cellsByEntity);
        const clusteringResult = generateEntityMappings(
            scanResult.cellsX,
            scanResult.cellsZ,
            maxCellsResult.maxCellsPerEntity,
            scanResult.entitiesByCell,
            scanResult.cellsByEntity,
            params.maxPolygonsPerCluster
        );
        return {
            clusters: {
                // visible: Object.keys (visibleClusters).length,
                total: clusteringResult.clusters.length,
            },
            clusteringResult: clusteringResult,
        };
    }

    let totalClusters = 0;
    const generateClustersResult = generateClusters({
        cellSideInMeters: 0.05,
        entityFilterFunc: function (entity) {
            return true;
        },
        maxPolygonsPerCluster: 90000,
        minPercentOfClustredPolygons: 0.9,
    });

    // totalVisibleClusters += generateClustersResult.clusters.visible;
    totalClusters += generateClustersResult.clusters.total;

    const orderedEntityIds = [];

    generateClustersResult.clusteringResult.clusters.forEach(function (cluster) {
        cluster.forEach(function (item) {
            orderedEntityIds.push(item.id);
        });
    });

    generateClustersResult.orderedEntityIds = orderedEntityIds;

    return generateClustersResult;
};

