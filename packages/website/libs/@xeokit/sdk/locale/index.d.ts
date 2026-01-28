/**
 * <img style="padding: 20px 0; height: 150px; width: 150px;" src="https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F45c3a188-6ed1-4540-9f33-37af754accbd%2Fi1n8_icon.png?id=06769198-9d4e-48fe-b891-7447f85222d1&table=block&spaceId=8ed52f91-a7f1-46bf-b39b-49af46e0a158&width=1000&userId=&cache=v2"/>
 *
 * # xeokit Localization Service
 *
 * ---
 *
 * **Provides locale-specific translations for words and phrases.**
 *
 * ---
 *
 * [![](https://mermaid.ink/img/pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt?type=png)](https://mermaid.live/edit#pako:eNqNUsFuwjAM_ZXKp00CabtWqIeN0wQD0WsupnFHpjSpnORQIf59SUMHCImtl9TPznvPjo_QWElQQqPRuaXCL8ZOGGGkYmq8sqZY7VI85ou6IUPreEMXR2GK-CmZT7v_jvUuBw0TetqM0NNzxvZBaTkFkpxnO6TwlNgn_iV6HOkfsfdse2I_1PRIL2M70pi6cAfV32a2F5Z_WcwGVxblu_LDR7353GKclZsGsVj0KSZPXFUZQmYc3kLbEmfA_Y7vrDG1e6OhrzQu7G0w43sk8rH43oqAFwHzeSXgVUB9pfVH6fJi41p7St_fhhl0xB0qGTdndCjAH6gjAWX8ldRi0F5AdBpLMXhbD6aB0nOgGYQ-9k3nXYOyRe0iSlJ5y-vzNqbj9AOT7uJt)
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Usage
 *
 * The example below demonstrates how to create a {@link locale!LocaleService | LocaleService} instance
 * with English, Māori, and French translations for a NavCube widget.
 *
 * The `LocaleService` provides translations for:
 *
 * - `"NavCube.front"`
 * - `"NavCube.back"`
 * - `"NavCube.top"`
 * - `"NavCube.bottom"`
 * - `"NavCube.left"`
 * - `"NavCube.right"`
 *
 * These terms act as keys that map to translations based on the active locale.
 * For example, if the locale is set to `"fr"`, `"NavCube.back"` resolves to `"Arrière"`.
 *
 * ```javascript
 * import { LocaleService } from "@xeokit/sdk/locale";
 *
 * const localeService = new LocaleService({
 *     messages: {
 *         "en": { // English
 *             "NavCube": {
 *                 "front": "Front",
 *                 "back": "Back",
 *                 "top": "Top",
 *                 "bottom": "Bottom",
 *                 "left": "Left",
 *                 "right": "Right"
 *             }
 *         },
 *         "mi": { // Māori
 *             "NavCube": {
 *                 "front": "Mua",
 *                 "back": "Tuarā",
 *                 "top": "Runga",
 *                 "bottom": "Raro",
 *                 "left": "Mauī",
 *                 "right": "Tika"
 *             }
 *         },
 *         "fr": { // French
 *             "NavCube": {
 *                 "front": "Avant",
 *                 "back": "Arrière",
 *                 "top": "Supérieur",
 *                 "bottom": "Inférieur",
 *                 "left": "Gauche",
 *                 "right": "Droit"
 *             }
 *         }
 *     },
 *     locale: "en"
 * });
 * ```
 *
 * ---
 *
 * ### Switching Locales Dynamically
 *
 * ```javascript
 * localeService.locale = "mi"; // Switch to Māori
 * ```
 *
 * ---
 *
 * ### Loading New Translations
 *
 * ```javascript
 * localeService.loadMessages({
 *     "jp": { // Japanese
 *         "NavCube": {
 *             "front": "前部",
 *             "back": "裏",
 *             "top": "上",
 *             "bottom": "底",
 *             "left": "左",
 *             "right": "右"
 *         }
 *     }
 * });
 * ```
 *
 * ---
 *
 * ### Clearing Translations
 *
 * ```javascript
 * localeService.clearMessages();
 * ```
 *
 * ---
 *
 * ### Listening for Locale Changes
 *
 * The `LocaleService` emits an event when the locale changes or new messages are loaded.
 * This can be useful for refreshing UI elements dynamically.
 *
 * ```javascript
 * localeService.onUpdated.subscribe(() => {
 *     console.log(localeService.translate("NavCube.left"));
 * });
 * ```
 *
 * ---
 *
 * @module locale
 */
export * from "./LocaleService";
//# sourceMappingURL=index.d.ts.map
