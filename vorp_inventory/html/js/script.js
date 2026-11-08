$("document").ready(function () {

    // Inventario secundario ya NO es draggable - siempre fijo
    // $("#secondInventoryHud").draggable();
    // HUD principal ya NO es draggable - siempre fijo
    // $("#inventoryHud").draggable();

    // Toggle: HUD siempre fijo, items siempre movibles
    window.inventoryMoveEnabled = false; // Siempre en modo "items movibles"

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
    function getPlayerKey() {
        try {
            if (window.currentPlayerId !== undefined && window.currentPlayerId !== null) {
                return String(window.currentPlayerId);
            }
        } catch (e) { }
        return 'default';
    }
    function saveHudPosition() {
        try {
            const $hud = $("#inventoryHud");
            const pos = $hud.position();
            const data = { left: Math.round(pos.left || parseInt($hud.css('left')) || 0), top: Math.round(pos.top || parseInt($hud.css('top')) || 0) };
            localStorage.setItem(`hudPos:${getPlayerKey()}`, JSON.stringify(data));
        } catch (e) { /* noop */ }
    }

    window.setInventoryMoveEnabled = function (enabled) {
        // Forzar siempre a false (items movibles, HUD fijo)
        window.inventoryMoveEnabled = false;

        // Limpiar modo MOVE al cambiar estado
        try { window.cancelMoveMode(); } catch (e) { }

        const mainHud = $("#inventoryHud");
        const secondHud = $("#secondInventoryHud");

        // HUD principal siempre deshabilitado (fijo)
        try { mainHud.draggable('disable'); } catch (e) { }

        // HUD secundario también siempre deshabilitado (fijo)
        try { secondHud.draggable('disable'); } catch (e) { }

        // Siempre activar reordenamiento de items
        if (typeof activateMainInventoryReorder === 'function') {
            activateMainInventoryReorder();
        }

        updateInventoryMoveToggleUI();
    };

    // Enlazar el botón toggle inmediatamente (DOM ya cargado)
    const btn = document.getElementById('moveToggleBtn');
    if (btn) {
        btn.addEventListener('click', function () {
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
            if ($('#player-target-overlay').is(":visible")) {
                if (typeof cancel3DPlayerTargeting === 'function') {
                    cancel3DPlayerTargeting();
                }
            } else if ($('#character-selection').is(":visible")) {
                $('#character-selection').hide();
                $('#disabler').hide();
            } else if (window.isInlineQtyActive) {
                window.cancelInlineQty();
            } else {
                closeInventory();
                document.querySelectorAll('.dropdownButton[data-type="itemtype"], .dropdownButton1[data-type="itemtype"]').forEach(btn => btn.classList.remove('active'));
                document.querySelector(`.dropdownButton[data-param="all"][data-type="itemtype"], .dropdownButton1[data-param="all"][data-type="itemtype"]`)?.classList.add('active');
            }
        }
    });

    $(document).on('contextmenu', '#player-target-overlay', function(e) {
        e.preventDefault();
        if (typeof cancel3DPlayerTargeting === 'function') {
            cancel3DPlayerTargeting();
        }
    });

    // Observar cambios en capacidad secundaria del DOM para sincronizar automáticamente el menú de información
    try {
        const targetCap = document.getElementById("capacity-value");
        const targetCur = document.getElementById("current-cap-value");
        const observer = new MutationObserver(function () {
            if (typeof window.updateWeightDisplay === 'function') {
                window.updateWeightDisplay();
            }
        });
        if (targetCap) observer.observe(targetCap, { childList: true, characterData: true, subtree: true });
        if (targetCur) observer.observe(targetCur, { childList: true, characterData: true, subtree: true });
    } catch (e) { }

    initSecondaryInventoryHandlers();
});


window.onload = initDivMouseOver;

let stopTooltip = false;
window.__pendingSecondToMainSlotAssignment = window.__pendingSecondToMainSlotAssignment || null;
window.__lastMainItemIds = window.__lastMainItemIds || null;

