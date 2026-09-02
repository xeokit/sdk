window.PROCEDURAL_CITY_STREAM_CONFIG = {
  "indexUrl": "../../../../models/ProceduralCityAmsterdam/xgfstream/index.runtime.json",
  "metadataUrl": "../../../../models/ProceduralCityAmsterdam/metadata.json",
  "reportUrl": "../../../../models/ProceduralCityAmsterdam/report.json",
  "modelId": "ProceduralCityAmsterdam",
  "viewId": "proceduralCityAmsterdamView",
  "streamLabel": "Amsterdam procedural city",
  "renderer": "webgl",
  "representationLOD": false,
  "windSound": true,
  "panel": false,
  "buildingPicking": false,
  "signalStudioFinished": false,
  "frustumOnly": true,
  "fastVisuals": {
    "backgroundColor": [0.90, 0.94, 0.97],
    "sky": {
      "skyColor": [0.56, 0.74, 0.91],
      "horizonColor": [0.88, 0.94, 0.98],
      "groundColor": [0.58, 0.62, 0.57],
      "blend": 0.26,
      "intensity": 0.96
    },
    "hemispheric": {
      "enabled": true,
      "intensity": 0.22,
      "skyColor": [0.72, 0.82, 0.94],
      "groundColor": [0.42, 0.44, 0.40],
      "worldUp": [0, 0, 1]
    },
    "ambientLight": {
      "color": [1, 1, 1],
      "intensity": 0.48
    },
    "dirLight": {
      "dir": [-0.42, -0.62, -0.72],
      "color": [1, 0.97, 0.90],
      "intensity": 1.08,
      "space": "world"
    }
  },
  "endlessWorld": {
    "enabled": true,
    "margin": 0
  },
  "hud": {
    "enabled": true
  },
  "vehicle": {
    "modelUrl": "../../../../models/SpaceShip/xgf/model.xgf",
    "modelId": "SpaceShip",
    "scale": 0.0085,
    "sourceCenter": [
      0.0001430511474609375,
      290.83030990186523,
      -245.64296573058726
    ],
    "forwardAxis": "-Y",
    "cameraDistance": 24,
    "cameraHeight": 7.2,
    "cameraLookAhead": 13,
    "cameraLookHeight": 1.6,
    "cameraFollowSmoothing": 4.8,
    "cameraLookSmoothing": 9,
    "cameraRollWithAircraft": true,
    "cameraRollWithAircraftScale": 0.42,
    "cameraRollWithAircraftPositionScale": 1,
    "cameraLateralOffset": 0,
    "cameraTrailFollow": 0.65,
    "cameraTrailHeight": 1.4,
    "cameraCockpitEyeOffset": [0, -1.55, -0.42],
    "cameraCockpitLookOffset": [0, -16, -0.32],
    "shipMouseDragYawSensitivity": 0.0095,
    "shipMouseDragPitchSensitivity": 0.0068,
    "shipMouseDragResponse": 5.2,
    "maxShipMouseDragInputPerFrame": 0.7,
    "shipKeyYawInitialScale": 0.34,
    "shipKeyYawRampSeconds": 1.45,
    "shipYawRateDegreesPerSecond": 76,
    "shipPitchRateDegreesPerSecond": 58,
    "maxShipPitchDegrees": 56,
    "minShipPitchDegrees": -42,
    "maxVisualRollDegrees": 46,
    "rollSmoothing": 7.5,
    "collision": true,
    "bodyRadius": 4,
    "minAltitude": 6,
    "initialShipPosition": [0, -1120, 36],
    "exhaustPlume": {
      "offset": [0, 4.25, 0.32],
      "trailLength": 44,
      "trailSegments": 16,
      "trailAdvection": 0,
      "trailTether": 0,
      "trailExpansion": 1,
      "trailOpacity": 0.6,
      "radius": 0.78,
      "wander": 0.16,
      "radialSegments": 6,
      "afterburner": {
        "threshold": 0.16,
        "length": 9.5,
        "minLength": 3.4,
        "radius": 1.05,
        "flicker": 0.12,
        "radialSegments": 10
      }
    },
    "minForwardSpeed": 26,
    "maxForwardSpeed": 175,
    "acceleration": 74,
    "brakeDeceleration": 54,
    "coastDeceleration": 1.2,
    "startSpeed": 44,
    "flightSimulation": {
      "enabled": true,
      "mass": 850,
      "inertiaBody": [
        800, 0, 0,
        0, 2400, 0,
        0, 0, 3000
      ],
      "referenceArea": 9,
      "referenceSpan": 6.5,
      "referenceChord": 2.1,
      "maxThrust": 7800,
      "aerodynamics": {
        "zeroLiftAlpha": -0.07,
        "liftCurveSlope": 3,
        "maxLiftCoefficient": 3,
        "dragCoefficientZero": 0.04,
        "inducedDragFactor": 0.08,
        "rollMomentPerRollCommand": 0.1,
        "pitchMomentPerPitchCommand": -0.08,
        "yawMomentPerYawCommand": 0.015,
        "yawMomentPerSideslip": 0.35,
        "rollDamping": 0.08,
        "pitchDamping": 0.18,
        "yawDamping": 0.06
      },
      "startSpeed": 105,
      "cruiseThrottle": 0.55,
      "pitchInputScale": 0.42,
      "rollInputScale": 1,
      "bankPitchCompensation": 0.58,
      "bankThrottleCompensation": 0.3,
      "visualForwardAxis": "-Y",
      "maxVerticalSpeed": 85,
      "maxSpeed": 260,
      "maxAltitude": 2500,
      "fixedDt": 0.008333333333333333
    },
    "initialCamera": {
      "eye": [0, -1158, 44],
      "look": [0, -1064, 40],
      "up": [0, 0, 1],
      "fov": 62
    }
  },
  "multiplayer": {
    "enabled": false,
    "room": "amsterdam-flight-sim",
    "broadcastChannel": "xeokit-amsterdam-flight-sim",
    "wsPort": 8098,
    "wsPath": "/flight-sim",
    "updateIntervalMs": 50,
    "peerTimeoutMs": 5000
  }
};

import("../procedural-city/index.js");
