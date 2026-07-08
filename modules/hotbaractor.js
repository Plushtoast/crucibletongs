import { CrucibleTongsSettingsConfig } from "./settings-app.js";
import {
    defenseTooltip,
    getSkillFavorites,
    handleSkillContextAction,
    isSkillFavorite,
    prepareActionPips,
    prepareFocusPips,
    prepareHeroismPips,
    skillTooltip,
    toggleActionFavorite,
    toggleSkillFavorite,
} from "./utility.js";

export class HotBarActor extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static AVATAR_RADIUS = 100;
    static WEAPON_RADIUS = 40;

    #dropTarget;

    static DEFAULT_OPTIONS = {
        id: "actor-hud",
        actions: {
            action: this._onAction,
            configure: this._onConfigure,
        },
        window: {
            frame: false,
        },
        classes: ['crucibletongs-actor-hud'],
    };

    static PARTS = {
        hud: {
            template: 'modules/crucibletongs/templates/hud/hotbar-hud.hbs',
            templates: ['modules/crucibletongs/templates/hud/actor-hud.hbs', 'modules/crucibletongs/templates/hud/actor-actions-hud.hbs']
        }
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: 'favorites', label: 'crucibletongs.TABS.FAVORITES' },
                { id: 'actions', label: 'crucibletongs.TABS.ACTIONS' },
                { id: 'talents', label: 'ACTOR.TABS.skills' },
                { id: 'macro', label: 'crucibletongs.TABS.MACRO' },
            ],
            initial: 'actions',
        },
    };

    get token() {
        if (this.actor?.isToken) return this.actor.token;
        return this.actor?.getActiveTokens()[0];
    }

    static _onAction(event, target) {
        const { type, actionId } = target.dataset;
        switch (type) {
            case 'action':
                this.actor.useAction(actionId);
                break;
            case 'skill':
                this.actor.rollSkill(actionId, { dialog: true });
                break;
        }
    }

    static _onConfigure() {
        new CrucibleTongsSettingsConfig().render(true, { focus: true });
    }

    #setActor() {
        const controlled = canvas?.tokens?.controlled || [];
        const fallbackActor = game.user.character ?? (!game.user.isGM
            ? game.actors?.find((actor) => actor.isOwner && actor.type !== 'group') ?? null
            : null);
        this.actor = controlled.length < 2 ? (controlled[0]?.actor ?? fallbackActor) : null;

        if (this.actor?.type === 'group') {
            this.actor = fallbackActor;
        }

        if (this.actor && !this.actor?.isOwner) this.actor = null;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.#setActor();

        await this.prepareActorContext(context);
        context.inCombat = game.combat;
        const token = this.token;
        context.myTurn = context.inCombat && game.combat?.current?.combatantId === token?.combatant?.id;
        return context;
    }

    async prepareActorContext(context) {
        if (!this.actor) return context;

        context.actor = this.actor;
        context.actions = this.#prepareActions();
        context.talents = await this.#prepareSkills();
        context.favoriteActions = this.#prepareFavoriteEntries(context.actions, context.talents);
        context.hasFavoriteActions = game.settings.get("crucibletongs", "showFavoriteActionsTab") && Object.keys(context.favoriteActions).length > 0;
        if (!context.hasFavoriteActions && this.tabGroups?.sheet === "favorites") {
            this.tabGroups.sheet = "actions";
            context.tabs.favorites.cssClass = context.tabs.favorites.cssClass.replace("active", "").trim();
            context.tabs.actions.cssClass = [context.tabs.actions.cssClass, "active"].filterJoin(" ");
        }
        context.resources = this.#prepareResources();
        context.defenseTooltip = this.#prepareDefenseTooltip();
        context.weapons = this.#weaponPositions();
        context.effects = this.#prepareEffects();
        context.slots = ui.hotbar.slots;
    }

    #prepareDefenseTooltip() {
        return defenseTooltip({actor: this.actor, token: this.token});
    }

    #prepareActions() {
        const actions = this.actor.actions || {};
        const sortBy = this.actor.getFlag("crucibletongs", "hotbarSlots") || [];

        if (sortBy.length === 0) return actions;

        const seen = new Set();
        const sorted = {};
        for (const id of sortBy) {
            if (id in actions) {
                sorted[id] = actions[id];
                seen.add(id);
            }
        }
        for (const [id, action] of Object.entries(actions)) {
            if (seen.has(id)) continue;
            if (!(id in sorted)) {
                sorted[id] = action;
            }
        }
        return sorted;
    }

    #prepareFavoriteEntries(actions, talents) {
        const favorites = {};
        for (const [id, action] of Object.entries(actions)) {
            if (!((action.isFavorite || action.autoFavorite) && action._displayOnSheet())) continue;
            favorites[`action:${id}`] = {
                type: "action",
                id,
                img: action.img,
                name: action.name,
                isAction: true,
            };
        }

        const skillFavorites = getSkillFavorites(this.actor);
        for (const talent of talents) {
            if (!skillFavorites.has(talent.id)) continue;
            favorites[`skill:${talent.id}`] = {
                type: "skill",
                id: talent.id,
                img: talent.img,
                name: talent.name,
                tooltip: talent.tooltip,
                isAction: false,
            };
        }

        return Object.fromEntries(Object.entries(favorites).sort(([, a], [, b]) => a.name.localeCompare(b.name)));
    }

    #prepareEffects() {
        const effects = this.actor.temporaryEffects.map(eff => {
            return `<img class="flex0" src="${eff.img}" data-tooltip-class="crucible crucible-tooltip" data-crucible-tooltip="activeEffect" data-uuid="${eff.uuid}" width=20 height=20/>`
        });
        return effects.join("");
    }

    #weaponPositions() {
        const weaponPositions = [
            "left:calc(50% - 72px);top:75px;",
            "left:calc(50% + 32px);top:75px;",
            "left:calc(50% - 88px);top:40px;",
            "left:calc(50% + 48px);top:40px;",
            "left:calc(50% - 83px);top:5px;",
            "left:calc(50% + 43px);top:5px;",
        ];

        const positions = [];
        const actorWeapons = this.actor.equipment?.weapons;
        if (!actorWeapons) return positions;

        const isAnimal = (actorWeapons.natural?.length ?? 0) > 0;
        let positionIndex = 0;

        if (!isAnimal) {
            this.#addHumanoidWeapons(positions, actorWeapons, weaponPositions, positionIndex);
        } else {
            this.#addAnimalWeapons(positions, actorWeapons.natural, weaponPositions);
        }

        return positions;
    }

    #addHumanoidWeapons(positions, weapons, weaponPositions, startIndex) {
        let positionIndex = startIndex;
        const mainhand = weapons.mainhand;

        if (mainhand) {
            positions.push({
                weapon: mainhand,
                style: weaponPositions[positionIndex++]
            });
        }

        const secondWeapon = weapons.twoHanded ? mainhand : weapons.offhand;
        if (secondWeapon && positionIndex < weaponPositions.length) {
            positions.push({
                weapon: secondWeapon,
                style: weaponPositions[positionIndex]
            });
        }
    }

    #addAnimalWeapons(positions, naturalWeapons, weaponPositions) {
        let positionIndex = 0;

        for (const weapon of naturalWeapons) {
            if (positionIndex >= weaponPositions.length) break;

            positions.push({
                weapon,
                style: weaponPositions[positionIndex++]
            });
        }
    }

    async #prepareSkills() {
        const skills = Object.entries(this.actor.skills || {});

        return Promise.all(skills.map(async ([id]) => {
            const baseSkill = SYSTEM.SKILL.SKILLS[id];
            return {
                img: baseSkill.icon,
                id,
                name: _loc(baseSkill.label),
                tooltip: await skillTooltip(this.actor, id),
            };
        }));
    }

    _insertElement(element) {
        const existing = document.getElementById(element.id);
        if (existing)
            existing.replaceWith(element);
        else
            ui.hotbar.element.insertAdjacentElement("beforebegin", element);
    }

    #prepareResources() {
        const resources = {};
        const rs = this.actor.system.resources;

        // Pools
        for (const [id, resource] of Object.entries(rs)) {
            const r = foundry.utils.mergeObject(SYSTEM.RESOURCES[id], resource, { inplace: false });
            r.id = id;
            //r.pct = Math.round(r.value * 100 / r.max);
            //r.cssPct = `--resource-pct: ${100 - r.pct}%`;
            resources[r.id] = r;
        }

        resources.action = prepareActionPips(resources.action);
        resources.focus = prepareFocusPips(resources.focus);
        resources.heroism = prepareHeroismPips(resources.heroism);
        return resources;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const scale = game.settings.get("crucibletongs", "hotbarActorScale") ?? 1;
        const maxWidth = game.settings.get("crucibletongs", "hotbarActionBarMaxWidth") ?? 300;
        this.element.style.setProperty("--hotbarActorScale", scale);
        this.element.style.setProperty("--hotbarActionBarMaxWidth", `${maxWidth}px`);

        this.element.querySelector('.avatar')?.addEventListener('dblclick', () => {
            if (this.actor) this.actor.sheet.render(true);
        });

        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: "[data-type='action']",
            dropSelector: '.slot',
            callbacks: {
                dragstart: this.#onDragStart.bind(this),
                dragover: this.#onDragOver.bind(this),
                drop: this.#onDrop.bind(this)
            }
        }).bind(this.element);

        ui.hotbar.element.hidden = !!this.actor;
    }

    #onDragStart(event) {
        game.tooltip.deactivate();
        const target = event.currentTarget;
        const dragData = {
            id: target.dataset.actionId,
            type: target.dataset.type,
        };
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    #onDragOver(event) {
        const target = event.target.closest(".slot");
        if (target === this.#dropTarget) return;
        if (this.#dropTarget) this.#dropTarget.classList.remove("drop-target");
        this.#dropTarget = target;
        target.classList.add("drop-target");
    }

    #onDrop(event) {
        if (this.#dropTarget) {
            this.#dropTarget.classList.remove("drop-target");
            this.#dropTarget = undefined;
        }

        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
        if (!dragData || !("id" in dragData) || !("type" in dragData)) return;

        const target = event.target.closest(".slot")?.dataset.actionId;
        if (!target) return;

        const slots = this.element.querySelectorAll(".action-items .slot");

        const slotArray = Array.from(slots).map(s => s.dataset.actionId);
        const fromIndex = slotArray.indexOf(dragData.id);
        const toIndex = slotArray.indexOf(target);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        slotArray[fromIndex] = target;
        slotArray[toIndex] = dragData.id;

        this.actor.setFlag("crucibletongs", "hotbarSlots", slotArray);
    }

    static updateHotbar(actorId, force = false) {
        if (!game.settings.get("crucibletongs", "enableHotBarActor")) return;

        const instance = foundry.applications.instances.get(HotBarActor.DEFAULT_OPTIONS.id);

        if (!instance) {
            new HotBarActor().render(true, { focus: false });
        } else {
            if (actorId == instance.actor?.id || force) {
                instance.render(true, { focus: false });
            }
        }
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        new foundry.applications.ux.ContextMenu(this.element, '[data-action="weapon"]', [], {
            onOpen: this.#onWeaponContext.bind(this),
            jQuery: false,
            fixed: true,
            eventName: 'click'
        });

        new foundry.applications.ux.ContextMenu(this.element, '.actions-bar .slot[data-type="action"], .actions-bar .slot[data-type="skill"]', [], {
            onOpen: this.#onSlotContext.bind(this),
            jQuery: false,
            fixed: true,
        });
    }

    #onSlotContext(target) {
        const { type, actionId } = target.dataset;
        if (type === "action") ui.context.menuItems = this.#getActionContextOptions(actionId);
        else if (type === "skill") ui.context.menuItems = this.#getSkillContextOptions(actionId);
    }

    #getActionContextOptions(actionId) {
        const action = this.actor?.actions?.[actionId];
        if (!action) return [];

        const isFavorite = action.isFavorite;
        return [
            {
                label: _loc("crucibletongs.HOTBAR.ACTION.Use", { name: action.name }),
                icon: "fa-solid fa-hand-fist",
                onClick: () => this.actor.useAction(actionId),
            },
            {
                label: _loc(isFavorite ? "ACTION.ACTIONS.RemoveFavorite" : "ACTION.ACTIONS.AddFavorite"),
                icon: isFavorite ? "fa-solid fa-star" : "fa-regular fa-star",
                onClick: async () => {
                    await toggleActionFavorite(this.actor, actionId);
                    this.render(true, { focus: false });
                },
            },
        ];
    }

    #getSkillContextOptions(skillId) {
        const config = SYSTEM.SKILL.SKILLS[skillId];
        const skill = this.actor?.skills?.[skillId];
        if (!config || !skill) return [];

        const skillName = _loc(config.label);
        const isFavorite = isSkillFavorite(this.actor, skillId);
        const alternateRoll = game.user.isGM
            ? {
                label: _loc("DICE.REQUESTS.RequestRolls"),
                icon: "fa-solid fa-users",
                onClick: () => handleSkillContextAction(this.actor, skillId),
            }
            : {
                label: _loc("crucibletongs.HOTBAR.SKILL.BlindRoll"),
                icon: "fa-solid fa-eye-slash",
                onClick: () => handleSkillContextAction(this.actor, skillId),
            };

        return [
            {
                label: _loc("ACTOR.ACTIONS.RollCheck"),
                icon: "fa-solid fa-dice",
                onClick: () => this.actor.rollSkill(skillId, { dialog: true }),
            },
            alternateRoll,
            {
                label: _loc(isFavorite ? "ACTION.ACTIONS.RemoveFavorite" : "ACTION.ACTIONS.AddFavorite"),
                icon: isFavorite ? "fa-solid fa-star" : "fa-regular fa-star",
                onClick: async () => {
                    await toggleSkillFavorite(this.actor, skillId);
                    this.render(true, { focus: false });
                },
            },
        ];
    }

    #onWeaponContext(target) {
        const { id } = target.dataset;
        const weapon = this.actor.items.get(id);

        ui.context.menuItems = this.#getWeaponContextOptions(weapon);
    }

    #getWeaponContextOptions(weapon) {
        const naturalWeapons = weapon?.system?.properties?.has("natural");
        if (naturalWeapons) return [];

        if (!weapon) {
            const options = [];
            for (const item of this.actor.items) {
                if (item.type !== 'weapon') continue;
                if (item.system.equipped) continue;
                if (item.system.properties.has("natural")) continue;

                options.push({
                    name: _loc(`crucibletongs.HOTBAR.WEAPON.${item.system.dropped ? "Recover" : "Equip"}`, { item: item.name }),
                    icon: `<i class='fa-solid ${item.system.dropped ? 'fa-hand-back-fist' : 'fa-shield-plus'}'></i>`,
                    callback: () => this.actor.equipItem(item.id, { equipped: true }),
                });
            }
            return options;
        }

        return [
            {
                name: _loc("crucibletongs.HOTBAR.WEAPON.Drop", { item: weapon.name }),
                icon: "<i class='fa-solid fa-hand-point-down'></i>",
                condition: !weapon.system.dropped,
                callback: () => this.actor.equipItem(weapon.id, { equipped: false, dropped: true }),
            },
            {
                name: _loc("crucibletongs.HOTBAR.WEAPON.UnEquip", { item: weapon.name }),
                icon: "<i class='fa-solid fa-shield-minus'></i>",
                condition: !weapon.system.dropped,
                callback: () => this.actor.equipItem(weapon.id, { equipped: false, dropped: false }),
            },
        ];
    }
}