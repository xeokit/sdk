import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const {Scene} = xeokit.model.scene;
const {Viewer} = xeokit.viewing.viewer;
const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
const {GlobeNavigationController} = xeokit.viewing.navigation.globe;
const {XGFStreamingLoader, readXGFStreamingIndex} = xeokit.formats.xgfstream;
const {BVHPickStrategy} = xeokit.spatial.picking;

const INDEX_URL = "../../../../models/NaturalEarth/xgfstream/index.json";
const COUNTRY_BOUNDARY_INDEX_URL = "../../../../models/NaturalEarthCountryBoundaries/xgfstream/index.json";
const COUNTRY_REGION_INDEX_URL = "../../../../models/NaturalEarthCountryRegions/xgfstream/index.json";
const WATER_INDEX_URL = "../../../../models/NaturalEarthWater/xgfstream/index.json";
const COUNTRY_DATAMODEL_URL = new URL("countries.datamodel.json", new URL(COUNTRY_REGION_INDEX_URL, window.location.href)).toString();
const COUNTRY_OBJECT_MAP_URL = new URL("countries.objectMap.json", new URL(COUNTRY_REGION_INDEX_URL, window.location.href)).toString();
const MODEL_ID = "NaturalEarth";
const COUNTRY_BOUNDARY_MODEL_ID = "NaturalEarthCountryBoundaries";
const COUNTRY_REGION_MODEL_ID = "NaturalEarthCountryRegions";
const WATER_MODEL_ID = "NaturalEarthWater";
const GRATICULE_MODEL_ID = "EarthGraticule";
const SATELLITE_ORBIT_MODEL_ID = "EarthSatelliteOrbits";
const LAUNCH_TRAJECTORY_MODEL_ID = "EarthLaunchTrajectories";
const COUNTRY_LABEL_MODEL_ID = "EarthCountryLabels";
const FETCH_CONCURRENCY = 8;
const EARTH_RADIUS = 6371100;
const OCEAN_RADIUS = EARTH_RADIUS - 60000;
const LAND_LIFT = 75000;
const LAND_SCALE = (EARTH_RADIUS + LAND_LIFT) / EARTH_RADIUS;
const WATER_SCALE = (EARTH_RADIUS + LAND_LIFT - 5000) / EARTH_RADIUS;
const COUNTRY_BOUNDARY_SCALE = (EARTH_RADIUS + LAND_LIFT + 9000) / EARTH_RADIUS;
const COASTLINE_SCALE = COUNTRY_BOUNDARY_SCALE;
const GRATICULE_RADIUS = EARTH_RADIUS + LAND_LIFT + 21000;
const GRATICULE_LABEL_RADIUS = GRATICULE_RADIUS + 45000;
const COUNTRY_LABEL_RADIUS = EARTH_RADIUS + LAND_LIFT + 45000;
const EARTH_ARC_FAR_CLIP = 800000000;
const COUNTRY_BOUNDARY_LAYER_ID = "countryBoundaries";
const COUNTRY_REGION_LAYER_ID = "countryRegions";
const SATELLITE_ORBIT_LAYER_ID = "satelliteOrbits";
const LAUNCH_TRAJECTORY_LAYER_ID = "launchTrajectories";
const LAND_COLOR = [0.340, 0.750, 0.275];
const OCEAN_COLOR = [0.105, 0.320, 0.680];
const COUNTRY_BOUNDARY_COLOR = [0.58, 0.55, 0.34];
const COASTLINE_COLOR = COUNTRY_BOUNDARY_COLOR;
const COUNTRY_REGION_COLOR = [0.355, 0.780, 0.280];
const NEUTRAL_TERRITORY_COLOR = [0.215, 0.440, 0.180];
const COUNTRY_HOVER_COLOR = [0.950, 0.880, 0.180];
const COUNTRY_LABEL_COLOR = [1.0, 1.0, 1.0];
const COUNTRY_LABEL_MIN_POPULATION = 15000000;
const COUNTRY_LABEL_MAX_COUNT = 80;
const COUNTRY_LABEL_MIN_SIZE = 76000;
const COUNTRY_LABEL_MAX_SIZE = 156000;
const ORBIT_LABEL_SIZE = 260000;
const TRAJECTORY_LABEL_SIZE = 180000;
const SATELLITE_ORBITS = [
  {
    id: "issLike",
    name: "LEO 51.6",
    altitudeMeters: 420000,
    inclinationDegrees: 51.6,
    raanDegrees: 22,
    phaseDegrees: 35,
    color: [0.20, 0.86, 1.00],
    opacity: 0.72,
    lineWidth: 1.5
  },
  {
    id: "polarLeo",
    name: "Polar LEO",
    altitudeMeters: 850000,
    inclinationDegrees: 97.6,
    raanDegrees: 128,
    phaseDegrees: 185,
    color: [0.68, 0.90, 1.00],
    opacity: 0.46,
    lineWidth: 1.2
  },
  {
    id: "sunSyncLeo",
    name: "Sun-sync LEO",
    altitudeMeters: 705000,
    inclinationDegrees: 98.2,
    raanDegrees: 205,
    phaseDegrees: 64,
    color: [0.52, 1.00, 0.74],
    opacity: 0.48,
    lineWidth: 1.15
  },
  {
    id: "lowInclinationLeo",
    name: "Low-inclination LEO",
    altitudeMeters: 550000,
    inclinationDegrees: 28.5,
    raanDegrees: 318,
    phaseDegrees: 236,
    color: [0.35, 0.72, 1.00],
    opacity: 0.50,
    lineWidth: 1.15
  },
  {
    id: "retrogradeLeo",
    name: "Retrograde LEO",
    altitudeMeters: 1200000,
    inclinationDegrees: 116,
    raanDegrees: 286,
    phaseDegrees: 122,
    color: [0.80, 0.68, 1.00],
    opacity: 0.40,
    lineWidth: 1.1
  },
  {
    id: "gnssMeo",
    name: "MEO 55",
    altitudeMeters: 20200000,
    inclinationDegrees: 55,
    raanDegrees: 78,
    phaseDegrees: 285,
    color: [1.00, 0.78, 0.28],
    opacity: 0.44,
    lineWidth: 1.3
  },
  {
    id: "galileoMeo",
    name: "MEO 56",
    altitudeMeters: 23222000,
    inclinationDegrees: 56,
    raanDegrees: 198,
    phaseDegrees: 18,
    color: [1.00, 0.66, 0.22],
    opacity: 0.36,
    lineWidth: 1.15
  },
  {
    id: "glonassMeo",
    name: "MEO 64.8",
    altitudeMeters: 19100000,
    inclinationDegrees: 64.8,
    raanDegrees: 302,
    phaseDegrees: 144,
    color: [1.00, 0.86, 0.36],
    opacity: 0.34,
    lineWidth: 1.1
  },
  {
    id: "geo",
    name: "GEO",
    altitudeMeters: 35786000,
    inclinationDegrees: 0,
    raanDegrees: 0,
    phaseDegrees: 310,
    color: [0.92, 0.88, 0.55],
    opacity: 0.36,
    lineWidth: 1.2
  },
  {
    id: "inclinedGeo",
    name: "Inclined GEO",
    altitudeMeters: 35786000,
    inclinationDegrees: 7.5,
    raanDegrees: 68,
    phaseDegrees: 92,
    color: [0.98, 0.96, 0.70],
    opacity: 0.30,
    lineWidth: 1.05
  },
  {
    id: "highEllipticApprox",
    name: "HEO reference",
    altitudeMeters: 26600000,
    inclinationDegrees: 63.4,
    raanDegrees: 248,
    phaseDegrees: 330,
    color: [1.00, 0.52, 0.46],
    opacity: 0.32,
    lineWidth: 1.05
  }
];
const LAUNCH_TRAJECTORIES = [
  {
    id: "capeCanaveralLeo",
    name: "Cape Canaveral LEO",
    lon: -80.604,
    lat: 28.608,
    azimuthDegrees: 72,
    downrangeDegrees: 115,
    apogeeMeters: 1200000,
    targetOrbitAltitudeMeters: 420000,
    targetOrbitSpanDegrees: 105,
    color: [0.30, 1.00, 0.86],
    opacity: 0.82,
    lineWidth: 2.0
  },
  {
    id: "vandenbergPolar",
    name: "Vandenberg Polar",
    lon: -120.572,
    lat: 34.742,
    azimuthDegrees: 176,
    downrangeDegrees: 105,
    apogeeMeters: 1400000,
    targetOrbitAltitudeMeters: 760000,
    targetOrbitSpanDegrees: 95,
    color: [0.58, 0.86, 1.00],
    opacity: 0.76,
    lineWidth: 1.8
  },
  {
    id: "kourouGeo",
    name: "Kourou GEO transfer",
    lon: -52.769,
    lat: 5.239,
    azimuthDegrees: 82,
    downrangeDegrees: 150,
    apogeeMeters: 8200000,
    targetOrbitAltitudeMeters: 35786000,
    targetOrbitSpanDegrees: 70,
    color: [1.00, 0.76, 0.24],
    opacity: 0.78,
    lineWidth: 1.9
  },
  {
    id: "baikonurLeo",
    name: "Baikonur LEO",
    lon: 63.305,
    lat: 45.965,
    azimuthDegrees: 62,
    downrangeDegrees: 118,
    apogeeMeters: 1300000,
    targetOrbitAltitudeMeters: 520000,
    targetOrbitSpanDegrees: 100,
    color: [0.68, 1.00, 0.50],
    opacity: 0.70,
    lineWidth: 1.7
  },
  {
    id: "tanegashimaEast",
    name: "Tanegashima East",
    lon: 130.976,
    lat: 30.390,
    azimuthDegrees: 92,
    downrangeDegrees: 120,
    apogeeMeters: 1500000,
    targetOrbitAltitudeMeters: 620000,
    targetOrbitSpanDegrees: 100,
    color: [1.00, 0.58, 0.46],
    opacity: 0.72,
    lineWidth: 1.7
  }
];
const SHOW_COUNTRY_REGIONS = new URLSearchParams(window.location.search).get("physical") !== "1";
const ENABLE_COUNTRY_SEMANTICS = true;
const COUNTRY_PROPERTY_DISPLAY = [
  ["ADM0_A3", "Code"],
  ["ADMIN", "Admin"],
  ["SOVEREIGNT", "Sovereignty"],
  ["CONTINENT", "Continent"],
  ["REGION_UN", "UN region"],
  ["SUBREGION", "Subregion"],
  ["POP_EST", "Population"],
  ["GDP_MD", "GDP MD"],
  ["ECONOMY", "Economy"],
  ["INCOME_GRP", "Income"]
];

