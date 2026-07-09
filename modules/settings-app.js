const { BooleanField } = foundry.data.fields;

/**
 * Boolean settings render the checkbox as a direct child of .form-group so long labels wrap correctly.
 * @see foundry14/templates/system/mastermenu/settings.hbs
 */
class SettingsBooleanField extends BooleanField {
    /** @inheritDoc */
    toFormGroup(groupConfig = {}, inputConfig = {}) {
        const { classes, label, hint, rootId, localize, units, hidden } = groupConfig;
        const classNames = ["form-group"];
        if (classes?.length) {
            classNames.push(...(typeof classes === "string" ? classes.split(" ") : classes));
        }

        const input = this.toInput(inputConfig);
        if (rootId && !input.id) {
            input.id = [rootId, input.name].filterJoin("-");
        } else if (!input.id && input.name) {
            input.id = input.name.replace(/\./g, "-");
        }

        const group = document.createElement("div");
        group.className = classNames.join(" ");
        group.hidden = hidden ?? false;

        const lbl = document.createElement("label");
        const displayLabel = label ?? this.label ?? this.fieldPath;
        lbl.textContent = localize ? game.i18n.localize(displayLabel) : displayLabel;
        if (input.id) lbl.htmlFor = input.id;
        if (units) {
            lbl.insertAdjacentHTML("beforeend", ` <span class="units">(${game.i18n.localize(units)})</span>`);
        }
        group.appendChild(lbl);
        group.appendChild(input);

        const hintText = hint ?? this.hint;
        if (hintText) {
            const h = document.createElement("p");
            h.className = "hint";
            h.textContent = localize ? game.i18n.localize(hintText) : hintText;
            group.appendChild(h);
        }

        return group;
    }
}

export class CrucibleTongsSettingsConfig extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "crucibletongs-settings-config",
        tag: "form",
        classes: ["standard-form", "crucibletongs-settings-config"],
        window: {
            title: "crucibletongs.SETTINGS.CONFIG.Title",
            resizable: true,
        },
        position: {
            width: 520,
            height: "auto",
        },
        form: {
            closeOnSubmit: false,
            submitOnChange: true,
            handler: CrucibleTongsSettingsConfig.#onSubmit,
        },
        actions: {
            resetDefaults: CrucibleTongsSettingsConfig.#onResetDefaults,
        },
    };

    static TABS = {
        config: {
            tabs: [
                { id: "hotbar", label: "crucibletongs.SETTINGS.TABS.hotbar" },
                { id: "combat", label: "crucibletongs.SETTINGS.TABS.combat" },
                { id: "partyViewer", label: "crucibletongs.SETTINGS.TABS.partyViewer" },
                { id: "gm", label: "crucibletongs.SETTINGS.TABS.gm" },
            ],
            initial: "hotbar",
        },
    };

    static SETTING_KEYS = {
        hotbar: [
            "enableHotBarActor",
            "showFavoriteActionsTab",
            "hotbarActorScale",
            "hotbarActionBarColumns",
            "hotbarActionBarRows",
        ],
        combat: [
            "enableCombatFlow",
            "enableCombatPan",
            "showIniTrackerActionPips",
            "iniTrackerSize",
            "iniTrackerCount",
        ],
        partyViewer: [
            "enablePartyViewer",
            "partyViewerLayout",
            "partyViewerSize",
        ],
        gm: [
            "enableActionConfirmToast",
        ],
    };

    static PARTS = {
        settings: {
            template: "modules/crucibletongs/templates/settings/settings-config.hbs",
        },
    };

    static open({ tab } = {}) {
        new CrucibleTongsSettingsConfig().render(true, { focus: true, tab });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const settingsByKey = this.#prepareSettingsMap();
        context.settingsByTab = {};
        for (const [tabId, keys] of Object.entries(this.constructor.SETTING_KEYS)) {
            context.settingsByTab[tabId] = keys
                .map((key) => settingsByKey.get(`crucibletongs.${key}`))
                .filter(Boolean);
        }
        context.tabIds = Object.keys(this.constructor.SETTING_KEYS);
        return context;
    }

    #prepareSettingsMap() {
        const settings = new Map();
        const fields = foundry.data.fields;
        for (const [id, setting] of game.settings.settings) {
            if (!id.startsWith("crucibletongs.")) continue;
            if (!setting.config) continue;
            settings.set(id, {
                id,
                field: this.#prepareField(setting, fields),
                value: game.settings.get(setting.namespace, setting.key),
                input: setting.input,
            });
        }
        return settings;
    }

    #prepareField(setting, fields) {
        let field;
        if (setting.type instanceof fields.DataField) {
            field = setting.type;
        } else if (setting.type === Boolean) {
            field = new SettingsBooleanField({ initial: setting.default ?? false });
        } else if (setting.type === Number) {
            const { min, max, step } = setting.range ?? {};
            field = new fields.NumberField({ required: true, choices: setting.choices, initial: setting.default, min, max, step });
        } else if (setting.type === Object) {
            field = new fields.JSONField({ required: true, initial: setting.default });
        } else if (setting.filePicker) {
            const categories = {
                audio: ["AUDIO"],
                folder: [],
                font: ["FONT"],
                graphics: ["GRAPHICS"],
                image: ["IMAGE"],
                imagevideo: ["IMAGE", "VIDEO"],
                text: ["TEXT"],
                texture: ["TEXTURE"],
                video: ["VIDEO"],
            }[setting.filePicker] ?? Object.keys(CONST.FILE_CATEGORIES).filter(c => c !== "HTML");
            if (categories.length) {
                field = new fields.FilePathField({ required: true, blank: true, categories });
            } else {
                field = new fields.StringField({ required: true });
            }
        } else {
            field = new fields.StringField({ required: true, choices: setting.choices, initial: setting.default });
        }
        field.name = setting.id;
        field.label ||= game.i18n.localize(setting.name ?? "");
        field.hint ||= game.i18n.localize(setting.hint ?? "");
        return field;
    }

    static async #onSubmit(_event, _form, formData) {
        const updates = [];
        const changedSetting = _event.target?.name;
        const entries = changedSetting ? [[changedSetting, formData.object[changedSetting]]] : Object.entries(formData.object);
        for (const [id, value] of entries) {
            const setting = game.settings.settings.get(id);
            if (!setting || !setting.config) continue;
            updates.push(game.settings.set(setting.namespace, setting.key, value));
        }
        await Promise.all(updates);
    }

    static async #onResetDefaults() {
        const updates = [];
        for (const [id, setting] of game.settings.settings) {
            if (!id.startsWith("crucibletongs.")) continue;
            if (!setting.config) continue;
            updates.push(game.settings.set(setting.namespace, setting.key, setting.default));
        }
        await Promise.all(updates);
        ui.notifications.info(game.i18n.localize("crucibletongs.SETTINGS.CONFIG.DefaultsRestored"));
        this.render(true, { focus: false });
    }
}
