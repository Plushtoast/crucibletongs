export class HotBarHover {
    static bindEvents(bar, html) {
        const root = html ?? bar?.element;
        if (!root) return;

        const activemacros = root.querySelectorAll(".slot.full");
        activemacros.forEach((macro) => {
            HotBarHover.buildDataset(macro);
            macro.addEventListener("pointerover", (ev) => this.onHoverMacros(ev));
            macro.addEventListener("pointerout", (ev) => this.onUnhoverMacros(ev));
        });
    }

    static buildDataset(macro) {
        const slot = macro.dataset.slot;
        if (!slot) return;

        const macroId = game.user.hotbar[slot];
        const macroDoc = macroId ? game.macros.get(macroId) : null;
        if (!macroDoc) return;

        const isMacroAction = /game\.system\.api\.documents\.CrucibleActor\.macroAction\(actor,/.test(macroDoc.command);
        if (!isMacroAction) return;

        const skill = macroDoc.command.match(/"(.*?)"/)[1].replace(/\\\"/g, "");

        macro.dataset.crucibleTooltip = "action";
        macro.dataset.actionId = skill;
        macro.dataset.tooltipClass = "crucible crucible-tooltip";
    }

    static onHoverMacros(event) {
        const target = event.currentTarget;
        if (!target.dataset.crucibleTooltip) return;

        const actor = HotBarHover.getActiveActor();
        
        target.dataset.uuid = actor?.uuid;
    }

    static getActiveActor() {
        if(canvas.ready && canvas.tokens.controlled.length > 0) {
            return canvas.tokens.controlled[0].actor;
        }
        return game.user.character
    }

    static onUnhoverMacros(event) {
        const target = event.currentTarget;
        if (!target.dataset.crucibleTooltip) return;
        
    }
}