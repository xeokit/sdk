import {LocaleService} from "../src";

describe('Test LocaleService', function () {
    it('Test LocaleService', () => {

        const localeService = new LocaleService({
            messages: {
                "en": { // English
                    "NavCube": {
                        "front": "Front",
                        "back": "Back",
                        "top": "Top",
                        "bottom": "Bottom",
                        "left": "Left",
                        "right": "Right"
                    }
                },
                "mi": { // Māori
                    "NavCube": {
                        "front": "Mua",
                        "back": "Tuarā",
                        "top": "Runga",
                        "bottom": "Raro",
                        "left": "Mauī",
                        "right": "Tika"
                    }
                },
                "fr": { // Francais
                    "NavCube": {
                        "front": "Avant",
                        "back": "Arrière",
                        "top": "Supérieur",
                        "bottom": "Inférieur",
                        "left": "Gauche",
                        "right": "Droit"
                    }
                }
            },
            locale: "en"
        });

        let countUpdatedEvents = 0;

        localeService.onUpdated.subscribe(() => {
            countUpdatedEvents++;
        });

        localeService.locale = "en";

        expect(localeService.locale).toStrictEqual("en");
        expect(localeService.translate("NavCube.left")).toStrictEqual("Left");
        expect(localeService.translate("NavCube.right")).toStrictEqual("Right");

        localeService.locale = "mi";

        expect(localeService.locale).toStrictEqual("mi");
        expect(localeService.translate("NavCube.left")).toStrictEqual("Mauī");
        expect(localeService.translate("NavCube.right")).toStrictEqual("Tika");

        localeService.locale = "fr";

        expect(localeService.locale).toStrictEqual("fr");
        expect(localeService.translate("NavCube.left")).toStrictEqual("Gauche");
        expect(localeService.translate("NavCube.right")).toStrictEqual("Droit");

        localeService.loadMessages({
            "jp": { // Japanese
                "NavCube": {
                    "front": "前部",
                    "back": "裏",
                    "top": "上",
                    "bottom": "底",
                    "left": "左",
                    "right": "右"
                }
            }
        });

        localeService.locale = "jp";

        expect(localeService.locale).toStrictEqual("jp");
        expect(localeService.translate("NavCube.left")).toStrictEqual("左");
        expect(localeService.translate("NavCube.right")).toStrictEqual("右");

        expect(countUpdatedEvents).toStrictEqual(4);
    });
});