const INITIAL_CAMERA = {
  eye: [21500000, 17900000, 3940000],
  look: [0, 0, 0],
  up: [-0.10713932782841748, -0.0892827731903479, 0.9902271208384044],
  fov: 38
};

main().catch((error) => {
  console.error(error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = String(error?.message || error);
  }
});

async function main() {
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const renderer = new WebGLRenderer({viewer});
  const picker = new BVHPickStrategy(scene);
  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    chunkProgress: document.getElementById("chunkProgress"),
    status: document.getElementById("status"),
    countryName: document.getElementById("countryName"),
    countryProperties: document.getElementById("countryProperties")
  };

  try {
    setStatus(ui, "Loading stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    const view = must(viewer.createView({
      id: "earthView",
      htmlElement: document.getElementById("demoCanvas"),
      adaptiveQuality: false,
      backgroundColor: [0, 0, 0],
      effects: {
        atmosphere: {
          enabled: false
        },
        edges: {
          enabled: false
        },
        sky: {
          enabled: false
        }
      },
      lights: {
        ibl: {
          enabled: false,
          intensity: 0.0
        },
        hemispheric: {
          enabled: false,
          intensity: 0.0
        }
      },
      camera: {
        projection: "perspective",
        perspectiveProjection: {
          fov: INITIAL_CAMERA.fov,
          near: 50000,
          far: EARTH_ARC_FAR_CLIP
        },
        eye: INITIAL_CAMERA.eye,
        look: INITIAL_CAMERA.look,
        up: INITIAL_CAMERA.up
      }
    }));
    window.__earthView = view;
    window.__earthRenderer = renderer;
    ensureEarthLayers(view);
    view.backgroundColor = [0, 0, 0];
    view.effects.atmosphere.enabled = false;
    view.effects.sky.enabled = false;
    configureEarthLighting(view);
    new GlobeNavigationController(view, {
      radius: EARTH_RADIUS,
      minAltitude: 1000,
      maxAltitude: 220000000,
      latitudinalDragScale: 0.38
    });
    enforceEarthArcFarClip(view);
    viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
      if (changedView === view) {
        enforceEarthArcFarClip(view);
      }
    });
    viewer.events.onCameraProjMatrixUpdated.subscribe((changedView) => {
      if (changedView === view) {
        enforceEarthArcFarClip(view);
      }
    });
    createGraticule(scene, {
      radius: GRATICULE_RADIUS,
      labelRadius: GRATICULE_LABEL_RADIUS,
      intervalDegrees: 10,
      segmentDegrees: 0.5,
      labelIntervalDegrees: 20
    });
    createSatelliteOrbits(scene);
    createLaunchTrajectories(scene);
    createOcean(scene, OCEAN_RADIUS);
    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "dynamic",
      coordinateSystem: index.coordinateSystem
    }));
    const loader = new XGFStreamingLoader();
    const chunkManifests = index.chunks.filter((manifest) => manifest.role === "referencesOnly");
    const state = {
      total: chunkManifests.length,
      loaded: 0,
      objects: 0,
      meshes: 0
    };

    render(ui, state);
    await loadStreamChunks(loader, index, sceneModel, view, state, ui);
    restyleEarth(sceneModel, view);
    await loadCountryBoundaries(scene, loader, view, state, ui);
    const countryRegionsLoaded = SHOW_COUNTRY_REGIONS
      ? await loadCountryRegions(scene, loader, view, state, ui)
      : false;
    const waterLoaded = countryRegionsLoaded
      ? await loadWaterRegions(scene, loader, view, state, ui)
      : false;
    setEarthMapMode(view, countryRegionsLoaded && waterLoaded ? "countries" : "physical");
    const countrySemantics = countryRegionsLoaded && ENABLE_COUNTRY_SEMANTICS ? await loadCountrySemantics(ui) : null;
    if (countrySemantics) {
      createCountryLabels(scene, countrySemantics.dataModel);
    }
    installCountryHover(picker, view, countrySemantics, ui);
    state.total = state.loaded;
    render(ui, state);
  } catch (error) {
    console.error(error);
    setStatus(ui, String(error?.message || error));
  }
}

