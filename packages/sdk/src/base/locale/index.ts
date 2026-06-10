/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="../../assets/xeokit_logo_mesh.png"/>
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
 * <br>
 *
 * ## Features
 *
 * - **Locale-keyed messages** — `loadMessages(locale, bundle)` builds
 *   up the message table; `setLocale(locale)` switches the active
 *   locale and re-renders subscribed UI.
 * - **Stable keys** — UI widgets reference keys like
 *   `"NavCube.front"`; translation bundles supply the per-locale
 *   strings without code changes to the widget.
 * - **Argument interpolation** — `translate("WELCOME", { name })`
 *   resolves `{name}` placeholders in the matched message.
 * - **Pluralisation** — `translatePlurals(key, count, args)`
 *   selects the right plural form based on the active locale's
 *   plural rules.
 * - **Incremental load** — bundles can be lazy-loaded per locale;
 *   missing keys fall through to the bundled default-locale string
 *   so the app never renders an empty cell.
 * - **Event-driven re-render** — `onLocaleChanged` /
 *   `onMessagesLoaded` notify subscribed widgets when something
 *   they depend on has changed.
 *
 * <br>
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
 * The example below shows how to create a {@link base!locale.LocaleService | LocaleService}
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
 * import { LocaleService } from "@xeokit/sdk/base/locale";
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
