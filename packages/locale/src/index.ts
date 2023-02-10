/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:150px; width:150px;" src="https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F45c3a188-6ed1-4540-9f33-37af754accbd%2Fi1n8_icon.png?id=06769198-9d4e-48fe-b891-7447f85222d1&table=block&spaceId=8ed52f91-a7f1-46bf-b39b-49af46e0a158&width=1000&userId=&cache=v2"/>
 *
 * ## Localization Service
 *
 * A container of string translations ("messages") for various locales.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/locale
 * ````
 * ## Usage
 *
 *  In the example below, we'll create a {@link @xeokit/viewer!Viewer} that uses an {@link WebIFCLoaderPlugin} to load an IFC model, and a
 *  {@link TreeViewPlugin}, which shows a camera navigation cube in the corner of the canvas.
 *
 *  We'll also configure our Viewer with our own LocaleService instance, configured with English, Māori and French
 *  translations for our TreeViewPlugin.
 *
 *  We could instead have just used the Viewer's default LocaleService, but this example demonstrates how we might
 *  configure the Viewer our own custom LocaleService subclass.
 *
 *  The translations fetched by our TreeViewPlugin will be:
 *
 * "NavCube.front"
 * "NavCube.back"
 * "NavCube.top"
 * "NavCube.bottom"
 * "NavCube.left"
 * "NavCube.right"
 *
 *  <br>
 *  These are paths that resolve to our translations for the currently active locale, and are hard-coded within
 *  the TreeViewPlugin.
 *
 *  For example, if  the LocaleService's locale is set to "fr", then the path "NavCube.back" will drill down
 *  into ````messages->fr->NavCube->front```` and fetch "Arrière".
 *
 *  If we didn't provide that particular translation in our LocaleService, or any translations for that locale,
 *  then the TreeViewPlugin will just fall back on its own default hard-coded translation, which in this case is "BACK".
 *
 *  [[Run example](https://xeokit.github.io/xeokit-sdk/examples/#localization_NavCubePlugin)]
 *
 *  ````javascript
 *  import {LocaleService} from "@xeokit/locale";
 *
 *  const localeService= new LocaleService({
 *           messages: {
 *               "en": { // English
 *                   "NavCube": {
 *                       "front": "Front",
 *                       "back": "Back",
 *                       "top": "Top",
 *                       "bottom": "Bottom",
 *                       "left": "Left",
 *                       "right": "Right"
 *                   }
 *               },
 *               "mi": { // Māori
 *                   "NavCube": {
 *                       "front": "Mua",
 *                       "back": "Tuarā",
 *                       "top": "Runga",
 *                       "bottom": "Raro",
 *                       "left": "Mauī",
 *                       "right": "Tika"
 *                   }
 *               },
 *               "fr": { // Francais
 *                   "NavCube": {
 *                       "front": "Avant",
 *                       "back": "Arrière",
 *                       "top": "Supérieur",
 *                       "bottom": "Inférieur",
 *                       "left": "Gauche",
 *                       "right": "Droit"
 *                   }
 *               }
 *           },
 *           locale: "en"
 *       })
 *   });
 * ````
 *
 *  We can dynamically switch to a different locale at any time:
 *
 *  ````javascript
 *  localeService.locale = "mi"; // Switch to Māori
 *  ````
 *
 *  We can load new translations at any time:
 *
 *  ````javascript
 *  localeService.loadMessages({
 *      "jp": { // Japanese
 *          "NavCube": {
 *              "front": "前部",
 *              "back": "裏",
 *              "top": "上",
 *              "bottom": "底",
 *              "left": "左",
 *              "right": "右"
 *          }
 *      }
 *  });
 *  ````
 *
 *  And we can clear the translations if needed:
 *
 *  ````javascript
 *  localeService.clearMessages();
 *  ````
 *
 *  We can get an "updated" event from the LocaleService whenever we switch locales or load messages, which is useful
 *  for triggering UI elements to refresh themselves with updated translations.
 *
 * TODO
 *
 *  ````javascript
 *  localeService.on("updated", () => {
 *      console.log( viewer.localeService.translate("NavCube.left") );
 *  });
 *  ````
 *
 *  @module @xeokit/locale
 */
export * from "./LocaleService";