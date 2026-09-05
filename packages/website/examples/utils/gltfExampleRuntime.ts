import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";

export const IDENTITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export function hideStatus(statusId = "status") {
  const status = document.getElementById(statusId);
  if (status) {
    status.style.display = "none";
  }
}

export function installStudioIBL(view, width = 1024, height = 512) {
  if (!view.lights?.ibl) {
    return;
  }
  const hdrBuffer = encodeRadianceHDR(paintStudioHDR(width, height), width, height);
  const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!result.ok) {
    console.warn("[glTF example] IBL setup failed:", result.error);
    view.lights.ibl.enabled = false;
    view.lights.ibl.intensity = 0;
  }
}
