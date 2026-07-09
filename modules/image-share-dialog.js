const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * Dialog for choosing which players receive a shared sheet portrait image.
 */
export class ShowImageToPlayersDialog extends HandlebarsApplicationMixin(DialogV2) {
    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["show-to-players", "crucibletongs-share-image-dialog"],
        modal: true,
        buttons: [{
            label: "JOURNAL.ActionShow",
            type: "submit",
            icon: "fa-solid fa-check",
        }],
        window: {
            contentTag: "form",
            contentClasses: ["standard-form"],
        },
        position: {
            width: 500,
        },
        form: {
            handler: ShowImageToPlayersDialog.#onFormSubmit,
            closeOnSubmit: true,
        },
    };

    /** @override */
    static PARTS = {
        body: {
            classes: ["standard-form"],
            template: "modules/crucibletongs/templates/image-popout/share-dialog.hbs",
        },
        footer: {
            template: "templates/generic/form-footer.hbs",
        },
    };

    /** @override */
    get title() {
        const name = this.options.imageTitle ?? "";
        return game.i18n.format("crucibletongs.IMAGE_POPOUT.ShareDialogTitle", { name });
    }

    /**
     * Open the player selection dialog for an ImagePopout instance.
     * @param {foundry.applications.apps.ImagePopout} imagePopout
     */
    static show(imagePopout) {
        if (game.users.size < 2) {
            ui.notifications.warn("JOURNAL.ShowNoPlayers", { localize: true });
            return;
        }

        new ShowImageToPlayersDialog({
            imagePopout,
            imageTitle: imagePopout.options.window.title,
        }).render({ force: true });
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        Object.assign(context, {
            buttons: this.options.buttons,
            users: game.users.filter((user) => !user.isSelf),
        });
        return context;
    }

    /** @override */
    _onChangeForm(_formConfig, event) {
        if (event.target.name !== "allPlayers") return;
        const checked = event.target.checked;
        this.form.querySelectorAll('[name="players"]').forEach((input) => {
            Object.assign(input, { checked, disabled: checked });
        });
    }

    /**
     * @this {ShowImageToPlayersDialog}
     * @param {SubmitEvent} _event
     * @param {HTMLFormElement} _form
     * @param {FormDataExtended} formData
     */
    static async #onFormSubmit(_event, _form, formData) {
        let { allPlayers, players } = formData.object;
        let users = game.users.filter((user) => !user.isSelf).map((user) => user.id);

        if (!allPlayers) {
            if (!players) return;
            if (!Array.isArray(players)) players = [players];
            users = players.reduce((ids, id) => {
                const user = game.users.get(id);
                if (user && !user.isSelf) ids.push(id);
                return ids;
            }, []);
        }

        if (!users.length) return;

        const popout = this.options.imagePopout;
        game.journal.constructor.showImage(popout.options.src, {
            users,
            title: popout.options.window.title,
            uuid: popout.options.uuid,
            showTitle: popout.options.showTitle,
            caption: popout.options.caption,
        });
    }
}