async function loadCountryBoundaries(scene, loader, view, state, ui) {
  setStatus(ui, "Loading country boundaries");
  const index = await fetchStreamingIndex(COUNTRY_BOUNDARY_INDEX_URL);
  const sceneModel = must(scene.createModel({
    id: COUNTRY_BOUNDARY_MODEL_ID,
    updateHint: "dynamic",
    coordinateSystem: index.coordinateSystem
  }));
  window.__earthCountryBoundarySceneModel = sceneModel;
  const chunkManifests = index.chunks.filter((manifest) => manifest.role === "referencesOnly");
  state.total += chunkManifests.length;
  render(ui, state);
  await loadStreamChunks(loader, index, sceneModel, view, state, ui);
  restyleEarth(sceneModel, view);
  setObjectsPickableByPrefix(view, ["earth.countryBoundary."], false);
}

async function loadCountryRegions(scene, loader, view, state, ui) {
  setStatus(ui, "Loading country regions");
  let index;
  try {
    index = await fetchStreamingIndex(COUNTRY_REGION_INDEX_URL);
  } catch (error) {
    console.warn(`Country region stream unavailable: ${error?.message || error}`);
    setStatus(ui, "Country regions unavailable");
    return false;
  }
  const sceneModel = must(scene.createModel({
    id: COUNTRY_REGION_MODEL_ID,
    updateHint: "dynamic",
    coordinateSystem: index.coordinateSystem
  }));
  window.__earthCountryRegionSceneModel = sceneModel;
  const chunkManifests = index.chunks.filter((manifest) => manifest.role === "referencesOnly");
  state.total += chunkManifests.length;
  render(ui, state);
  await loadStreamChunks(loader, index, sceneModel, view, state, ui);
  restyleEarth(sceneModel, view);
  return true;
}

async function loadWaterRegions(scene, loader, view, state, ui) {
  setStatus(ui, "Loading water regions");
  let index;
  try {
    index = await fetchStreamingIndex(WATER_INDEX_URL);
  } catch (error) {
    console.warn(`Water region stream unavailable: ${error?.message || error}`);
    setStatus(ui, "Water regions unavailable");
    return false;
  }
  const sceneModel = must(scene.createModel({
    id: WATER_MODEL_ID,
    updateHint: "dynamic",
    coordinateSystem: index.coordinateSystem
  }));
  window.__earthWaterSceneModel = sceneModel;
  const chunkManifests = index.chunks.filter((manifest) => manifest.role === "referencesOnly");
  state.total += chunkManifests.length;
  render(ui, state);
  await loadStreamChunks(loader, index, sceneModel, view, state, ui);
  restyleEarth(sceneModel, view);
  return true;
}

async function loadCountrySemantics(ui) {
  setStatus(ui, "Loading country semantics");
  try {
    const [dataModelParams, objectMap] = await Promise.all([
      fetchJSON(COUNTRY_DATAMODEL_URL),
      fetchJSON(COUNTRY_OBJECT_MAP_URL)
    ]);
    const data = new xeokit.model.data.Data();
    const dataModel = must(data.createModel({
      id: dataModelParams.id || "NaturalEarthCountries",
      schema: dataModelParams.schema
    }));
    const importer = new xeokit.formats.datamodel.DataModelImporter();
    await importer.load({
      fileData: dataModelParams,
      dataModel
    });
    window.__earthCountryDataModel = dataModel;
    window.__earthCountryObjectMap = objectMap;
    renderCountrySemantic(ui, null);
    return {data, dataModel, objectMap};
  } catch (error) {
    console.warn(`Country semantic data unavailable: ${error?.message || error}`);
    renderCountrySemantic(ui, null, "Unavailable");
    return null;
  }
}

function installCountryHover(picker, view, countrySemantics, ui) {
  renderCountrySemantic(ui, null);
  let lastCountryKey = null;
  let pendingEvent = null;
  let scheduled = false;
  const canvas = view.htmlElement;

  canvas.addEventListener("pointermove", (event) => {
    pendingEvent = event;
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!pendingEvent) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const pickResult = picker.pick({
        view,
        canvasPos: [pendingEvent.clientX - rect.left, pendingEvent.clientY - rect.top],
        filter: (objectId) => objectId.startsWith("earth.countryRegion.")
      });
      const hit = pickResult;
      const countryKey = hit?.hit && hit.objectId ? countryHoverKeyForSceneObject(hit.objectId, countrySemantics?.objectMap) : null;
      if (countryKey?.countryId === lastCountryKey?.countryId) {
        return;
      }
      colorizeHoveredCountry(view, lastCountryKey, countryKey);
      lastCountryKey = countryKey;
      const dataObject = countrySemantics?.dataModel && countryKey?.dataObjectId
        ? countrySemantics.dataModel.objects[countryKey.dataObjectId]
        : null;
      renderCountrySemantic(ui, dataObject);
    });
  });

  canvas.addEventListener("pointerleave", () => {
    colorizeHoveredCountry(view, lastCountryKey, null);
    lastCountryKey = null;
    pendingEvent = null;
    renderCountrySemantic(ui, null);
  });
}

function countryHoverKeyForSceneObject(objectId, objectMap) {
  const match = /^earth\.countryRegion\.country\.([^.]+)\./.exec(objectId);
  if (!match) {
    return null;
  }
  const countryId = match[1];
  return {
    countryId,
    dataObjectId: countryDataObjectIdForSceneObject(objectId, objectMap)
  };
}

function colorizeHoveredCountry(view, previousCountryKey, nextCountryKey) {
  if (previousCountryKey) {
    const previousObjectIds = loadedCountryObjectIds(view, previousCountryKey.countryId);
    if (previousObjectIds.length > 0) {
      view.setObjectsColorized(previousObjectIds, null);
    }
  }
  if (nextCountryKey) {
    const nextObjectIds = loadedCountryObjectIds(view, nextCountryKey.countryId);
    if (nextObjectIds.length > 0) {
      view.setObjectsColorized(nextObjectIds, COUNTRY_HOVER_COLOR);
    }
  }
}

function loadedCountryObjectIds(view, countryId) {
  const loaded = [];
  const viewObjects = view.objects || {};
  const countryPrefix = `earth.countryRegion.country.${countryId}.`;
  for (const loadedObjectId of Object.keys(viewObjects)) {
    if (loadedObjectId.startsWith(countryPrefix)) {
      loaded.push(loadedObjectId);
    }
  }
  return loaded;
}

