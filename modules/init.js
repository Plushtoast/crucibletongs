import { HotBarHover } from "./hotbar.js";
import { HotActions } from "./hotactions.js";
import "./settings.js";
import { HotBarActor } from "./hotbaractor.js";
import { CrucibleCombatTracker } from "./initiativetracker.js";

Hooks.on("renderHotbar", (bar, html) => {
    HotBarHover.bindEvents(bar, html);
});
;

Hooks.on('renderTokenHUD', (app, jhtml, data) => {
    HotActions.bindToHud(app, jhtml, data);
});

Hooks.on("canvasPan", () => {
    HotActions.closeAll();
});

Hooks.once("ready", () => {
    foundry.applications.handlebars.loadTemplates([
        "modules/crucibletongs/templates/tooltip/activeeffect.hbs"
    ]);
})


/* hotbar hooks */
Hooks.on('controlToken', (elem, controlTaken) => {
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on('updateToken', (scene, token, updates) => {
    HotBarActor.updateHotbar(token.actor?.id);
});

Hooks.on('updateActor', (actor, updates) => {
    HotBarActor.updateHotbar(actor.id);
});

Hooks.on('updateOwnedItem', (source, item) => {
    HotBarActor.updateHotbar(source.data.id);
});

Hooks.on('createOwnedItem', (source, item) => {
    HotBarActor.updateHotbar(source.data.id);
});

Hooks.on('deleteOwnedItem', (source, item) => {
    HotBarActor.updateHotbar(source.data.id);
});

Hooks.on('updateItem', (source, item) => {
    const id = source.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('createItem', (source, item) => {
    const id = source.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('deleteItem', (source, item) => {
    const id = source.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('deleteActiveEffect', (effect, options) => {
    const id = effect.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('updateActiveEffect', (effect, options) => {
    const id = effect.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('createActiveEffect', (effect, options) => {
    const id = effect.parent?.id;
    if (id) HotBarActor.updateHotbar(id);
});

Hooks.on('deleteCombat', () => {
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on('updateCombat', (combat, changed, options, userId) => {
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on('createCombat', (combat, options, userId) => {
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on('canvasInit', () => {
    HotBarActor.updateHotbar(undefined, true);
});

/* ################# */


Hooks.on('renderCombatTracker', (app, html, data, what) => {
    if (!game.settings.get('crucibletongs', 'enableCombatFlow')) return;

    const combatTracker = game.modules.get("crucibletongs").api.combatTracker;
    if (game.combat) {
        combatTracker.updateTracker(data);
    } else {
        combatTracker.close();
    }
});

Hooks.once('init', () => {
    game.modules.get("crucibletongs").api = {
        combatTracker: new CrucibleCombatTracker()
    }
});