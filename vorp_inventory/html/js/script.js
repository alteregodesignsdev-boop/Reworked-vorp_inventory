$("document").ready(function () {

    $("#secondInventoryHud").draggable();
    $("#inventoryHud").draggable();

    // Toggle: initial state allows moving the HUD (items not draggable)
    window.inventoryMoveEnabled = true;

    function updateInventoryMoveToggleUI() {
        const btn = document.getElementById('moveToggleBtn');
        if (!btn) return;
        btn.classList.toggle('active', !!window.inventoryMoveEnabled);
        btn.setAttribute('aria-pressed', window.inventoryMoveEnabled ? 'true' : 'false');
        btn.title = window.inventoryMoveEnabled ? 'Mover inventario: activado' : 'Mover inventario: desactivado';
        const icon = btn.querySelector('.toggle-icon');
        if (icon) icon.textContent = window.inventoryMoveEnabled ? '⇲' : '⇅';
    }

    // Persistencia de posición del HUD por jugador
    function getPlayerKey(){
        try {
            if (window.currentPlayerId !== undefined && window.currentPlayerId !== null) {
                return String(window.currentPlayerId);
            }
        } catch(e) {}
        return 'default';
    }
    function saveHudPosition(){
        try {
            const $hud = $("#inventoryHud");
            const pos = $hud.position();
            const data = { left: Math.round(pos.left || parseInt($hud.css('left')) || 0), top: Math.round(pos.top || parseInt($hud.css('top')) || 0) };
            localStorage.setItem(`hudPos:${getPlayerKey()}` , JSON.stringify(data));
        } catch(e) { /* noop */ }
    }

    window.setInventoryMoveEnabled = function(enabled){
        window.inventoryMoveEnabled = !!enabled;
        // Limpiar modo MOVE al cambiar estado
        try { window.cancelMoveMode(); } catch(e) {}
        const mainHud = $("#inventoryHud");
        const secondHud = $("#secondInventoryHud");
        if (window.inventoryMoveEnabled) {
            // Asegurar inicialización y habilitar drag en ambos HUDs
            try { mainHud.draggable('enable'); } catch(e) { mainHud.draggable(); }
            try { secondHud.draggable('enable'); } catch(e) { secondHud.draggable(); }
            // Desactivar reordenamiento de ítems cuando el HUD se puede mover
            if (typeof deactivateMainInventoryReorder === 'function') {
                deactivateMainInventoryReorder();
            } else {
                try { $("#inventoryElement .item").draggable("destroy"); } catch(e) {}
                try { $("#inventoryElement .item").droppable("destroy"); } catch(e) {}
            }
        } else {
            // Deshabilitar movimiento del HUD principal y secundario
            try { mainHud.draggable('disable'); } catch(e) {}
            try { secondHud.draggable('disable'); } catch(e) {}
            // Activar reordenamiento cuando el HUD está fijo
            if (typeof activateMainInventoryReorder === 'function') {
                activateMainInventoryReorder();
            }
            // Guardar posición del HUD al desactivar movimiento
            saveHudPosition();
        }
        updateInventoryMoveToggleUI();
    };

    // Enlazar el botón toggle inmediatamente (DOM ya cargado)
    const btn = document.getElementById('moveToggleBtn');
    if (btn){
        btn.addEventListener('click', function(){
            window.setInventoryMoveEnabled(!window.inventoryMoveEnabled);
        });
        updateInventoryMoveToggleUI();
    }

    // Initialize according to default state
    window.setInventoryMoveEnabled(window.inventoryMoveEnabled);

    $("#inventoryHud").hide();
    $("#secondInventoryHud").hide();
    $('#character-selection').hide();
    $('#disabler').hide();

    $("body").on("keyup", function (key) {
        if (Config.closeKeys.includes(key.which)) {
            if ($('#character-selection').is(":visible")) {
                $('#character-selection').hide();
                $('#disabler').hide();
            } else {
                closeInventory();
                document.querySelectorAll('.dropdownButton[data-type="itemtype"], .dropdownButton1[data-type="itemtype"]').forEach(btn => btn.classList.remove('active'));
                document.querySelector(`.dropdownButton[data-param="all"][data-type="itemtype"], .dropdownButton1[data-param="all"][data-type="itemtype"]`)?.classList.add('active');
            }
        }
    });

    initSecondaryInventoryHandlers();
});


