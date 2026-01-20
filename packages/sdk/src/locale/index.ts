/**
 * <img style="padding: 20px 0; height: 150px; width: 150px;" src="https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F45c3a188-6ed1-4540-9f33-37af754accbd%2Fi1n8_icon.png?id=06769198-9d4e-48fe-b891-7447f85222d1&table=block&spaceId=8ed52f91-a7f1-46bf-b39b-49af46e0a158&width=1000&userId=&cache=v2"/>
 *
 * # xeokit Localization Service
 *
 * ---
 *
 * **Locale-aware message lookup and translation utilities.**
 *
 * ---
 *
 * This module provides a lightweight localization layer for xeokit components,
 * allowing UI text to be defined once and rendered in different languages at runtime.
 * Translations are keyed by stable identifiers (for example `"NavCube.front"`) and
 * resolved based on the currently active locale.
 *
 * The service is designed for:
 *
 * - UI widgets that need dynamic language switching
 * - Centralized management of translated strings
 * - Incremental loading or replacement of translation bundles
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
 * The example below shows how to create a {@link locale!LocaleService | LocaleService}
 * with English, Māori, and French translations for a NavCube widget.
 *
 * The following keys are used by the NavCube:
 *
 * - `"NavCube.front"`
 * - `"NavCube.back"`
 * - `"NavCube.top"`
 * - `"NavCube.bottom"`
 * - `"NavCube.left"`
 * - `"NavCube.right"`
 *
 * These keys are resolved against the active locale. For example, when the locale
 * is set to `"fr"`, `"NavCube.back"` resolves to `"Arrière"`.
 *
 * ```javascript
 * import { LocaleService } from "@xeokit/sdk/locale";
 *
 * const localeService = new LocaleService({
 *   messages: {
 *     en: { // English
 *       NavCube: {
 *         front: "Front",
 *         back: "Back",
 *         top: "Top",
 *         bottom: "Bottom",
 *         left: "Left",
 *         right: "Right"
 *       }
 *     },
 *     mi: { // Māori
 *       NavCube: {
 *         front: "Mua",
 *         back: "Tuarā",
 *         top: "Runga",
 *         bottom: "Raro",
 *         left: "Mauī",
 *         right: "Tika"
 *       }
 *     },
 *     fr: { // French
 *       NavCube: {
 *         front: "Avant",
 *         back: "Arrière",
 *         top: "Supérieur",
 *         bottom: "Inférieur",
 *         left: "Gauche",
 *         right: "Droit"
 *       }
 *     }
 *   },
 *   locale: "en"
 * });
 * ```
 *
 * ---
 *
 * ## Switching locales at runtime
 *
 * ```javascript
 * localeService.locale = "mi"; // Switch to Māori
 * ```
 *
 * ---
 *
 * ## Loading additional translations
 *
 * New message bundles can be merged in at any time, without recreating the service:
 *
 * ```javascript
 * localeService.loadMessages({
 *   jp: { // Japanese
 *     NavCube: {
 *       front: "前部",
 *       back: "裏",
 *       top: "上",
 *       bottom: "底",
 *       left: "左",
 *       right: "右"
 *     }
 *   }
 * });
 * ```
 *
 * ---
 *
 * ## Clearing translations
 *
 * ```javascript
 * localeService.clearMessages();
 * ```
 *
 * ---
 *
 * ## Reacting to locale updates
 *
 * `LocaleService` emits an update event whenever the active locale changes or new
 * messages are loaded. This allows UI components to re-render automatically.
 *
 * ```javascript
 * localeService.onUpdated.subscribe(() => {
 *   console.log(localeService.translate("NavCube.left"));
 * });
 * ```
 *
 * ---
 *
 * @module locale
 */
export * from "./LocaleService";
