import { handleSkillContextAction } from "./utility.js";

export class HotActions extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static maxActionsPerCircle = {
        action: [10, 14, 18, 22, 26],
        skill: [0, 12, 16, 20, 24],
    };

    static bindToHud(app, jhtml, data) {
        jhtml.querySelector('.col.left').insertAdjacentHTML('beforeend', this.actionsHud());
        const btn = jhtml.querySelector('.control-icon[data-action="actionHUD"]');
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            new HotActions(app).render(true);
            app.close({ animate: false });
        });
    }

    static actionsHud() {
        const icon = game.combat ? "fa-hand-fist" : "fa-hand-paper";
        return `<button type="button" class="control-icon" data-action="actionHUD" data-tooltip="crucibletongs.selectAction"><i class="fas ${icon}" width="36" height="36"></button>`;
    }

    constructor(app, target, options = {}) {
        super();
        this.document = app.object;
        const element = app.element.getBoundingClientRect();
        this.basePosition = {
            top: element.top + element.height / 2,
            left: element.left + element.width / 2
        }
    }

    static DEFAULT_OPTIONS = {
        id: "action-hud",
        actions: {
            action: this._onAction,
            quickClose: this._onQuickClose
        },
        window: {
            frame: false,
        },
        classes: ['crucibletongs-action-hud'],
    };

    static PARTS = {
        hud: {
            template: "modules/crucibletongs/templates/hud/action-hud.hbs"
        }
    };

    get actor() {
        return this.document?.actor;
    }

    _onPosition(position) {
        this.element.classList.toggle("large", this.document.height >= 2);
    }

    static closeAll() {
        const instance = foundry.applications.instances.get(HotActions.DEFAULT_OPTIONS.id);
        if (instance) {
            instance.close({ animate: false });
        }
    }

    static _onAction(event, target) {
        const { type, actionId } = target.dataset;
        switch (type) {
            case 'action':
                this.actor.useAction(actionId);
                break;
            case 'skill':
                this.actor.rollSkill(actionId, {dialog: true});
                break;
        }
        this.close({ animate: false });
    }

    static _onQuickClose(event, target) {
        this.close({ animate: false });
    }

    static RADIUS = 100;

    calculateXY(index, totalActions, context, maxActionsPerCircle) {
        let circleIndex = 0;
        let totalActionsInPreviousCircles = 0;

        while (circleIndex < maxActionsPerCircle.length) {
            const actionsInCurrentCircle = Math.min(
                maxActionsPerCircle[circleIndex],
                totalActions - totalActionsInPreviousCircles
            );

            if (index < totalActionsInPreviousCircles + actionsInCurrentCircle) {
                break;
            }

            totalActionsInPreviousCircles += actionsInCurrentCircle;
            circleIndex++;
        }

        const actionInCircle = index - totalActionsInPreviousCircles;
        const actionsInThisCircle = Math.min(
            maxActionsPerCircle[circleIndex],
            totalActions - totalActionsInPreviousCircles
        );
        const currentRadius = context.radius * (1 + circleIndex * 0.6);

        const angle = (actionInCircle / actionsInThisCircle) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * currentRadius + context.radius;
        const y = Math.sin(angle) * currentRadius + context.radius;
        return { x, y };
    }

    prepareActions(context) {
        const actions = Object.entries(this.actor.actions || {});
        const skipActions = new Set(['move', 'recover'])
        const totalActions = actions.length - skipActions.size;
        let realindex = 0;
        return actions.reduce((acc, [key, action]) => {
            if (skipActions.has(action.id)) return acc;
            
            const { x, y } = this.calculateXY(realindex, totalActions, context, HotActions.maxActionsPerCircle.action);
            acc.push({
                img: action.img,
                id: key,
                name: action.name,
                type: 'action',
                style: `left: ${x - 25}px; top: ${y - 25}px;`
            });
            realindex += 1;
            return acc;
        }, []);
    }

    prepareSkills(context) {
        const skills = Object.entries(this.actor.skills || {});

        return skills.map(([id, skill], index) => {
            const { x, y } = this.calculateXY(index, skills.length, context, HotActions.maxActionsPerCircle.skill);
            const baseSkill = SYSTEM.SKILL.SKILLS[id];
            return {
                img: baseSkill.icon,
                id,
                name: baseSkill.label,
                type: 'skill',
                style: `left: ${x - 25}px; top: ${y - 25}px;`
            };
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.radius = this.constructor.RADIUS;

        if (game.combat) {
            context.actions = this.prepareActions(context);
        } else {
            context.actions = this.prepareSkills(context);
        }

        context.actorUuid = this.actor?.uuid || '';
        context.scale = canvas.dimensions.uiScale;
        return context;
    }

    setPosition(position) {
        //const ratio = canvas.dimensions.size / 100;
        const revised = {
            /*width: 400,
            height: 400,*/
            top: this.basePosition.top - this.constructor.RADIUS,
            left: this.basePosition.left - this.constructor.RADIUS,
        }

        return super.setPosition(revised);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        for (const skill of this.element.querySelectorAll("[data-type='skill']")) {
            skill.addEventListener('contextmenu', this.#onSkillContext.bind(this));
        }

        this.element.addEventListener('click', (event) => {
            if (!event.target.closest('.data-action')) {
                this.close({ animate: false });
            }
        });

        setTimeout(() => {
            this.element.querySelectorAll('.collapsed').forEach((action) => {
                action.classList.remove('collapsed');
            });
        }, 20);
    }

    async #onSkillContext(event) {
        event.preventDefault();
        event.stopPropagation();
        const skillId = event.currentTarget.dataset.actionId;
        this.close({ animate: false });
        await handleSkillContextAction(this.actor, skillId);
    }

}