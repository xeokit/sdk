#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  collectColorSamples,
  collectSceneModelStats,
  loadSourceModel,
  parseArgs,
  relativeToRoot,
  rootDir,
  round,
  selectedSampleModels
} = require("./lib/common");

const defaultOut = path.join(__dirname, "building-style.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv);
  const outPath = path.resolve(rootDir, args.out || defaultOut);
  const samples = selectedSampleModels(args.models);
  if (samples.length === 0) {
    throw new Error("No sample models selected");
  }

  const sourceProfiles = [];
  for (const spec of samples) {
    const loaded = await loadSourceModel(spec);
    const stats = collectSceneModelStats(loaded.sceneModel);
    const colorSamples = collectColorSamples(loaded.sceneModel);
    const pointDominated = stats.vertices > 0 && stats.points / stats.vertices > 0.5;
    if (pointDominated) {
      console.log(`Skipping point-dominated sample ${spec.model}`);
      destroyLoaded(loaded);
      continue;
    }

    const profile = profileSource(spec, loaded.source, stats, colorSamples);
    sourceProfiles.push(profile);
    console.log(`Analyzed ${spec.model} (${formatSourceLabel(loaded.source)}): ${formatDims(profile.dimensions)}, ${stats.objects.toLocaleString()} objects`);
    destroyLoaded(loaded);
  }

  if (sourceProfiles.length === 0) {
    throw new Error("No usable source profiles were produced");
  }

  const profile = {
    schema: "xeokit-procedural-building-style/1.0",
    generatedAt: new Date().toISOString(),
    description: "Procedural building style profile derived from selected xeokit website sample building models.",
    sources: sourceProfiles,
    aggregate: buildAggregate(sourceProfiles)
  };

  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  console.log(`Wrote ${relativeToRoot(outPath)}`);
}

function profileSource(spec, source, stats, colorSamples) {
  const [width, depth, height] = stats.dimensions;
  const storeys = estimateStoreys(height);
  const trainingSource = source.trainingSource || source;
  const sourceInfo = {
    format: trainingSource.format,
    uri: trainingSource.relPath
  };
  if (trainingSource.package) {
    sourceInfo.package = trainingSource.package;
  }
  const analysisSource = source.analysisSource ? {
    format: source.analysisSource.format,
    uri: source.analysisSource.relPath
  } : undefined;
  return {
    id: spec.id,
    model: spec.model,
    source: sourceInfo,
    ...(analysisSource ? {analysisSource} : {}),
    scale: spec.scale || 1,
    aabb: stats.aabb.map((value) => round(value, 4)),
    dimensions: {
      width: round(width, 3),
      depth: round(depth, 3),
      height: round(height, 3)
    },
    counts: {
      objects: stats.objects,
      meshes: stats.meshes,
      geometries: stats.geometries,
      materials: stats.materials,
      textures: stats.textures,
      vertices: stats.vertices,
      triangles: stats.triangles,
      points: stats.points
    },
    inferred: {
      storeys,
      floorHeight: round(height / Math.max(1, storeys), 3),
      footprintArea: round(width * depth, 3),
      meshDensityPerSquareMeter: round(stats.meshes / Math.max(1, width * depth), 4)
    },
    colors: summarizeSourceColors(colorSamples)
  };
}

function buildAggregate(sources) {
  const widths = sources.map((source) => source.dimensions.width).filter(positive);
  const depths = sources.map((source) => source.dimensions.depth).filter(positive);
  const heights = sources.map((source) => source.dimensions.height).filter(positive);
  const floorHeights = sources.map((source) => source.inferred.floorHeight).filter(positive);
  const storeys = sources.map((source) => source.inferred.storeys).filter(positive);
  const meshDensities = sources.map((source) => source.inferred.meshDensityPerSquareMeter).filter(positive);
  const palette = summarizePalette(sources.flatMap((source) => source.colors.samples));
  const glassWeight = sources.reduce((sum, source) => sum + source.colors.glassWeight, 0);
  const totalColorWeight = sources.reduce((sum, source) => sum + source.colors.totalWeight, 0);
  const glassRatio = totalColorWeight > 0 ? glassWeight / totalColorWeight : 0.28;
  const floorHeight = clamp(median(floorHeights), 2.8, 4.4);
  const bayWidth = clamp(median(widths.concat(depths).map((value) => value / Math.max(2, Math.round(value / 4.2)))), 2.8, 6.5);

  return {
    sourceCount: sources.length,
    dimensions: {
      width: distribution(widths),
      depth: distribution(depths),
      height: distribution(heights)
    },
    storeys: distribution(storeys),
    facade: {
      floorHeight: round(floorHeight, 3),
      bayWidth: round(bayWidth, 3),
      windowToWallRatio: round(clamp(glassRatio, 0.18, 0.58), 3),
      recessDepth: round(clamp(bayWidth * 0.055, 0.12, 0.35), 3),
      mullionWidth: round(clamp(bayWidth * 0.045, 0.12, 0.3), 3)
    },
    massing: {
      podiumProbability: round(sources.filter((source) => source.dimensions.width > 35 || source.dimensions.depth > 35).length / sources.length, 3),
      towerProbability: round(sources.filter((source) => source.dimensions.height >= median(heights) * 1.15).length / sources.length, 3),
      setbackRatio: round(clamp(median(heights) / Math.max(1, median(widths) + median(depths)) * 0.18, 0.08, 0.22), 3),
      roofPlantProbability: round(clamp(median(meshDensities) * 0.8, 0.25, 0.82), 3)
    },
    palette,
    generationDefaults: {
      buildingCount: 14,
      spacing: round(Math.max(48, median(widths.concat(depths)) * 1.7), 3),
      randomSeed: 42
    }
  };
}

