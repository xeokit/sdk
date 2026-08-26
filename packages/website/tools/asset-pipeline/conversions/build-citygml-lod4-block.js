const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SOURCE_MODEL = path.join(ROOT, "models", "OGC_Building_LOD4", "citygml", "model.gml");
const OUTPUT_MODEL_DIR = path.join(ROOT, "models", "OGC_CityBlock_LOD4");
const OUTPUT_CITYGML_DIR = path.join(OUTPUT_MODEL_DIR, "citygml");
const OUTPUT_MODEL = path.join(OUTPUT_CITYGML_DIR, "model.gml");

const COLS = 4;
const ROWS = 3;
const SPACING_X = 36;
const SPACING_Y = 30;

function main() {
  const source = fs.readFileSync(SOURCE_MODEL, "utf8");
  const members = source.match(/\s*<cityObjectMember>[\s\S]*?<\/cityObjectMember>/g);
  if (!members || members.length === 0) {
    throw new Error(`No cityObjectMember elements found in ${SOURCE_MODEL}`);
  }

  const headerEnd = source.indexOf(members[0]);
  if (headerEnd < 0) {
    throw new Error("Could not locate first cityObjectMember");
  }

  const sourceBounds = readEnvelope(source);
  const clones = [];
  const blockBounds = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const lotId = `r${row + 1}c${col + 1}`;
      const dx = col * SPACING_X;
      const dy = row * SPACING_Y;
      const dz = 0;
      for (const member of members) {
        clones.push(cloneMember(member, lotId, dx, dy, dz));
      }
      expandBounds(blockBounds, sourceBounds, dx, dy, dz);
    }
  }

  const header = replaceEnvelope(
    source.slice(0, headerEnd),
    blockBounds,
    `Synthetic 4x3 city block generated from ${path.basename(SOURCE_MODEL)}`
  );
  const cityModelClose = source.slice(source.lastIndexOf("</CityModel>"));
  const output = `${header}${clones.join("\n")}\n${cityModelClose}`;

  fs.mkdirSync(OUTPUT_CITYGML_DIR, {recursive: true});
  fs.writeFileSync(OUTPUT_MODEL, output);
  fs.writeFileSync(path.join(OUTPUT_MODEL_DIR, "coordSys.json"), `${JSON.stringify({
    basis: [
      1, 0, 0,
      0, 0, 1,
      0, 1, 0
    ],
    origin: [blockBounds[0], blockBounds[1], blockBounds[2]],
    units: "meters"
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_MODEL_DIR, "attribution.json"), `${JSON.stringify({
    source: "Synthetic LoD4 city block generated from the Open Geospatial Consortium CityGML 2.0 LoD4 building example",
    url: "https://schemas.opengis.net/citygml/examples/2.0/building/Building_LOD4-EPSG25832.gml"
  }, null, 2)}\n`);

  console.log(`Wrote ${OUTPUT_MODEL}`);
  console.log(`Buildings: ${COLS * ROWS}, source members per lot: ${members.length}`);
  console.log(`Bounds: ${blockBounds.map(formatNumber).join(", ")}`);
}

function cloneMember(member, lotId, dx, dy, dz) {
  const idSuffix = `_block_${lotId}`;
  return member
    .replace(/\bgml:id="([^"]+)"/g, (_match, id) => `gml:id="${id}${idSuffix}"`)
    .replace(/\bxlink:href="#([^"]+)"/g, (_match, id) => `xlink:href="#${id}${idSuffix}"`)
    .replace(
      /(<gml:(posList|pos|lowerCorner|upperCorner)\b[^>]*>)([\s\S]*?)(<\/gml:\2>)/g,
      (_match, open, _tag, content, close) => `${open}${offsetCoordinates(content, dx, dy, dz)}${close}`
    );
}

function readEnvelope(source) {
  const lowerMatch = source.match(/<gml:lowerCorner[^>]*>([\s\S]*?)<\/gml:lowerCorner>/);
  const upperMatch = source.match(/<gml:upperCorner[^>]*>([\s\S]*?)<\/gml:upperCorner>/);
  if (!lowerMatch || !upperMatch) {
    throw new Error("Could not read source envelope");
  }
  const lower = numbers(lowerMatch[1]);
  const upper = numbers(upperMatch[1]);
  return [lower[0], lower[1], lower[2] || 0, upper[0], upper[1], upper[2] || 0];
}

function replaceEnvelope(header, bounds, description) {
  const envelope = [
    "\t<gml:description>",
    `\t\t${escapeXml(description)}`,
    "\t</gml:description>",
    "\t<gml:boundedBy>",
    "\t\t<gml:Envelope srsDimension=\"3\" srsName=\"urn:ogc:def:crs,crs:EPSG::25832,crs:EPSG::5783\">",
    `\t\t\t<gml:lowerCorner>${formatNumber(bounds[0])} ${formatNumber(bounds[1])} ${formatNumber(bounds[2])}</gml:lowerCorner>`,
    `\t\t\t<gml:upperCorner>${formatNumber(bounds[3])} ${formatNumber(bounds[4])} ${formatNumber(bounds[5])}</gml:upperCorner>`,
    "\t\t</gml:Envelope>",
    "\t</gml:boundedBy>"
  ].join("\n");

  return header.replace(
    /\s*<gml:boundedBy>[\s\S]*?<\/gml:boundedBy>/,
    `\n${envelope}`
  );
}

function expandBounds(target, sourceBounds, dx, dy, dz) {
  target[0] = Math.min(target[0], sourceBounds[0] + dx);
  target[1] = Math.min(target[1], sourceBounds[1] + dy);
  target[2] = Math.min(target[2], sourceBounds[2] + dz);
  target[3] = Math.max(target[3], sourceBounds[3] + dx);
  target[4] = Math.max(target[4], sourceBounds[4] + dy);
  target[5] = Math.max(target[5], sourceBounds[5] + dz);
}

function offsetCoordinates(text, dx, dy, dz) {
  const values = numbers(text);
  const dimension = values.length % 3 === 0 ? 3 : 2;
  for (let i = 0; i < values.length; i += dimension) {
    values[i] += dx;
    values[i + 1] += dy;
    if (dimension >= 3) {
      values[i + 2] += dz;
    }
  }
  return values.map(formatNumber).join(" ");
}

function numbers(text) {
  return text.trim().split(/\s+/).map(Number).filter(Number.isFinite);
}

function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(6))}`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

main();
