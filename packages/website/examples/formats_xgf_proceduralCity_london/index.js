window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../models/ProceduralCityLondon/xgfstream/index.runtime.json",
  "metadataUrl": "../../models/ProceduralCityLondon/metadata.json",
  "reportUrl": "../../models/ProceduralCityLondon/report.json",
  "modelId": "ProceduralCityLondon",
  "viewId": "proceduralCityLondonView",
  "streamLabel": "London procedural city with the Thames",
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
