/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Flocale.svg)](https://badge.fury.io/js/%40xeokit%2Flocale)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/locale/badge)](https://www.jsdelivr.com/package/npm/@xeokit/locale)
 * 
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px; height:150px; width:150px;" src="https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F45c3a188-6ed1-4540-9f33-37af754accbd%2Fi1n8_icon.png?id=06769198-9d4e-48fe-b891-7447f85222d1&table=block&spaceId=8ed52f91-a7f1-46bf-b39b-49af46e0a158&width=1000&userId=&cache=v2"/>
 *
 * # xeokit Localization Service
 *
 * ---
 *
 * ### Repository of locale-specific translations for words and phrases
 *
 * ---
 *
 * A container of string translations ("messages") for various locales.
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt?type=png)](https://mermaid.live/edit#pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt)
 *
 * <br>
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/locale
 * ````
 * ## Usage
 *
 *  In the example below, we'll create a {@link @xeokit/locale!LocaleService | LocaleService} instance, configured with some English, Māori and French
 *  translations for a NavCube widget.
 *
 *  Our LocaleServe will provide translations for the following terms:
 *
 * * "NavCube.front"
 * * "NavCube.back"
 * * "NavCube.top"
 * * "NavCube.bottom"
 * * "NavCube.left"
 * * "NavCube.right"
 *
 *  These terms are effectively paths that map to translations for the currently active locale.
 *
 *  For example, if  the {@link @xeokit/locale!LocaleService | LocaleService}'s locale is set to "fr", then the path "NavCube.back" will drill down
 *  into ````messages->fr->NavCube->front```` and fetch "Arrière".
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
 *  We can also get an event from the {@link @xeokit/locale!LocaleService | LocaleService} whenever we switch locales or load messages, which is useful
 *  for triggering UI elements to refresh themselves with updated translations:
 *
 *  ````javascript
 *  localeService.onUpdated.subscribe(() => {
 *      console.log( viewer.localeService.translate("NavCube.left") );
 *  });
 *  ````
 *
 *  @module @xeokit/locale
 */
export * from "./LocaleService";