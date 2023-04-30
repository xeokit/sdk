import { EventEmitter } from "@xeokit/core";
/**
 * The localization service for a {@link @xeokit/viewer!Viewer}.
 *
 * See {@link "@xeokit/localization"} for usage.
 */
declare class LocaleService {
    #private;
    /**
     * Emits an event each time the locale translations have updated.
     *
     * @event
     */
    readonly onUpdated: EventEmitter<LocaleService, string>;
    /**
     * Constructs a LocaleService.
     *
     * @param cfg LocaleService configuration
     * @param cfg.messages Set of locale translations
     * @param cfg.locale Initial locale
     */
    constructor(cfg?: {
        messages?: any;
        locale?: string;
    });
    /**
     * Replaces the current set of locale translations.
     *
     * * Fires an "updated" event when done.
     * * Automatically refreshes any plugins that depend on the translations.
     * * Does not change the current locale.
     *
     * ## Usage
     *
     * ````javascript
     * viewer.localeService.setMessages({
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
     *         }
     *    }
     * });
     * ````
     *
     * @param messages The new translations.
     */
    set messages(messages: {
        [key: string]: any;
    });
    /**
     * Gets the list of available locales.
     *
     * These are derived from the currently configured set of translations.
     *
     * @returns The list of available locales.
     */
    get locales(): string[];
    /**
     * Gets the current locale.
     *
     * @returns {String} The current locale.
     */
    get locale(): string;
    /**
     * Sets the current locale.
     *
     * * Fires an "updated" event when done.
     * * The given locale does not need to be in the list of available locales returned by {@link LocaleService.locales}, since
     * this method assumes that you may want to load the locales at a later point.
     * * Automatically refreshes any plugins that depend on the translations.
     * * We can then get translations for the locale, if translations have been loaded for it, via {@link LocaleService.translate} and {@link LocaleService.translatePlurals}.
     *
     * @param locale The new current locale.
     */
    set locale(locale: string | undefined);
    /**
     * Loads a new set of locale translations, adding them to the existing translations.
     *
     * * Fires an "updated" event when done.
     * * Automatically refreshes any plugins that depend on the translations.
     * * Does not change the current locale.
     *
     * ## Usage
     *
     * ````javascript
     * viewer.localeService.loadMessages({
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
     * ````
     *
     * @param messages The new translations.
     */
    loadMessages(messages?: {
        [key: string]: any;
    }): void;
    /**
     * Clears all locale translations.
     *
     * * Fires an "updated" event when done.
     * * Does not change the current locale.
     * * Automatically refreshes any plugins that depend on the translations, which will cause those
     * plugins to fall back on their internal hard-coded text values, since this method removes all
     * our translations.
     */
    clearMessages(): void;
    /**
     * Translates the given string according to the current locale.
     *
     * Returns null if no translation can be found.
     *
     * @param msg String to translate.
     * @param args Extra parameters.
     * @returns  Translated string if found, else null.
     */
    translate(msg: string, args?: any): string | null;
    /**
     * Translates the given phrase according to the current locale.
     *
     * Returns null if no translation can be found.
     *
     * @param msg Phrase to translate.
     * @param count The plural number.
     * @param [args] Extra parameters.
     * @returns String|null Translated string if found, else null.
     */
    translatePlurals(msg: string, count: number, args: any): string | null;
}
export { LocaleService };