function countryDataObjectIdForSceneObject(objectId, objectMap) {
  const direct = objectMap?.objects?.[objectId];
  if (direct) {
    return direct;
  }
  const match = /^earth\.countryRegion\.country\.([^.]+)\./.exec(objectId);
  return match ? objectMap?.countries?.[match[1]] || null : null;
}

async function loadStreamChunks(loader, index, sceneModel, view, state, ui) {
  const chunkManifests = index.chunks.filter((manifest) => manifest.role === "referencesOnly");
  await loader.loadChunks({
    manifests: chunkManifests,
    sceneModel
  }, {
    manifests: index.chunks,
    fetchConcurrency: FETCH_CONCURRENCY,
    getFileData: (manifest) => fetchArrayBuffer(manifest.uri),
    onChunkLoaded: (manifest) => {
      if (manifest.role !== "referencesOnly") {
        return;
      }
      restyleEarth(sceneModel, view);
      state.loaded++;
      state.objects += manifest.counts?.objects || 0;
      state.meshes += manifest.counts?.meshes || 0;
      render(ui, state);
    }
  });
}

async function fetchStreamingIndex(url) {
  const streamIndex = await fetchJSON(url);
  const result = readXGFStreamingIndex(streamIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, url);
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Failed to fetch ${url}: ${request.status}`));
        return;
      }
      resolve(request.responseText);
    };
    request.onerror = () => reject(new Error(`Failed to fetch ${url}`));
    request.send();
  });
}

function fetchArrayBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Failed to fetch ${url}: ${request.status}`));
        return;
      }
      resolve(request.response);
    };
    request.onerror = () => reject(new Error(`Failed to fetch ${url}`));
    request.send();
  });
}

function resolveIndexRelativeChunkUris(index, indexURL) {
  const baseURL = new URL(indexURL, window.location.href).href;
  return {
    ...index,
    chunks: (index.chunks || []).map((manifest) => ({
      ...manifest,
      uri: manifest.uri ? new URL(manifest.uri, baseURL).href : manifest.uri,
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: dependency.uri ? new URL(dependency.uri, baseURL).href : dependency.uri
        }))
      }
    }))
  };
}

function createOcean(scene, radius) {
  const model = must(scene.createModel({
    id: "EarthOceanLocal",
    updateHint: "static"
  }));
  const sphere = must(xeokit.model.generation.buildGeometry.buildSphere({
    radius,
    heightSegments: 64,
    widthSegments: 128,
    center: [0, 0, 0]
  }));
  must(model.createGeometry({
    id: "earth.localOcean.geometry",
    primitive: sphere.primitive,
    positions: sphere.positions,
    normals: sphere.normals,
    indices: sphere.indices
  }));
  must(model.createMaterial({
    id: "earth.localOcean.material",
    color: OCEAN_COLOR,
    roughness: 0.18,
    metallic: 0
  }));
  must(model.createMesh({
    id: "earth.localOcean.mesh",
    geometryId: "earth.localOcean.geometry",
    materialId: "earth.localOcean.material"
  }));
  must(model.createObject({
    id: "earth.localOcean",
    meshIds: ["earth.localOcean.mesh"],
    clippable: false,
    pickable: false
  }));
}

function restyleEarth(sceneModel, view) {
  const landMaterial = sceneModel.materials?.["earth.land"];
  if (landMaterial) {
    landMaterial.color = LAND_COLOR;
  }
  const boundaryMaterial = sceneModel.materials?.["earth.countryBoundary"];
  if (boundaryMaterial) {
    boundaryMaterial.color = COUNTRY_BOUNDARY_COLOR;
    boundaryMaterial.opacity = 1.0;
  }
  const regionMaterial = sceneModel.materials?.["earth.countryRegion"];
  if (regionMaterial) {
    regionMaterial.color = COUNTRY_REGION_COLOR;
  }
  const neutralMaterial = sceneModel.materials?.["earth.neutralTerritory"];
  if (neutralMaterial) {
    neutralMaterial.color = NEUTRAL_TERRITORY_COLOR;
  }
  const waterMaterial = sceneModel.materials?.["earth.water"];
  if (waterMaterial) {
    waterMaterial.color = OCEAN_COLOR;
  }
  const coastlineMaterial = sceneModel.materials?.["earth.coastline"];
  if (coastlineMaterial) {
    coastlineMaterial.color = COASTLINE_COLOR;
    coastlineMaterial.opacity = 1.0;
  }
  liftSurfaceMeshes(sceneModel);
  const streamedOcean = view.objects?.["earth.ocean"];
  if (streamedOcean) {
    streamedOcean.visible = false;
  }
  restyleSurfaceFillMeshes(sceneModel);
  restyleCoastlineMeshes(sceneModel);
  restyleCountryBoundaryMeshes(sceneModel);
}

function restyleSurfaceFillMeshes(sceneModel) {
  for (const mesh of Object.values(sceneModel.meshes || {})) {
    switch (mesh?.materialId) {
      case "earth.land":
        mesh.color = LAND_COLOR;
        mesh.opacity = 1.0;
        break;
      case "earth.countryRegion":
        mesh.color = COUNTRY_REGION_COLOR;
        mesh.opacity = 1.0;
        break;
      case "earth.neutralTerritory":
        mesh.color = NEUTRAL_TERRITORY_COLOR;
        mesh.opacity = 1.0;
        break;
      case "earth.water":
        mesh.color = OCEAN_COLOR;
        mesh.opacity = 1.0;
        break;
    }
  }
}

function restyleCoastlineMeshes(sceneModel) {
  for (const mesh of Object.values(sceneModel.meshes || {})) {
    if (mesh?.materialId !== "earth.coastline") {
      continue;
    }
    mesh.color = COASTLINE_COLOR;
    mesh.opacity = 0.68;
    mesh.lineWidth = 1.6;
  }
}

function restyleCountryBoundaryMeshes(sceneModel) {
  for (const mesh of Object.values(sceneModel.meshes || {})) {
    if (mesh?.materialId !== "earth.countryBoundary") {
      continue;
    }
    mesh.color = COUNTRY_BOUNDARY_COLOR;
    mesh.opacity = 0.68;
    mesh.lineWidth = 1.6;
  }
}

function liftSurfaceMeshes(sceneModel) {
  const lifted = sceneModel.__earthLiftedSurfaceMeshes || (sceneModel.__earthLiftedSurfaceMeshes = new Set());
  for (const mesh of Object.values(sceneModel.meshes || {})) {
    const scale = getSurfaceScale(mesh?.materialId);
    if (!mesh || lifted.has(mesh.id) || !scale) {
      continue;
    }
    mesh.matrix = [
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      0, 0, 0, 1
    ];
    lifted.add(mesh.id);
  }
  window.__earthLiftedMeshCount = lifted.size;
}

function getSurfaceScale(materialId) {
  switch (materialId) {
    case "earth.land":
      return LAND_SCALE;
    case "earth.coastline":
      return COASTLINE_SCALE;
    case "earth.water":
      return WATER_SCALE;
    case "earth.countryRegion":
    case "earth.neutralTerritory":
      return LAND_SCALE;
    case "earth.countryBoundary":
      return COUNTRY_BOUNDARY_SCALE;
    default:
      return 0;
  }
}

