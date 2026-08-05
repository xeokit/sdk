window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../models/ProceduralCityChicagoRiver/xgfstream/index.runtime.json",
  "metadataUrl": "../../models/ProceduralCityChicagoRiver/metadata.json",
  "reportUrl": "../../models/ProceduralCityChicagoRiver/report.json",
  "modelId": "ProceduralCityChicagoRiver",
  "viewId": "proceduralCityChicagoRiverView",
  "streamLabel": "Chicago river procedural city",
  "renderMode": "realistic",
  "adaptiveQuality": {
    "fastMode": "navigation",
    "restMode": "realistic",
    "restMs": 500
  },
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
