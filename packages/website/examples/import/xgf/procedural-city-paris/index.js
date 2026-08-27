window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../../../models/ProceduralCityParis/xgfstream/index.runtime.json",
  "metadataUrl": "../../../../models/ProceduralCityParis/metadata.json",
  "reportUrl": "../../../../models/ProceduralCityParis/report.json",
  "modelId": "ProceduralCityParis",
  "viewId": "proceduralCityParisView",
  "streamLabel": "Paris procedural city",

  "adaptiveQuality": false,
  "effects": {
    "sao": {
      "enabled": false
    },
    "bloom": {
      "enabled": false
    },
    "atmosphere": {
      "enabled": false
    },
    "depthOfField": {
      "enabled": false
    },
    "tonemap": {
      "enabled": false
    },
    "antiAliasing": {
      "enabled": false
    },
    "shadows": {
      "enabled": false
    },
    "edges": {
      "enabled": false
    },
    "sectionPlaneCaps": {
      "enabled": false
    },
    "bodyHatch": {
      "enabled": false
    }
  },
  "lights": {
    "ibl": {
      "enabled": false
    },
    "hemispheric": {
      "enabled": true
    }
  }
};

import("../procedural-city/index.js");
