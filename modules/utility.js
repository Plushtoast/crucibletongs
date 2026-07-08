const SKILL_TOOLTIP_TEMPLATE = "modules/crucibletongs/templates/tooltip/skill.hbs";

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

/**
 * Prepare display data for a skill tooltip matching the actor sheet skills tab.
 * @param {CrucibleActor} actor
 * @param {string} skillId
 * @returns {object|null}
 */
export function prepareSkillTooltipData(actor, skillId) {
  const config = SYSTEM.SKILL.SKILLS[skillId];
  const skill = actor.skills[skillId];
  if (!config || !skill) return null;

  const a1 = SYSTEM.ABILITIES[config.abilities[0]];
  const a2 = SYSTEM.ABILITIES[config.abilities[1]];
  const rank = SYSTEM.TALENT.TRAINING_RANK_VALUES[skill.rank];

  return {
    icon: config.icon,
    label: _loc(config.label),
    abilityAbbrs: [a1.abbreviation, a2.abbreviation],
    scoreFormatted: formatSignedNumber(skill.score),
    pips: Array.fromRange(4).map(i => i < skill.rank ? "full" : ""),
    rankTags: [_loc(rank.label)],
    tooltips: {
      value: _loc("SKILL.TooltipCheck", { a1: a1.label, a2: a2.label }),
    },
  };
}

/**
 * Render a skill tooltip for the actor hotbar.
 * @param {CrucibleActor} actor
 * @param {string} skillId
 * @returns {Promise<string>}
 */
export async function skillTooltip(actor, skillId) {
  const data = prepareSkillTooltipData(actor, skillId);
  if (!data) return "";
  return foundry.applications.handlebars.renderTemplate(SKILL_TOOLTIP_TEMPLATE, data);
}

function formatSignedNumber(value) {
  return value >= 0 ? `+${value}` : `${value}`;
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