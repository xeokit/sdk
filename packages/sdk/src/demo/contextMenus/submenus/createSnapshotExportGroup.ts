/**
 * Snapshot-export group — screenshot + BCF viewpoint output.
 * Used by both the view-object and canvas Export submenus.
 *
 * @module demo/viewObjectContextMenu/submenus/createSnapshotExportGroup
 */

import {ExportBCFPanel} from "../../panels/exportBCF/ExportBCFPanel";
import type {BaseViewContext} from "../BaseViewContext";
import {screenshotIconSvg, saveViewScreenshot} from "../helpers/screenshot";


export function createSnapshotExportGroup() {
  return [
    {
      title: "Save Screenshot",
      icon: screenshotIconSvg(),
      doAction: async (context: BaseViewContext) => {
        await saveViewScreenshot(context);
      }
    },
    {
      title: "Export BCF Viewpoint…",
      icon: ExportBCFPanel.iconSvg(),
      doAction: (context: BaseViewContext) => {
        context.demoHelper.openExportBCFPanel();
      }
    }
  ];
}