function ensureEarthLayers(view) {
  ensureLayer(view, COUNTRY_BOUNDARY_LAYER_ID, true);
  ensureLayer(view, COUNTRY_REGION_LAYER_ID, false);
  ensureLayer(view, SATELLITE_ORBIT_LAYER_ID, true);
  ensureLayer(view, LAUNCH_TRAJECTORY_LAYER_ID, true);
}

function configureEarthLighting(view) {
  view.lights.ibl.enabled = false;
  view.lights.ibl.intensity = 0.0;
  view.lights.hemispheric.enabled = false;
  view.lights.hemispheric.intensity = 0.0;

  const dirLights = [];
  for (const light of view.lightsList || []) {
    if (light.space !== undefined) {
      dirLights.push(light);
    } else if (light.color && light.intensity !== undefined) {
      light.color = [0.46, 0.50, 0.44];
      light.intensity = 0.22;
    }
  }

  if (dirLights[0]) {
    dirLights[0].dir = [0.35, -0.55, -0.76];
    dirLights[0].color = [0.95, 0.96, 0.86];
    dirLights[0].intensity = 0.78;
  }

  for (let i = 1; i < dirLights.length; i++) {
    dirLights[i].intensity = 0.0;
  }
}

function enforceEarthArcFarClip(view) {
  if (view.camera.perspectiveProjection.far < EARTH_ARC_FAR_CLIP) {
    view.camera.perspectiveProjection.far = EARTH_ARC_FAR_CLIP;
  }
}

function ensureLayer(view, id, visible) {
  if (view.layers?.[id]) {
    setLayerObjectsVisible(view.layers[id], visible);
    return view.layers[id];
  }
  const layerResult = view.createLayer({
    id,
    visible,
    autoDestroy: false
  });
  if (!layerResult.ok) {
    throw new Error(`Error creating ViewLayer '${id}': ${layerResult.error}`);
  }
  return layerResult.value;
}

function setEarthMapMode(view, mode) {
  const countryMode = mode === "countries";
  setObjectsVisibleByPrefix(view, ["earth.land.", "earth.localOcean", "earth.ocean"], !countryMode);
  setObjectsVisibleByPrefix(view, ["earth.coastline."], true);
  setObjectsVisibleByPrefix(view, ["earth.water.", "earth.countryRegion."], countryMode);
  setObjectsVisibleByPrefix(view, ["earth.graticule."], true);
  setObjectsVisibleByPrefix(view, ["earth.satelliteOrbit."], true);
  setObjectsVisibleByPrefix(view, ["earth.launchTrajectory."], true);
  if (view.layers?.[COUNTRY_REGION_LAYER_ID]) {
    setLayerObjectsVisible(view.layers[COUNTRY_REGION_LAYER_ID], countryMode);
  }
  if (view.layers?.[COUNTRY_BOUNDARY_LAYER_ID]) {
    setLayerObjectsVisible(view.layers[COUNTRY_BOUNDARY_LAYER_ID], countryMode);
  }
  if (view.layers?.[SATELLITE_ORBIT_LAYER_ID]) {
    setLayerObjectsVisible(view.layers[SATELLITE_ORBIT_LAYER_ID], true);
  }
  if (view.layers?.[LAUNCH_TRAJECTORY_LAYER_ID]) {
    setLayerObjectsVisible(view.layers[LAUNCH_TRAJECTORY_LAYER_ID], true);
  }
}

function setLayerObjectsVisible(layer, visible) {
  layer.setObjectsVisible(layer.objectIds || [], visible);
  layer.visible = visible;
}

function setObjectsVisibleByPrefix(view, prefixes, visible) {
  const objectIds = Object.keys(view.objects || {}).filter((id) => prefixes.some((prefix) => id.startsWith(prefix)));
  if (objectIds.length > 0) {
    view.setObjectsVisible(objectIds, visible);
  }
}

function setObjectsPickableByPrefix(view, prefixes, pickable) {
  const objectIds = Object.keys(view.objects || {}).filter((id) => prefixes.some((prefix) => id.startsWith(prefix)));
  if (objectIds.length > 0 && view.setObjectsPickable) {
    view.setObjectsPickable(objectIds, pickable);
  }
}

function createGraticule(scene, options) {
  const radius = options.radius;
  const labelRadius = options.labelRadius || radius;
  const intervalDegrees = options.intervalDegrees;
  const segmentDegrees = options.segmentDegrees;
  const labelIntervalDegrees = options.labelIntervalDegrees || intervalDegrees;
  const model = must(scene.createModel({
    id: GRATICULE_MODEL_ID,
    updateHint: "static"
  }));

  must(model.createGeometry({
    id: "latitudeLines",
    primitive: xeokit.base.constants.LinesPrimitive,
    ...buildLatitudeLines(radius, intervalDegrees, segmentDegrees)
  }));
  must(model.createMesh({
    id: "latitudeLinesMesh",
    geometryId: "latitudeLines",
    color: [0.46, 0.48, 0.42],
    opacity: 0.24,
    lineWidth: 1.0
  }));
  must(model.createObject({
    id: "earth.graticule.latitude",
    meshIds: ["latitudeLinesMesh"],
    clippable: false,
    pickable: false
  }));

  must(model.createGeometry({
    id: "longitudeLines",
    primitive: xeokit.base.constants.LinesPrimitive,
    ...buildLongitudeLines(radius, intervalDegrees, segmentDegrees)
  }));
  must(model.createMesh({
    id: "longitudeLinesMesh",
    geometryId: "longitudeLines",
    color: [0.46, 0.48, 0.42],
    opacity: 0.22,
    lineWidth: 1.0
  }));
  must(model.createObject({
    id: "earth.graticule.longitude",
    meshIds: ["longitudeLinesMesh"],
    clippable: false,
    pickable: false
  }));

  createGraticuleLabels(model, {
    radius: labelRadius,
    intervalDegrees: labelIntervalDegrees,
    size: 260000
  });
}

function buildLatitudeLines(radius, intervalDegrees, segmentDegrees) {
  const positions = [];
  const indices = [];
  let vertex = 0;
  for (let lat = -90 + intervalDegrees; lat <= 90 - intervalDegrees; lat += intervalDegrees) {
    const startVertex = vertex;
    for (let lon = -180; lon <= 180; lon += segmentDegrees) {
      positions.push(...lonLatToXYZ(lon, lat, radius));
      if (vertex > startVertex) {
        indices.push(vertex - 1, vertex);
      }
      vertex++;
    }
    indices.push(vertex - 1, startVertex);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices)
  };
}

function buildLongitudeLines(radius, intervalDegrees, segmentDegrees) {
  const positions = [];
  const indices = [];
  let vertex = 0;
  for (let lon = -180; lon < 180; lon += intervalDegrees) {
    const startVertex = vertex;
    for (let lat = -90; lat <= 90; lat += segmentDegrees) {
      positions.push(...lonLatToXYZ(lon, lat, radius));
      if (vertex > startVertex) {
        indices.push(vertex - 1, vertex);
      }
      vertex++;
    }
    indices.push(vertex - 1, startVertex);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices)
  };
}

