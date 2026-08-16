window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../models/ProceduralCityBerlin/xgfstream/index.runtime.json",
  "metadataUrl": "../../models/ProceduralCityBerlin/metadata.json",
  "reportUrl": "../../models/ProceduralCityBerlin/report.json",
  "modelId": "ProceduralCityBerlin",
  "viewId": "proceduralCityBerlinView",
  "streamLabel": "Berlin procedural city",
  "renderMode": "navigation",
  "adaptiveQuality": false,
  "effects": {
    "sao": {
      "renderModes": ["realistic"]
    },
    "bloom": {
      "renderModes": ["realistic"]
    },
    "atmosphere": {
      "renderModes": []
    },
    "depthOfField": {
      "renderModes": []
    },
    "tonemap": {
      "renderModes": ["realistic"]
    },
    "antiAliasing": {
      "renderModes": ["realistic"]
    },
    "shadows": {
      "renderModes": ["realistic"]
    },
    "edges": {
      "renderModes": ["navigation", "detailed", "realistic"],
      "edgeWidth": 1
    },
    "sectionPlaneCaps": {
      "renderModes": []
    },
    "bodyHatch": {
      "renderModes": []
    }
  },
  "lights": {
    "ibl": {
      "renderModes": ["realistic"]
    },
    "hemispheric": {
      "renderModes": ["navigation", "detailed", "realistic"]
    }
  }
};

import("../formats_xgf_proceduralCity/index.js");
