export function defenseTooltip(combatant) {
  const actor = combatant?.actor;
  const token = combatant?.token;
  if (!actor) return "";

  const title = token?.name ?? actor.name ?? "";
  const lines = [`<h4>${title}</h4>`].concat(
    ["physical", "fortitude", "willpower", "reflex"].map((type) => {
      const value = actor.defenses[type];
      const name = _loc(`DEFENSES.${type.capitalize()}`);
      return `${name}: ${value.total}`;
    })
  );
  const stride = _loc("ACTOR.FIELDS.movement.stride.label");
  const engage = _loc("ACTOR.FIELDS.movement.engagement.labelShort");
  lines.push(`${stride}: ${actor.system.movement.stride}`);
  lines.push(`${engage}: ${actor.system.movement.engagement}`);

  return lines.join("<br>");
}

export async function handleSkillContextAction(actor, skillId) {
  if (!actor || !skillId) return null;

  if (game.user.isGM) {
    const requestedActors = Array.from(crucible.party?.system?.actors ?? []);
    if (!requestedActors.length) {
      ui.notifications.warn(_loc("WARNING.NoParty"));
      return null;
    }

    const checkData = { type: skillId };
    const check = new crucible.api.dice.StandardCheck(checkData);
    return check.dialog({ request: true, requestedActors });
  }

  return actor.rollSkill(skillId, { dialog: true, messageMode: "blind" });
}