const { mergeObject } = foundry.utils;
const MAX_ITEMS = 5;

/**
 * Resolve the TokenDocument for a pending action chat message.
 * Movement confirmations require a token; the stored UUID may be missing or stale.
 * @param {ChatMessage} message
 * @returns {TokenDocument|null}
 */
function resolveActionMessageToken(message) {
    const flags = message.flags?.crucible ?? {};
    if (flags.token) {
        const token = fromUuidSync(flags.token);
        if (token) return token;
    }

    const speaker = message.speaker;
    if (speaker?.scene && speaker?.token) {
        const token = game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
        if (token) return token;
    }

    const actor = fromUuidSync(flags.actor) ?? ChatMessage.getSpeakerActor(speaker);
    return actor?.getActiveTokens?.(true, true)?.[0] ?? null;
}

/**
 * Clone a chat message with a resolved token for Crucible action confirmation.
 * @param {ChatMessage} message
 * @returns {ChatMessage}
 */
function prepareActionConfirmMessage(message) {
    const flags = message.flags?.crucible;
    if (!flags?.action) return message;

    if (flags.token && fromUuidSync(flags.token)) return message;

    const needsToken = flags.action.tags?.includes("movement") || !!flags.movement;
    if (!needsToken) return message;

    const token = resolveActionMessageToken(message);
    if (!token) return message;

    const prepared = message.clone();
    prepared.updateSource({ "flags.crucible.token": token.uuid });
    return prepared;
}

async function confirmActionMessage(message) {
    const prepared = prepareActionConfirmMessage(message);
    await crucible.api.models.CrucibleAction.confirmMessage(prepared);
}

export class ActionConfirmQueue {
    #queue = [];
    #dismissed = new Set();
    #toast = null;

    setToast(toast) {
        this.#toast = toast;
    }

    get items() {
        return [...this.#queue];
    }

    static isEnabled() {
        return game.user.isGM && game.settings.get("crucibletongs", "enableActionConfirmToast");
    }

    static isPendingAction(message) {
        const flags = message.flags?.crucible;
        return flags?.action && !flags?.confirmed;
    }

    static itemFromMessage(message) {
        const flags = message.flags.crucible;
        const actor = fromUuidSync(flags.actor);
        return {
            messageId: message.id,
            actorName: actor?.name ?? message.speaker?.alias ?? "?",
            actorImg: actor?.img ?? message.speaker?.token ?? "icons/svg/mystery-man.svg",
            actionName: flags.action.name,
        };
    }

    enqueue(message) {
        if (!ActionConfirmQueue.isEnabled()) return;
        if (!ActionConfirmQueue.isPendingAction(message)) return;
        if (this.#dismissed.has(message.id)) return;

        this.#queue = this.#queue.filter((item) => item.messageId !== message.id);
        this.#queue.unshift(ActionConfirmQueue.itemFromMessage(message));
        this.#queue = this.#queue.slice(0, MAX_ITEMS);
        this.#syncView();
    }

    dequeue(messageId) {
        const before = this.#queue.length;
        this.#queue = this.#queue.filter((item) => item.messageId !== messageId);
        if (this.#queue.length !== before) this.#syncView();
    }

    dismiss(messageId) {
        this.#dismissed.add(messageId);
        this.dequeue(messageId);
    }

    bootstrap() {
        if (!ActionConfirmQueue.isEnabled()) {
            this.clear();
            return;
        }

        this.#queue = game.messages.contents
            .filter((message) => ActionConfirmQueue.isPendingAction(message) && !this.#dismissed.has(message.id))
            .slice(-MAX_ITEMS)
            .reverse()
            .map((message) => ActionConfirmQueue.itemFromMessage(message));
        this.#syncView();
    }

    clear() {
        this.#queue = [];
        this.#syncView();
    }

    #syncView() {
        if (!this.#toast) return;
        if (this.#queue.length) {
            this.#toast.render(true, { focus: false });
        } else if (this.#toast.rendered) {
            this.#toast.close({ animate: false });
        }
    }
}

export class ActionConfirmToast extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "action-confirm-toast",
        window: {
            frame: false,
        },
        position: {
            width: "auto",
        },
        classes: ["crucible-tongs-action-confirm-toast", "crucible"],
        actions: {
            confirm: ActionConfirmToast.#onConfirm,
            dismiss: ActionConfirmToast.#onDismiss,
        },
    };

    static PARTS = {
        main: {
            template: "modules/crucibletongs/templates/confirm/action-confirm-toast.hbs",
        },
    };

    #draggable;

    constructor(queue) {
        super();
        this.queue = queue;
        queue.setToast(this);
    }

    async _prepareContext(options) {
        mergeObject(options, { position: game.settings.get("crucibletongs", "actionConfirmToastPosition") });
        return { items: this.queue.items };
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        const container = this.element.querySelector(".dragHandler");
        if (container) {
            this.#draggable = new foundry.applications.ux.Draggable(this, this.element, container, false);
        }
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const saved = game.settings.get("crucibletongs", "actionConfirmToastPosition");
        if (saved?.left == null || saved?.top == null) {
            this.#applyDefaultPosition();
        }
    }

    #applyDefaultPosition() {
        const width = this.element.offsetWidth;
        const height = this.element.offsetHeight;
        super.setPosition({
            left: Math.max(0, (window.innerWidth - width) / 2),
            top: Math.max(0, window.innerHeight * 0.75 - height / 2),
        });
    }

    setPosition(position) {
        const currentPosition = super.setPosition(position);
        game.settings.set("crucibletongs", "actionConfirmToastPosition", {
            left: currentPosition.left,
            top: currentPosition.top,
        });
        return currentPosition;
    }

    static async #onConfirm(event, target) {
        const row = target.closest("[data-message-id]");
        const messageId = row?.dataset.messageId;
        const message = game.messages.get(messageId);
        if (!message) return;

        const button = target.closest("button") ?? target;
        const icon = button.querySelector("i");
        button.disabled = true;
        if (icon) icon.className = "fa-solid fa-spinner fa-spin";

        await confirmActionMessage(message);

        const updated = game.messages.get(messageId);
        if (!updated?.flags?.crucible?.confirmed) {
            button.disabled = false;
            if (icon) icon.className = "fa-solid fa-hexagon-check";
        }
    }

    static #onDismiss(event, target) {
        const row = target.closest("[data-message-id]");
        const messageId = row?.dataset.messageId;
        if (messageId) this.queue.dismiss(messageId);
    }
}

export const actionConfirmQueue = new ActionConfirmQueue();
export const actionConfirmToast = new ActionConfirmToast(actionConfirmQueue);
