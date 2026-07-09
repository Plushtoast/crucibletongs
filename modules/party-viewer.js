import { preparePartyViewerMembers } from "./utility.js";
import { CrucibleTongsSettingsConfig } from "./settings-app.js";

const { mergeObject } = foundry.utils;

export async function syncPartyViewer() {
  const viewer = game.modules.get("crucibletongs")?.api?.partyViewer;
  if (!viewer) return;

  if (!game.settings.get("crucibletongs", "enablePartyViewer")) {
    viewer.close();
    return;
  }

  if (!game.combat) {
    viewer.close();
    return;
  }

  const members = await preparePartyViewerMembers();
  if (!members.length) {
    viewer.close();
    return;
  }

  await viewer.render(true, { focus: false });
}

export class CruciblePartyViewer extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    position: {
      width: 320,
      height: 88,
      left: 20,
      top: 100,
    },
    window: {
      title: "crucibletongs.partyViewer.title",
      resizable: true,
      frame: false,
    },
    actions: {
      activateCombatant: this.#onCombatantMouseDown,
      toggleLayout: this.#toggleLayout,
      configure: this.#onConfigure,
    },
    classes: ["crucible", "crucible-party-viewer"],
  };

  static PARTS = {
    main: {
      template: "modules/crucibletongs/templates/party-viewer/party-viewer.hbs",
    },
  };

  #draggable;
  #highlighted;

  static PORTRAIT_SIZE_MIN = 48;
  static PORTRAIT_SIZE_MAX = 120;
  static PORTRAIT_SIZE_STEP = 4;

  setPosition(position) {
    const currentPosition = super.setPosition(position);
    game.settings.set("crucibletongs", "partyViewerPosition", {
      left: currentPosition.left,
      top: currentPosition.top,
    });
    return currentPosition;
  }

  async _prepareContext(options) {
    mergeObject(options, { position: game.settings.get("crucibletongs", "partyViewerPosition") });
    options.position ??= {};

    const portraitSize = game.settings.get("crucibletongs", "partyViewerSize");
    const layout = game.settings.get("crucibletongs", "partyViewerLayout");
    const vertical = layout === 0;
    const members = await preparePartyViewerMembers();
    const count = Math.max(members.length, 1);
    const controlsWidth = 36;
    const gap = 4;

    if (vertical) {
      options.position.width = portraitSize + controlsWidth + 8;
      options.position.height = portraitSize * count + gap * (count - 1) + 8;
    } else {
      options.position.width = portraitSize * count + gap * (count - 1) + controlsWidth + 8;
      options.position.height = portraitSize + 8;
    }

    const savedPosition = game.settings.get("crucibletongs", "partyViewerPosition");
    const hasSavedPosition = savedPosition?.left != null && savedPosition?.top != null;
    if (!hasSavedPosition && !this.rendered) {
      options.position.left = 20;
      options.position.top = Math.max(20, window.innerHeight - options.position.height - 80);
    }

    return {
      members,
      portraitSize,
      layout,
      vertical,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const container = this.element.querySelector(".dragHandler");
    if (container) {
      this.#draggable = new foundry.applications.ux.Draggable(this, this.element, container, this.options.resizable);
      container.onwheel = (ev) => this.#onWheelResize(ev);
      container.oncontextmenu = (ev) => this.#onDragContextMenu(ev);
    }

    this.#clearHover();

    const portraits = this.element.querySelectorAll(".party-member");
    portraits.forEach((portrait) => {
      portrait.addEventListener("pointerover", this.#onCombatantHoverIn.bind(this));
      portrait.addEventListener("pointerout", this.#onCombatantHoverOut.bind(this));
      portrait.addEventListener("dblclick", this.#onPortraitDblClick.bind(this));
    });
  }

  _onClose(options) {
    super._onClose(options);
    this.#clearHover();
    this.#draggable = null;
  }

  #clearHover() {
    this.#highlighted?._onHoverOut({});
    this.#highlighted = null;
  }

  #onCombatantHoverIn(event) {
    if (!canvas.ready) return;
    const { combatantId } = event.currentTarget?.dataset ?? {};
    if (!combatantId) return;
    const combatant = game.combat?.combatants.get(combatantId);
    const token = combatant?.token?.object;
    if (token && token._canHover(game.user, event) && ui.combat._isTokenVisible(token)) {
      token._onHoverIn(event, { hoverOutOthers: true });
      this.#highlighted = token;
    }
  }

  #onCombatantHoverOut(event) {
    this.#highlighted?._onHoverOut(event);
    this.#highlighted = null;
  }

  async #onWheelResize(ev) {
    ev.stopPropagation();
    ev.preventDefault();

    const { PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX, PORTRAIT_SIZE_STEP } = this.constructor;
    const current = game.settings.get("crucibletongs", "partyViewerSize");
    const delta = ev.deltaY > 0 ? -PORTRAIT_SIZE_STEP : PORTRAIT_SIZE_STEP;
    const next = Math.clamp(current + delta, PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX);
    if (next === current) return;

    await game.settings.set("crucibletongs", "partyViewerSize", next);
  }

  #onDragContextMenu(ev) {
    ev.preventDefault();
    this.constructor.#toggleLayout.call(this);
  }

  static async #toggleLayout() {
    let layout = game.settings.get("crucibletongs", "partyViewerLayout") + 1;
    if (layout > 1) layout = 0;
    await game.settings.set("crucibletongs", "partyViewerLayout", layout);
  }

  static #onConfigure() {
    CrucibleTongsSettingsConfig.open({ tab: "partyViewer" });
  }

  static #onCombatantMouseDown(ev, target) {
    ui.combat._onCombatantMouseDown(ev, target);
  }

  #onPortraitDblClick(ev) {
    const target = ev.currentTarget;
    if (target?.dataset?.combatantId) ui.combat._onCombatantMouseDown(ev, target);
  }
}
