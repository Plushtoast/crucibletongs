const SKILL_TOOLTIP_TEMPLATE = "modules/crucibletongs/templates/tooltip/skill.hbs";

/**
 * Format the first active keybinding for a registered action.
 * @param {string} actionId
 * @param {string} [namespace="crucibletongs"]
 * @returns {string}
 */
export function getKeybindingDisplay(actionId, namespace = "crucibletongs") {
  if (!actionId || !game.keybindings?.actions?.has(`${namespace}.${actionId}`)) return "";

  try {
    const bindings = game.keybindings.get(namespace, actionId);
    const binding = bindings?.find((b) => b?.key);
    if (!binding) return "";
    return foundry.applications.sidebar.apps.ControlsConfig.humanizeBinding(binding);
  } catch {
    return "";
  }
}

/**
 * Build a localized tooltip label with an optional keybinding suffix.
 * @param {string} labelKey
 * @param {string} actionId
 * @param {string} [namespace="crucibletongs"]
 * @returns {string}
 */
export function tooltipWithKeybinding(labelKey, actionId, namespace = "crucibletongs") {
  const label = _loc(labelKey);
  const keyString = getKeybindingDisplay(actionId, namespace);
  return keyString ? `${label} (${keyString})` : label;
}

/**
 * Whether the current user may view an actor's defense stats on the initiative tracker.
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function canViewCombatantDefenseTooltip(combatant) {
  if (!combatant?.actor) return false;
  if (game.user.isGM) return true;
  if (combatant.players?.includes(game.user)) return true;
  return combatant.actor.isOwner;
}

export function defenseTooltip(combatant) {
  const actor = combatant?.actor;
  const token = combatant?.token;
  if (!actor || !canViewCombatantDefenseTooltip(combatant)) return "";

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

/**
 * Whether the current user may view a combatant's action points.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function canViewCombatantActions(actor) {
  return game.user.isGM || actor?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED);
}

/**
 * Prepare action point pip display data matching the actor hotbar.
 * @param {object} actionResource
 * @returns {object}
 */
export function prepareActionPips(actionResource) {
  const resource = foundry.utils.mergeObject(SYSTEM.RESOURCES.action, actionResource, { inplace: false });
  resource.pips = [];
  const maxAction = Math.min(resource.max, 6);
  for (let i = 1; i <= maxAction; i++) {
    const full = resource.value >= i;
    const double = (resource.value - 6) >= i;
    const cssClass = [full ? "full" : "", double ? "double" : ""].filterJoin(" ");
    resource.pips.push({ full, double, cssClass });
  }
  return resource;
}

/**
 * Prepare focus pip display data matching the actor hotbar.
 * @param {object} focusResource
 * @returns {object}
 */
export function prepareFocusPips(focusResource) {
  const resource = foundry.utils.mergeObject(SYSTEM.RESOURCES.focus, focusResource, { inplace: false });
  resource.pips = [];
  const maxFocus = Math.min(resource.max, 12);
  for (let i = 1; i <= maxFocus; i++) {
    const full = resource.value >= i;
    const double = (resource.value - 12) >= i;
    const cssClass = [full ? "full" : "", double ? "double" : ""].filterJoin(" ");
    resource.pips.push({ full, double, cssClass });
  }
  return resource;
}

/**
 * Prepare heroism pip display data matching the actor hotbar.
 * @param {object} heroismResource
 * @returns {object}
 */
export function prepareHeroismPips(heroismResource) {
  const resource = foundry.utils.mergeObject(SYSTEM.RESOURCES.heroism, heroismResource, { inplace: false });
  resource.pips = [];
  for (let i = 1; i <= 3; i++) {
    const full = resource.value >= i;
    const cssClass = full ? "full" : "";
    resource.pips.push({ full, double: false, cssClass });
  }
  return resource;
}

/**
 * Prepare combat resource pip display data for the active combatant.
 * @param {Actor} actor
 * @returns {object}
 */
export function prepareActiveCombatantResources(actor) {
  const resources = actor.system.resources;
  return {
    action: prepareActionPips(resources.action),
    focus: prepareFocusPips(resources.focus),
    heroism: prepareHeroismPips(resources.heroism),
  };
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

/**
 * @param {CrucibleActor} actor
 * @returns {Set<string>}
 */
export function getSkillFavorites(actor) {
  return new Set(actor?.getFlag("crucibletongs", "skillFavorites") ?? []);
}

/**
 * @param {CrucibleActor} actor
 * @param {string} skillId
 * @returns {boolean}
 */
export function isSkillFavorite(actor, skillId) {
  return getSkillFavorites(actor).has(skillId);
}

/**
 * @param {CrucibleActor} actor
 * @param {string} skillId
 * @returns {Promise<void>}
 */
export async function toggleSkillFavorite(actor, skillId) {
  if (!actor?.skills?.[skillId]) return;

  const favorites = getSkillFavorites(actor);
  if (favorites.has(skillId)) favorites.delete(skillId);
  else favorites.add(skillId);
  await actor.setFlag("crucibletongs", "skillFavorites", [...favorites]);
}

/**
 * @param {CrucibleActor} actor
 * @param {string} actionId
 * @returns {Promise<void>}
 */
export async function toggleActionFavorite(actor, actionId) {
  const action = actor?.actions?.[actionId];
  if (!action) return;

  const priorFavorites = actor.system.favorites;
  const favorites = new Set();
  for (const entry of Object.values(actor.actions)) {
    if (priorFavorites.has(entry.id)) favorites.add(entry.id);
  }

  if (favorites.has(action.id)) favorites.delete(action.id);
  else favorites.add(action.id);
  await actor.update({ "system.favorites": favorites });
}