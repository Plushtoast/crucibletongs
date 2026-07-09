![Version](https://img.shields.io/github/v/tag/Plushtoast/crucibletongs?label=Version&style=flat-square&color=2577a1) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2FPlushtoast%2Fcrucibletongs%2Ffoundry14%2Fmodule.json&label=Foundry%20Core%20Compatible%20Version&query=$.compatibility.verified&style=flat-square&color=ff6400)

# Crucible Tongs

Crucible Tongs adds some minor functionality to the crucible system to enhance the experience for the current Ember Playtest.
Among these is a Action HUD on the Token to quickly select combat actions as well as some additional tooltips for the Macro bar, a macro bar replacement, a initiative tracker, and a draggable party portrait HUD for combat.
Be aware as Crucible is still under heavy development the functions might get oudated or replaced quickly.

# Features

* Action HUD on the Token HUD to speed up combat with quick select buttons for attacks. Will show talents instead outside of combat.

<img width="477" height="523" alt="grafik" src="https://github.com/Plushtoast/crucibletongs/blob/foundry14/demo/hud.png?raw=true" />

* Tooltips on Action Macros on the hotbar which show details on the action if a token or character is currently selected.

<img width="537" height="419" alt="grafik" src="https://github.com/Plushtoast/crucibletongs/blob/foundry14/demo/tooltip.png?raw=true" />


* Hotbar replacement which shows actor details and provides quick access to actions and talents. Actions can be sorted with drag and drop.

<img width="537" height="419" alt="grafik" src="https://github.com/Plushtoast/crucibletongs/blob/foundry14/demo/hotbar.png?raw=true" />

* Light-weight combat tracker popout adopted to crucible

<img alt="grafik" src="https://github.com/Plushtoast/crucibletongs/blob/foundry14/demo/combattracker.png?raw=true" />

* Party viewer: a frameless, draggable portrait strip shown during combat for members of the primary party who are also combatants in the active encounter. Portraits show health and morale overlays, optional wounds and madness columns in the same style as the hotbar, and effect icons. Click a portrait to activate that combatant in the tracker; double-click behaves like the combat tracker. Drag the grip to reposition (position is saved per client). Right-click the grip to switch between horizontal and vertical layout; scroll the mouse wheel on the grip to resize portraits. Configure via the cog button or in **Crucible Tongs** module settings under the **Party Viewer** tab.

* GM action confirmation toasts: when a Crucible action needs GM approval, a toast overlay appears in the lower third of the viewport showing the acting character, action name, and **Confirm** / **Dismiss** buttons. Up to five recent pending actions are shown as a stack (newest on top). **Dismiss** only hides the toast locally; the chat card stays unconfirmed.

* Sheet image popout (GM only): on Crucible actor and item sheets, hover the portrait to reveal a popout button. Clicking it opens the image in a lightbox with a prominent **Show to Players** bar at the bottom. That button opens a player selection dialog (all players or individual checkboxes).