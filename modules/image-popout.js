import { ShowImageToPlayersDialog } from "./image-share-dialog.js";

const WRAPPER_CLASS = "crucibletongs-image-popout";
const POPOUT_FLAG = "crucibletongsSheetPopout";
const SHARE_BAR_CLASS = "crucibletongs-image-popout-share";

const PROFILE_SELECTORS = {
    actor: ".sheet-sidebar > img.profile[data-action='editImage']",
    item: ".sheet-header > img.profile[data-action='editImage']",
};

/**
 * Determine whether an application element is a Crucible actor or item sheet
 * that should receive the GM image popout control.
 * @param {HTMLElement} element
 * @returns {"actor"|"item"|null}
 */
function getCrucibleSheetType(element) {
    if (!element?.classList.contains("crucible")) return null;
    if (element.classList.contains("actor") && !element.classList.contains("actor-group")) return "actor";
    if (element.classList.contains("item") && !element.classList.contains("affix")) return "item";
    return null;
}

/**
 * Open a Foundry ImagePopout for a document portrait.
 * @param {foundry.abstract.Document} doc
 */
function showImagePopout(doc) {
    const { img, name, uuid } = doc;
    if (!img || img === CONST.DEFAULT_TOKEN) return;
    new foundry.applications.apps.ImagePopout({
        src: img,
        uuid,
        window: { title: name },
        [POPOUT_FLAG]: true,
        classes: ["image-popout", "crucibletongs-sheet-image-popout"],
    }).render({ force: true });
}

/**
 * Add a prominent share button below the image in sheet portrait popouts.
 * @param {foundry.applications.apps.ImagePopout} app
 * @param {HTMLElement} element
 */
function enhanceSheetImagePopout(app, element) {
    if (!app.options[POPOUT_FLAG] || !game.user.isGM) return;

    const figure = element.querySelector(".window-content figure") ?? element.querySelector("figure");
    if (!figure || figure.nextElementSibling?.classList.contains(SHARE_BAR_CLASS)) return;

    const label = game.i18n.localize("crucibletongs.IMAGE_POPOUT.ShareToPlayers");
    const shareBar = document.createElement("div");
    shareBar.className = SHARE_BAR_CLASS;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "share-to-players";
    button.innerHTML = `<i class="fa-solid fa-eye" inert></i><span>${label}</span>`;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ShowImageToPlayersDialog.show(app);
    });

    shareBar.appendChild(button);
    figure.insertAdjacentElement("afterend", shareBar);
}

/**
 * Wrap a sheet profile image with a GM-only hover button that opens an ImagePopout.
 * @param {HTMLImageElement} img
 * @param {foundry.abstract.Document} doc
 */
function unwrapProfileImage(wrapper) {
    const img = wrapper.querySelector("img.profile");
    if (!img) return;
    wrapper.parentNode.insertBefore(img, wrapper);
    wrapper.remove();
}

function wrapProfileImage(img, doc) {
    if (img.closest(`.${WRAPPER_CLASS}`)) return;

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    const controls = document.createElement("div");
    controls.className = "hoverbuttons";

    const label = game.i18n.localize("crucibletongs.IMAGE_POPOUT.Show");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-control icon fa-solid fa-image";
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        showImagePopout(doc);
    });

    controls.appendChild(button);
    wrapper.appendChild(controls);
}

function isImagePopoutEnabled() {
    return game.user.isGM && game.settings.get("crucibletongs", "enableImagePopout");
}

/**
 * Apply or remove image popout controls on all open Crucible actor and item sheets.
 */
export function refreshImagePopoutControls() {
    for (const app of foundry.applications.instances.values()) {
        const element = app.element;
        const sheetType = getCrucibleSheetType(element);
        if (!sheetType || !app.document) continue;

        element.querySelectorAll(`.${WRAPPER_CLASS}`).forEach(unwrapProfileImage);

        if (!isImagePopoutEnabled()) continue;

        const img = element.querySelector(PROFILE_SELECTORS[sheetType]);
        if (img) wrapProfileImage(img, app.document);
    }
}

/**
 * Register hooks that add GM-only image popout controls to Crucible actor and item sheets.
 */
export function initImagePopout() {
    Hooks.on("renderImagePopout", (app, element) => {
        enhanceSheetImagePopout(app, element);
    });

    Hooks.on("renderApplicationV2", (app, element) => {
        if (!isImagePopoutEnabled()) return;

        const sheetType = getCrucibleSheetType(element);
        if (!sheetType || !app.document) return;

        const img = element.querySelector(PROFILE_SELECTORS[sheetType]);
        if (!img) return;

        wrapProfileImage(img, app.document);
    });
}
