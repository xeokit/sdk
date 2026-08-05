window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../models/ProceduralCityParis/xgfstream/index.runtime.json",
  "metadataUrl": "../../models/ProceduralCityParis/metadata.json",
  "reportUrl": "../../models/ProceduralCityParis/report.json",
  "modelId": "ProceduralCityParis",
  "viewId": "proceduralCityParisView",
  "streamLabel": "Paris procedural city",
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
