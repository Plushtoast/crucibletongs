export const APP_SETTINGS_DEFAULTS = Object.freeze({
    combatTracker: Object.freeze({
        enabled: true,
        dockToCalendar: true,
        fadedUi: false,
        preferTokenImage: true,
        panToTurn: true,
        showActionPips: true,
        size: 70,
        count: 5,
        position: Object.freeze({}),
    }),
});

export class AppSettings {
    static KEY = "appSettings";

    static defaults() {
        return foundry.utils.deepClone(APP_SETTINGS_DEFAULTS);
    }

    static getAll() {
        const stored = game.settings.get("crucibletongs", this.KEY) ?? {};
        return foundry.utils.mergeObject(this.defaults(), stored, { inplace: false });
    }

    static get(appKey) {
        return this.getAll()[appKey] ?? {};
    }

    static async set(appKey, partial) {
        const all = this.getAll();
        all[appKey] = foundry.utils.mergeObject(all[appKey] ?? {}, partial, { inplace: false });
        await game.settings.set("crucibletongs", this.KEY, all);
        return all[appKey];
    }

    static async replaceApp(appKey, value) {
        const all = this.getAll();
        all[appKey] = foundry.utils.mergeObject(this.defaults()[appKey] ?? {}, value ?? {}, { inplace: false });
        await game.settings.set("crucibletongs", this.KEY, all);
        return all[appKey];
    }

    static async resetApp(appKey) {
        return this.replaceApp(appKey, this.defaults()[appKey] ?? {});
    }
}

/**
 * Ember top calendar helpers (`EmberCalendarNavigation` / `#ember-calendar`).
 * Collapsed day/time chrome is a fixed 40px (`#ember-calendar-controls`).
 */
export class EmberCalendar {
    /** Ember CSS: `#ember-calendar-controls { height: 40px }` (collapsed day strip). */
    static COLLAPSED_CONTROLS_HEIGHT = 40;

    /** Never dock lower than this viewport Y (keeps tracker under the top chrome). */
    static DOCK_BOTTOM_CAP = 150;

    static #savedExpanded = null;
    static #app = null;
    static #element = null;
    static #hookIds = [];
    static #notifyTimer = null;

    static isActive() {
        return !!game.modules.get("ember")?.active;
    }

    static init() {
        if (this.#hookIds.length) return;
        const onRender = (application, element) => this.#onRenderApplication(application, element);
        this.#hookIds.push(Hooks.on("renderApplicationV2", onRender));
        this.#hookIds.push(Hooks.on("renderEmberCalendarNavigation", onRender));
    }

    static #onRenderApplication(application, element) {
        if (!this.isActive()) return;
        const el = element instanceof HTMLElement ? element : application?.element;
        if (!(el instanceof HTMLElement)) return;
        if (!this.#looksLikeCalendar(application, el)) return;

        this.#app = application;
        this.#element = el;

        if (this.#notifyTimer) clearTimeout(this.#notifyTimer);
        this.#notifyTimer = setTimeout(() => {
            this.#notifyTimer = null;
            game.modules.get("crucibletongs")?.api?.combatTracker?.onCalendarRendered?.(this.#app, this.#element);
        }, 30);
    }

    static #looksLikeCalendar(application, el) {
        const id = String(application?.id ?? application?.options?.id ?? el.id ?? "");
        const name = String(application?.constructor?.name ?? "");
        if (id === "ember-calendar" || el.id === "ember-calendar") return true;
        if (name === "EmberCalendarNavigation") return true;
        return false;
    }

    static getApp() {
        if (this.#app?.element?.isConnected) return this.#app;
        if (!this.isActive()) return null;
        const ember = globalThis.ember ?? game.ember;
        if (ember?.ui?.calendar) return ember.ui.calendar;
        const api = game.modules.get("ember")?.api;
        return api?.calendar ?? api?.apps?.calendar ?? api?.ui?.calendar ?? null;
    }

    static getElement() {
        if (this.#element?.isConnected) return this.#element;
        const app = this.getApp();
        if (app?.element instanceof HTMLElement && app.element.isConnected) {
            this.#element = app.element;
            return this.#element;
        }
        return document.getElementById("ember-calendar");
    }

    static getControlsElement() {
        return document.getElementById("ember-calendar-controls");
    }

    /** True once Ember's day/time strip is in the DOM (live measure available). */
    static hasMeasuredControls() {
        return !!this.getControlsElement()?.isConnected;
    }

    /**
     * Viewport Y of the bottom of the collapsed day strip.
     * Uses live `#ember-calendar-controls` when present; otherwise estimates from
     * Ember's fixed 40px collapsed height (safe for dock-on-login before Ember paints).
     * @returns {number|null}
     */
    static getDockBottom() {
        if (!this.isActive()) return null;

        const controls = this.getControlsElement();
        if (controls?.isConnected) {
            return Math.min(controls.getBoundingClientRect().bottom, this.DOCK_BOTTOM_CAP);
        }

        const calendar = this.getElement();
        if (calendar?.isConnected) {
            const top = calendar.getBoundingClientRect().top;
            return Math.min(top + this.COLLAPSED_CONTROLS_HEIGHT, this.DOCK_BOTTOM_CAP);
        }

        // Login estimate: calendar sits at the top of the UI with a 40px controls bar.
        return this.COLLAPSED_CONTROLS_HEIGHT;
    }

    /** Ember is active — dock position can always be estimated (40px collapsed chrome). */
    static isAvailable() {
        return this.isActive();
    }

    static get expanded() {
        const el = this.getElement();
        if (el) return el.classList.contains("expanded");
        const app = this.getApp();
        // Private `#expanded` is not readable; class on the element is the source of truth.
        return !!app?.element?.classList?.contains("expanded");
    }

    static collapseForCombat() {
        if (!this.isActive()) return;
        if (this.#savedExpanded === null) this.#savedExpanded = this.expanded;

        const app = this.getApp();
        if (typeof app?.toggleExpanded === "function") {
            app.toggleExpanded(false);
            return;
        }

        const el = this.getElement();
        if (!el) return;
        el.classList.remove("expanded");
    }

    static restoreAfterCombat() {
        if (this.#savedExpanded === null) return;
        const expanded = this.#savedExpanded;
        this.#savedExpanded = null;

        const app = this.getApp();
        if (typeof app?.toggleExpanded === "function") {
            app.toggleExpanded(expanded);
            return;
        }

        const el = this.getElement();
        if (!el) return;
        el.classList.toggle("expanded", expanded);
    }
}