function summarizeSourceColors(samples) {
  const buckets = new Map();
  let totalWeight = 0;
  let glassWeight = 0;
  for (const sample of samples) {
    const color = sample.color.map((value) => round(value, 2));
    const key = color.join(",");
    const weight = sample.weight || 1;
    const bucket = buckets.get(key) || {color, weight: 0, glass: isGlass(color, sample.opacity)};
    bucket.weight += weight;
    buckets.set(key, bucket);
    totalWeight += weight;
    if (bucket.glass) {
      glassWeight += weight;
    }
  }
  const ordered = Array.from(buckets.values()).sort((a, b) => b.weight - a.weight).slice(0, 16);
  return {
    totalWeight: round(totalWeight, 3),
    glassWeight: round(glassWeight, 3),
    samples: ordered.map((bucket) => ({
      color: bucket.color,
      weight: round(bucket.weight, 3),
      glass: bucket.glass
    }))
  };
}

function summarizePalette(samples) {
  const weighted = samples
    .map((sample) => ({...sample, luma: luminance(sample.color), sat: saturation(sample.color)}))
    .sort((a, b) => b.weight - a.weight);
  const wall = pickColor(weighted, (sample) => !sample.glass && sample.luma > 0.35 && sample.luma < 0.96 && sample.sat < 0.38) || [0.7, 0.72, 0.68];
  const glass = pickColor(weighted, (sample) => sample.glass && sample.sat > 0.12 && sample.color[2] >= sample.color[0]) || pickColor(weighted, (sample) => sample.glass && sample.luma < 0.9) || [0.32, 0.58, 0.72];
  const trim = pickColor(weighted, (sample) => !sample.glass && sample.luma > 0.08 && sample.luma <= 0.45) || [0.24, 0.27, 0.28];
  const roof = pickColor(weighted, (sample) => !sample.glass && sample.luma > 0.08 && sample.luma <= 0.42 && sample.sat < 0.35) || [0.16, 0.18, 0.18];
  const accent = pickColor(weighted, (sample) => !sample.glass && sample.sat >= 0.22) || [0.64, 0.34, 0.24];
  return {wall, glass, trim, roof, accent};
}

function pickColor(samples, predicate) {
  const sample = samples.find(predicate);
  return sample ? sample.color : null;
}

function estimateStoreys(height) {
  if (!Number.isFinite(height) || height <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(height / 3.4));
}

function distribution(values) {
  const sorted = values.filter(positive).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {min: 0, median: 0, p80: 0, max: 0};
  }
  return {
    min: round(sorted[0], 3),
    median: round(quantile(sorted, 0.5), 3),
    p80: round(quantile(sorted, 0.8), 3),
    max: round(sorted[sorted.length - 1], 3)
  };
}

function median(values) {
  return quantile(values.filter(positive).sort((a, b) => a - b), 0.5);
}

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = (sortedValues.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) {
    return sortedValues[low];
  }
  const t = index - low;
  return sortedValues[low] * (1 - t) + sortedValues[high] * t;
}

function luminance(color) {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function saturation(color) {
  const max = Math.max(color[0], color[1], color[2]);
  const min = Math.min(color[0], color[1], color[2]);
  return max === 0 ? 0 : (max - min) / max;
}

function isGlass(color, opacity) {
  return opacity < 0.95 || (color[2] > color[0] + 0.08 && color[2] >= color[1] - 0.04 && luminance(color) > 0.25);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function formatDims(dimensions) {
  return `${dimensions.width} x ${dimensions.depth} x ${dimensions.height}m`;
}

function formatSourceLabel(source) {
  if (source.trainingSource && source.analysisSource) {
    return `${source.trainingSource.format} via ${source.analysisSource.format}`;
  }
  return source.format;
}

function destroyLoaded(loaded) {
  loaded.sceneModel.destroy();
  loaded.dataModel.destroy();
}
