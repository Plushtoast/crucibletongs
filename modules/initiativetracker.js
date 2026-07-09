import { canViewCombatantActions, canViewCombatantDefenseTooltip, defenseTooltip, prepareActiveCombatantResources } from "./utility.js";

const { mergeObject, duplicate } = foundry.utils;

export class CrucibleCombatTracker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        position: {
            width: 440,
            top: 100,
            left: 170,
        },
        window: {
            title: 'crucibletongs.combatTracker',
            resizable: true,
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
        },
        classes: ['crucible-tongs-combat-tracker', 'crucible'],
    };

    static PARTS = {
        main: {
            template: 'modules/crucibletongs/templates/combattracker/initracker.hbs',
        },
    };

    get scene() {
        return ui.combat.scene;
    }

    get viewed() {
        return ui.combat.viewed;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const container = this.element.querySelector('.dragHandler');
        new foundry.applications.ux.Draggable(this, this.element, container, this.options.resizable);

        const turns = this.element.querySelectorAll('.iniItem');
        turns.forEach(turn => {
            turn.addEventListener('pointerover', this._onCombatantHoverIn.bind(this));
            turn.addEventListener('pointerout', this._onCombatantHoverOut.bind(this));
            turn.addEventListener('dblclick', this._onCombatantMouseDown.bind(this));
        });
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        this._createContextMenu(this._getCrucibleIniTrackerEntryContextOptions, ".iniTrackerList .combatant", { fixed: true });

        if (!game.user.isGM) return;

        this._createContextMenu(ui.combat._getCombatContextOptions, ".encounter-context-menu", {
            eventName: "click",
            fixed: true,
            parentClassHooks: false
        });
    }

    _getCrucibleIniTrackerEntryContextOptions() {
        game.tooltip.deactivate();
        return ui.combat._getEntryContextOptions();
    }

    async _prepareContext(options) {
        const data = this.combatData;
        mergeObject(options, { position: game.settings.get('crucibletongs', 'iniTrackerPosition') });

        const itemWidth = game.settings.get('crucibletongs', 'iniTrackerSize');
        const actorCount = game.settings.get('crucibletongs', 'iniTrackerCount');

        const combatStarted = data.combat.round;
        const turnsToUse = data.turns;

        const skipDefeated = game.settings.get('core', Combat.CONFIG_SETTING).skipDefeated;

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

        const remainingTurns = turnsToUse.slice(startIndex + 1).filter(t => {
            const combatant = data.combat.combatants.get(t.id);
            return !(skipDefeated && combatant.defeated) && (game.user.isGM || !combatant.hidden);
        });
        data.isLastTurn = combatStarted && remainingTurns.length === 0;
        data.showEndOfRoundBox = showEndOfRoundBox;
        data.currentRound = data.combat.round;
        data.nextRound = data.combat.round + 1;

        data.showActiveCombatantActions = false;
        if (game.settings.get('crucibletongs', 'showIniTrackerActionPips') && combatStarted) {
            const activeTurn = data.turns?.find((turn) => turn.active) ?? data.turns?.[0];
            if (activeTurn) {
                const activeCombatant = data.combat.combatants.get(activeTurn.id);
                if (activeCombatant?.actor && canViewCombatantActions(activeCombatant.actor)) {
                    data.showActiveCombatantActions = true;
                    data.activeCombatantResources = prepareActiveCombatantResources(activeCombatant.actor);
                }
            }
        }

        const calculatedWidth = itemWidth * actorCount + actorCount * 3 + 70;
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

        Object.assign(data, {
            itemWidth,
            unRolled,
        });

        this.conditionalPanToCurrentCombatant(data);

        return data;
    }

    #prepareDefenseTooltip(combatant) {
        return defenseTooltip(combatant);
    }

    async conditionalPanToCurrentCombatant(data) {
        if (!game.settings.get('crucibletongs', 'enableCombatPan')) return;

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
        game.settings.set('crucibletongs', 'iniTrackerPosition', {
            left: currentPosition.left,
            top: currentPosition.top,
        });
        return currentPosition;
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

    static #onCombatantControl(event, target) {
        ui.combat._onCombatantControl(event, target);
    }

    static #onCombatantMouseDown(ev, target) {
        ui.combat._onCombatantMouseDown(ev, target);
    }

    static #waitInit() {
        const combatant = game.combat.combatants.get(game.combat.current.combatantId);
        combatant.actor?.useAction('delay');
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