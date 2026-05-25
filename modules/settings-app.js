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

    static PARTS = {
        settings: {
            template: "modules/crucibletongs/templates/settings/settings-config.hbs",
        },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.hint = "crucibletongs.SETTINGS.CONFIG.Hint";
        context.settings = this.#prepareSettings();
        return context;
    }

    #prepareSettings() {
        const settings = [];
        const fields = foundry.data.fields;
        for (const [id, setting] of game.settings.settings) {
            if (!id.startsWith("crucibletongs.")) continue;
            if (!setting.config) continue;
            const field = this.#prepareField(setting, fields);
            settings.push({
                id,
                field,
                value: game.settings.get(setting.namespace, setting.key),
                input: setting.input,
            });
        }
        return settings.sort((a, b) => a.field.label.localeCompare(b.field.label, game.i18n.lang));
    }

    #prepareField(setting, fields) {
        let field;
        if (setting.type instanceof fields.DataField) {
            field = setting.type;
        } else if (setting.type === Boolean) {
            field = new fields.BooleanField({ initial: setting.default ?? false });
        } else if (setting.type === Number) {
            const { min, max, step } = setting.range ?? {};
            field = new fields.NumberField({ required: true, choices: setting.choices, initial: setting.default, min, max, step });
        } else if (setting.type === Object) {
            field = new fields.JSONField({ required: true, initial: setting.default });
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