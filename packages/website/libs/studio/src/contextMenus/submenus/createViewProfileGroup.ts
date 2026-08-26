/**
 * View-profile preset group.
 *
 * @module studio/viewObjectContextMenu/submenus/createViewProfileGroup
 */

import type {BaseViewContext} from "../BaseViewContext";

const PROFILE_LABELS = [
  ["fast", "Fast Profile"],
  ["detailed", "Detailed Profile"],
  ["realistic", "Realistic Profile"]
] as const;

export function createViewProfileGroup() {
  return PROFILE_LABELS.map(([profileId, title]) => ({
    getTitle: () => title,
    getEnabled: (context: BaseViewContext) => {
      const viewProfiles = context.studio.viewProfiles;
      return !!viewProfiles && viewProfiles.hasProfile(profileId) && viewProfiles.activeProfile !== profileId;
    },
    doAction: (context: BaseViewContext) => {
      context.studio.viewProfiles?.setActiveProfile(profileId);
    }
  }));
}