function createSatelliteOrbits(scene) {
  const model = must(scene.createModel({
    id: SATELLITE_ORBIT_MODEL_ID,
    layerId: SATELLITE_ORBIT_LAYER_ID,
    updateHint: "static"
  }));

  for (const orbit of SATELLITE_ORBITS) {
    const orbitGeometryId = `satelliteOrbitGeometry.${orbit.id}`;
    const orbitMeshId = `satelliteOrbitMesh.${orbit.id}`;
    const markerGeometryId = `satelliteMarkerGeometry.${orbit.id}`;
    const markerMeshId = `satelliteMarkerMesh.${orbit.id}`;
    const labelMeshId = createArcBillboardLabel(model, {
      id: `satelliteOrbit.${orbit.id}`,
      text: orbit.name,
      position: satelliteOrbitLabelPosition(orbit),
      size: ORBIT_LABEL_SIZE,
      color: orbit.color,
      opacity: Math.min(1.0, orbit.opacity + 0.18),
      lineWidth: 1.0
    });

    must(model.createGeometry({
      id: orbitGeometryId,
      primitive: xeokit.base.constants.LinesPrimitive,
      ...buildSatelliteOrbitLine(orbit, 720)
    }));
    must(model.createMesh({
      id: orbitMeshId,
      geometryId: orbitGeometryId,
      color: orbit.color,
      opacity: orbit.opacity,
      lineWidth: orbit.lineWidth
    }));

    must(model.createGeometry({
      id: markerGeometryId,
      primitive: xeokit.base.constants.LinesPrimitive,
      ...buildSatelliteMarker(orbit)
    }));
    must(model.createMesh({
      id: markerMeshId,
      geometryId: markerGeometryId,
      color: orbit.color,
      opacity: Math.min(1.0, orbit.opacity + 0.2),
      lineWidth: orbit.lineWidth + 0.8
    }));

    must(model.createObject({
      id: `earth.satelliteOrbit.${orbit.id}`,
      meshIds: [orbitMeshId, markerMeshId, labelMeshId],
      clippable: false,
      pickable: false
    }));
  }

  window.__earthSatelliteOrbits = SATELLITE_ORBITS.map((orbit) => ({
    id: orbit.id,
    name: orbit.name,
    altitudeMeters: orbit.altitudeMeters,
    inclinationDegrees: orbit.inclinationDegrees
  }));
}

function buildSatelliteOrbitLine(orbit, segments) {
  const positions = [];
  const indices = [];
  const radius = EARTH_RADIUS + orbit.altitudeMeters;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(...orbitPoint(radius, angle, orbit.inclinationDegrees, orbit.raanDegrees));
    if (i > 0) {
      indices.push(i - 1, i);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices)
  };
}

function buildSatelliteMarker(orbit) {
  const radius = EARTH_RADIUS + orbit.altitudeMeters;
  const angle = orbit.phaseDegrees * Math.PI / 180;
  const position = orbitPoint(radius, angle, orbit.inclinationDegrees, orbit.raanDegrees);
  const tangent = normalize3(subtract3(
    orbitPoint(radius, angle + 0.01, orbit.inclinationDegrees, orbit.raanDegrees),
    position
  ));
  const radial = normalize3(position);
  const normal = normalize3(cross3(radial, tangent));
  const size = Math.max(150000, Math.min(900000, radius * 0.018));
  const positions = [
    ...addScaled3(position, tangent, -size), ...addScaled3(position, tangent, size),
    ...addScaled3(position, normal, -size * 0.72), ...addScaled3(position, normal, size * 0.72),
    ...addScaled3(position, radial, -size * 0.48), ...addScaled3(position, radial, size * 0.48)
  ];
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5])
  };
}

function satelliteOrbitLabelPosition(orbit) {
  const radius = EARTH_RADIUS + orbit.altitudeMeters;
  const angle = (orbit.phaseDegrees + 16) * Math.PI / 180;
  return orbitPoint(radius, angle, orbit.inclinationDegrees, orbit.raanDegrees);
}

function orbitPoint(radius, angle, inclinationDegrees, raanDegrees) {
  const inclination = inclinationDegrees * Math.PI / 180;
  const raan = raanDegrees * Math.PI / 180;
  const x = radius * Math.cos(angle);
  const yInclined = radius * Math.sin(angle) * Math.cos(inclination);
  const zInclined = radius * Math.sin(angle) * Math.sin(inclination);
  return [
    x * Math.cos(raan) - yInclined * Math.sin(raan),
    x * Math.sin(raan) + yInclined * Math.cos(raan),
    zInclined
  ];
}

function createLaunchTrajectories(scene) {
  const model = must(scene.createModel({
    id: LAUNCH_TRAJECTORY_MODEL_ID,
    layerId: LAUNCH_TRAJECTORY_LAYER_ID,
    updateHint: "static"
  }));

  for (const trajectory of LAUNCH_TRAJECTORIES) {
    const trajectoryGeometryId = `launchTrajectoryGeometry.${trajectory.id}`;
    const trajectoryMeshId = `launchTrajectoryMesh.${trajectory.id}`;
    const targetOrbitGeometryId = `launchTargetOrbitGeometry.${trajectory.id}`;
    const targetOrbitMeshId = `launchTargetOrbitMesh.${trajectory.id}`;
    const markerGeometryId = `launchSiteMarkerGeometry.${trajectory.id}`;
    const markerMeshId = `launchSiteMarkerMesh.${trajectory.id}`;
    const labelMeshId = createArcBillboardLabel(model, {
      id: `launchTrajectory.${trajectory.id}`,
      text: trajectory.name,
      position: launchTrajectoryLabelPosition(trajectory),
      size: TRAJECTORY_LABEL_SIZE,
      color: trajectory.color,
      opacity: Math.min(1.0, trajectory.opacity + 0.18),
      lineWidth: 1.0
    });

    must(model.createGeometry({
      id: trajectoryGeometryId,
      primitive: xeokit.base.constants.LinesPrimitive,
      ...buildLaunchTrajectoryLine(trajectory, 160)
    }));
    must(model.createMesh({
      id: trajectoryMeshId,
      geometryId: trajectoryGeometryId,
      color: trajectory.color,
      opacity: trajectory.opacity,
      lineWidth: trajectory.lineWidth
    }));

    must(model.createGeometry({
      id: targetOrbitGeometryId,
      primitive: xeokit.base.constants.LinesPrimitive,
      ...buildLaunchTargetOrbitLine(trajectory, 160)
    }));
    must(model.createMesh({
      id: targetOrbitMeshId,
      geometryId: targetOrbitGeometryId,
      color: trajectory.color,
      opacity: Math.max(0.28, trajectory.opacity * 0.56),
      lineWidth: Math.max(1.0, trajectory.lineWidth - 0.35)
    }));

    must(model.createGeometry({
      id: markerGeometryId,
      primitive: xeokit.base.constants.LinesPrimitive,
      ...buildLaunchSiteMarker(trajectory)
    }));
    must(model.createMesh({
      id: markerMeshId,
      geometryId: markerGeometryId,
      color: trajectory.color,
      opacity: Math.min(1.0, trajectory.opacity + 0.18),
      lineWidth: trajectory.lineWidth + 0.6
    }));

    must(model.createObject({
      id: `earth.launchTrajectory.${trajectory.id}`,
      meshIds: [trajectoryMeshId, targetOrbitMeshId, markerMeshId, labelMeshId],
      clippable: false,
      pickable: false
    }));
  }

  window.__earthLaunchTrajectories = LAUNCH_TRAJECTORIES.map((trajectory) => ({
    id: trajectory.id,
    name: trajectory.name,
    lon: trajectory.lon,
    lat: trajectory.lat,
    azimuthDegrees: trajectory.azimuthDegrees,
    apogeeMeters: trajectory.apogeeMeters,
    targetOrbitAltitudeMeters: trajectory.targetOrbitAltitudeMeters
  }));
}