window.mainWeightCurrent = window.mainWeightCurrent || "0";
window.mainWeightMax = window.mainWeightMax || "0";
window.secondCurrentCap = window.secondCurrentCap || null;
window.secondCapacityValue = window.secondCapacityValue || null;
window.isSecondaryOpen = false;

window.updateWeightDisplay = function updateWeightDisplay() {
    const $check = $('#check');
    if (!$check.length) return;

    const measure = (typeof Config !== 'undefined' && Config && Config.WeightMeasure) ? Config.WeightMeasure : "KG";
    const mainCurrent = (window.mainWeightCurrent !== undefined && window.mainWeightCurrent !== null) ? window.mainWeightCurrent : (typeof checkxy !== 'undefined' ? checkxy : "0");
    const mainMax = (window.mainWeightMax !== undefined && window.mainWeightMax !== null) ? window.mainWeightMax : (typeof infoxy !== 'undefined' ? infoxy : "0");
    const mainText = `${mainCurrent}/${mainMax} ${measure}`;

    // Detectar si el inventario secundario está abierto
    const isSecOpen = window.isSecondaryOpen === true || $('#secondInventoryHud').is(':visible');

    // Obtener capacidad secundaria con múltiples fallbacks seguros
    let secCap = window.secondCapacityValue;
    if (!secCap || secCap === "0" || secCap === 0) {
        const domCap = (document.getElementById("capacity-value")?.textContent || $('#capacity-value').text() || '').trim();
        if (domCap && domCap !== "0") {
            secCap = domCap;
            window.secondCapacityValue = domCap;
        }
    }

    // Obtener cantidad actual del secundario
    let secCurrent = window.secondCurrentCap;
    if (secCurrent === null || secCurrent === undefined) {
        const domCur = (document.getElementById("current-cap-value")?.textContent || $('#current-cap-value').text() || '').trim();
        if (domCur !== '') {
            secCurrent = domCur;
            window.secondCurrentCap = domCur;
        } else {
            secCurrent = 0;
        }
    }

    const showSecondary = isSecOpen && (secCap !== null && secCap !== undefined && secCap !== "0" && secCap !== 0 && secCap !== "");

    if (showSecondary) {
        const secText = `${secCurrent}/${secCap}`;
        $check.removeClass('single-weight').addClass('dual-weight');
        $check.html(`
            <div class="weight-row main-weight-row">
                <span class="weight-text">${mainText}</span>
            </div>
            <div class="weight-row second-weight-row">
                <span class="weight-text">${secText}</span>
            </div>
        `);
    } else {
        $check.removeClass('dual-weight').addClass('single-weight');
        $check.html(`
            <div class="weight-row main-weight-row">
                <span class="weight-text">${mainText}</span>
            </div>
        `);
    }
};
var updateWeightDisplay = window.updateWeightDisplay;

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
        Config.MaxInventorySlots = LuaConfig.MaxInventorySlots || 16; // Default 16 if not set
        // Fetch the Actions configuration from Lua
        loadActionsConfig().then(actionsConfig => {
            generateActionButtons(actionsConfig, 'carousel1', 'inventoryElement', 'dropdownButton');
            generateActionButtons(actionsConfig, 'staticCarousel', 'secondInventoryElement', 'dropdownButton1');
            document.querySelector(`.dropdownButton[data-param="all"][data-type="itemtype"]`)?.classList.add('active');
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
            try { window.currentPlayerId = event.data.id; } catch (e) { }
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
        checkxy = event.data.check;
        infoxy = event.data.info;
        window.mainWeightCurrent = checkxy;
        window.mainWeightMax = infoxy;
        window.updateWeightDisplay();
    }

    //main inv
    if (event.data.action == "display") {
        stopTooltip = false;
        moveInventory("main");
        if (event.data.type != 'main') {
            moveInventory("second");
            window.isSecondaryOpen = true;
        } else {
            window.isSecondaryOpen = false;
            window.secondCapacityValue = null;
            window.secondCurrentCap = null;
        }
        $("#inventoryHud").fadeIn();

        // Mostrar quickslot HUD cuando se abre el inventario principal
        if (typeof setQuickslotHudVisible === 'function') {
            setQuickslotHudVisible(true);
        }

        window.mainWeightCurrent = checkxy;
        window.mainWeightMax = infoxy;

        $(".controls").remove();
        $("#inventoryHud").append(
            `<div class='controls'><div class='controls-center'><input type='text' id='search' placeholder='${LANGUAGE.inventorysearch}'/><div id='check' class='single-weight'></div></div><button id='close'>${LANGUAGE.inventoryclose}</button></div></div>`
        );
        window.updateWeightDisplay();
        setTimeout(window.updateWeightDisplay, 50);
        setTimeout(window.updateWeightDisplay, 200);

        // Reset category to 'all' when opening inventory
        window.currentActiveCategory = 'all';
        document.querySelectorAll('.dropdownButton[data-type="itemtype"]').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.dropdownButton[data-param="all"][data-type="itemtype"]`)?.classList.add('active');

        $("#search").off("input").on("input", function () {
            const searchFor = ($(this).val() || "").trim().toLowerCase();
            const activeCat = window.currentActiveCategory || 'all';
            const catTypes = (window.Actions && window.Actions[activeCat]) ? window.Actions[activeCat].types : [];

            $("#inventoryElement .item").each(function () {
                const $it = $(this);
                const rawGroup = $it.data("group") !== undefined ? $it.data("group") : $it.attr("data-group");
                const group = Number(rawGroup);
                const itemId = ($it.attr('id') || '').toString();
                const isGunbelt = (itemId === 'item-gunbelt');
                const isAmmoItem = isGunbelt || itemId.toLowerCase().startsWith('item-ammo') || group === 6;

                let matchCat = false;
                if (!catTypes || catTypes.length === 0) {
                    matchCat = true;
                } else if (catTypes.some(t => Number(t) === 6) && isAmmoItem) {
                    matchCat = true;
                } else if (isGunbelt && catTypes.some(t => Number(t) === 1)) {
                    matchCat = true;
                } else if (catTypes.some(t => Number(t) === group)) {
                    matchCat = true;
                }

                if (!matchCat) {
                    $it.hide();
                    return;
                }

                if (!searchFor) {
                    $it.show();
                    return;
                }

                const label = ($it.data("label") || $it.attr("data-label") || "").toString().toLowerCase();
                if (label.indexOf(searchFor) >= 0) {
                    $it.show();
                } else {
                    $it.hide();
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

        if (event.data.type != 'main') {
            window.isSecondaryOpen = true;
            if (event.data.capacity) {
                window.secondCapacityValue = (event.data.weight ? event.data.weight + " " + (Config.WeightMeasure || "KG") : event.data.capacity);
            }
            window.updateWeightDisplay();
            setTimeout(window.updateWeightDisplay, 50);
            setTimeout(window.updateWeightDisplay, 200);
        }

        disabled = false;

        // Desactivado autofocus automático del buscador para permitir uso de teclas rápidas
        // El buscador solo se activará si el jugador hace clic directamente en el input
        $(document).on('keydown', '#search, #secondarysearch', function (e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                $(this).blur();
            }
        });

        $("#close").on('click', function (event) {
            closeInventory();
        });

    } else if (event.data.action == "hide") {
        // Guardar la posición al cerrar el inventario
        try { saveHudPosition(); } catch (e) { }
        $('.tooltip').remove();
        if (typeof window.clearItemPanel === 'function') {
            window.clearItemPanel();
        } else {
            $("#item-actions-panel").empty();
            $("#inventoryElement .item").removeClass('panel-item-active');
            window.currentPanelItem = null;
            try { OverSetTitle(" "); OverSetDesc(" "); } catch (e) { }
        }
        $("#inventoryHud").fadeOut();

        // Ocultar quickslot HUD cuando se cierra el inventario principal
        if (typeof setQuickslotHudVisible === 'function') {
            setQuickslotHudVisible(false);
        }

        $(".controls").fadeOut();
        $(".site-cm-box").remove();
        $("#secondInventoryHud").fadeOut();
        window.isSecondaryOpen = false;
        window.secondCapacityValue = null;
        window.secondCurrentCap = null;
        if (typeof updateWeightDisplay === 'function') {
            updateWeightDisplay();
        }
        $(".controls").fadeOut();
        $(".site-cm-box").remove();
        if ($('#character-selection').is(":visible")) {
            $('#character-selection').hide();
            $('#disabler').hide();
        }
        dialog.close();
        stopTooltip = true;
    } else if (event.data.action == "setItems") {
        TIME_NOW = event.data.timenow || Math.floor(Date.now() / 1000);
        window.serverTimeOffset = (typeof event.data.timenow === 'number')
            ? (event.data.timenow - Math.floor(Date.now() / 1000))
            : 0;

        // ANTI-DUPLICACIÓN MEJORADO: Usar timestamp para evitar actualizaciones rápidas duplicadas
        const now = Date.now();
        const lastUpdate = window.__lastInventoryUpdate || 0;
        const timeSinceLastUpdate = now - lastUpdate;

        // ANTI-DUPLICACIÓN: Detectar si estamos recibiendo items duplicados
        const incomingItems = Array.isArray(event.data.itemList) ? event.data.itemList : [];
        const previousItems = Array.isArray(window.mainItems) ? window.mainItems : [];

        // Si la actualización es muy rápida (menos de 500ms) y los items son idénticos, ignorar
        if (timeSinceLastUpdate < 500 && previousItems.length > 0 && incomingItems.length > 0) {
            const previousIds = new Set();
            const incomingIds = new Set();

            for (const it of previousItems) {
                if (it && it.id) previousIds.add(String(it.id));
            }
            for (const it of incomingItems) {
                if (it && it.id) incomingIds.add(String(it.id));
            }

            // Si los IDs son idénticos y la actualización es muy rápida, probablemente es duplicada
            const sameIds = previousIds.size === incomingIds.size &&
                [...previousIds].every(id => incomingIds.has(id));

            if (sameIds) {
                // Silenciosamente ignorar duplicados (sistema funcionando correctamente)
                return; // Ignorar esta actualización
            }
        }

        // Actualizar timestamp
        window.__lastInventoryUpdate = now;

        const previousIdentities = new Set();
        for (const it of previousItems) {
            const id = (it && it.id !== undefined && it.id !== null) ? String(it.id) : null;
            if (id && id !== '0') previousIdentities.add(id);
            try {
                if (typeof itemBaseKey === 'function' && typeof itemMetaHash === 'function') {
                    const k = itemBaseKey(it);
                    const m = itemMetaHash(it);
                    if (k && m) previousIdentities.add(`${String(k)}|${String(m)}`);
                }
            } catch (e) { }
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

        // Actualizar datos del HUD de quickslots tras cargar items (sin forzar apertura)
        try {
            if (typeof updateQuickslotHudFromMain === 'function') {
                updateQuickslotHudFromMain();
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
        secondarySetCurrentCapacity(total, weight);
        if (typeof window.updateWeightDisplay === 'function') {
            window.updateWeightDisplay();
        }
    } else if (event.data.action == "startPlayerTargeting") {
        if (typeof start3DPlayerTargeting === 'function') {
            start3DPlayerTargeting(event.data);
        }
    } else if (event.data.action == "updatePlayerTargets") {
        if (typeof update3DPlayerTargets === 'function') {
            update3DPlayerTargets(event.data.targets);
        }
    } else if (event.data.action == "nearPlayers") {
        if (event.data.what == "give") {
            if (typeof start3DPlayerTargeting === 'function') {
                start3DPlayerTargeting(event.data);
            } else {
                selectPlayerToGive(event.data);
            }
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


