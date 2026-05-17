/**
 * JSON serialization + rendering helpers used by the **Inspect**
 * submenu's "View … JSON" entries.
 *
 *   - {@link getSceneObjectJSON} / {@link getDataObjectJSON} — build
 *     a minimal `SceneModelParams` / `DataModelContentParams`
 *     payload around a single object.
 *   - {@link openJsonInNewTab} — write a syntax-highlighted HTML
 *     document into a new tab.
 *
 * @module demo/viewObjectContextMenu/helpers/json
 */

import type {SceneModelParams, SceneObject} from "../../../model/scene";
import type {DataModelContentParams, DataObject} from "../../../model/data";


/**
 * Serializes a {@link model!scene.SceneObject | SceneObject} into a minimal
 * {@link SceneModelParams} payload — includes mesh params,
 * referenced compressed geometry, referenced materials, and the
 * object params itself.
 */
export function getSceneObjectJSON(sceneObject: SceneObject): SceneModelParams {
  const params: SceneModelParams = {
    materials: [],
    geometriesCompressed: [],
    meshes: [],
    objects: []
  };

  for (const mesh of sceneObject.meshes) {
    const meshParamsResult = mesh.toParams();
    if (meshParamsResult.ok) {
      params.meshes.push(meshParamsResult.value);
    }

    const geometry = mesh.geometry;
    if (geometry) {
      const geometryParamsResult = geometry.toParams();
      if (geometryParamsResult.ok) {
        params.geometriesCompressed.push(geometryParamsResult.value);
      }
    }

    const material = mesh.material;
    if (material) {
      const materialParamsResult = material.toParams();
      if (materialParamsResult.ok) {
        params.materials.push(materialParamsResult.value);
      }
    }
  }

  const objectParamsResult = sceneObject.toParams();
  if (objectParamsResult.ok) {
    params.objects.push(objectParamsResult.value);
  }

  return params;
}

/**
 * Serializes a {@link model!data.DataObject | DataObject} into a minimal
 * {@link DataModelContentParams} payload — includes the data
 * object itself plus its property sets. Relationships are
 * intentionally omitted (the relationship walk is currently
 * commented out — see the legacy implementation for details).
 */
export function getDataObjectJSON(dataObject: DataObject): DataModelContentParams {
  const params: DataModelContentParams = {
    objects: [],
    propertySets: [],
    relationships: []
  };

  for (const propertySet of dataObject.propertySets) {
    params.propertySets.push({
      id: propertySet.id,
      name: propertySet.name,
      type: propertySet.type,
      schema: propertySet.schema,
      properties: propertySet.properties.map(property => ({
        name: property.name,
        description: property.description,
        type: property.type,
        value: property.value
      }))
    });
  }

  params.objects.push({
    id: dataObject.id,
    originalSystemId: dataObject.originalSystemId,
    name: dataObject.name,
    description: dataObject.description,
    type: dataObject.type,
    schema: dataObject.schema,
    propertySetIds: dataObject.propertySets?.map(propertySet => propertySet.id)
  });

  return params;
}

/**
 * Opens a new browser tab containing syntax-highlighted JSON.
 */
export function openJsonInNewTab(obj: any, title: string = "DataModel JSON"): void {
  const json = JSON.stringify(obj, null, 2);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
  <style>
    body { background: #0f1116; color: #e7e7e7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; padding: 0; }
    .json-pre {
      background: #0f1116;
      border-radius: 10px;
      margin: 24px 0 24px 24px;
      padding: 24px 32px;
      max-width: 900px;
      font-size: 15px;
      box-shadow: 0 4px 24px #0001;
      color: #e7e7e7;
      text-align: left;
    }
    .json-key { color: #7ec7e6; font-weight: 600; }
    .json-string { color: #ffe7b3; }
    .json-number { color: #b3e6c7; }
    .json-boolean { color: #ffd57a; }
    .json-null { color: #888; }
    h1 { color: #fff; font-size: 20px; font-weight: 650; margin: 24px 24px 12px 24px; }
    .meta { color: #aaa; font-size: 13px; margin: 0 24px 18px 24px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Serialized to JSON</div>
  <pre class="json-pre">${syntaxHighlightJson(json)}</pre>
</body>
</html>
  `.trim();

  const win = window.open();
  if (!win) {
    return;
  }

  win.document.write(html);
  win.document.close();
}

/**
 * Applies span-wrapped syntax highlighting to a JSON string for
 * the in-browser viewer. The returned string is intended for
 * insertion into trusted HTML content.
 */
function syntaxHighlightJson(json: string): string {
  json = json.replace(/[&<>]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  }[c] || c));

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";

      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }

      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
