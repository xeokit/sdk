// Validate the Duplex IFC DataModel against a hand-rolled IFC4
// DataFormatSchema using the dataModelInspector. Loads the
// `models/Duplex/datamodel/model.json` payload, runs
// inspectDataModel with every opt-in check enabled, and renders
// the report into a three-tier panel (severity → code → issues).

import * as xeokit from "../../js/xeokit-studio-bundle.js";

const MODEL_BASE = "../../models/Duplex";

const studio = new xeokit.studio.Studio({});

studio.init({logging: false}).then(async () => {
  const {data} = studio;

  const dm = mustCreate(data.createModel({id: "duplex"}));
  await studio.loadModel({
    id: "duplex",
    src: `${MODEL_BASE}/datamodel/model.json`,
    format: "datamodel",
    dataModel: dm,
  });

  const report = xeokit.inspect.dataModel.inspectDataModel({
    dataModel: dm,
    schema: IFC4_SCHEMA,
    checkSchemaTagging:           true,
    checkRelationshipTypeBinding: true,
    checkRelationshipCycles:      true,
    checkIfcSpatialHierarchy:     true,
    checkIfcElementContainment:   true,
  });

  renderReport(report, dm);
  studio.openInfoPanelFromMeta();
  studio.finished();

}).catch((err) => {
  document.getElementById("status").textContent = `Failed: ${err && err.message || err}`;
  console.error(err);
});


// ---------------------------------------------------------------------
// Minimal IFC4 schema covering the IFC types Duplex uses, plus the
// canonical IFC inheritance edges they need for super-type-aware
// type-binding checks. Real IFC4 has ~700 entity types — this is a
// curated subset, easy to read and extend per-project.
// ---------------------------------------------------------------------
const IFC4_SCHEMA = /** @type {import("@xeokit/sdk/dataModelInspector").DataFormatSchema} */ ({
  id: "IFC4",
  description: "ISO 16739-1:2018 / buildingSMART IFC4 (curated subset)",

  objectTypes: {
    // Roots — superType chains stop at IfcObjectDefinition for
    // this subset. Real IFC4 has IfcRoot above it; including IfcRoot
    // would dilute the example without changing what gets validated.
    IfcObjectDefinition: {label: "IFC Object Definition"},
    IfcContext:          {superType: "IfcObjectDefinition", label: "IFC Context"},

    // Spatial structure.
    IfcProject:                  {superType: "IfcContext", label: "Project"},
    IfcSpatialStructureElement:  {superType: "IfcObjectDefinition", label: "Spatial Structure Element"},
    IfcSite:                     {superType: "IfcSpatialStructureElement", label: "Site"},
    IfcBuilding:                 {superType: "IfcSpatialStructureElement", label: "Building"},
    IfcBuildingStorey:           {superType: "IfcSpatialStructureElement", label: "Building Storey"},
    IfcSpace:                    {superType: "IfcSpatialStructureElement", label: "Space"},

    // Element hierarchy.
    IfcElement:                  {superType: "IfcObjectDefinition", label: "Element"},
    IfcBuildingElement:          {superType: "IfcElement",          label: "Building Element"},
    IfcWall:                     {superType: "IfcBuildingElement",  label: "Wall"},
    IfcWallStandardCase:         {superType: "IfcWall",             label: "Wall (Standard Case)"},
    IfcWindow:                   {superType: "IfcBuildingElement",  label: "Window"},
    IfcDoor:                     {superType: "IfcBuildingElement",  label: "Door"},
    IfcSlab:                     {superType: "IfcBuildingElement",  label: "Slab"},
    IfcBeam:                     {superType: "IfcBuildingElement",  label: "Beam"},
    IfcRoof:                     {superType: "IfcBuildingElement",  label: "Roof"},
    IfcFooting:                  {superType: "IfcBuildingElement",  label: "Footing"},
    IfcStair:                    {superType: "IfcBuildingElement",  label: "Stair"},
    IfcRailing:                  {superType: "IfcBuildingElement",  label: "Railing"},
    IfcMember:                   {superType: "IfcBuildingElement",  label: "Member"},
    IfcStairFlight:              {superType: "IfcBuildingElement",  label: "Stair Flight"},
    IfcCovering:                 {superType: "IfcBuildingElement",  label: "Covering"},
    IfcFurnishingElement:        {superType: "IfcElement",          label: "Furnishing Element"},
  },

  relationshipTypes: {
    IfcRelAggregates: {
      label: "Aggregates / decomposes a parent into parts",
      // Both ends are subtypes of IfcObjectDefinition per IFC4
      // §5.1.4. Self-references aren't allowed (a part can't
      // contain itself).
      allowedRelatingTypes: ["IfcObjectDefinition"],
      allowedRelatedTypes:  ["IfcObjectDefinition"],
    },
  },
});