function buildLaunchTrajectoryLine(trajectory, segments) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ground = destinationLonLat(
      trajectory.lon,
      trajectory.lat,
      trajectory.azimuthDegrees,
      trajectory.downrangeDegrees * t
    );
    const altitude = trajectory.apogeeMeters * easeOutCubic(t);
    positions.push(...lonLatToXYZ(ground.lon, ground.lat, EARTH_RADIUS + LAND_LIFT + 7000 + altitude));
    if (i > 0) {
      indices.push(i - 1, i);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices)
  };
}

function buildLaunchTargetOrbitLine(trajectory, segments) {
  const insertion = launchInsertionFrame(trajectory, EARTH_RADIUS + trajectory.targetOrbitAltitudeMeters);
  const span = trajectory.targetOrbitSpanDegrees * Math.PI / 180;
  const startAngle = -span * 0.20;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + span * t;
    positions.push(...rotateAroundAxis(insertion.position, insertion.normal, angle));
    if (i > 0) {
      indices.push(i - 1, i);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices)
  };
}

function buildLaunchSiteMarker(trajectory) {
  const position = lonLatToXYZ(trajectory.lon, trajectory.lat, EARTH_RADIUS + LAND_LIFT + 14000);
  const up = normalize3(position);
  const east = normalize3([-position[1], position[0], 0]);
  const north = normalize3(cross3(up, east));
  const size = 145000;
  const positions = [
    ...addScaled3(position, east, -size), ...addScaled3(position, east, size),
    ...addScaled3(position, north, -size), ...addScaled3(position, north, size),
    ...position, ...addScaled3(position, up, size * 1.4)
  ];
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5])
  };
}

function launchTrajectoryLabelPosition(trajectory) {
  const t = 0.58;
  const ground = destinationLonLat(
    trajectory.lon,
    trajectory.lat,
    trajectory.azimuthDegrees,
    trajectory.downrangeDegrees * t
  );
  const altitude = trajectory.apogeeMeters * easeOutCubic(t);
  return lonLatToXYZ(ground.lon, ground.lat, EARTH_RADIUS + LAND_LIFT + 7000 + altitude);
}

function launchInsertionFrame(trajectory, radius) {
  const end = destinationLonLat(
    trajectory.lon,
    trajectory.lat,
    trajectory.azimuthDegrees,
    trajectory.downrangeDegrees
  );
  const position = lonLatToXYZ(end.lon, end.lat, radius);
  const ahead = destinationLonLat(end.lon, end.lat, trajectory.azimuthDegrees, 0.5);
  const tangent = normalize3(subtract3(lonLatToXYZ(ahead.lon, ahead.lat, radius), position));
  const radial = normalize3(position);
  const normal = normalize3(cross3(radial, tangent));
  return {position, tangent, radial, normal};
}

function destinationLonLat(lonDegrees, latDegrees, bearingDegrees, angularDistanceDegrees) {
  const lon = lonDegrees * Math.PI / 180;
  const lat = latDegrees * Math.PI / 180;
  const bearing = bearingDegrees * Math.PI / 180;
  const distance = angularDistanceDegrees * Math.PI / 180;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinDistance = Math.sin(distance);
  const cosDistance = Math.cos(distance);
  const resultLat = Math.asin(sinLat * cosDistance + cosLat * sinDistance * Math.cos(bearing));
  const resultLon = lon + Math.atan2(
    Math.sin(bearing) * sinDistance * cosLat,
    cosDistance - sinLat * Math.sin(resultLat)
  );
  return {
    lon: wrapLongitudeDegrees(resultLon * 180 / Math.PI),
    lat: resultLat * 180 / Math.PI
  };
}

function wrapLongitudeDegrees(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function easeOutCubic(t) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function lonLatToXYZ(lonDegrees, latDegrees, radius) {
  const lon = lonDegrees * Math.PI / 180;
  const lat = latDegrees * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return [
    radius * cosLat * Math.cos(lon),
    radius * cosLat * Math.sin(lon),
    radius * Math.sin(lat)
  ];
}

function createGraticuleLabels(model, options) {
  const radius = options.radius;
  const intervalDegrees = options.intervalDegrees;
  const size = options.size;
  const meshIds = [];
  let id = 0;

  for (let lon = -150; lon <= 180; lon += intervalDegrees) {
    meshIds.push(createGraticuleLabel(model, {
      id: id++,
      text: formatLongitude(lon),
      lon,
      lat: 0,
      radius,
      size
    }));
  }

  for (let lat = -60; lat <= 60; lat += intervalDegrees) {
    if (lat === 0) {
      continue;
    }
    meshIds.push(createGraticuleLabel(model, {
      id: id++,
      text: formatLatitude(lat),
      lon: -165,
      lat,
      radius,
      size
    }));
  }

  must(model.createObject({
    id: "earth.graticule.labels",
    meshIds,
    clippable: false,
    pickable: false
  }));
}

function createCountryLabels(scene, dataModel) {
  if (window.__earthCountryLabelsCreated) {
    return;
  }
  const labels = countryLabelEntries(dataModel);
  if (labels.length === 0) {
    return;
  }
  const model = must(scene.createModel({
    id: COUNTRY_LABEL_MODEL_ID,
    updateHint: "static"
  }));
  const meshIds = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    meshIds.push(...createCountryLabel(model, {
      id: i,
      text: label.text,
      lon: label.lon,
      lat: label.lat,
      radius: COUNTRY_LABEL_RADIUS,
      size: label.size
    }));
  }
  must(model.createObject({
    id: "earth.country.labels",
    meshIds,
    clippable: false,
    pickable: false
  }));
  window.__earthCountryLabelsCreated = labels.length;
}

function countryLabelEntries(dataModel) {
  const entries = [];
  for (const dataObject of Object.values(dataModel.objects || {})) {
    const properties = propertiesByName(dataObject);
    const lon = Number(valueFor(properties, "LABEL_X"));
    const lat = Number(valueFor(properties, "LABEL_Y"));
    const population = Number(valueFor(properties, "POP_EST") || 0);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || population < COUNTRY_LABEL_MIN_POPULATION) {
      continue;
    }
    const text = cleanLabelText(valueFor(properties, "NAME") || dataObject.name);
    if (!text) {
      continue;
    }
    entries.push({
      text,
      lon,
      lat,
      population,
      size: countryLabelSize(population)
    });
  }
  return entries
    .sort((a, b) => b.population - a.population)
    .slice(0, COUNTRY_LABEL_MAX_COUNT);
}

