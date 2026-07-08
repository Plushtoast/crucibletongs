Hooks.once('init', () => {
    const settings = {
        enableHotBarActor: {
            name: 'crucibletongs.SETTINGS.enableHotBarActor',
            hint: 'crucibletongs.SETTINGS.enableHotBarActorHint',
            scope: 'client',
            config: true,
            default: true,
            type: Boolean,
        },
        showFavoriteActionsTab: {
            name: 'crucibletongs.SETTINGS.showFavoriteActions',
            hint: 'crucibletongs.SETTINGS.showFavoriteActionsTabHint',
            scope: 'client',
            config: true,
            default: true,
            type: Boolean,
            onChange: async () => {
                const instance = foundry.applications.instances.get("actor-hud");
                if (instance) instance.render(true, { focus: false });
            },
        },
        enableCombatFlow: {
            name: 'crucibletongs.SETTINGS.enableCombatFlow',
            hint: 'crucibletongs.SETTINGS.enableCombatFlowHint',
            scope: 'client',
            config: true,
            default: true,
            type: Boolean,
        },
        iniTrackerPosition: {
            name: 'iniTrackerPosition',
            scope: 'client',
            config: false,
            default: {},
            type: Object,
        },
        enableCombatPan: {
            name: 'crucibletongs.SETTINGS.enableCombatPan',
            hint: 'crucibletongs.SETTINGS.enableCombatPanHint',
            scope: 'client',
            config: true,
            default: true,
            type: Boolean,
        },
        showIniTrackerActionPips: {
            name: 'crucibletongs.SETTINGS.showIniTrackerActionPips',
            hint: 'crucibletongs.SETTINGS.showIniTrackerActionPipsHint',
            scope: 'client',
            config: true,
            default: true,
            type: Boolean,
            onChange: async () => {
                if (game.combat) game.modules.get("crucibletongs").api.combatTracker.render(true, { focus: false });
            },
        },
        iniTrackerSize: {
            name: 'crucibletongs.SETTINGS.iniTrackerSize',
            hint: 'crucibletongs.SETTINGS.iniTrackerSizeHint',
            scope: 'client',
            config: true,
            default: 70,
            type: Number,
            range: {
                min: 30,
                max: 140,
                step: 5,
            },
        },
        iniTrackerCount: {
            name: 'crucibletongs.SETTINGS.iniTrackerCount',
            hint: 'crucibletongs.SETTINGS.iniTrackerCountHint',
            scope: 'client',
            config: true,
            default: 5,
            type: Number,
            range: {
                min: 3,
                max: 25,
                step: 1,
            },
            onChange: async (val) => {
                if(game.combat) game.modules.get("crucibletongs").api.combatTracker.render({ force: true });
            },
        },
        hotbarActorScale: {
            name: 'crucibletongs.SETTINGS.hotbarActorScale',
            hint: 'crucibletongs.SETTINGS.hotbarActorScaleHint',
            scope: 'client',
            config: true,
            default: 1,
            type: Number,
            range: {
                min: 0.5,
                max: 2,
                step: 0.05,
            },
            onChange: async () => {
                const instance = foundry.applications.instances.get("actor-hud");
                if (instance) instance.render(true, { focus: false });
            },
        },
        hotbarActionBarMaxWidth: {
            name: 'crucibletongs.SETTINGS.hotbarActionBarMaxWidth',
            hint: 'crucibletongs.SETTINGS.hotbarActionBarMaxWidthHint',
            scope: 'client',
            config: true,
            default: 300,
            type: Number,
            range: {
                min: 120,
                max: 1000,
                step: 10,
            },
            onChange: async () => {
                const instance = foundry.applications.instances.get("actor-hud");
                if (instance) instance.render(true, { focus: false });
            },
        },
        hotbarActionBarRows: {
            name: 'crucibletongs.SETTINGS.hotbarActionBarRows',
            hint: 'crucibletongs.SETTINGS.hotbarActionBarRowsHint',
            scope: 'client',
            config: true,
            default: 3,
            type: Number,
            range: {
                min: 1,
                max: 6,
                step: 1,
            },
            onChange: async () => {
                const instance = foundry.applications.instances.get("actor-hud");
                if (instance) instance.render(true, { focus: false });
            },
        },
    };
    for (const [key, value] of Object.entries(settings)) {
        game.settings.register('crucibletongs', key, value);
    }
});
