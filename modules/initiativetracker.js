import { canViewCombatantActions, canViewCombatantDefenseTooltip, defenseTooltip, prepareActiveCombatantResources } from "./utility.js";
import { AppSettings, EmberCalendar } from "./app-settings.js";
import { CrucibleTongsSettingsConfig } from "./settings-app.js";

const { mergeObject, duplicate } = foundry.utils;

export class CrucibleCombatTracker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        position: {
            width: 440,
            top: 100,
            left: 170,
        },
        window: {
            title: "crucibletongs.combatTracker",
            resizable: false,
            frame: false,
        },
        actions: {
            panToCombatant: this.#onCombatantControl,
            pingCombatant: this.#onCombatantControl,
            rollInitiative: this.#onCombatantControl,
            toggleDefeated: this.#onCombatantControl,
            toggleHidden: this.#onCombatantControl,
            activateCombatant: this.#onCombatantMouseDown,
            waitInit: this.#waitInit,
            configure: this.#onConfigure,
        },
        classes: ["crucible-tongs-combat-tracker", "crucible"],
    };

    static PARTS = {
        main: {
            template: "modules/crucibletongs/templates/combattracker/initracker.hbs",
        },
    };

    static COUNT_MIN = 3;
    static COUNT_MAX = 25;
    static DOCK_TOP_MARGIN = 12;
    static CONTROL_WIDTH = 80;

    #dockedCombatId = null;
    #resizePointerId = null;
    #resizeStartX = 0;
    #resizeStartCount = 0;
    #suppressPositionPersist = false;
    #calendarDockMeasured = false;

    get scene() {
        return ui.combat.scene;
    }

    get viewed() {
        return ui.combat.viewed;
    }

    get combatSettings() {
        return AppSettings.get("combatTracker");
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        this.element.classList.toggle("faded-ui", !!this.combatSettings.fadedUi);

        const container = this.element.querySelector(".dragHandler");
        new foundry.applications.ux.Draggable(this, this.element, container, false);

        const turns = this.element.querySelectorAll(".iniItem");
        turns.forEach((turn) => {
            turn.addEventListener("pointerover", this._onCombatantHoverIn.bind(this));
            turn.addEventListener("pointerout", this._onCombatantHoverOut.bind(this));
            turn.addEventListener("dblclick", this._onCombatantMouseDown.bind(this));
        });

        this.#bindResizeHandle();

        if (
            this.combatSettings.dockToCalendar
            && EmberCalendar.isActive()
            && !this.#calendarDockMeasured
            && EmberCalendar.isAvailable()
        ) {
            this.#redockBelowCalendar();
        }
    }

    /**
     * Called from EmberCalendar when `renderApplicationV2` fires for the calendar HUD.
     */
    onCalendarRendered(_app, _element) {
        if (!this.rendered || !this.combatSettings.dockToCalendar) return;
        if (!EmberCalendar.isActive()) return;
        if (this.#calendarDockMeasured) return;
        this.#redockBelowCalendar();
    }

    _onClose(options) {
        return super._onClose(options);
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        this._createContextMenu(this._getCrucibleIniTrackerEntryContextOptions, ".iniTrackerList .combatant", { fixed: true });

        if (!game.user.isGM) return;

        this._createContextMenu(this._getCombatContextOptions, ".encounter-context-menu", {
            eventName: "click",
            fixed: true,
            parentClassHooks: false,
        });
    }

    _getCrucibleIniTrackerEntryContextOptions() {
        game.tooltip.deactivate();
        return ui.combat._getEntryContextOptions().map(CrucibleCombatTracker.#normalizeContextMenuEntry);
    }

    _getCombatContextOptions() {
        game.tooltip.deactivate();
        const options = ui.combat._getCombatContextOptions().map(CrucibleCombatTracker.#normalizeContextMenuEntry);
        options.push({
            label: "crucibletongs.SETTINGS.combatTracker.config",
            icon: "<i class='fa-solid fa-cog'></i>",
            onClick: () => CrucibleTongsSettingsConfig.open({ tab: "combat" }),
        });
        return options;
    }

    /** Foundry V14+: ContextMenuEntry uses `label` / `onClick` (not `name` / `callback`). */
    static #normalizeContextMenuEntry(entry) {
        if (!entry || typeof entry !== "object") return entry;
        const normalized = { ...entry };
        if (normalized.label == null && normalized.name != null) {
            normalized.label = normalized.name;
            delete normalized.name;
        }
        if (normalized.onClick == null && typeof normalized.callback === "function") {
            normalized.onClick = normalized.callback;
            delete normalized.callback;
        }
        return normalized;
    }

    async _prepareContext(options) {
        const data = this.combatData;
        const settings = this.combatSettings;
        const itemWidth = settings.size;
        const actorCount = settings.count;
        const forceDock = options.forceDock === true;

        const combatStarted = data.combat.round;
        const turnsToUse = data.turns;

        const skipDefeated = game.settings.get("core", Combat.CONFIG_SETTING).skipDefeated;

        const anyActive = turnsToUse.some((x) => x.active);
        let unRolled = data.turns.some((x) => x.isOwner && !x.initiative && (!game.user.isGM || data.combat.combatants.get(x.id).isNPC));

        const activeIndex = turnsToUse.findIndex((x) => x.active);
        const startIndex = activeIndex === -1 ? 0 : activeIndex;

        let remainingValidTurns = 0;
        for (let i = startIndex; i < turnsToUse.length; i++) {
            const combatant = data.combat.combatants.get(turnsToUse[i].id);
            if (!(skipDefeated && combatant.defeated) && (game.user.isGM || !combatant.hidden)) {
                remainingValidTurns++;
            }
        }

        const showEndOfRoundBox = combatStarted && remainingValidTurns < actorCount;
        const turnLimit = showEndOfRoundBox ? actorCount - 1 : actorCount;

        if (turnsToUse.length) {
            const filteredTurns = [];
            let started = false;

            for (let i = startIndex; i < turnsToUse.length && filteredTurns.length < turnLimit; i++) {
                const turn = duplicate(turnsToUse[i]);
                const combatant = data.combat.combatants.get(turn.id);

                if (!combatStarted || turn.active || !anyActive) {
                    started = true;
                }

                if (started && !(skipDefeated && combatant.defeated) && (game.user.isGM || !combatant.hidden)) {
                    const canViewActorStats = canViewCombatantDefenseTooltip(combatant);
                    turn.canViewActorStats = canViewActorStats;
                    turn.img = await this.#resolveCombatantImage(combatant, turn.img);
                    if (canViewActorStats) {
                        turn.maxLP = combatant.actor.resources.health.max;
                        turn.currentLP = combatant.actor.resources.health.value;
                        turn.maxM = combatant.actor.resources.morale.max;
                        turn.currentM = combatant.actor.resources.morale.value;
                        turn.defenseTooltip = this.#prepareDefenseTooltip(combatant);
                    } else {
                        delete turn.defenseTooltip;
                    }
                    filteredTurns.push(turn);
                }
            }
            data.turns = filteredTurns;
        }

        const remainingTurns = turnsToUse.slice(startIndex + 1).filter((t) => {
            const combatant = data.combat.combatants.get(t.id);
            return !(skipDefeated && combatant.defeated) && (game.user.isGM || !combatant.hidden);
        });
        data.isLastTurn = combatStarted && remainingTurns.length === 0;
        data.showEndOfRoundBox = showEndOfRoundBox;
        data.currentRound = data.combat.round;
        data.nextRound = data.combat.round + 1;

        data.showActiveCombatantActions = false;
        if (settings.showActionPips && combatStarted) {
            const activeTurn = data.turns?.find((turn) => turn.active) ?? data.turns?.[0];
            if (activeTurn) {
                const activeCombatant = data.combat.combatants.get(activeTurn.id);
                if (activeCombatant?.actor && canViewCombatantActions(activeCombatant.actor)) {
                    data.showActiveCombatantActions = true;
                    data.activeCombatantResources = prepareActiveCombatantResources(activeCombatant.actor);
                }
            }
        }

        const calculatedWidth = this.constructor.#widthForCount(actorCount, itemWidth);
        const minWidth = 250;
        options.position.width = Math.max(calculatedWidth, minWidth);

        let extraHeight = 0;
        const showTurnControls = combatStarted && (data.control || game.user.isGM);
        if (showTurnControls && !data.showActiveCombatantActions) extraHeight += 28;
        if (data.showActiveCombatantActions) {
            extraHeight += 22;
            if (showTurnControls) extraHeight += 38;
        }
        options.position.height = itemWidth + 10 + extraHeight;

        this.#applyPosition(options, { forceDock });

        Object.assign(data, {
            itemWidth,
            unRolled,
        });

        this.conditionalPanToCurrentCombatant(data);

        return data;
    }

    static #widthForCount(count, itemWidth) {
        return itemWidth * count + count * 3 + this.CONTROL_WIDTH;
    }

    #applyPosition(options, { forceDock = false } = {}) {
        const settings = this.combatSettings;
        options.position ??= {};

        const shouldDock = settings.dockToCalendar;
        const combatId = this.combatData?.combat?.id ?? game.combat?.id ?? null;
        const waitingForCalendar = shouldDock && EmberCalendar.isActive() && !this.#calendarDockMeasured;
        const isNewCombatDock = shouldDock && combatId && (forceDock || combatId !== this.#dockedCombatId);

        if (shouldDock && (isNewCombatDock || forceDock || !this.rendered || waitingForCalendar)) {
            if (EmberCalendar.isActive()) EmberCalendar.collapseForCombat();
            const docked = this.#dockPosition(options.position.width, options.position.height);
            options.position.left = docked.left;
            options.position.top = docked.top;
            // Only lock this combat once we have a real calendar measure (or Ember is off).
            if (combatId && (!EmberCalendar.isActive() || this.#calendarDockMeasured)) {
                this.#dockedCombatId = combatId;
            }
            return;
        }

        // While docked this combat, prefer live window coords over a stale pre-calendar save.
        if (shouldDock && this.rendered && Number.isFinite(this.position?.left) && Number.isFinite(this.position?.top)) {
            options.position.left = this.position.left;
            options.position.top = this.position.top;
            return;
        }

        mergeObject(options.position, settings.position ?? {});
    }

    #dockPosition(width, height) {
        const margin = this.constructor.DOCK_TOP_MARGIN;
        // Same coordinate space as party-viewer / Foundry ApplicationV2 window position.
        const left = Math.max(0, Math.round((window.innerWidth - width) / 2));
        let top = margin;

        if (EmberCalendar.isActive()) {
            // Collapsed Ember day strip is 40px; getDockBottom() estimates that on login
            // and uses live `#ember-calendar-controls` once Ember has painted.
            const dockBottom = EmberCalendar.getDockBottom() ?? EmberCalendar.COLLAPSED_CONTROLS_HEIGHT;
            top = Math.round(dockBottom + margin);
            top = Math.min(top, EmberCalendar.DOCK_BOTTOM_CAP + margin);
        }

        return { left, top, width, height };
    }

    /**
     * Collapse Ember calendar (if needed) and snap tracker under the top day strip.
     */
    #redockBelowCalendar() {
        if (!this.rendered || !this.combatSettings.dockToCalendar) return;
        if (EmberCalendar.isActive()) EmberCalendar.collapseForCombat();

        const apply = (persist = false) => {
            if (!this.rendered || !this.combatSettings.dockToCalendar) return;

            const width = this.position.width ?? this.element?.offsetWidth ?? 440;
            const height = this.position.height ?? this.element?.offsetHeight ?? 80;
            const docked = this.#dockPosition(width, height);

            this.#suppressPositionPersist = !persist;
            try {
                this.setPosition({ left: docked.left, top: docked.top });
            } finally {
                this.#suppressPositionPersist = false;
            }

            if (persist) {
                // Lock only after live controls measure (or Ember off). Estimates may refine later.
                const measured = !EmberCalendar.isActive() || EmberCalendar.hasMeasuredControls();
                if (measured) {
                    this.#calendarDockMeasured = true;
                    this.#dockedCombatId = game.combat?.id ?? this.#dockedCombatId;
                    AppSettings.set("combatTracker", {
                        position: { left: docked.left, top: docked.top },
                    });
                }
            }
        };

        apply(false);
        requestAnimationFrame(() => {
            apply(false);
            setTimeout(() => apply(true), 75);
        });
    }

    async #resolveCombatantImage(combatant, fallback) {
        const preferToken = this.combatSettings.preferTokenImage;
        if (preferToken) {
            if (typeof ui.combat?._getCombatantThumbnail === "function") {
                try {
                    return await ui.combat._getCombatantThumbnail(combatant);
                } catch (_) {
                    // fall through
                }
            }
            return combatant.token?.texture?.src ?? combatant.img ?? fallback;
        }
        return combatant.actor?.img ?? combatant.img ?? fallback;
    }

    #prepareDefenseTooltip(combatant) {
        return defenseTooltip(combatant);
    }

    async conditionalPanToCurrentCombatant(data) {
        if (!this.combatSettings.panToTurn) return;

        const firstTurn = data.turns[0];
        if (!firstTurn) return;

        const combatant = data.combat.combatants.get(firstTurn.id);

        if (!combatant || !this.hasChangedTurn(data)) return;

        setTimeout(() => {
            const token = combatant.token;
            if (!token || !token.object || !token.object.isVisible) return;
            canvas.animatePan({ x: token.x, y: token.y });

            if (!combatant.actor || !combatant.actor.isOwner) return;
            token.object.control({ releaseOthers: true });
        }, 300);
    }

    setPosition(position) {
        const currentPosition = super.setPosition(position);
        if (this.#suppressPositionPersist) return currentPosition;
        if (!Number.isFinite(currentPosition?.left) || !Number.isFinite(currentPosition?.top)) return currentPosition;
        AppSettings.set("combatTracker", {
            position: {
                left: currentPosition.left,
                top: currentPosition.top,
            },
        });
        return currentPosition;
    }

    /**
     * Re-apply calendar docking for a newly started/created combat.
     */
    dockForNewCombat() {
        if (!this.combatSettings.dockToCalendar) return;
        this.#dockedCombatId = null;
        this.#calendarDockMeasured = false;
        if (!this.rendered) return;
        this.render(true, { focus: false, forceDock: true });
        // If calendar already rendered earlier, dock immediately; otherwise wait for renderApplicationV2.
        if (EmberCalendar.isAvailable()) this.#redockBelowCalendar();
    }

    onCombatEnded() {
        this.#dockedCombatId = null;
        this.#calendarDockMeasured = false;
        EmberCalendar.restoreAfterCombat();
    }

    updateTracker(data) {
        this.combatData = data;
        this.render(true, { focus: false });
    }

    hasChangedTurn(data) {
        const res = data.turn !== this.lastTurnUpdate || data.round !== this.lastRoundUpdate;
        this.lastTurnUpdate = data.turn;
        this.lastRoundUpdate = data.round;
        return res;
    }

    #bindResizeHandle() {
        const handle = this.element.querySelector(".resize-handle");
        if (!handle) return;

        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            this.#resizePointerId = event.pointerId;
            this.#resizeStartX = event.clientX;
            this.#resizeStartCount = this.combatSettings.count;
            handle.setPointerCapture(event.pointerId);
            handle.classList.add("active");
        });

        handle.addEventListener("pointermove", (event) => {
            if (this.#resizePointerId !== event.pointerId) return;
            const itemWidth = this.combatSettings.size;
            const slotWidth = itemWidth + 3;
            const deltaSlots = Math.round((event.clientX - this.#resizeStartX) / slotWidth);
            const next = Math.clamp(
                this.#resizeStartCount + deltaSlots,
                this.constructor.COUNT_MIN,
                this.constructor.COUNT_MAX,
            );
            if (next === this.combatSettings.count) return;
            this.#previewCount(next);
        });

        const endResize = async (event) => {
            if (this.#resizePointerId !== event.pointerId) return;
            handle.releasePointerCapture(event.pointerId);
            handle.classList.remove("active");
            this.#resizePointerId = null;
            const count = Number(this.element.dataset.previewCount ?? this.combatSettings.count);
            delete this.element.dataset.previewCount;
            if (count !== this.combatSettings.count) {
                await AppSettings.set("combatTracker", { count });
            }
            this.render(true, { focus: false });
        };

        handle.addEventListener("pointerup", endResize);
        handle.addEventListener("pointercancel", endResize);
    }

    #previewCount(count) {
        this.element.dataset.previewCount = String(count);
        const itemWidth = this.combatSettings.size;
        const width = Math.max(250, this.constructor.#widthForCount(count, itemWidth));
        this.#suppressPositionPersist = true;
        try {
            this.setPosition({ width });
        } finally {
            this.#suppressPositionPersist = false;
        }
    }

    static #onCombatantControl(event, target) {
        ui.combat._onCombatantControl(event, target);
    }

    static #onCombatantMouseDown(ev, target) {
        ui.combat._onCombatantMouseDown(ev, target);
    }

    static #waitInit() {
        const combatant = game.combat.combatants.get(game.combat.current.combatantId);
        combatant.actor?.useAction("delay");
    }

    static #onConfigure() {
        CrucibleTongsSettingsConfig.open({ tab: "combat" });
    }

    _onClickAction(event, target) {
        ui.combat._onClickAction(event, target);
    }

    _onCombatantHoverOut(ev) {
        ui.combat._onCombatantHoverOut(ev);
    }

    _onCombatantHoverIn(ev) {
        ui.combat._onCombatantHoverIn(ev);
    }

    _onCombatantMouseDown(ev) {
        ui.combat._onCombatantMouseDown(ev, ev.target.closest("[data-combatant-id]"));
    }
}
