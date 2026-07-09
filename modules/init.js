import { HotBarHover } from "./hotbar.js";
import { HotActions } from "./hotactions.js";
import "./settings.js";
import { HotBarActor } from "./hotbaractor.js";
import { CrucibleCombatTracker } from "./initiativetracker.js";
import { actionConfirmQueue, ActionConfirmQueue } from "./action-confirm-toast.js";
import { CruciblePartyViewer, syncPartyViewer } from "./party-viewer.js";
import initKeybindings from "./keybindings.js";
import { tooltipWithKeybinding } from "./utility.js";
import { initImagePopout } from "./image-popout.js";

Hooks.on("renderHotbar", (bar, html) => {
    HotBarHover.bindEvents(bar, html);
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on("updateUser", (user, changes) => {
    if (user.id !== game.user.id || !("hotbar" in changes)) return;
    HotBarActor.updateHotbar(undefined, true);
});

Hooks.on('renderTokenHUD', (app, jhtml, data) => {
    HotActions.bindToHud(app, jhtml, data);
});

Hooks.on("canvasPan", () => {
    HotActions.closeAll();
});

Hooks.once('ready', () => {
    foundry.applications.handlebars.loadTemplates([
        "modules/crucibletongs/templates/tooltip/activeeffect.hbs",
        "modules/crucibletongs/templates/tooltip/skill.hbs",
        "modules/crucibletongs/templates/image-popout/share-dialog.hbs",
    ]);
    actionConfirmQueue.bootstrap();
});


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
    syncPartyViewer();
});

Hooks.on('updateCombat', (combat, changed, options, userId) => {
    HotBarActor.updateHotbar(undefined, true);
    syncPartyViewer();
});

Hooks.on('updateActor', (actor, updates) => {
    if (!game.settings.get('crucibletongs', 'enableCombatFlow') || !game.settings.get('crucibletongs', 'showIniTrackerActionPips')) return;
    if (!game.combat?.started) return;
    const combatTracker = game.modules.get("crucibletongs").api.combatTracker;
    if (!combatTracker.combatData) return;
    if (game.combat.combatant?.actor?.id !== actor.id) return;
    if (!foundry.utils.hasProperty(updates, 'system.resources')) return;
    combatTracker.render(true, { focus: false });
});

Hooks.on('createCombat', (combat, options, userId) => {
    HotBarActor.updateHotbar(undefined, true);
    syncPartyViewer();
});

Hooks.on('canvasInit', () => {
    HotBarActor.updateHotbar(undefined, true);
});

/* ################# */


Hooks.on('renderCombatTracker', (app, html, data, what) => {
    if (game.settings.get('crucibletongs', 'enableCombatFlow')) {
        const combatTracker = game.modules.get("crucibletongs").api.combatTracker;
        if (game.combat) {
            combatTracker.updateTracker(data);
        } else {
            combatTracker.close();
        }
    }

    syncPartyViewer();
});

function shouldSyncPartyViewerActor(actor) {
    return crucible.party?.system?.actors?.has(actor);
}

Hooks.on('updateActor', (actor, updates) => {
    if (!game.combat || !shouldSyncPartyViewerActor(actor)) return;
    syncPartyViewer();
});

Hooks.on('updateActiveEffect', (effect) => {
    if (effect.parent && shouldSyncPartyViewerActor(effect.parent)) syncPartyViewer();
});

Hooks.on('createActiveEffect', (effect) => {
    if (effect.parent && shouldSyncPartyViewerActor(effect.parent)) syncPartyViewer();
});

Hooks.on('deleteActiveEffect', (effect) => {
    if (effect.parent && shouldSyncPartyViewerActor(effect.parent)) syncPartyViewer();
});

Hooks.once('init', () => {
    game.modules.get("crucibletongs").api = {
        combatTracker: new CrucibleCombatTracker(),
        partyViewer: new CruciblePartyViewer(),
        actionConfirmQueue,
    };

    Handlebars.registerHelper({
        tooltipWithKeybinding: (labelKey, actionId) => tooltipWithKeybinding(labelKey, actionId),
    });
});

Hooks.on("createChatMessage", (doc) => {
    actionConfirmQueue.enqueue(doc);
});

Hooks.on("updateChatMessage", (doc, changes) => {
    if (!foundry.utils.hasProperty(changes, "flags.crucible.confirmed")) return;
    if (ActionConfirmQueue.isPendingAction(doc)) actionConfirmQueue.enqueue(doc);
    else actionConfirmQueue.dequeue(doc.id);
});

Hooks.on("deleteChatMessage", (doc) => {
    actionConfirmQueue.dequeue(doc.id);
});

Hooks.once('setup', () => {
    initKeybindings();
    initImagePopout();
});