import {EventDispatcher} from "strongly-typed-events";
import {EventEmitter} from "@xeokit/core";

/**
 * The localization service for a {@link @xeokit/viewer!Viewer | Viewer}.
 *
 * See {@link "@xeokit/locale"} for usage.
 */
class LocaleService {

    /**
     * Emits an event each time the locale translations have updated.
     *
     * @event
     */
    readonly onUpdated: EventEmitter<LocaleService, string>;
    #messages: { [key: string]: any };
    #locales: string[];
    #locale: string = "en";

    /**
     * Constructs a LocaleService.
     *
     * @param cfg LocaleService configuration
     * @param cfg.messages Set of locale translations
     * @param cfg.locale Initial locale
     */
    constructor(cfg: {
        messages?: any,
        locale?: string
    } = {
        messages: {},
        locale: ""
    }) {
        this.onUpdated = new EventEmitter(new EventDispatcher<LocaleService, string>());
        this.messages = cfg.messages;
        this.locale = cfg.locale;
    }

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
    set messages(messages: { [key: string]: any }) {
        this.#messages = messages || {};
        this.#locales = Object.keys(this.#messages);
        this.onUpdated.dispatch(this, this.#locale);
    }

    /**
     * Gets the list of available locales.
     *
     * These are derived from the currently configured set of translations.
     *
     * @returns The list of available locales.
     */
    get locales(): string[] {
        return this.#locales;
    }

    /**
     * Gets the current locale.
     *
     * @returns {String} The current locale.
     */
    get locale(): string {
        return this.#locale;
    }

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
    set locale(locale: string|undefined) {
        locale = locale || "de";
        if (this.#locale === locale) {
            return;
        }
        this.#locale = locale;
        this.onUpdated.dispatch(this, this.#locale);
    }

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
    loadMessages(messages: { [key: string]: any } = {}) {
        for (let locale in messages) {
            this.#messages[locale] = messages[locale];
        }
        this.messages = this.#messages;
    }

    /**
     * Clears all locale translations.
     *
     * * Fires an "updated" event when done.
     * * Does not change the current locale.
     * * Automatically refreshes any plugins that depend on the translations, which will cause those
     * plugins to fall back on their internal hard-coded text values, since this method removes all
     * our translations.
     */
    clearMessages() {
        this.messages = {};
    }

    /**
     * Translates the given string according to the current locale.
     *
     * Returns null if no translation can be found.
     *
     * @param msg String to translate.
     * @param args Extra parameters.
     * @returns  Translated string if found, else null.
     */
    translate(msg: string, args?: any): string | null {
        const localeMessages = this.#messages[this.#locale];
        if (!localeMessages) {
            return null;
        }
        const localeMessage = resolvePath(msg, localeMessages);
        if (localeMessage) {
            if (args) {
                return vsprintf(localeMessage, args);
            }
            return localeMessage;
        }
        return null;
    }

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
    translatePlurals(msg: string, count: number, args: any): string | null {
        const localeMessages = this.#messages[this.#locale];
        if (!localeMessages) {
            return null;
        }
        let localeMessage = resolvePath(msg, localeMessages);
        count = parseInt("" + count, 10);
        if (count === 0) {
            localeMessage = localeMessage.zero;
        } else {
            localeMessage = (count > 1) ? localeMessage.other : localeMessage.one;
        }
        if (!localeMessage) {
            return null;
        }
        localeMessage = vsprintf(localeMessage, [count]);
        if (args) {
            localeMessage = vsprintf(localeMessage, args);
        }
        return localeMessage;
    }
}

function resolvePath(key: string, json: any) {
    if (json[key]) {
        return json[key];
    }
    const parts = key.split(".");
    let obj = json;
    for (let i = 0, len = parts.length; obj && (i < len); i++) {
        const part = parts[i];
        obj = obj[part];
    }
    return obj;
}

function vsprintf(msg: string, args: any = []) {
    return msg.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
        if (m === "{{") {
            return "{";
        }
        if (m === "}}") {
            return "}";
        }
        return args[n];
    });
}

export {LocaleService};
