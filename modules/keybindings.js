export default function () {
  game.keybindings.register('crucibletongs', 'combatTrackerNext', {
    name: 'COMBAT.TurnNext',
    hint: 'COMBAT.TurnNext',
    editable: [{ key: 'KeyN' }],
    onDown: () => combatTurn('nextTurn'),
  });
  game.keybindings.register('crucibletongs', 'combatTrackerPrevious', {
    name: 'COMBAT.TurnPrev',
    hint: 'COMBAT.TurnPrev',
    editable: [{ key: 'KeyV' }],
    onDown: () => combatTurn('previousTurn'),
  });
}

const combatTurn = (mode) => {
  game.combat?.combatant?.isOwner && game.combat[mode]();
};