// ---------------------------------------------------------------------
// Report rendering. Tier 1: severity counts in the header. Tier 2:
// one collapsible <details> per code, with the code's plain-English
// description. Tier 3: per-issue rows inside each group.
// ---------------------------------------------------------------------
function renderReport(report, dataModel) {
  const counts = document.getElementById("counts");
  const body   = document.getElementById("report-body");
  const status = document.getElementById("status");

  counts.innerHTML = "";
  if (report.errors.length === 0 && report.warnings.length === 0 && report.info.length === 0) {
    counts.appendChild(makePill("count-clean", "0 issues"));
  } else {
    if (report.errors.length)   counts.appendChild(makePill("count-error",   `${report.errors.length} errors`));
    if (report.warnings.length) counts.appendChild(makePill("count-warning", `${report.warnings.length} warnings`));
    if (report.info.length)     counts.appendChild(makePill("count-info",    `${report.info.length} info`));
  }

  body.innerHTML = "";

  // Order codes by severity, then by count desc.
  const sevOrder = {error: 0, warning: 1, info: 2};
  const groups = [];
  for (const [code, issues] of report.byCode) {
    groups.push({code, issues, severity: issues[0].severity});
  }
  groups.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    return s !== 0 ? s : b.issues.length - a.issues.length;
  });

  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:32px;text-align:center;color:#666;font-size:13px;";
    empty.textContent = "No issues — DataModel passes every inspection.";
    body.appendChild(empty);
  } else {
    for (const g of groups) body.appendChild(makeGroup(g));
  }

  status.textContent =
    `Inspected ${countObjects(dataModel)} DataObjects, ` +
    `${dataModel.relationships.length} Relationships, ` +
    `${countPropertySets(dataModel)} PropertySets · schema = ${IFC4_SCHEMA.id}`;
}

function makePill(cls, text) {
  const span = document.createElement("span");
  span.className = `count-pill ${cls}`;
  span.textContent = text;
  return span;
}

function makeGroup({code, issues, severity}) {
  const details = document.createElement("details");
  details.className = "group";
  if (severity === "error") details.open = true;

  const summary = document.createElement("summary");
  summary.className = "group-summary";

  const label = document.createElement("span");
  label.className = "group-label";
  const labelText = xeokit.inspect.dataModel.labelForCode(code);
  label.innerHTML =
    `${escapeHtml(labelText)}<span class="code">${escapeHtml(code)}</span>`;

  const count = document.createElement("span");
  count.className = `group-count severity-${severity}`;
  count.textContent = String(issues.length);

  summary.append(label, count);
  details.appendChild(summary);

  const description = xeokit.inspect.dataModel.descriptionForCode(code);
  if (description) {
    const desc = document.createElement("div");
    desc.className = "group-description";
    desc.textContent = description;
    details.appendChild(desc);
  }

  // Top 50 issues — Duplex's reports stay small but in real-world
  // models a single code can fire thousands of times; truncate so
  // the panel doesn't blow up.
  const ul = document.createElement("ul");
  ul.className = "issue-list";
  const visible = issues.slice(0, 50);
  for (const issue of visible) {
    const li = document.createElement("li");
    li.className = "issue-row";
    const res = document.createElement("div");
    res.className = "issue-resource";
    res.title = issue.resourceId || "";
    res.textContent = issue.resourceId || "—";
    const msg = document.createElement("div");
    msg.className = "issue-message";
    msg.textContent = issue.summary || issue.message;
    li.append(res, msg);
    ul.appendChild(li);
  }
  if (issues.length > visible.length) {
    const more = document.createElement("li");
    more.className = "issue-row";
    more.style.color = "#666";
    more.style.fontStyle = "italic";
    more.textContent = `… and ${issues.length - visible.length} more`;
    ul.appendChild(more);
  }
  details.appendChild(ul);

  return details;
}

function countObjects(dm) {
  let n = 0;
  for (const _id in dm.objects) n++;
  return n;
}
function countPropertySets(dm) {
  let n = 0;
  for (const _id in dm.propertySets) n++;
  return n;
}

function mustCreate(result) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c]));
}
