export class CopyDynamicToken {
    static async copy() {
        const ownedActors = game.actors
            .filter(actor => actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (ownedActors.length < 2) {
            ui.notifications.warn("You need ownership of at least two actors.");
            return;
        }

        const sourceActors = ownedActors.filter(actor => actor.prototypeToken.flags.ember?.dynamicToken);
        if (!sourceActors.length) {
            ui.notifications.warn("None of your owned actors have an Ember Dynamic Token configured.");
            return;
        }

        const actorOptions = actors => actors
            .map(actor => `<option value="${actor.id}">${actor.name}</option>`)
            .join("");

        const content = `
  <fieldset>
    <div class="form-group">
      <label>Source Actor</label>
      <div class="form-fields">
        <select name="sourceId">${actorOptions(sourceActors)}</select>
      </div>
      <p class="hint">The actor whose Ember Dynamic Token settings will be copied.</p>
    </div>

    <div class="form-group">
      <label>Target Actor</label>
      <div class="form-fields">
        <select name="targetId">${actorOptions(ownedActors)}</select>
      </div>
      <p class="hint">The actor that will receive the copied token settings.</p>
    </div>
  </fieldset>
`;

        const response = await foundry.applications.api.DialogV2.input({
            window: {
                icon: "fa-solid fa-user-pen",
                title: "Copy Ember Dynamic Token"
            },
            content,
            ok: {
                label: "Copy Token Settings",
                icon: "fa-solid fa-copy"
            }
        });

        if (!response) return;

        const source = game.actors.get(response.sourceId);
        const target = game.actors.get(response.targetId);

        if (!source || !target) {
            ui.notifications.error("The selected actor could not be found.");
            return;
        }

        if (source.id === target.id) {
            ui.notifications.warn("Choose two different actors.");
            return;
        }

        if (!target.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
            ui.notifications.error(`You do not have owner permission for ${target.name}.`);
            return;
        }

        const dynamicToken = foundry.utils.deepClone(source.prototypeToken.flags.ember?.dynamicToken);
        if (!dynamicToken) {
            ui.notifications.warn(`${source.name} does not have an Ember Dynamic Token configured.`);
            return;
        }

        await target.update({
            "prototypeToken.flags.ember.dynamicToken": dynamicToken,
            "prototypeToken.texture.src": source.prototypeToken.texture.src
        });

        ui.notifications.info(`Copied Ember Dynamic Token settings from ${source.name} to ${target.name}.`);
    }
}