window.onload = initDivMouseOver;

let stopTooltip = false;
window.__pendingSecondToMainSlotAssignment = window.__pendingSecondToMainSlotAssignment || null;
window.__lastMainItemIds = window.__lastMainItemIds || null;

window.addEventListener('message', function (event) {

    if (event.data.action == "cacheImages") {
        const list = Array.isArray(event.data.info) ? event.data.info : [];
        // Precargar fallback directo en cache por si el preload aún no está listo
        try {
            if (Array.isArray(list)) {
                list.forEach(name => {
                    const key = (name || '').toString().trim();
                    if (key && !imageCache[key]) {
                        imageCache[key] = `url("img/items/${key}.png")`;
                    }
                });
            }
        } catch (e) { /* noop */ }
        if (typeof preloadImages === 'function') {
            preloadImages(list);
        } else {
            // Guardar la lista para consumirla cuando se defina preloadImages
            window.__pendingImageList = list;
        }
        // Actualizar HUD si está visible (tras cachear imágenes)
        try {
            if (window.quickslotHudVisible && typeof updateQuickslotHudFromMain === 'function') {
                updateQuickslotHudFromMain();
            }
        } catch (e) { /* noop */ }
    }

    // Sync UI cooldown with client when items are used via hotkeys or elsewhere
    if (event.data.action == "setCooldown") {
        const delay = event.data.delay ?? (window.Config?.SpamDelay ?? 5000);
        const now = Date.now();
        try { window.uiUseCooldownUntil = now + delay; } catch (e) { /* noop */ }
    }

    if (event.data.action == "initiate") {
        LANGUAGE = event.data.language
        LuaConfig = event.data.config
        Config.UseGoldItem = LuaConfig.UseGoldItem;
        Config.AddGoldItem = LuaConfig.AddGoldItem;
        Config.AddDollarItem = LuaConfig.AddDollarItem;
        Config.AddAmmoItem = LuaConfig.AddAmmoItem;
        Config.DoubleClickToUse = LuaConfig.DoubleClickToUse;
        Config.UseRolItem = LuaConfig.UseRolItem;
        Config.WeightMeasure = LuaConfig.WeightMeasure;
        // Fetch the Actions configuration from Lua
        loadActionsConfig().then(actionsConfig => {
            generateActionButtons(actionsConfig, 'carousel1', 'inventoryElement', 'dropdownButton');
            generateActionButtons(actionsConfig, 'staticCarousel', 'secondInventoryElement', 'dropdownButton1');
        }).catch(error => {
            console.error("Failed to load or process the Actions configuration:", error);
        });

        if (!Config.UseGoldItem) {
            $("#inventoryHud").addClass("NoGoldBackground")
        }
    }

    if (event.data.action == "reclabels") {
        ammolabels = event.data.labels
    }

    if (event.data.action == "updateammo") {
        if (event.data.ammo) {
            allplayerammo = event.data.ammo
        }
    }

    if (event.data.action == "updateStatusHud") {

        if (event.data.money || event.data.money === 0) {
            $("#money-value").text(event.data.money.toFixed(2) + " ");
        }

        if (Config.UseGoldItem) {
            if (event.data.gold || event.data.gold === 0) {
                $("#gold-value").text(event.data.gold.toFixed(2) + " ");
            }
        }
        if (Config.UseRolItem) {
            if (event.data.rol || event.data.rol === 0) {
                $("#rol-value").text(event.data.rol.toFixed(2) + " ");
            }
        }


        if (event.data.id) {
            $("#id-value").text("ID " + event.data.id);
            // Capturar el id del jugador para key de persistencia
            try { window.currentPlayerId = event.data.id; } catch(e) {}
        }

    } else if (event.data.action == "transaction") {
        let t = event.data.type
        if (t == 'started') {
            let displaytext = event.data.text
            $('#loading-text').html(displaytext)
            $('#transaction-loader').show()
        }
        if (t == 'completed') {
            $('#transaction-loader').hide()
        }
    }

    //main inv update weight
    if (event.data.action == "changecheck") {
        checkxy = event.data.check
        infoxy = event.data.info

        $('#check').html('')
        $("#check").append(`<button id='check'>${checkxy}/${infoxy + " " + Config.WeightMeasure}</button>`);
    }

    //main inv
    if (event.data.action == "display") {
        stopTooltip = false;
        moveInventory("main");
        if (event.data.type != 'main') {
            moveInventory("second");
        }
        $("#inventoryHud").fadeIn();
        $(".controls").remove();
        $("#inventoryHud").append(
            `<div class='controls'><div class='controls-center'><input type='text' id='search' placeholder='${LANGUAGE.inventorysearch}'/input><button id='check'>${checkxy}/${infoxy + " " + Config.WeightMeasure}</button></div><button id='close'>${LANGUAGE.inventoryclose}</button></div></div>`
        );

        $("#search").bind("input", function () {
            var searchFor = $("#search").val().toLowerCase();
            $("#inventoryElement .item").each(function () {
                var label = $(this).data("label");
                if (label) {
                    label = label.toLowerCase();
                    if (label.indexOf(searchFor) < 0) {
                        $(this).hide();
                    } else {
                        $(this).show();
                    }
                }
            });
        });

        type = event.data.type

        if (event.data.type == "player") {
            playerId = event.data.id;

            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }

        if (event.data.type == "custom") {
            customId = event.data.id;
            initiateSecondaryInventory(event.data.title, event.data.capacity, event.data.weight)
        }

        if (event.data.type == "horse") {
            horseid = event.data.horseid;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }

        if (event.data.type == "cart") {
            wagonid = event.data.wagonid;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }

        if (event.data.type == "house") {
            houseId = event.data.houseId;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "hideout") {
            hideoutId = event.data.hideoutId;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "bank") {
            bankId = event.data.bankId;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "clan") {
            clanid = event.data.clanid;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "store") {
            StoreId = event.data.StoreId;
            geninfo = event.data.geninfo;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "steal") {
            stealid = event.data.stealId;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }
        if (event.data.type == "Container") {
            Containerid = event.data.Containerid;
            initiateSecondaryInventory(event.data.title, event.data.capacity)
        }


        disabled = false;

        if (event.data.autofocus == true) {
            $(document).on('keydown', function (event) {
                if (!(event.target && event.target.id === 'secondarysearch')) {
                    $("#search").focus();
                }
            });
        }

        $("#close").on('click', function (event) {
            closeInventory();
        });

    } else if (event.data.action == "hide") {
        // Guardar la posición al cerrar el inventario
        try { saveHudPosition(); } catch(e) {}
        $('.tooltip').remove();
        $("#inventoryHud").fadeOut();
        $(".controls").fadeOut();
        $(".site-cm-box").remove();
        $("#secondInventoryHud").fadeOut();
        $(".controls").fadeOut();
        $(".site-cm-box").remove();
        if ($('#character-selection').is(":visible")) {
            $('#character-selection').hide();
            $('#disabler').hide();
        }
        dialog.close();
        stopTooltip = true;
    } else if (event.data.action == "setItems") {
        TIME_NOW = event.data.timenow

        const previousItems = Array.isArray(window.mainItems) ? window.mainItems : [];
        const previousIds = new Set();
        const previousIdentities = new Set();
        for (const it of previousItems) {
            const id = (it && it.id !== undefined && it.id !== null) ? String(it.id) : null;
            if (id && id !== '0') previousIds.add(id);
            try {
                if (typeof itemBaseKey === 'function' && typeof itemMetaHash === 'function') {
                    const k = itemBaseKey(it);
                    const m = itemMetaHash(it);
                    if (k && m) previousIdentities.add(`${String(k)}|${String(m)}`);
                }
            } catch (e) {}
        }

        try {
            // Guardar la lista real de ítems para el HUD y el layout para el orden
            if (Array.isArray(event.data.itemList)) {
                window.mainItems = event.data.itemList;
            }
            if (Array.isArray(event.data.layout)) {
                window.mainItemsLayout = event.data.layout;
            }
        } catch (e) { /* noop */ }

        try {
            const pending = window.__pendingSecondToMainSlotAssignment;
            const itemsNow = Array.isArray(event.data.itemList) ? event.data.itemList : [];
            if (pending && Number.isFinite(Number(pending.slotIndex)) && pending.from && pending.from.name) {
                const desiredName = String(pending.from.name);
                const desiredMeta = pending.from.meta ? String(pending.from.meta) : null;

                const metaOf = (it) => {
                    try { return (typeof itemMetaHash === 'function') ? itemMetaHash(it) : null; } catch (e) { return null; }
                };
                const baseKeyOf = (it) => {
                    try {
                        if (typeof itemBaseKey === 'function') return itemBaseKey(it);
                        if (it && it.id !== undefined && it.id !== null && it.id !== 0) return String(it.id);
                        if (it && it.name !== undefined && it.name !== null) return String(it.name);
                        return null;
                    } catch (e) { return null; }
                };
                const isNewOf = (it) => {
                    try {
                        const bk = baseKeyOf(it);
                        const mh = metaOf(it);
                        if (bk && mh && previousIdentities && previousIdentities.size) {
                            return !previousIdentities.has(`${String(bk)}|${String(mh)}`);
                        }
                        const itId = (it && it.id !== undefined && it.id !== null) ? String(it.id) : null;
                        if (itId && itId !== '0') return !previousIds.has(itId);
                        return true;
                    } catch (e) { return true; }
                };

                let candidate = null;
                for (const it of itemsNow) {
                    if (!it || it.name === undefined || it.name === null) continue;
                    if (String(it.name) !== desiredName) continue;
                    if (!isNewOf(it)) continue;
                    if (desiredMeta) {
                        const mh = metaOf(it);
                        if (!mh || String(mh) !== desiredMeta) continue;
                    }
                    candidate = it;
                    break;
                }

                if (!candidate) {
                    for (const it of itemsNow) {
                        if (!it || it.name === undefined || it.name === null) continue;
                        if (String(it.name) !== desiredName) continue;
                        if (!isNewOf(it)) continue;
                        candidate = it;
                        break;
                    }
                }

                if (!candidate && desiredMeta && typeof itemMetaHash === 'function') {
                    for (const it of itemsNow) {
                        if (!it || it.name === undefined || it.name === null) continue;
                        if (String(it.name) !== desiredName) continue;
                        const mh = metaOf(it);
                        if (mh && String(mh) === desiredMeta) {
                            candidate = it;
                            break;
                        }
                    }
                }

                if (candidate && typeof upsertMainSlotEntry === 'function') {
                    const cId = (candidate.id !== undefined && candidate.id !== null) ? String(candidate.id) : null;
                    const cMeta = (typeof itemMetaHash === 'function') ? itemMetaHash(candidate) : null;
                    if (Array.isArray(window.mainItemsLayout) && cId) {
                        for (let i = 0; i < window.mainItemsLayout.length; i++) {
                            const e = window.mainItemsLayout[i];
                            if (!e || typeof e !== 'object') continue;
                            const s = Number(e.slot);
                            if (!Number.isFinite(s) || s < 0) continue;
                            const eid = (e.itemId === undefined || e.itemId === null) ? null : String(e.itemId);
                            const em = (e.meta === undefined || e.meta === null) ? null : String(e.meta);
                            if (eid === cId && (!cMeta || !em || String(cMeta) === em)) {
                                window.mainItemsLayout[i] = { slot: s, itemId: null, meta: null };
                            }
                        }
                    }
                    window.mainItemsLayout = upsertMainSlotEntry(window.mainItemsLayout, Number(pending.slotIndex), candidate);
                    if (typeof postSaveInventoryLayout === 'function') {
                        postSaveInventoryLayout(window.mainItemsLayout);
                    }
                }
            }
        } catch (e) { /* noop */ }

        try { window.__pendingSecondToMainSlotAssignment = null; } catch (e) { /* noop */ }

        inventorySetup(event.data.itemList);

        // Actualizar HUD de quickslots inmediatamente tras cargar items
        try {
            if (typeof updateQuickslotHudFromMain === 'function') {
                updateQuickslotHudFromMain();
            }
            // Asegurar que el HUD quede visible si hay items cargados
            if (Array.isArray(event.data.itemList) && event.data.itemList.length && typeof setQuickslotHudVisible === 'function') {
                if (!window.quickslotHudVisible) {
                    setQuickslotHudVisible(true);
                }
            }
        } catch (e) { /* noop */ }

        if (type != "main") {

            $('.item').draggable({
                helper: 'clone',
                appendTo: 'body',
                zIndex: 99999,
                revert: 'invalid',
                start: function (event, ui) {

                    if (disabled) {
                        return false;
                    }
                    stopTooltip = true;
                    itemData = $(this).data("item");
                    itemInventory = $(this).data("inventory");
                    try {
                        if (itemInventory === "second" && typeof window.disableMainSlotDroppablesDuringSecondDrag === 'function') {
                            window.disableMainSlotDroppablesDuringSecondDrag();
                        }
                        if (itemInventory === "second" && isNonStackableSecondToMainSlotTarget(itemData)) {
                            if (typeof window.enableSecondToMainSlotTargeting === 'function') {
                                window.enableSecondToMainSlotTargeting(itemData);
                            }
                        }
                    } catch (e) { /* noop */ }

                },
                stop: function () {
                    stopTooltip = false;
                    itemData = $(this).data("item");
                    itemInventory = $(this).data("inventory");
                    try {
                        if (itemInventory === "second" && typeof window.disableSecondToMainSlotTargeting === 'function') {
                            window.disableSecondToMainSlotTargeting();
                        }
                        if (itemInventory === "second" && typeof window.restoreMainSlotDroppablesAfterSecondDrag === 'function') {
                            window.restoreMainSlotDroppablesAfterSecondDrag();
                        }
                    } catch (e) { /* noop */ }

                }
            });
        }
    } else if (event.data.action == "setSecondInventoryItems") {

        secondInventorySetup(event.data.itemList, event.data.info);

        let l = event.data.itemList.length
        let itemlist = event.data.itemList
        let total = 0
        let p = 0
        for (p; p < l; p++) {
            total += Number(itemlist[p].count)
        }
        let weight = null
        //amount of items in Inventory
        secondarySetCurrentCapacity(total, weight)
    } else if (event.data.action == "nearPlayers") {
        if (event.data.what == "give") {
            selectPlayerToGive(event.data);
        }
    }
});

function isNonStackableSecondToMainSlotTarget(item) {
    try {
        if (!item) return false;
        if (item.type === "item_weapon") return false;
        if (item.count !== undefined && item.count !== null && Number(item.count) !== 1) return false;
        const rawLim = item.limit;
        if (rawLim !== undefined && rawLim !== null && rawLim !== '') {
            const lim = Number(rawLim);
            if (Number.isFinite(lim) && lim === 1) return true;
        }

        if (typeof itemMetaHash !== 'function') return false;
        const desiredName = item.name !== undefined && item.name !== null ? String(item.name) : null;
        if (!desiredName) return false;
        const desiredMeta = itemMetaHash(item);
        if (!desiredMeta) return false;

        const itemsNow = Array.isArray(window.mainItems) ? window.mainItems : [];
        for (const it of itemsNow) {
            if (!it || it.name === undefined || it.name === null) continue;
            if (String(it.name) !== desiredName) continue;
            const mh = itemMetaHash(it);
            if (mh && String(mh) === String(desiredMeta)) {
                return false;
            }
        }
        return true;
    } catch (e) {
        return false;
    }
}

window.addEventListener("offline", function () {
    closeInventory()
});


