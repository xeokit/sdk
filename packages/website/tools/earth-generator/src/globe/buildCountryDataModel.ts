import type {PolygonFeature} from "../naturalEarth/loadNaturalEarth";
import {countryDataObjectIdForCountryId, countryIdForFeature} from "./buildCountryRegions";

const DATA_MODEL_ID = "NaturalEarthCountries";
const SCHEMA = "NaturalEarthAdmin0/v1";

const COUNTRY_PROPERTY_KEYS = [
  "ADM0_A3",
  "ISO_A2",
  "ISO_A3",
  "NAME",
  "NAME_LONG",
  "ADMIN",
  "SOVEREIGNT",
  "TYPE",
  "FORMAL_EN",
  "POSTAL",
  "ABBREV",
  "CONTINENT",
  "REGION_UN",
  "SUBREGION",
  "REGION_WB",
  "ECONOMY",
  "INCOME_GRP",
  "POP_EST",
  "POP_RANK",
  "GDP_MD",
  "GDP_YEAR",
  "POP_YEAR",
  "LABEL_X",
  "LABEL_Y"
];

export interface CountryDataArtifacts {
  dataModel: Record<string, unknown>;
  objectMap: Record<string, unknown>;
}

export function buildCountryDataArtifacts(
  features: PolygonFeature[],
  objectDataObjectIds: Record<string, string>
): CountryDataArtifacts {
  const propertySets: any[] = [];
  const objects: any[] = [];
  const countries: Record<string, string> = {};

  for (const feature of features) {
    const countryId = countryIdForFeature(feature);
    const dataObjectId = countryDataObjectIdForCountryId(countryId);
    const props = feature.properties || {};
    const propertySetId = `${dataObjectId}.properties`;
    countries[countryId] = dataObjectId;

    propertySets.push({
      id: propertySetId,
      name: "Natural Earth admin-0 attributes",
      type: "NaturalEarthAdmin0Properties",
      schema: SCHEMA,
      properties: buildProperties(props)
    });

    objects.push({
      id: dataObjectId,
      originalSystemId: String(cleanValue(props.ADM0_A3 || props.ISO_A3 || props.NAME || feature.id)),
      type: "NaturalEarthAdmin0Country",
      schema: SCHEMA,
      name: String(cleanValue(props.NAME_LONG || props.ADMIN || props.NAME || dataObjectId)),
      description: String(cleanValue(props.FORMAL_EN || props.ADMIN || props.NAME_LONG || props.NAME || "")),
      propertySetIds: [propertySetId]
    });
  }

  return {
    dataModel: {
      id: DATA_MODEL_ID,
      version: "1.0",
      schema: SCHEMA,
      author: "Natural Earth",
      creatingApplication: "packages/website/tools/earth-generator",
      propertySets,
      objects,
      relationships: []
    },
    objectMap: {
      version: 1,
      dataModelId: DATA_MODEL_ID,
      objectIdPattern: "earth.countryRegion.country.<countryId>.tile.<x>.<y>.<featureId>.<partId>",
      countries,
      objects: objectDataObjectIds
    }
  };
}

function buildProperties(props: Record<string, any>): any[] {
  const properties = [];
  for (const key of COUNTRY_PROPERTY_KEYS) {
    const value = cleanValue(props[key]);
    if (value === undefined || value === null || value === "") {
      continue;
    }
    properties.push({
      name: key,
      value,
      valueType: typeof value
    });
  }
  properties.push({
    name: "SOURCE",
    value: "Natural Earth 1:10m admin_0_countries",
    valueType: "string"
  });
  return properties;
}

function cleanValue(value: any): any {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/\0/g, "").trim();
}
