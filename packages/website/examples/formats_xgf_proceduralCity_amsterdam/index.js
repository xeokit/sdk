window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../models/ProceduralCityAmsterdam/xgfstream/index.runtime.json",
  "metadataUrl": "../../models/ProceduralCityAmsterdam/metadata.json",
  "reportUrl": "../../models/ProceduralCityAmsterdam/report.json",
  "modelId": "ProceduralCityAmsterdam",
  "viewId": "proceduralCityAmsterdamView",
  "streamLabel": "Amsterdam procedural city",
  "windSound": true,
  "vehicle": {
    "modelUrl": "../../models/SpaceShip/xgf/model.xgf",
    "modelId": "SpaceShip",
    "scale": 0.0085,
    "sourceCenter": [
      0.0001430511474609375,
      290.83030990186523,
      -245.64296573058726
    ],
    "forwardAxis": "-Y",
    "cameraDistance": 28,
    "cameraHeight": 9,
    "cameraLookAhead": 18,
    "cameraLookHeight": 4,
    "cameraFollowSmoothing": 4.8,
    "cameraLookSmoothing": 9,
    "cameraLateralOffset": 2,
    "cursorTurnResponse": 1.05,
    "shipYawRateDegreesPerSecond": 132,
    "shipPitchRateDegreesPerSecond": 88,
    "maxShipPitchDegrees": 56,
    "minShipPitchDegrees": -42,
    "maxVisualRollDegrees": 76,
    "rollSmoothing": 16,
    "minAltitude": 6,
    "minForwardSpeed": 26,
    "maxForwardSpeed": 175,
    "acceleration": 74,
    "brakeDeceleration": 54,
    "coastDeceleration": 1.2,
    "startSpeed": 44,
    "initialCamera": {
      "eye": [-360, -520, 118],
      "look": [-260, -390, 72],
      "up": [0, 0, 1],
      "fov": 62
    }
  }
};

import("../formats_xgf_proceduralCity/index.js");