function createCountryLabel(model, options) {
  const textGeometry = must(xeokit.model.generation.buildGeometry.buildVectorText({
    origin: textOriginForCenter(options.text, options.size),
    size: options.size,
    text: options.text
  }));
  const geometryId = `countryLabelGeometry.${options.id}`;
  const meshId = `countryLabelMesh.${options.id}`;
  must(model.createGeometry({
    id: geometryId,
    primitive: textGeometry.primitive,
    positions: textGeometry.positions,
    indices: textGeometry.indices
  }));
  must(model.createMesh({
    id: meshId,
    geometryId,
    matrix: tangentLabelMatrix(options.lon, options.lat, options.radius),
    color: COUNTRY_LABEL_COLOR,
    opacity: 1.0,
    lineWidth: 1.0
  }));
  return [meshId];
}

function createArcBillboardLabel(model, options) {
  const textGeometry = must(xeokit.model.generation.buildGeometry.buildVectorText({
    origin: textOriginForLeftAlign(options.size),
    size: options.size,
    text: options.text
  }));
  const geometryId = `${options.id}.labelGeometry`;
  const meshId = `${options.id}.labelMesh`;
  must(model.createGeometry({
    id: geometryId,
    primitive: textGeometry.primitive,
    positions: textGeometry.positions,
    indices: textGeometry.indices
  }));
  must(model.createMesh({
    id: meshId,
    geometryId,
    matrix: translationMatrix(options.position),
    billboard: "spherical",
    color: options.color,
    opacity: options.opacity,
    lineWidth: options.lineWidth
  }));
  return meshId;
}

function countryLabelSize(population) {
  const t = Math.min(1, Math.max(0, (Math.log10(Math.max(population, 1)) - 7.2) / 2.0));
  return COUNTRY_LABEL_MIN_SIZE + (COUNTRY_LABEL_MAX_SIZE - COUNTRY_LABEL_MIN_SIZE) * t;
}

function cleanLabelText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^ -~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createGraticuleLabel(model, options) {
  const textGeometry = must(xeokit.model.generation.buildGeometry.buildVectorText({
    origin: textOriginForCenter(options.text, options.size),
    size: options.size,
    text: options.text
  }));
  const geometryId = `graticuleLabelGeometry.${options.id}`;
  const meshId = `graticuleLabelMesh.${options.id}`;
  must(model.createGeometry({
    id: geometryId,
    primitive: textGeometry.primitive,
    positions: textGeometry.positions,
    indices: textGeometry.indices
  }));
  must(model.createMesh({
    id: meshId,
    geometryId,
    matrix: tangentLabelMatrix(options.lon, options.lat, options.radius),
    color: [0.55, 0.56, 0.50],
    opacity: 0.58,
    lineWidth: 1.25
  }));
  return meshId;
}

function textOriginForCenter(text, size) {
  const charWidth = (16 / 25) * size;
  const halfWidth = (text.length * charWidth) / 2;
  const capHeight = (21 / 25) * size;
  return [-halfWidth, -capHeight / 2, 0];
}

function textOriginForLeftAlign(size) {
  const capHeight = (21 / 25) * size;
  return [0, -capHeight / 2, 0];
}

function translationMatrix(position) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    position[0], position[1], position[2], 1
  ];
}

function tangentLabelMatrix(lonDegrees, latDegrees, radius) {
  const position = lonLatToXYZ(lonDegrees, latDegrees, radius);
  const up = normalize3(position);
  const east = normalize3([-position[1], position[0], 0]);
  const north = normalize3(cross3(up, east));

  return [
    east[0], east[1], east[2], 0,
    north[0], north[1], north[2], 0,
    up[0], up[1], up[2], 0,
    position[0], position[1], position[2], 1
  ];
}

function formatLongitude(lon) {
  const abs = Math.abs(lon);
  if (abs === 180) {
    return "180";
  }
  if (lon === 0) {
    return "0";
  }
  return `${abs}${lon < 0 ? "W" : "E"}`;
}

function formatLatitude(lat) {
  if (lat === 0) {
    return "0";
  }
  return `${Math.abs(lat)}${lat < 0 ? "S" : "N"}`;
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) {
    return [1, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function subtract3(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2]
  ];
}

function addScaled3(a, b, scale) {
  return [
    a[0] + b[0] * scale,
    a[1] + b[1] * scale,
    a[2] + b[2] * scale
  ];
}

function rotateAroundAxis(v, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  const cross = cross3(axis, v);
  return [
    v[0] * cos + cross[0] * sin + axis[0] * dot * (1 - cos),
    v[1] * cos + cross[1] * sin + axis[1] * dot * (1 - cos),
    v[2] * cos + cross[2] * sin + axis[2] * dot * (1 - cos)
  ];
}

function renderCountrySemantic(ui, dataObject, fallback = "Hover a country") {
  if (!ui.countryName || !ui.countryProperties) {
    return;
  }
  if (!dataObject) {
    ui.countryName.textContent = "Country";
    ui.countryProperties.innerHTML = `<dt>Hover</dt><dd>${escapeHTML(fallback)}</dd>`;
    return;
  }
  const properties = propertiesByName(dataObject);
  ui.countryName.textContent = dataObject.name || valueFor(properties, "NAME_LONG") || valueFor(properties, "NAME") || "Country";
  const rows = [];
  for (const [key, label] of COUNTRY_PROPERTY_DISPLAY) {
    const value = valueFor(properties, key);
    if (value !== undefined && value !== null && value !== "") {
      rows.push(`<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(formatSemanticValue(value))}</dd>`);
    }
  }
  ui.countryProperties.innerHTML = rows.length > 0 ? rows.join("") : "<dt>Data</dt><dd>No attributes</dd>";
}

function propertiesByName(dataObject) {
  const result = {};
  for (const propertySet of dataObject.propertySets || []) {
    for (const property of propertySet.properties || []) {
      result[property.name] = property.value;
    }
  }
  return result;
}

function valueFor(properties, name) {
  return properties[name];
}

function formatSemanticValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, {maximumFractionDigits: 2});
  }
  return String(value);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(ui, state) {
  const loaded = state.loaded;
  const total = state.total;
  ui.loadedChunks.textContent = `${loaded}/${total}`;
  ui.objectCount.textContent = state.objects.toLocaleString();
  ui.meshCount.textContent = state.meshes.toLocaleString();
  ui.chunkProgress.max = Math.max(total, 1);
  ui.chunkProgress.value = loaded;
  if (total > 0 && loaded >= total) {
    setStatus(ui, "Loaded");
  } else {
    setStatus(ui, "Loading chunks");
  }
}

function setStatus(ui, status) {
  ui.status.textContent = status;
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Unexpected SDK failure");
  }
  return result.value;
}
