let imageCache = {};
window.uiUseCooldownUntil = window.uiUseCooldownUntil || 0; // cooldown global entre usos

/**
 * Preload images
 * @param {Array} images - The array of images to preload so we can choose to display placeholder or not
 */
function preloadImages(images) {

    $.each(images, function (_, image) {
        imageCache[image] = `url("img/items/${image}.png")`;
        const img = new Image();
        let triedAlt = false;

        img.onload = () => {
            imageCache[image] = `url("${img.src}")`;
        };
        img.onerror = () => {
            if (!triedAlt) {
                triedAlt = true;
                img.src = `img-items/${image}.png`;
                return;
            }
            imageCache[image] = `url("img/items/${image}.png")`;
        };
        img.src = `img/items/${image}.png`;
    });

}

function stableStringify(value) {
    const t = typeof value;
    if (value === null) return 'null';
    if (t === 'string') return JSON.stringify(value);
    if (t === 'number') return Number.isFinite(value) ? String(value) : JSON.stringify(String(value));
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'undefined') return 'undefined';
    if (t === 'bigint') return JSON.stringify(value.toString());
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    if (t === 'object') {
        const keys = Object.keys(value).sort();
        let out = '{';
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            out += JSON.stringify(k) + ':' + stableStringify(value[k]);
            if (i !== keys.length - 1) out += ',';
        }
        out += '}';
        return out;
    }
    return JSON.stringify(String(value));
}

function fnv1a32(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function itemBaseKey(it) {
    if (!it) return null;
    if (it.id !== undefined && it.id !== null && it.id !== 0) return String(it.id);
    if (it.name !== undefined && it.name !== null) return String(it.name);
    return null;
}

function itemMetaHash(it) {
    try {
        if (!it) return null;
        const metaObj = {
            name: it.name ?? null,
            metadata: it.metadata ?? null,
            serial_number: it.serial_number ?? null
        };
        return String(fnv1a32(stableStringify(metaObj)));
    } catch (e) {
        return null;
    }
}

function getQuickslotLayoutEntries(layoutArr) {
    const out = [];
    const seen = new Set();
    if (!Array.isArray(layoutArr)) return out;
    for (const e of layoutArr) {
        if (!e || typeof e !== 'object') continue;
        const s = Number(e.slot);
        if (Number.isNaN(s) || s >= 0) continue;
        const key = String(s);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
    }
    return out;
}

function upsertQuickslotEntry(layoutArr, slotIndex0to3, item) {
    const slot = -(Number(slotIndex0to3) + 1);
    if (!Array.isArray(layoutArr)) layoutArr = [];
    const itemId = (item && item.id !== undefined && item.id !== null && item.id !== 0) ? item.id : (item?.name ?? null);
    const meta = itemMetaHash(item);
    let found = false;
    for (let i = 0; i < layoutArr.length; i++) {
        const e = layoutArr[i];
        if (!e || typeof e !== 'object') continue;
        const s = Number(e.slot);
        if (!Number.isNaN(s) && s === slot) {
            layoutArr[i] = { slot, itemId, meta };
            found = true;
            break;
        }
    }
    if (!found) layoutArr.push({ slot, itemId, meta });
    return layoutArr;
}

function clearMainSlotEl($el) {
    try {
        $el.removeData('item');
        $el.removeData('inventory');
        $el.removeAttr('data-inventory');
        $el.removeAttr('data-label');
        $el.removeAttr('data-tooltip');
        $el.attr('data-group', '0');
        $el.css('background-image', 'none');
        $el.css('opacity', '1');
        $el.find('.count,.equipped-icon').remove();
    } catch (e) {}
}

function getQuickslotEntry(layoutArr, slotIndex0to3) {
    const slot = -(Number(slotIndex0to3) + 1);
    if (!Array.isArray(layoutArr)) return null;
    for (const e of layoutArr) {
        if (!e || typeof e !== 'object') continue;
        const s = Number(e.slot);
        if (!Number.isNaN(s) && s === slot) return e;
    }
    return null;
}

function findItemForQuickslotEntry(entry) {
    try {
        if (!entry || typeof entry !== 'object') return null;
        const key = entry.itemId;
        if (key === undefined || key === null) return null;
        const desiredMeta = (entry.meta === undefined || entry.meta === null) ? null : String(entry.meta);
        const items = Array.isArray(window.mainItems) ? window.mainItems : [];
        let fallback = null;
        for (const it of items) {
            if (!it) continue;
            const k = itemBaseKey(it);
            if (k !== String(key)) continue;
            if (!fallback) fallback = it;
            if (desiredMeta && itemMetaHash(it) === desiredMeta) return it;
        }
        return fallback;
    } catch (e) {
        return null;
    }
}

try {
    if (Array.isArray(window.__pendingImageList) && window.__pendingImageList.length) {
        preloadImages(window.__pendingImageList);
        window.__pendingImageList = [];
    }
} catch (e) { /* noop */ }

/* DROP DOWN BUTTONS MAIN AND SECONDARY INVENTORY */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.dropdownButton[data-type="clothing"], .dropdownButton1[data-type="clothing"]').forEach(button => {
        button.classList.add('active');
    });
});


function bindButtonEventListeners() {
    document.querySelectorAll('.dropdownButton[data-type="itemtype"]').forEach(button => {
        button.addEventListener('mouseenter', function () {
            OverSetTitle(this.getAttribute('data-param'));
            OverSetDesc(this.getAttribute('data-desc'));
        });
        button.addEventListener('mouseleave', function () {
            OverSetTitle(" ");
            OverSetDesc(" ");
        });
    });
}

function bindSecondButtonEventListeners() {
    document.querySelectorAll('.dropdownButton1[data-type="itemtype"]').forEach(button => {
        button.addEventListener('mouseenter', function () {
            OverSetTitleSecond(this.getAttribute('data-param'));
            OverSetDescSecond(this.getAttribute('data-desc'));
        });
        button.addEventListener('mouseleave', function () {
            OverSetTitleSecond(" ");
            OverSetDescSecond(" ");
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    bindButtonEventListeners();
    bindSecondButtonEventListeners();

    document.querySelectorAll('.dropdownButton[data-type="clothing"]').forEach(button => {
        button.addEventListener('mouseenter', function () {
            OverSetTitle(this.getAttribute('data-param'));
            OverSetDesc(this.getAttribute('data-desc'));
        });
        button.addEventListener('mouseleave', function () {
            OverSetTitle(" ");
            OverSetDesc(" ");
        });
    });
});

function toggleDropdown(mainButton) {
    const dropdownButtonsContainers = document.querySelectorAll('.dropdownButtonContainer');
    dropdownButtonsContainers.forEach((container) => {
        if (container.classList.contains(mainButton)) {
            const isVisible = container.classList.toggle('showDropdown');
            const parentCarouselContainer = container.closest('.carouselContainer');
            if (parentCarouselContainer) {
                const controls = parentCarouselContainer.querySelectorAll('.carousel-control');
                controls.forEach(control => control.style.visibility = isVisible ? 'visible' : 'hidden');
            }
        } else {
            container.classList.remove('showDropdown');
            const otherParentCarouselContainer = container.closest('.carouselContainer');
            if (otherParentCarouselContainer) {
                const controls = otherParentCarouselContainer.querySelectorAll('.carousel-control');
                controls.forEach(control => control.style.visibility = 'hidden');
            }
        }
    });

    const dropdownContainers = document.querySelectorAll('.dropdownButtonContainer');
    dropdownContainers.forEach(container => {
        container.addEventListener('wheel', function (event) {
            event.preventDefault();
            this.scrollLeft += event.deltaY;
        }, { passive: false });
    });
}

function initializeStaticCarousel() {

    const staticCarouselControls = document.querySelectorAll('.carouselWrapper1 .carousel-control1');
    staticCarouselControls.forEach(control => control.style.visibility = 'visible');
    const staticDropdownContainer = document.querySelector('#staticCarousel');
    if (staticDropdownContainer) {
        staticDropdownContainer.addEventListener('wheel', function (event) {
            event.preventDefault();
            this.scrollLeft += event.deltaY;
        }, { passive: false });
    }
}

document.addEventListener('DOMContentLoaded', initializeStaticCarousel);

function scrollCarousel(carouselId, direction) {
    const container = document.getElementById(carouselId);
    const scrollAmount = 200;
    let newScrollPosition = container.scrollLeft + (scrollAmount * direction);
    container.scrollTo({
        top: 0,
        left: newScrollPosition,
        behavior: 'smooth'
    });
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

let actionsConfigLoaded; // Holds the promise once initialized

const DEFAULT_ACTIONS_CONFIG = {
    all: { types: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ], desc: "Todos los objetos", img: "satchel_nav_all.png" },
    medical: { types: [ 0, 2 ], desc: "Medicina y remedios", img: "satchel_nav_remedies.png" },
    foods: { types: [ 0, 3 ], desc: "Comida y provisiones", img: "satchel_nav_provisions.png" },
    weapons: { types: [ 0, 5 ], desc: "Armas", img: "weapon.png" },
    ammo: { types: [ 0, 6 ], desc: "Municiones", img: "ammo.png" },
    tools: { types: [ 0, 4 ], desc: "Herramientas y materiales", img: "satchel_nav_materials.png" },
    animals: { types: [ 0, 8 ], desc: "Materiales de animales", img: "satchel_nav_animals.png" },
    documents: { types: [ 0, 7 ], desc: "Documentos", img: "satchel_nav_documents.png" },
    valuables: { types: [ 0, 9 ], desc: "Objetos de valor", img: "satchel_nav_valuables.png" },
    horse: { types: [ 0, 10 ], desc: "Objetos de caballo", img: "satchel_nav_horse_items.png" },
    herbs: { types: [ 0, 11 ], desc: "Hierbas", img: "satchel_nav_herbs.png" },
};

function loadActionsConfig() {
    if (!actionsConfigLoaded) {
        actionsConfigLoaded = new Promise((resolve) => {
            fetch(`https://${GetParentResourceName()}/getActionsConfig`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                }
            })
                .then(response => response.json())
                .then(actionsConfig => {
                    window.Actions = (actionsConfig && Object.keys(actionsConfig).length > 0) ? actionsConfig : DEFAULT_ACTIONS_CONFIG;
                    resolve(window.Actions);
                })
                .catch(() => {
                    window.Actions = DEFAULT_ACTIONS_CONFIG;
                    resolve(DEFAULT_ACTIONS_CONFIG);
                });
        });
    }
    return actionsConfigLoaded;
}

function generateActionButtons(actionsConfig, containerId, inventoryContext, buttonClass) {
    const basePath = "img/itemtypes/";
    const container = document.getElementById(containerId);

    if (container) {
        container.innerHTML = '';
        Object.keys(actionsConfig).forEach(key => {
            const action = actionsConfig[key];
            const button = document.createElement('button');
            button.className = buttonClass;
            button.type = 'button';
            button.setAttribute('data-type', 'itemtype');
            button.setAttribute('data-param', key);
            button.setAttribute('data-desc', action.desc || key);
            button.setAttribute('title', action.desc || key);
            button.setAttribute('onclick', `action('itemtype', '${key}', '${inventoryContext}')`);

            if (key === 'all' && inventoryContext === 'inventoryElement') {
                button.classList.add('active');
            }

            const div = document.createElement('div');
            const img = document.createElement('img');
            img.src = basePath + action.img;
            img.alt = key;
            div.appendChild(img);
            button.appendChild(div);
            container.appendChild(button);
        });

        bindButtonEventListeners();
        bindSecondButtonEventListeners();
    } else {
        console.warn(`Container for action buttons not found: ${containerId}`);
    }
}

function action(type, param, inv) {
    if (type === 'itemtype') {
        if (inv === "inventoryElement") {
            window.currentActiveCategory = param;
            document.querySelectorAll('.dropdownButton[data-type="itemtype"]').forEach(btn => btn.classList.remove('active'));
            const activeButtonMain = document.querySelector(`.dropdownButton[data-param="${param}"][data-type="itemtype"]`);
            if (activeButtonMain) activeButtonMain.classList.add('active');
        } else if (inv === "secondInventoryElement") {
            window.currentActiveCategorySecond = param;
            document.querySelectorAll('.dropdownButton1').forEach(btn => {
                if (btn.getAttribute('data-type') === 'itemtype') btn.classList.remove('active');
            });
            const activeButtonSecond = document.querySelector(`.dropdownButton1[data-param="${param}"][data-type="itemtype"]`);
            if (activeButtonSecond) activeButtonSecond.classList.add('active');
        }

        const actionsMap = window.Actions || DEFAULT_ACTIONS_CONFIG;
        let types = [];
        if (actionsMap && (param in actionsMap)) {
            types = actionsMap[param].types || [];
        } else if (actionsMap && actionsMap['all']) {
            types = actionsMap['all'].types || [];
        }

        showItemsByType(types, inv);

        // Si el item seleccionado en el panel de detalles quedó oculto por el filtro, limpiarlo
        try {
            if (window.currentPanelItem && !window.currentPanelItem.is(':visible')) {
                if (typeof window.clearItemPanel === 'function') {
                    window.clearItemPanel();
                }
            }
        } catch (e) {}
    } else if (type === 'clothing') {
        const clickedButton = document.querySelector(`.dropdownButton[data-param="${param}"][data-type="clothing"], .dropdownButton1[data-param="${param}"][data-type="clothing"]`);
        if (clickedButton) {
            clickedButton.classList.toggle('active');
        }
        $.post(
            `https://${GetParentResourceName()}/ChangeClothing`, JSON.stringify(param)
        );
    }
}

/* FILTER ITEMS BY TYPE */
function showItemsByType(itemTypesToShow, inv) {
    $(`#${inv} .item`).each(function () {
        const $this = $(this);
        // Descartar casillas vacías residuales sin id ni label si las hubiera
        if ($this.attr('data-group') === '0' && !$this.attr('id') && !$this.data('label')) {
            $this.remove();
            return;
        }

        const rawGroup = $this.data("group") !== undefined ? $this.data("group") : $this.attr("data-group");
        const group = Number(rawGroup);
        const itemId = ($this.attr('id') || '').toString();
        const isGunbelt = (itemId === 'item-gunbelt');
        const isAmmoItem = isGunbelt || itemId.toLowerCase().startsWith('item-ammo') || group === 6;

        let isMatch = false;
        if (!itemTypesToShow || itemTypesToShow.length === 0) {
            isMatch = true;
        } else if (itemTypesToShow.some(t => Number(t) === 6) && isAmmoItem) {
            // La cartuchera y todos los items de munición pertenecen a la categoría ammo (grupo 6)
            isMatch = true;
        } else if (isGunbelt && itemTypesToShow.some(t => Number(t) === 1)) {
            // La cartuchera pertenece también a 'all'
            isMatch = true;
        } else if (itemTypesToShow.some(t => Number(t) === group)) {
            isMatch = true;
        }

        // Si además el jugador tiene texto en el buscador, aplicar ambos filtros de forma conjunta
        if (isMatch && inv === "inventoryElement") {
            const searchVal = $("#search").val();
            if (searchVal && searchVal.trim().length > 0) {
                const searchFor = searchVal.trim().toLowerCase();
                const label = ($this.data("label") || $this.attr("data-label") || "").toString().toLowerCase();
                if (label.indexOf(searchFor) < 0) {
                    isMatch = false;
                }
            }
        }

        if (isMatch) {
            $this.show();
        } else {
            $this.hide();
        }
    });
}

$(document).ready(function () {

    $(document).on('mouseenter', '.item', function () {

        // En el inventario principal y secundario, toda la información se muestra en el panel fijo lateral derecho compartido (#item-details-panel)
        if ($(this).closest('#inventoryElement, #secondInventoryElement').length) return;

        if ($(this).data('tooltip') && !stopTooltip) {

            const tooltipText = $(this).data('tooltip');
            const $tooltip = $('<div></div>')
                .addClass('tooltip')
                .css('pointer-events', 'none')
                .html(tooltipText)
                .appendTo('body');

            const itemOffset = $(this).offset();
            const tooltipTop = itemOffset.top + $(this).outerHeight() + 10;
            const tooltipLeft = itemOffset.left;

            $tooltip.css({
                'top': tooltipTop,
                'left': tooltipLeft,
                'position': 'absolute',
                'display': 'block'
            });
        }
    });

    $(document).on('mouseleave', '.item', function () {
        $('.tooltip').remove();
    });
});

// Renderizar botones de acción en el panel lateral fijo (derecho)
window.renderItemActionsInPanel = function($el) {
    const $container = $("#item-actions-panel");
    if (!$container.length) return;
    $container.empty();

    if (!$el || !$el.length) return;
    const item = $el.data('item');
    if (!item) return;

    let actions = $el.data('panelActions') || [];

    // Si no tiene la acción USAR/EQUIPAR y no es dinero:
    const isMoney = $el.data('isMoney') || item.type === "item_money";
    const hasUseAction = actions.some(a => a.text === (typeof LANGUAGE !== 'undefined' && LANGUAGE ? LANGUAGE.use : "Use") || a.text === (typeof LANGUAGE !== 'undefined' && LANGUAGE ? LANGUAGE.equip : "Equip") || a.text === (typeof LANGUAGE !== 'undefined' && LANGUAGE ? LANGUAGE.unequip : "Unequip"));
    if (!hasUseAction && !isMoney && item.type !== "item_ammo" && $el.attr('id') !== 'item-gunbelt') {
        const useText = (item.type === "item_weapon") 
            ? ((item.used || item.used2) ? ((typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.unequip) ? LANGUAGE.unequip : "DESEQUIPAR") : ((typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.equip) ? LANGUAGE.equip : "EQUIPAR"))
            : ((typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.use) ? LANGUAGE.use : "USAR");
        const useAction = {
            text: useText,
            action: function() {
                const now = Date.now();
                const spamDelay = (window.Config?.SpamDelay ?? 5000);
                const until = (window.uiUseCooldownUntil ?? 0);
                if (now < until) return;

                if (item.used || item.used2) {
                    $el.find('.equipped-icon').hide();
                    $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                        item: item.name,
                        id: item.id,
                    }));
                } else {
                    if (item.type === "item_weapon") {
                        $el.find('.equipped-icon').show();
                    }
                    $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                        item: item.name,
                        type: item.type,
                        hash: item.hash,
                        amount: item.count,
                        id: item.id,
                    }));
                }
                window.uiUseCooldownUntil = now + spamDelay;
            }
        };
        actions = [useAction, ...actions];
    }

    // Teclas asignadas para cada uno de los 4 cajones
    const actionKeys = ['E', 'G', 'X', 'C'];

    // Renderizar hasta 4 acciones (uno por cada recuadro del fondo)
    actions.slice(0, 4).forEach((act, idx) => {
        const key = actionKeys[idx] || '';
        let displayText = String(act.text || '');
        if (/empaquetar/i.test(displayText)) {
            displayText = 'EMPAQUETAR';
        }
        const $btn = $(`
            <button class="panel-action-btn" type="button" data-key="${key}">
                <span class="panel-action-key">${key}</span>
                <span class="panel-action-text">${displayText}</span>
            </button>
        `);
        $btn.data('action', act.action);
        $container.append($btn);
    });

    // Panel lateral para municiones adicionales de la cartuchera (fondo menu_infoink.png)
    const $lateralPanel = $("#gunbelt-ammo-panel");
    const $lateralContainer = $("#gunbelt-ammo-buttons");
    if ($lateralContainer.length) $lateralContainer.empty();

    const isGunbelt = ($el.attr('id') === 'item-gunbelt') || (item === 'gunbelt') || (item && item.name === 'gunbelt') || ($el.data('item') === 'gunbelt');

    if (isGunbelt && actions.length > 4) {
        const lateralKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'F', 'R', 'T', 'Y', 'V'];
        const extraActions = actions.slice(4);
        extraActions.forEach((act, idx) => {
            const key = lateralKeys[idx] || (idx + 1 <= 9 ? String(idx + 1) : '');
            let displayText = String(act.text || '');
            const $btn = $(`
                <button class="lateral-ammo-btn" type="button" data-key="${key}">
                    <span class="lateral-ammo-key">${key}</span>
                    <span class="lateral-ammo-text">${displayText}</span>
                </button>
            `);
            $btn.data('action', act.action);
            $lateralContainer.append($btn);
        });
        if ($lateralPanel.length) $lateralPanel.fadeIn(120);
    } else {
        if ($lateralPanel.length) $lateralPanel.hide();
    }
};

window.clearPanelTimeout = null;

window.getItemDurability = function(item) {
    if (!item) return null;

    // 1. Degradación temporal dinámica (alimentos, perecederos con degradación por tiempo)
    const maxDeg = Number(item.maxDegradation);
    if (!isNaN(maxDeg) && maxDeg > 0) {
        const deg = Number(item.degradation);
        if (!isNaN(deg) && deg > 0) {
            const offset = (typeof window.serverTimeOffset === 'number') ? window.serverTimeOffset : 0;
            const now = Math.floor(Date.now() / 1000) + offset;
            const maxDegradeSeconds = maxDeg * 60;
            const elapsedSeconds = now - deg;
            if (elapsedSeconds <= 0) return 100;
            if (elapsedSeconds >= maxDegradeSeconds) return 0;
            const pct = ((maxDegradeSeconds - elapsedSeconds) / maxDegradeSeconds) * 100;
            return Math.max(0, Math.min(100, pct));
        } else if (deg === 0) {
            return 0; // Expirado
        } else if (typeof item.percentage === 'number' && item.percentage >= 0) {
            return Math.min(100, Math.max(0, item.percentage));
        } else {
            return 100;
        }
    }

    // 2. Durabilidad en metadata (armas personalizadas, herramientas)
    if (item.metadata) {
        if (typeof item.metadata.durability === 'number') {
            return Math.min(100, Math.max(0, item.metadata.durability));
        }
        if (typeof item.metadata.percentage === 'number') {
            return Math.min(100, Math.max(0, item.metadata.percentage));
        }
        if (typeof item.metadata.degradation === 'number') {
            return Math.min(100, Math.max(0, item.metadata.degradation));
        }
    }

    // 3. Condición de armas (conditionlevel)
    if (typeof item.conditionlevel === 'number' && item.conditionlevel > 0) {
        return Math.min(100, Math.max(0, item.conditionlevel));
    }

    // 4. Porcentaje genérico estático solo si está deteriorado (< 100)
    if (typeof item.percentage === 'number' && item.percentage >= 0 && item.percentage < 100) {
        return Math.min(100, Math.max(0, item.percentage));
    }

    return null;
};

window.renderDurabilityInPanel = function(pct, customLabel) {
    const $durPanel = $("#item-durability-panel");
    if (!$durPanel.length) return;

    if (pct === null || pct === undefined || isNaN(pct)) {
        $durPanel.hide();
        return;
    }

    const defaultLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && (LANGUAGE.durability || LANGUAGE.labels?.durability)) ? (LANGUAGE.durability || LANGUAGE.labels?.durability) : "Durabilidad";
    const labelText = customLabel || defaultLabel;
    $durPanel.find('.durability-label').text(labelText.toUpperCase());

    const activeCount = Math.max(0, Math.min(10, Math.round(pct / 10)));
    let ticksHtml = '';
    for (let i = 1; i <= 10; i++) {
        const stateClass = (i <= activeCount) ? 'active' : 'consumed';
        ticksHtml += `<div class="durability-tick ${stateClass}"></div>`;
    }

    $durPanel.find('.durability-bar').html(ticksHtml);
    $durPanel.css('display', 'flex').show();
};

// Renderizar detalles del item (peso, serial, límite, cantidad) en el recuadro fijo debajo de los KG
window.renderItemDetailsInPanel = function(item) {
    const $detailsPanel = $("#item-details-panel");
    if (!$detailsPanel.length) return;
    $detailsPanel.empty();

    if (!item) {
        $detailsPanel.hide();
        return;
    }

    const weightMeasure = (typeof Config !== 'undefined' && Config && Config.WeightMeasure) ? Config.WeightMeasure : "KG";
    
    // Labels traducidos con fallbacks limpios
    const weightLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.labels && LANGUAGE.labels.weight) 
        ? LANGUAGE.labels.weight.trim() 
        : "PESO";
    
    let serialLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.labels && LANGUAGE.labels.serial) 
        ? LANGUAGE.labels.serial.trim() 
        : "SERIAL";
    if (serialLabel.toLowerCase().includes("número") || serialLabel.toLowerCase().includes("numero")) {
        serialLabel = "Nº SERIE";
    }

    const limitLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.labels && LANGUAGE.labels.limit) 
        ? LANGUAGE.labels.limit.trim() 
        : "LÍMITE";

    const countLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.labels && LANGUAGE.labels.amount) 
        ? LANGUAGE.labels.amount.trim().replace(':', '') 
        : ((typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.prompttitle) ? LANGUAGE.prompttitle.trim() : "CANTIDAD");

    let rowsHtml = '';

    if (item.type === "item_weapon") {
        // Armas: Peso, Cantidad (1) y Número de serie
        const rawWeight = Number(item.weight) || 0;
        const weightStr = rawWeight.toFixed(2) + " " + weightMeasure;
        const count = item.count != null ? item.count : 1;

        rowsHtml += `
            <div class="item-detail-row item-detail-weight">
                <span class="item-detail-label">${weightLabel.toUpperCase()}:</span>
                <span class="item-detail-value">${weightStr}</span>
            </div>
            <div class="item-detail-row item-detail-count">
                <span class="item-detail-label">${countLabel.toUpperCase()}:</span>
                <span class="item-detail-value">${count}</span>
            </div>
        `;

        if (item.serial_number && String(item.serial_number).trim() !== "") {
            rowsHtml += `
                <div class="item-detail-row item-detail-serial">
                    <span class="item-detail-label">${serialLabel.toUpperCase()}:</span>
                    <span class="item-detail-value">${String(item.serial_number).trim()}</span>
                </div>
            `;
        }
    } else if (item.type === "item_money") {
        // Dinero: Mostrar peso y cantidad
        const count = item.count != null ? item.count : 0;
        const rawWeight = Number(item.weight) || 0;
        if (rawWeight > 0) {
            rowsHtml += `
                <div class="item-detail-row item-detail-weight">
                    <span class="item-detail-label">${weightLabel.toUpperCase()}:</span>
                    <span class="item-detail-value">${rawWeight.toFixed(2)} ${weightMeasure}</span>
                </div>
            `;
            rowsHtml += `
                <div class="item-detail-row item-detail-count">
                    <span class="item-detail-label">${countLabel.toUpperCase()}:</span>
                    <span class="item-detail-value">${count}</span>
                </div>
            `;
        } else {
            rowsHtml += `
                <div class="item-detail-row item-detail-count" style="grid-column: 1 / -1; justify-self: center;">
                    <span class="item-detail-label">${countLabel.toUpperCase()}:</span>
                    <span class="item-detail-value">${count}</span>
                </div>
            `;
        }
    } else {
        // Items estándar
        const { weight } = getItemMetadataInfo(item, false);
        const count = item.count != null ? Number(item.count) : 1;
        const totalWeight = (Number(weight) || 0) * count;
        const weightStr = totalWeight.toFixed(2) + " " + weightMeasure;

        // Fila 1 - Izquierda: Peso
        rowsHtml += `
            <div class="item-detail-row item-detail-weight">
                <span class="item-detail-label">${weightLabel.toUpperCase()}:</span>
                <span class="item-detail-value">${weightStr}</span>
            </div>
        `;

        // Fila 1 - Derecha: Cantidad
        rowsHtml += `
            <div class="item-detail-row item-detail-count">
                <span class="item-detail-label">${countLabel.toUpperCase()}:</span>
                <span class="item-detail-value">${count}</span>
            </div>
        `;

        // Fila 2 - Izquierda: Límite (si tiene límite configurado)
        if (item.limit != null && Number(item.limit) > 0) {
            rowsHtml += `
                <div class="item-detail-row item-detail-limit">
                    <span class="item-detail-label">${limitLabel.toUpperCase()}:</span>
                    <span class="item-detail-value">${item.limit}</span>
                </div>
            `;
        }

        if (item.metadata && item.metadata.tooltip) {
            rowsHtml += `
                <div class="item-detail-row item-detail-custom">
                    ${item.metadata.tooltip}
                </div>
            `;
        }
    }

    if (rowsHtml.trim() !== '') {
        $detailsPanel.html(rowsHtml);
        $detailsPanel.css('display', 'grid').show();
    } else {
        $detailsPanel.hide();
    }
};

window.clearItemPanel = function() {
    if (window.clearPanelTimeout) {
        clearTimeout(window.clearPanelTimeout);
        window.clearPanelTimeout = null;
    }
    if (window.panelDurabilityInterval) {
        clearInterval(window.panelDurabilityInterval);
        window.panelDurabilityInterval = null;
    }
    window.currentPanelItem = null;
    $("#inventoryElement .item, #secondInventoryElement .item").removeClass('panel-item-active');
    $("#item-actions-panel").empty();
    const $lateralPanel = $("#gunbelt-ammo-panel");
    if ($lateralPanel.length) {
        $lateralPanel.hide().find('#gunbelt-ammo-buttons').empty();
    }
    $("#item-durability-panel").hide();
    $("#item-details-panel").empty().hide();
    try {
        if (typeof OverSetTitle === 'function') OverSetTitle(" ");
        if (typeof OverSetDesc === 'function') OverSetDesc(" ");
    } catch(e) {}
};

window.showItemInPanel = function($el) {
    if (window.clearPanelTimeout) {
        clearTimeout(window.clearPanelTimeout);
        window.clearPanelTimeout = null;
    }
    if (!$el || !$el.length) return;
    const item = $el.data('item');
    if (!item) return;

    $("#inventoryElement .item, #secondInventoryElement .item").removeClass('panel-item-active');
    $el.addClass('panel-item-active');
    window.currentPanelItem = $el;

    if (item.type === "item_money") {
        const count = item.count || 0;
        OverSetTitle(item.label || "Dólares");
        OverSetDesc(item.desc || ("Dinero en efectivo - $" + Number(count).toFixed(2)));
    } else {
        const { label, description } = getItemMetadataInfo(item);
        OverSetTitle(label);
        OverSetDesc(description);
    }

    // Renderizar detalles del item (peso, serial, límite) en el recuadro debajo de KG
    window.renderItemDetailsInPanel(item);

    if (window.panelDurabilityInterval) {
        clearInterval(window.panelDurabilityInterval);
        window.panelDurabilityInterval = null;
    }

    const isDecay = (item && Number(item.maxDegradation) > 0);
    const durabilityLabel = isDecay
        ? ((typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.labels && LANGUAGE.labels.decay) ? LANGUAGE.labels.decay.trim() : "DECADENCIA")
        : ((typeof LANGUAGE !== 'undefined' && LANGUAGE && (LANGUAGE.durability || LANGUAGE.labels?.durability)) ? (LANGUAGE.durability || LANGUAGE.labels?.durability).trim() : "DURABILIDAD");

    const durability = window.getItemDurability(item);
    window.renderDurabilityInPanel(durability, durabilityLabel);

    // Actualización en tiempo real cada 1 segundo si el item tiene degradación temporal
    if (item && item.maxDegradation && Number(item.maxDegradation) > 0) {
        window.panelDurabilityInterval = setInterval(() => {
            if (!window.currentPanelItem || !window.currentPanelItem.length) {
                clearInterval(window.panelDurabilityInterval);
                window.panelDurabilityInterval = null;
                return;
            }
            const currentItem = window.currentPanelItem.data('item');
            if (!currentItem || !currentItem.maxDegradation || Number(currentItem.maxDegradation) <= 0) {
                clearInterval(window.panelDurabilityInterval);
                window.panelDurabilityInterval = null;
                return;
            }
            const liveDurability = window.getItemDurability(currentItem);
            window.renderDurabilityInPanel(liveDurability, durabilityLabel);
        }, 1000);
    }

    if ($el.data('inventory') === 'second' || $el.closest('#secondInventoryElement').length) {
        // En inventario secundario (caballo, cofre), no mostrar botones de acción directa del jugador
        $("#item-actions-panel").empty();
    } else {
        window.renderItemActionsInPanel($el);
    }
};

// Limpiar selección cuando el cursor sale de los ítems
$(document).on('mouseleave', '#inventoryElement .item, #secondInventoryElement .item', function(e) {
    if (e.relatedTarget && $(e.relatedTarget).closest('#gunbelt-ammo-panel').length) {
        return; // Moviéndose hacia el panel lateral de munición
    }
    const nextItem = e.relatedTarget ? $(e.relatedTarget).closest('#inventoryElement .item, #secondInventoryElement .item') : null;
    if (!nextItem || !nextItem.length || !nextItem.data('item')) {
        if (window.clearPanelTimeout) clearTimeout(window.clearPanelTimeout);
        window.clearPanelTimeout = setTimeout(function() {
            if (!$("#inventoryElement .item:hover, #secondInventoryElement .item:hover").filter(function() { return !!$(this).data('item'); }).length && !$("#gunbelt-ammo-panel:hover").length) {
                window.clearItemPanel();
            }
        }, 50);
    }
});

$(document).on('mouseleave', '#gunbelt-ammo-panel', function(e) {
    if (e.relatedTarget && ($(e.relatedTarget).closest('#inventoryElement .item, #secondInventoryElement .item').length || $(e.relatedTarget).closest('#inventoryBackground').length)) {
        return; // Moviéndose de regreso al inventario
    }
    if (window.clearPanelTimeout) clearTimeout(window.clearPanelTimeout);
    window.clearPanelTimeout = setTimeout(function() {
        if (!$("#inventoryElement .item:hover, #secondInventoryElement .item:hover").filter(function() { return !!$(this).data('item'); }).length && !$("#gunbelt-ammo-panel:hover").length) {
            window.clearItemPanel();
        }
    }, 50);
});

$(document).on('mouseleave', '#inventoryElement, #secondInventoryElement', function(e) {
    if (e.relatedTarget && $(e.relatedTarget).closest('#gunbelt-ammo-panel, #inventoryElement .item, #secondInventoryElement .item').length) {
        return;
    }
    if (window.clearPanelTimeout) clearTimeout(window.clearPanelTimeout);
    window.clearPanelTimeout = setTimeout(function() {
        if (!$("#inventoryElement .item:hover, #secondInventoryElement .item:hover").filter(function() { return !!$(this).data('item'); }).length && !$("#gunbelt-ammo-panel:hover").length) {
            window.clearItemPanel();
        }
    }, 50);
});

$(document).on('click', function(e) {
    if (!$(e.target).closest('#inventoryElement .item, #secondInventoryElement .item').length && !$(e.target).closest('#gunbelt-ammo-panel').length) {
        window.clearItemPanel();
    }
});

// Clic directo en botones del panel lateral de munición
$(document).on('click', '.lateral-ammo-btn', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const $btn = $(this);
    $btn.addClass('btn-key-pressed');
    setTimeout(() => $btn.removeClass('btn-key-pressed'), 180);
    const actionFn = $btn.data('action');
    if (typeof actionFn === 'function') {
        actionFn();
    }
});

// Atajos de teclado para ejecutar acciones con el cursor sobre un ítem
$(document).on('keydown', function(e) {
    // Si el usuario está escribiendo en el buscador o cualquier input, ignorar atajos
    const tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '');
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) {
        return;
    }

    if (!window.currentPanelItem || !window.currentPanelItem.length) return;

    const pressedKey = (e.key || '').toUpperCase();

    // 1. Teclas del panel principal (E, G, X, C)
    if (['E', 'G', 'X', 'C'].includes(pressedKey)) {
        const $btn = $(`#item-actions-panel .panel-action-btn[data-key="${pressedKey}"]`);
        if ($btn && $btn.length) {
            e.preventDefault();
            e.stopPropagation();
            $btn.addClass('btn-key-pressed');
            setTimeout(() => $btn.removeClass('btn-key-pressed'), 180);
            const actionFn = $btn.data('action');
            if (typeof actionFn === 'function' && window.currentPanelItem && window.currentPanelItem.length) {
                actionFn.call(window.currentPanelItem[0]);
            }
        }
        return;
    }

    // 2. Teclas del panel lateral de municiones adicionales (1..0, F, R, T, Y, V)
    const lateralKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'F', 'R', 'T', 'Y', 'V'];
    if (lateralKeys.includes(pressedKey) && $("#gunbelt-ammo-panel").is(":visible")) {
        const $latBtn = $(`#gunbelt-ammo-buttons .lateral-ammo-btn[data-key="${pressedKey}"]`);
        if ($latBtn && $latBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            $latBtn.addClass('btn-key-pressed');
            setTimeout(() => $latBtn.removeClass('btn-key-pressed'), 180);
            const actionFn = $latBtn.data('action');
            if (typeof actionFn === 'function') {
                actionFn();
            }
        }
    }
});

$(document).on('contextmenu', '#inventoryElement .item, #secondInventoryElement .item', function(e) {
    if ($(this).data('item')) {
        e.preventDefault();
        e.stopPropagation();
        window.showItemInPanel($(this));
    }
});

$(document).on('click', '#inventoryElement .item, #secondInventoryElement .item', function() {
    if ($(this).data('item')) {
        window.showItemInPanel($(this));
    }
});

function moveInventory(inv) {
    const inventoryHud = document.getElementById('inventoryHud');
    
    // HUD principal siempre en posición fija (no se mueve)
    // Solo aplicar posición guardada si existe, sino usar CSS por defecto
    try {
        const key = (window.currentPlayerId !== undefined && window.currentPlayerId !== null) ? String(window.currentPlayerId) : 'default';
        const raw = localStorage.getItem(`hudPos:${key}`);
        if (raw) {
            const pos = JSON.parse(raw);
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                inventoryHud.style.left = `${pos.left}px`;
                inventoryHud.style.top = `${pos.top}px`;
            }
        }
        // Si no hay posición guardada, el CSS se encarga (left: 25%, top: 5%)
    } catch(e) { 
        // En caso de error, dejar que el CSS maneje la posición
    }

    // Mover inventario secundario si es necesario
    if (inv === 'second') {
        // El inventario secundario sigue siendo movible
    }
}



function addData(index, item) {

    $("#item-" + index).data("item", item);
    $("#item-" + index).data("inventory", "main");
    $("#item-" + index).attr("data-inventory", "main");

    const data = [];

    if (Config.DoubleClickToUse) {

        $("#item-" + index).dblclick(function () {
            const now = Date.now();
            const spamDelay = (window.Config?.SpamDelay ?? 5000);
            const id = item?.id ?? item?.name;
            const until = (window.uiUseCooldownUntil ?? 0);
            if (now < until) {
                return; // cooldown activo, evita mostrar mensaje de spam
            }

            if (item.used || item.used2) {
                $(this).find('.equipped-icon').hide();
                $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                    item: item.name,
                    id: item.id,
                }));

            } else {

                if (item.type == "item_weapon") {
                    $(this).find('.equipped-icon').show();
                }

                $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                    item: item.name,
                    type: item.type,
                    hash: item.hash,
                    amount: item.count,
                    id: item.id,
                }));
            }

            window.uiUseCooldownUntil = now + spamDelay;
        });

    } else {
        if (item.used || item.used2) {
            data.push({
                text: LANGUAGE.unequip,
                action: function () {
                    $(this).find('.equipped-icon').hide();
                    $.post(`https://${GetParentResourceName()}/UnequipWeapon`,
                        JSON.stringify({
                            item: item.name,
                            id: item.id,
                        })
                    );
                },
            });
        } else {
            if (item.type != "item_weapon") {
                lang = LANGUAGE.use;
            } else {
                lang = LANGUAGE.equip;
            }
            data.push({
                text: lang,
                action: function () {
                    if (item.type == "item_weapon") {
                        $(this).find('.equipped-icon').show();
                    }
                    $.post(`https://${GetParentResourceName()}/UseItem`,
                        JSON.stringify({
                            item: item.name,
                            type: item.type,
                            hash: item.hash,
                            amount: item.count,
                            id: item.id,
                        })
                    );
                },
            });
        }
    }

    if (item.canRemove) {
        data.push({
            text: LANGUAGE.give,
            action: function () {
                giveGetHowMany(item.name, item.type, item.hash, item.id, item.metadata, item.count);
            },
        });

        data.push({
            text: LANGUAGE.drop,
            action: function () {
                dropGetHowMany(
                    item.name,
                    item.type,
                    item.hash,
                    item.id,
                    item.metadata,
                    item.count,
                    item.degradation,
                    item.percentage
                );
            },
        });
        if (Config.EnableCopySerial && item.type == "item_weapon" && item.serial_number) {
            data.push({
                text: LANGUAGE.copyserial,
                action: function () {
                    const clipElem = document.createElement('textarea');
                    clipElem.value = item.serial_number;
                    document.body.appendChild(clipElem);
                    clipElem.select();
                    document.execCommand('copy');
                    document.body.removeChild(clipElem);
                },
            });
        }
    }


    if (item.metadata?.context) {
        item.metadata.context.forEach(option => {
            data.push({
                text: option.text,
                action: function () {
                    option.itemid = item.id;
                    $.post(`https://${GetParentResourceName()}/ContextMenu`,
                        JSON.stringify(option)
                    );
                }
            });
        });
    }

    $("#item-" + index).data("panelActions", data);

    const itemElement = document.getElementById(`item-${index}`);

    itemElement.addEventListener('mouseenter', () => {
        window.showItemInPanel($("#item-" + index));
    });
}

function getItemDegradationPercentage(item) {
    if (item.maxDegradation === 0) return 1;
    const now = TIME_NOW
    const maxDegradeSeconds = item.maxDegradation * 60;
    const elapsedSeconds = now - item.degradation;
    const degradationPercentage = Math.max(0, ((maxDegradeSeconds - elapsedSeconds) / maxDegradeSeconds) * 100);
    return degradationPercentage;
}

/**
 * Get the degradation percentage 
 * @param {Object} item - The item object
 * @returns {string}
 */
function getDegradationMain(item) {
    return "";
}

/**
 * Load inventory items
 * @param {Object} item - The item object
 * @param {number} index - The index of the item
 * @param {number} group - The group of the item
 * @param {number} count - The count of the item
 * @param {number} limit - The limit of the item
 */
function loadInventoryItems(item, index, group, count, limit) {

    if (item.type === "item_weapon") return;

    const { tooltipData, degradation, image, label, weight } = getItemMetadataInfo(item, false);
    const itemWeight = getItemWeight(weight, count);
    const groupKey = getGroupKey(group);
    const { tooltipContent, url } = getItemTooltipContent(image, groupKey, group, limit, itemWeight, degradation, tooltipData);
    const imageOpacity = getItemDegradationPercentage(item) === 0 ? 0.5 : 1;

    $("#inventoryElement").append(`<div data-group='${group}' data-label='${label}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center; opacity: ${imageOpacity};' id='item-${index}' class='item' data-tooltip='${tooltipContent}'> 
        <div class='count'>
            <span style='color:Black'>${count}</span>
        </div>
    </div>`);

}

/**
 * Load inventory weapons
 * @param {Object} item - The item object
 * @param {number} index - The index of the item
 * @param {number} group - The group of the item
 * @param {number} count - The count of the item
 */
function loadInventoryWeapons(item, index, group) {
    if (item.type != "item_weapon") return;

    const weight = getItemWeight(item.weight, 1);
    const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.serial ?? "Serial: ") + item.serial_number : "";
    const url = imageCache[item.name] || `url("img/items/${item.name}.png")`
    const label = item.custom_label ? item.custom_label : item.label;

    $("#inventoryElement").append(`<div data-label='${label}' data-group='${group}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center;' id='item-${index}' class='item' data-tooltip="${weight + info}">
        <div class='equipped-icon' style='display: ${!item.used && !item.used2 ? "none" : "block"};'></div>
    </div> `);
}


/**
 * Load fixed items in the main inventory
 * @param {string} label - The label of the item
 * @param {string} description - The description of the item
 * @param {string} item - The item name
 * @param {Array} data - The data for the context menu
 */
function mainInventoryFixedItems(label, description, item, data) {
    const url = imageCache[item] || `url("img/items/${item}.png")`;
    const fixedGroup = (item === 'gunbelt') ? 6 : 1;
    $("#inventoryElement").append(`<div data-label='${label}' data-group='${fixedGroup}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center;' id='item-${item}' class='item'></div>`);

    $("#item-" + item).data("panelActions", data);

    const itemElement = document.getElementById(`item-${item}`);
    itemElement.addEventListener('mouseenter', () => {
        window.showItemInPanel($("#item-" + item));
    });
}

// --- Reordenación de inventario principal ---
function activateMainInventoryReorder() {
    // Limpiar instancias previas para evitar duplicados
    $("#inventoryElement .item").each(function(){
        try { $(this).draggable("destroy"); } catch(e) {}
        try { $(this).droppable("destroy"); } catch(e) {}
    });

    // Hacer arrastrables los items reales del inventario principal
    $("#inventoryElement .item[data-inventory='main']").draggable({
        helper: 'clone',
        appendTo: 'body',
        zIndex: 99999,
        revert: 'invalid',
        start: function () { try { window.stopTooltip = true; } catch(e) {} },
        stop: function () { try { window.stopTooltip = false; } catch(e) {} }
    });

    // Permitir soltar sobre cualquier casilla (ocupada o vacía)
    $("#inventoryElement .item").droppable({
        accept: "#inventoryElement .item[data-inventory='main'], #quickslotHud .qs-slot.qs-draggable",
        tolerance: "pointer",
        greedy: true,
        drop: function (_, ui) {
            const $source = $(ui.draggable);
            const $target = $(this);
            if ($source[0] === $target[0]) return;
            try {
                const tid = $target.attr('id');
                if (tid && String(tid).startsWith('item-')) {
                    const suffix = String(tid).slice(5);
                    if (suffix && !/^\d+$/.test(suffix)) return;
                }
            } catch(e) {}

            const fromQuickslot = ($source && $source.length && $source.hasClass('qs-slot') && $source.closest('#quickslotHud').length > 0);
            if (fromQuickslot) {
                const qsIdx = Number($source.attr('data-index'));
                try { moveQuickslotItemToMainSlot(qsIdx, $target); } catch (e) {}
                return;
            }

            const targetIsEmpty = ($target.data('group') === 0) || !$target.data('item') || $target.data('inventory') === undefined || $target.data('inventory') === 'none';

            if (targetIsEmpty) {
                // Colocar en la casilla vacía exacta
                swapElements($source, $target);
            } else {
                // Intercambiar posiciones entre los dos items
                swapElements($source, $target);
            }

            rebuildMainItemsCache();
        }
    });

    // Permitir soltar directamente en el fondo del inventario o ventana principal
    $("#inventoryElement, #inventoryHud").each(function () {
        try { $(this).droppable("destroy"); } catch (e) {}
    });
    $("#inventoryElement, #inventoryHud").droppable({
        accept: "#quickslotHud .qs-slot.qs-draggable",
        tolerance: "pointer",
        greedy: false,
        drop: function (event, ui) {
            const $source = $(ui.draggable);
            const fromQuickslot = ($source && $source.length && $source.hasClass('qs-slot') && $source.closest('#quickslotHud').length > 0);
            if (fromQuickslot) {
                const qsIdx = Number($source.attr('data-index'));
                try { moveQuickslotItemToMainSlot(qsIdx, null); } catch (e) {}
            }
        }
    });
}

// --- Modo MOVE por menú contextual ---
(function(){
    function injectMoveModeStyles(){
        if (document.getElementById('move-mode-styles')) return;
        const style = document.createElement('style');
        style.id = 'move-mode-styles';
        style.textContent = `
            #inventoryElement .item.move-target{outline:2px dashed #DC143C; box-shadow:0 0 0 2px rgba(220,20,60,.25) inset; cursor:pointer;}
            #inventoryElement .item.move-source{outline:2px solid #DC143C;}
            #quickslotHud .qs-slot.move-target{outline:2px dashed #DC143C; box-shadow:0 0 0 2px rgba(220,20,60,.25) inset; cursor:pointer;}
            #quickslotHud.qs-interactive{pointer-events:auto;}
        `;
        document.head.appendChild(style);
    }
    window.inventoryMoveMode = { active:false, sourceEl:null };
    window.startMoveMode = function($source){
        if (window.inventoryMoveEnabled) return; // sólo en modo inamovible
        injectMoveModeStyles();
        try { window.cancelMoveMode(); } catch(e) {}
        window.inventoryMoveMode.active = true;
        window.inventoryMoveMode.sourceEl = $source;
        $source.addClass('move-source');
        $("#inventoryElement .item").each(function(){
            const $t = $(this);
            if ($t[0] !== $source[0] && $t.data('inventory') !== 'none'){
                $t.addClass('move-target');
            }
        });
        $("#quickslotHud").addClass('qs-interactive');
        $("#quickslotHud .qs-slot").addClass('move-target');
    };
    window.finishMoveMode = function($target){
        const $source = window.inventoryMoveMode.sourceEl;
        if (!$source) { try { window.cancelMoveMode(); } catch(e) {} return; }
        if ($source[0] === $target[0]) { try { window.cancelMoveMode(); } catch(e) {} return; }
        try {
            const tid = $target && $target.attr ? $target.attr('id') : null;
            if (tid && String(tid).startsWith('item-')) {
                const suffix = String(tid).slice(5);
                if (suffix && !/^\d+$/.test(suffix)) { try { window.cancelMoveMode(); } catch(e) {} return; }
            }
            if ($target && $target.data && $target.data('inventory') === 'none') { try { window.cancelMoveMode(); } catch(e) {} return; }
        } catch(e) {}
        swapElements($source, $target);
        rebuildMainItemsCache();
        try { window.cancelMoveMode(); } catch(e) {}
    };
    window.cancelMoveMode = function(){
        window.inventoryMoveMode.active = false;
        $("#inventoryElement .item").removeClass('move-target move-source');
        try {
            const keepInteractive = (typeof isOpen !== 'undefined' && !!isOpen);
            if (!keepInteractive) $("#quickslotHud").removeClass('qs-interactive');
        } catch (e) {
            $("#quickslotHud").removeClass('qs-interactive');
        }
        $("#quickslotHud .qs-slot").removeClass('move-target');
        window.inventoryMoveMode.sourceEl = null;
    };

    // Click en casillas destino durante modo MOVE
    $(document).on('click', '#inventoryElement .item', function(ev){
        if (window.inventoryMoveMode && window.inventoryMoveMode.active){
            if (!$(this).hasClass('move-target')) return;
            ev.preventDefault(); ev.stopPropagation();
            window.finishMoveMode($(this));
        }
    });
    $(document).on('click', '#quickslotHud .qs-slot', function(ev){
        if (window.inventoryMoveMode && window.inventoryMoveMode.active){
            ev.preventDefault(); ev.stopPropagation();
            if (!window.quickslotHudVisible) return;
            const slotIndex = Number($(this).data('index'));
            if (Number.isNaN(slotIndex) || slotIndex < 0) return;
            const $source = window.inventoryMoveMode.sourceEl;
            if (!$source || !$source.length) { try { window.cancelMoveMode(); } catch(e) {} return; }
            const item = $source.data('item');
            if (!item) { try { window.cancelMoveMode(); } catch(e) {} return; }
            window.mainItemsLayout = upsertQuickslotEntry(window.mainItemsLayout, slotIndex, item);
            try {
                window.quickslotAssignedItems = window.quickslotAssignedItems || {};
                window.quickslotAssignedItems[String(slotIndex)] = item;
            } catch (e) {}
            clearMainSlotEl($source);
            rebuildMainItemsCache();
            try {
                setTimeout(function () {
                    try { updateQuickslotHudFromMain(); } catch (e) {}
                    try { initQuickslotHudDrag(); } catch (e) {}
                }, 0);
            } catch (e) {}
            try { window.cancelMoveMode(); } catch(e) {}
        }
    });
    // Escape para cancelar
    $(document).on('keydown', function(ev){
        if (window.inventoryMoveMode && window.inventoryMoveMode.active && (ev.key === 'Escape' || ev.key === 'Esc')){
            ev.preventDefault();
            try { window.cancelMoveMode(); } catch(e) {}
        }
    });
})();

function swapElements($a, $b) {
    const $placeholder = $('<div class="swap-placeholder" style="display:none;"></div>');
    $a.before($placeholder);
    $b.before($a);
    $placeholder.replaceWith($b);
}

function rebuildMainItemsCache() {
    try {
        const preservedQuick = getQuickslotLayoutEntries(window.mainItemsLayout);
        const newOrder = [];
        const layout = [];
        let slotIndex = 0;
        $("#inventoryElement .item").each(function () {
            const id = this && this.id ? String(this.id) : "";
            if (id.startsWith("item-")) {
                const suffix = id.slice(5);
                if (suffix && !/^\d+$/.test(suffix)) {
                    return;
                }
            }
            const $el = $(this);
            const data = $el.data('item');
            const inv = $el.data('inventory');
            if (data && inv === 'main') {
                newOrder.push(data);
                const itemId = (data.id !== undefined && data.id !== null && data.id !== 0) ? data.id : (data.name ?? null);
                const meta = itemMetaHash(data);
                layout.push({ slot: slotIndex, itemId: itemId, meta: meta });
                slotIndex++;
            }
        });
        for (const e of preservedQuick) layout.push(e);
        window.mainItems = newOrder;
        window.mainItemsLayout = layout;
        try { updateQuickslotHudFromMain(); } catch (e3) { /* noop */ }
        try {
            const res = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'vorp_inventory';
            $.post(`https://${res}/SaveInventoryLayout`, JSON.stringify({ layout: layout }));
        } catch (e2) { /* post noop */ }
    } catch (e) { /* noop */ }
}

// Añadir acción MOVE al menú contextual de los ítems del inventario principal
// La acción se agrega dentro de addData (que ya configura el menú)
function addData(index, item) {

    $("#item-" + index).data("item", item);
    $("#item-" + index).data("inventory", "main");
    $("#item-" + index).attr("data-inventory", "main");

    const data = [];

    if (Config.DoubleClickToUse) {
        $("#item-" + index).dblclick(function () {
            const now = Date.now();
            const spamDelay = (window.Config?.SpamDelay ?? 5000);
            const id = item?.id ?? item?.name;
            const until = (window.uiUseCooldownUntil ?? 0);
            if (now < until) {
                return; // cooldown activo
            }
            if (item.used || item.used2) {
                $(this).find('.equipped-icon').hide();
                $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                    item: item.name,
                    id: item.id,
                }));
            } else {
                if (item.type == "item_weapon") {
                    $(this).find('.equipped-icon').show();
                }
                $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                    item: item.name,
                    type: item.type,
                    hash: item.hash,
                    amount: item.count,
                    id: item.id,
                }));
            }
            window.uiUseCooldownUntil = now + spamDelay;
        });
    } else {
        if (item.used || item.used2) {
            data.push({
                text: LANGUAGE.unequip,
                action: function () {
                    $(this).find('.equipped-icon').hide();
                    $.post(`https://${GetParentResourceName()}/UnequipWeapon`,
                        JSON.stringify({
                            item: item.name,
                            id: item.id,
                        })
                    );
                },
            });
        } else {
            if (item.type != "item_weapon") {
                lang = LANGUAGE.use;
            } else {
                lang = LANGUAGE.equip;
            }
            data.push({
                text: lang,
                action: function () {
                    if (item.type == "item_weapon") {
                        $(this).find('.equipped-icon').show();
                    }
                    $.post(`https://${GetParentResourceName()}/UseItem`,
                        JSON.stringify({
                            item: item.name,
                            type: item.type,
                            hash: item.hash,
                            amount: item.count,
                            id: item.id,
                        })
                    );
                },
            });
        }
    }

    if (item.canRemove) {
        data.push({
            text: LANGUAGE.give,
            action: function () {
                giveGetHowMany(item.name, item.type, item.hash, item.id, item.metadata, item.count);
            },
        });

        data.push({
            text: LANGUAGE.drop,
            action: function () {
                dropGetHowMany(
                    item.name,
                    item.type,
                    item.hash,
                    item.id,
                    item.metadata,
                    item.count,
                    item.degradation,
                    item.percentage
                );
            },
        });
        if (Config.EnableCopySerial && item.type == "item_weapon" && item.serial_number) {
            data.push({
                text: LANGUAGE.copyserial,
                action: function () {
                    const clipElem = document.createElement('textarea');
                    clipElem.value = item.serial_number;
                    document.body.appendChild(clipElem);
                    clipElem.select();
                    document.execCommand('copy');
                    document.body.removeChild(clipElem);
                },
            });
        }
    }


    if (item.metadata?.context) {
        item.metadata.context.forEach(option => {
            data.push({
                text: option.text,
                action: function () {
                    option.itemid = item.id;
                    $.post(`https://${GetParentResourceName()}/ContextMenu`,
                        JSON.stringify(option)
                    );
                }
            });
        });
    }

    $("#item-" + index).data("panelActions", data);

    const itemElement = document.getElementById(`item-${index}`);

    itemElement.addEventListener('mouseenter', () => {
        window.showItemInPanel($("#item-" + index));
    });
}

function getItemDegradationPercentage(item) {
    if (item.maxDegradation === 0) return 1;
    const now = TIME_NOW
    const maxDegradeSeconds = item.maxDegradation * 60;
    const elapsedSeconds = now - item.degradation;
    const degradationPercentage = Math.max(0, ((maxDegradeSeconds - elapsedSeconds) / maxDegradeSeconds) * 100);
    return degradationPercentage;
}

/**
 * Get the degradation percentage 
 * @param {Object} item - The item object
 * @returns {string}
 */
function getDegradationMain(item) {
    return "";
}

/**
 * Load inventory items
 * @param {Object} item - The item object
 * @param {number} index - The index of the item
 * @param {number} group - The group of the item
 * @param {number} count - The count of the item
 * @param {number} limit - The limit of the item
 */
function loadInventoryItems(item, index, group, count, limit) {

    if (item.type === "item_weapon") return;

    const { tooltipData, degradation, image, label, weight } = getItemMetadataInfo(item, false);
    const itemWeight = getItemWeight(weight, count);
    const groupKey = getGroupKey(group);
    const { tooltipContent, url } = getItemTooltipContent(image, groupKey, group, limit, itemWeight, degradation, tooltipData);
    const imageOpacity = getItemDegradationPercentage(item) === 0 ? 0.5 : 1;

    $("#inventoryElement").append(`<div data-group='${group}' data-label='${label}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center; opacity: ${imageOpacity};' id='item-${index}' class='item' data-tooltip='${tooltipContent}'> 
        <div class='count'>
            <span style='color:Black'>${count}</span>
        </div>
    </div>`);

}

/**
 * Load inventory weapons
 * @param {Object} item - The item object
 * @param {number} index - The index of the item
 * @param {number} group - The group of the item
 * @param {number} count - The count of the item
 */
function loadInventoryWeapons(item, index, group) {
    if (item.type != "item_weapon") return;

    const weight = getItemWeight(item.weight, 1);
    const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.serial ?? "Serial: ") + item.serial_number : "";
    const url = imageCache[item.name] || `url("img/items/${item.name}.png")`
    const label = item.custom_label ? item.custom_label : item.label;

    $("#inventoryElement").append(`<div data-label='${label}' data-group='${group}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center;' id='item-${index}' class='item' data-tooltip="${weight + info}">
        <div class='equipped-icon' style='display: ${!item.used && !item.used2 ? "none" : "block"};'></div>
    </div> `);
}


/**
 * Load fixed items in the main inventory
 * @param {string} label - The label of the item
 * @param {string} description - The description of the item
 * @param {string} item - The item name
 * @param {Array} data - The data for the context menu
 */
function mainInventoryFixedItems(label, description, item, data) {
    const url = imageCache[item] || `url("img/items/${item}.png")`;
    const fixedGroup = (item === 'gunbelt') ? 6 : 1;
    $("#inventoryElement").append(`<div data-label='${label}' data-group='${fixedGroup}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center;' id='item-${item}' class='item'></div>`);

    $("#item-" + item).data("panelActions", data);

    const itemElement = document.getElementById(`item-${item}`);
    itemElement.addEventListener('mouseenter', () => {
        window.showItemInPanel($("#item-" + item));
    });
}


function getItemResolvedGroup(it) {
    if (!it) return 1;
    if (it.type === "item_weapon") return 5;
    if (it.type === "item_ammo") return 6;
    const name = (it.name || it.item || "").toString().toLowerCase();
    if (name.startsWith("ammo")) return 6;
    if (it.group !== undefined && it.group !== null && Number(it.group) > 0) return Number(it.group);
    return 1;
}

function inventorySetup(items) {
    if (typeof window.clearItemPanel === 'function') {
        window.clearItemPanel();
    }

    $("#inventoryElement").html("");
    let divAmount = 0;

    let slotCountRendered = 0;
    try {
        const itemsByKey = new Map();
        for (const it of (Array.isArray(items) ? items : [])) {
            const k = itemBaseKey(it);
            if (!k) continue;
            if (!itemsByKey.has(k)) itemsByKey.set(k, []);
            itemsByKey.get(k).push(it);
        }

        // Limpiar del layout cualquier slot de items que ya no existen en el inventario (movidos a caballos/cofres, etc.)
        if (Array.isArray(window.mainItemsLayout)) {
            const validKeys = new Set(itemsByKey.keys());
            window.mainItemsLayout = window.mainItemsLayout.filter(entry => {
                if (!entry || typeof entry !== 'object') return false;
                const s = Number(entry.slot);
                if (s < 0) return true; // preservar quickslots
                const v = ('itemId' in entry) ? entry.itemId : (('id' in entry) ? entry.id : (('name' in entry) ? entry.name : null));
                if (v === undefined || v === null) return false;
                return validKeys.has(String(v));
            });
            let compactSlot = 0;
            for (let i = 0; i < window.mainItemsLayout.length; i++) {
                const e = window.mainItemsLayout[i];
                if (e && Number(e.slot) >= 0) {
                    e.slot = compactSlot++;
                }
            }
        }

        const layout = Array.isArray(window.mainItemsLayout) ? window.mainItemsLayout : null;
        const slotKeyByIndex = [];
        const slotMetaByIndex = [];
        const hasSlot = [];
        if (layout && layout.length > 0) {
            for (let i = 0; i < layout.length; i++) {
                const entry = layout[i];
                if (entry && typeof entry === 'object' && ('slot' in entry)) {
                    const s = Number(entry.slot);
                    if (!Number.isNaN(s) && s >= 0) {
                        hasSlot[s] = true;
                        const v = ('itemId' in entry) ? entry.itemId : (('id' in entry) ? entry.id : (('name' in entry) ? entry.name : null));
                        slotKeyByIndex[s] = (v === undefined || v === null) ? null : String(v);
                        slotMetaByIndex[s] = (entry.meta === undefined || entry.meta === null) ? null : String(entry.meta);
                    }
                } else {
                    hasSlot[i] = true;
                    slotKeyByIndex[i] = (entry === undefined || entry === null || entry === false) ? null : String(entry);
                }
            }
        }

        try {
            const assigned = {};
            const reserved = [];
            for (let qs = 0; qs < 5; qs++) {
                const entry = getQuickslotEntry(layout, qs);
                if (!entry || entry.itemId === undefined || entry.itemId === null) continue;
                const key = String(entry.itemId);
                const list = itemsByKey.get(key);
                if (!list || !list.length) continue;
                let desiredMeta = (entry.meta === undefined || entry.meta === null) ? null : String(entry.meta).trim();
                if (desiredMeta === '') desiredMeta = null;
                let it = null;
                if (desiredMeta) {
                    for (let j = 0; j < list.length; j++) {
                        if (itemMetaHash(list[j]) === desiredMeta) {
                            it = list.splice(j, 1)[0];
                            break;
                        }
                    }
                }
                if (!it) it = list.shift();
                if (it) {
                    assigned[String(qs)] = it;
                    reserved.push(it);
                }
            }
            window.quickslotAssignedItems = assigned;
            window.__quickslotReservedItems = reserved;
        } catch (e) {}

        let maxSlot = -1;
        for (let i = 0; i < hasSlot.length; i++) {
            if (hasSlot[i] && slotKeyByIndex[i] !== null && slotKeyByIndex[i] !== undefined) maxSlot = i;
        }
        const slotCount = maxSlot >= 0 ? (maxSlot + 1) : 0;

        const used = new Set();
        try {
            const reserved = Array.isArray(window.__quickslotReservedItems) ? window.__quickslotReservedItems : [];
            for (const it of reserved) used.add(it);
        } catch (e) {}
        
        // Recopilar items que NO están en el layout (items realmente nuevos)
        const unusedItems = [];
        if (Array.isArray(items) && items.length > 0) {
            for (const it of items) {
                if (!it || used.has(it)) continue;
                
                // Verificar si este item está en el layout
                const k = itemBaseKey(it);
                let inLayout = false;
                if (k && layout && layout.length > 0) {
                    for (let i = 0; i < layout.length; i++) {
                        const entry = layout[i];
                        let entryKey = null;
                        if (entry && typeof entry === 'object' && ('slot' in entry)) {
                            const v = ('itemId' in entry) ? entry.itemId : (('id' in entry) ? entry.id : (('name' in entry) ? entry.name : null));
                            entryKey = (v === undefined || v === null) ? null : String(v);
                        } else if (entry !== undefined && entry !== null && entry !== false) {
                            entryKey = String(entry);
                        }
                        
                        if (entryKey === k) {
                            inLayout = true;
                            break;
                        }
                    }
                }
                
                if (!inLayout) {
                    unusedItems.push(it);
                }
            }
        }
        
        let domIndex = 0;
        let unusedIndex = 0;
        
        if (slotCount > 0) {
            for (let s = 0; s < slotCount; s++) {
                const key = hasSlot[s] ? slotKeyByIndex[s] : null;
                if (key) {
                    const list = itemsByKey.get(key);
                    let it = null;
                    if (list && list.length) {
                        let desiredMeta = (hasSlot[s] && slotMetaByIndex[s] !== undefined && slotMetaByIndex[s] !== null)
                            ? String(slotMetaByIndex[s]).trim()
                            : null;
                        if (desiredMeta === '') desiredMeta = null;
                        if (desiredMeta) {
                            for (let j = 0; j < list.length; j++) {
                                if (itemMetaHash(list[j]) === desiredMeta) {
                                    it = list.splice(j, 1)[0];
                                    break;
                                }
                            }
                        }
                        if (!it) it = list.shift();
                    }
                    if (it) {
                        const count = it.count;
                        const limit = it.limit;
                        const group = getItemResolvedGroup(it);
                        loadInventoryItems(it, domIndex, group, count, limit);
                        loadInventoryWeapons(it, domIndex, group);
                        addData(domIndex, it);
                        used.add(it); // CRITICAL: Mark as used to prevent duplication
                        divAmount++;
                        domIndex++;
                    } else if (unusedIndex < unusedItems.length) {
                        // Slot en el layout de un item que ya no existe: colocar item nuevo si hay disponibles
                        const newIt = unusedItems[unusedIndex];
                        const count = newIt.count;
                        const limit = newIt.limit;
                        const group = getItemResolvedGroup(newIt);
                        loadInventoryItems(newIt, domIndex, group, count, limit);
                        loadInventoryWeapons(newIt, domIndex, group);
                        addData(domIndex, newIt);
                        used.add(newIt);
                        divAmount++;
                        domIndex++;
                        unusedIndex++;
                    }
                    // Si el item fue movido o eliminado y no hay item nuevo, NO se crea casilla vacía
                } else if (unusedIndex < unusedItems.length) {
                    const newIt = unusedItems[unusedIndex];
                    const count = newIt.count;
                    const limit = newIt.limit;
                    const group = getItemResolvedGroup(newIt);
                    loadInventoryItems(newIt, domIndex, group, count, limit);
                    loadInventoryWeapons(newIt, domIndex, group);
                    addData(domIndex, newIt);
                    used.add(newIt);
                    divAmount++;
                    domIndex++;
                    unusedIndex++;
                }
                // Si el slot está vacío y no hay item nuevo, NO se crea casilla vacía
                slotCountRendered++;
            }
        }

        // Añadir items restantes que no cupieron en el layout
        while (unusedIndex < unusedItems.length) {
            const newIt = unusedItems[unusedIndex];
            const count = newIt.count;
            const limit = newIt.limit;
            const group = getItemResolvedGroup(newIt);
            loadInventoryItems(newIt, domIndex, group, count, limit);
            loadInventoryWeapons(newIt, domIndex, group);
            addData(domIndex, newIt);
            used.add(newIt);
            divAmount++;
            domIndex++;
            slotCountRendered++;
            unusedIndex++;
        }
    } catch(e) {
        slotCountRendered = 0;
        divAmount = 0;
        if (items && items.length > 0) {
            for (const [index, item] of items.entries()) {
                if (item) {
                    const count = item.count;
                    const limit = item.limit;
                    const group = getItemResolvedGroup(item);
                    loadInventoryItems(item, index, group, count, limit);
                    loadInventoryWeapons(item, index, group);
                    addData(index, item);
                    divAmount++;
                    slotCountRendered++;
                }
            }
        }
    }

    const gunbelt_item = "gunbelt";
    const gunbelt_label = LANGUAGE.gunbeltlabel;
    const gunbelt_desc = LANGUAGE.gunbeltdescription;
    var data = [];

    let empty = true;
    if (allplayerammo) {
        for (const [ind, tab] of Object.entries(allplayerammo)) {
            if (tab > 0) {
                empty = false;
                data.push({
                    text: `${ammolabels[ind]} : ${tab}`,
                    action: function () {
                        giveammotoplayer(ind, tab);
                    },
                });
            }
        }
    }

    if (empty) {
        data.push({
            text: LANGUAGE.empty,
            action: function () { },
        });
    }

    if (Config.AddAmmoItem) {
        mainInventoryFixedItems(gunbelt_label, gunbelt_desc, gunbelt_item, data);
        $("#item-" + gunbelt_item).data("item", gunbelt_item);
        $("#item-" + gunbelt_item).data("inventory", "none");
    } else {
        $("#ammobox").contextMenu([data], {
            offsetX: 1,
            offsetY: 1,
        });

        $("#ammobox").hover(
            function () {
                $("#hint").show();
                document.getElementById("hint").innerHTML = gunbelt_label;
            },
            function () {
                $("#hint").hide();
                document.getElementById("hint").innerHTML = "";
            }
        );
    }

    isOpen = true;
    initDivMouseOver();
    const m_item = "money";
    const m_label = LANGUAGE.inventorymoneylabel;
    const m_desc = LANGUAGE.inventorymoneydescription;

    var data = [];

    data.push({
        text: LANGUAGE.givemoney,
        action: function () {
            giveGetHowManyMoney();
        },
    });

    data.push({
        text: LANGUAGE.dropmoney,
        action: function () {
            dropGetHowMany(m_item, "item_money", "asd", 0);
        },
    });

    

    // COMENTADO: Item fijo de cash ocultado porque ahora el dinero es un item del inventario
    // if (Config.AddDollarItem) {
    //     mainInventoryFixedItems(m_label, m_desc, m_item, data);
    //     $("#item-" + m_item).data("item", m_item);
    //     $("#item-" + m_item).data("inventory", "none");
    // } else {
    if (true) { // Siempre usar el comportamiento del else (sin item fijo)
        $("#cash").contextMenu([data], {
            offsetX: 1,
            offsetY: 1,
        });

        $("#cash").hover(
            function () {
                $("#money-value").hide();
                $("#hint-money-value").show();
                $("#hint-money-value").text(m_label);
            },
            function () {
                $("#money-value").show();
                $("#hint-money-value").hide();
            }
        );
    }

    isOpen = true;
    initDivMouseOver();

    if (Config.UseGoldItem) {
        //AddGold
        const g_item = "gold";
        const g_label = LANGUAGE.inventorygoldlabel;
        const g_desc = LANGUAGE.inventorygolddescription;

        let data = [];

        data.push({
            text: LANGUAGE.givegold,
            action: function () {
                giveGetHowManyGold();
            },
        });

        data.push({
            text: LANGUAGE.dropgold,
            action: function () {
                dropGetHowMany(g_item, "item_gold", "asd", 0);
            },
        });

        // COMENTADO: Item fijo de gold ocultado porque ahora el oro es un item del inventario
        // if (Config.AddGoldItem) {
        //     mainInventoryFixedItems(g_label, g_desc, g_item, data);
        //     $("#item-" + g_item).data("item", g_item);
        //     $("#item-" + g_item).data("inventory", "none");
        // } else {
        if (true) { // Siempre usar el comportamiento del else (sin item fijo)
            $("#gold").contextMenu([data], {
                offsetX: 1,
                offsetY: 1,
            });

            $("#gold").hover(
                function () {
                    $("#gold-value").hide();
                    $("#hint-gold-value").show();
                    $("#hint-gold-value").text(g_label);
                },
                function () {
                    $("#gold-value").show();
                    $("#hint-gold-value").hide();
                }
            );
        }

        isOpen = true;
        initDivMouseOver();
    }

    // Activar o desactivar reordenación según el modo actual
    if (window.inventoryMoveEnabled) {
        deactivateMainInventoryReorder();
    } else {
        activateMainInventoryReorder();
    }

    // Actualizar cache y persistencia de layout limpio (eliminando items transferidos o inexistentes)
    try {
        rebuildMainItemsCache();
    } catch (e) {}

    // Re-aplicar filtro de la categoría activa actual
    try {
        const cat = window.currentActiveCategory || 'all';
        const actionsMap = window.Actions || DEFAULT_ACTIONS_CONFIG;
        if (actionsMap && actionsMap[cat]) {
            showItemsByType(actionsMap[cat].types, 'inventoryElement');
        }
    } catch (e) {}
}


function activateMainInventoryReorder() {
    if (typeof window.type === 'undefined' || window.type === 'main') {
        $("#inventoryElement .item").each(function(){
            try { $(this).draggable("destroy"); } catch(e) {}
            try { $(this).droppable("destroy"); } catch(e) {}
        });

        $("#inventoryElement .item[data-inventory='main']").draggable({
            helper: 'clone',
            appendTo: 'body',
            zIndex: 99999,
            revert: 'invalid',
            start: function () { try { window.stopTooltip = true; } catch(e) {} },
            stop: function () { try { window.stopTooltip = false; } catch(e) {} }
        });

        $("#inventoryElement .item").droppable({
            accept: "#inventoryElement .item[data-inventory='main'], #quickslotHud .qs-slot.qs-draggable",
            tolerance: "pointer",
            greedy: true,
            drop: function (_, ui) {
                const $source = $(ui.draggable);
                const $target = $(this);
                if ($source[0] === $target[0]) return;
                try {
                    const tid = $target.attr('id');
                    if (tid && String(tid).startsWith('item-')) {
                        const suffix = String(tid).slice(5);
                        if (suffix && !/^\d+$/.test(suffix)) return;
                    }
                } catch(e) {}

                const fromQuickslot = ($source && $source.length && $source.hasClass('qs-slot') && $source.closest('#quickslotHud').length > 0);
                if (fromQuickslot) {
                    const qsIdx = Number($source.attr('data-index'));
                    try { moveQuickslotItemToMainSlot(qsIdx, $target); } catch (e) {}
                    return;
                }

                const targetIsEmpty = ($target.data('group') === 0) || !$target.data('item') || $target.data('inventory') === undefined || $target.data('inventory') === 'none';

                if (targetIsEmpty) {
                    swapElements($source, $target);
                } else {
                    swapElements($source, $target);
                }

                rebuildMainItemsCache();
            }
        });

        // Permitir soltar directamente en el fondo del inventario o ventana principal
        $("#inventoryElement, #inventoryHud").each(function () {
            try { $(this).droppable("destroy"); } catch (e) {}
        });
        $("#inventoryElement, #inventoryHud").droppable({
            accept: "#quickslotHud .qs-slot.qs-draggable",
            tolerance: "pointer",
            greedy: false,
            drop: function (event, ui) {
                const $source = $(ui.draggable);
                const fromQuickslot = ($source && $source.length && $source.hasClass('qs-slot') && $source.closest('#quickslotHud').length > 0);
                if (fromQuickslot) {
                    const qsIdx = Number($source.attr('data-index'));
                    try { moveQuickslotItemToMainSlot(qsIdx, null); } catch (e) {}
                }
            }
        });
    }
}

function deactivateMainInventoryReorder(){
    $("#inventoryElement .item").each(function(){
        try { $(this).draggable("destroy"); } catch(e) {}
        try { $(this).droppable("destroy"); } catch(e) {}
    });
}

function swapElements($a, $b) {
    const $placeholder = $('<div class="swap-placeholder" style="display:none;"></div>');
    $a.before($placeholder);
    $b.before($a);
    $placeholder.replaceWith($b);
}

function rebuildMainItemsCache() {
    try {
        const preservedQuick = getQuickslotLayoutEntries(window.mainItemsLayout);
        const newOrder = [];
        const layout = [];
        let slotIndex = 0;
        $("#inventoryElement .item").each(function () {
            const id = this && this.id ? String(this.id) : "";
            if (id.startsWith("item-")) {
                const suffix = id.slice(5);
                if (suffix && !/^\d+$/.test(suffix)) {
                    return;
                }
            }
            const $el = $(this);
            const data = $el.data('item');
            const inv = $el.data('inventory');
            if (data && inv === 'main') {
                newOrder.push(data);
                const itemId = (data.id !== undefined && data.id !== null && data.id !== 0) ? data.id : (data.name ?? null);
                const meta = itemMetaHash(data);
                layout.push({ slot: slotIndex, itemId: itemId, meta: meta });
                slotIndex++;
            }
        });
        for (const e of preservedQuick) layout.push(e);
        window.mainItems = newOrder;
        window.mainItemsLayout = layout;
        try { updateQuickslotHudFromMain(); } catch (e3) { /* noop */ }
        try {
            const res = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'vorp_inventory';
            $.post(`https://${res}/SaveInventoryLayout`, JSON.stringify({ layout: layout }));
        } catch (e2) { /* post noop */ }
    } catch (e) { /* noop */ }
}


function useSlotElement($slot) {
    try {
        const item = $slot.data('item');
        if (!item) return;
        if ($slot.data('inventory') !== 'main') return;

        const id = item?.id ?? item?.name;
        const now = Date.now();
        const spamDelay = (window.Config?.SpamDelay ?? 5000);
        const until = (window.uiUseCooldownUntil ?? 0);
        if (now < until) {
            return; 
        }

        if (item.used || item.used2) {
            $slot.find('.equipped-icon').hide();
            $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                item: item.name,
                id: item.id,
            }));
        } else {
            if (item.type === "item_weapon") {
                $slot.find('.equipped-icon').show();
            }
            $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                item: item.name,
                type: item.type,
                hash: item.hash,
                amount: item.count,
                id: item.id,
            }));
        }
        window.uiUseCooldownUntil = now + spamDelay;
    } catch (e) { /* noop */ }
}


$(document).on('keydown.inventoryHotkeys', function (e) {

    if ($(e.target).is('input, textarea')) return;

  
    if (typeof isOpen !== 'undefined' && !isOpen) return;

    const key = e.key;
    const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (!(key in map)) return;

    const idx = map[key];
    e.preventDefault();
    const entry = getQuickslotEntry(window.mainItemsLayout, idx);
    const assigned = window.quickslotAssignedItems || {};
    const item = assigned[String(idx)] || findItemForQuickslotEntry(entry);
    if (!item) return;
    try {
        const now = Date.now();
        const spamDelay = (window.Config?.SpamDelay ?? 5000);
        const until = (window.uiUseCooldownUntil ?? 0);
        if (now < until) return;
        if (item.used || item.used2) {
            $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                item: item.name,
                id: item.id,
            }));
        } else {
            $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                item: item.name,
                type: item.type,
                hash: item.hash,
                amount: item.count,
                id: item.id,
            }));
        }
        window.uiUseCooldownUntil = now + spamDelay;
    } catch(e) { /* noop */ }
});

function useQuickslotIndex(idx) {
    try {
        const entry = getQuickslotEntry(window.mainItemsLayout, idx);
        const assigned = window.quickslotAssignedItems || {};
        const item = assigned[String(idx)] || findItemForQuickslotEntry(entry);
        if (!item) return;
        const now = Date.now();
        const spamDelay = (window.Config?.SpamDelay ?? 5000);
        const until = (window.uiUseCooldownUntil ?? 0);
        if (now < until) return;
        if (item.used || item.used2) {
            $.post(`https://${GetParentResourceName()}/UnequipWeapon`, JSON.stringify({
                item: item.name,
                id: item.id,
            }));
        } else {
            $.post(`https://${GetParentResourceName()}/UseItem`, JSON.stringify({
                item: item.name,
                type: item.type,
                hash: item.hash,
                amount: item.count,
                id: item.id,
            }));
        }
        window.uiUseCooldownUntil = now + spamDelay;
    } catch (e) { /* noop */ }
}


function updateQuickslotHudFromMain() {
    try {
        const slots = document.querySelectorAll('#quickslotHud .qs-slot');
        for (let i = 0; i < 5; i++) {
            const el = slots[i];
            if (!el) continue;
            const entry = getQuickslotEntry(window.mainItemsLayout, i);
            const assigned = window.quickslotAssignedItems || {};
            const item = assigned[String(i)] || findItemForQuickslotEntry(entry);
            const countEl = el.querySelector('.qs-count');
            const itemImageEl = el.querySelector('.qs-item-image'); // Get the item image element
            
            if (item) {
                try { $(el).data('qsItem', item); } catch (e) {}
                let raw = null;
                if (item.type !== "item_weapon") {
                    try {
                        const meta = getItemMetadataInfo(item, false);
                        raw = meta.image;
                    } catch (e) {
                        raw = item?.metadata?.image || item?.name || null;
                    }
                } else {
                    raw = item?.name || null;
                }

                const key = (raw || 'placeholder').toString().trim();
                const isCssUrl = /^url\(/i.test(key);
                const isPathLike = /^(https?:\/\/|img\/|\.?\/|\/)/i.test(key);
                const hasExt = /\.(png|jpg|jpeg|webp|gif)$/i.test(key);
                if (!isCssUrl && !isPathLike && !hasExt && key && !imageCache[key]) {
                    try { preloadImages([key]); } catch (e) {}
                }
                let url;
                if (isCssUrl) url = key;
                else if (hasExt) url = `url("${/[\\/]/.test(key) ? key : `img/items/${key}`}")`;
                else if (isPathLike) url = `url("${key}")`;
                else url = imageCache[key] || `url("img/items/${key}.png")`;
                
                // Set image on the item image element, not the slot
                if (itemImageEl) itemImageEl.style.backgroundImage = url;
                if (countEl) countEl.textContent = '';
            } else {
                // Clear item image when no item
                if (itemImageEl) itemImageEl.style.backgroundImage = 'none';
                if (countEl) countEl.textContent = '';
                try { $(el).removeData('qsItem'); } catch (e) {}
            }
        }
        try { initQuickslotHudDrag(); } catch (eDrag) {}
    } catch (e) { /* noop */ }
}

window.quickslotHudVisible = window.quickslotHudVisible || false;
function setQuickslotHudVisible(visible) {
    const hud = document.getElementById('quickslotHud');
    if (!hud) return;
    window.quickslotHudVisible = !!visible;
    
    // Cancelar cualquier timeout pendiente de animación anterior
    if (window.quickslotAnimTimeout) {
        clearTimeout(window.quickslotAnimTimeout);
        window.quickslotAnimTimeout = null;
    }
    
    if (window.quickslotHudVisible) {
        hud.style.display = 'grid';
        try {
            hud.classList.remove('qs-animate-enter', 'qs-animate-exit');
            void hud.offsetWidth; // reflow para reiniciar animación
            hud.classList.add('qs-animate-enter');
            
            // No remover la clase hasta que terminen TODAS las animaciones de los slots
            // La animación más larga es del último slot: delay 1.2s + duration 1.2s = 2.4s
            window.quickslotAnimTimeout = setTimeout(() => {
                hud.classList.remove('qs-animate-enter');
                window.quickslotAnimTimeout = null;
            }, 2500); // 2.5s para asegurar que todas las animaciones terminen
        } catch (e) { /* noop */ }
        updateQuickslotHudFromMain();
    } else {
        // Animación de salida antes de ocultar
        hud.classList.remove('qs-animate-enter');
        hud.classList.add('qs-animate-exit');
        
        // Esperar a que termine la animación de salida completa
        // Slots terminan en 2.4s, luego background empieza y dura 0.3s = 2.7s total
        window.quickslotAnimTimeout = setTimeout(() => {
            hud.style.display = 'none';
            hud.classList.remove('qs-animate-exit');
            window.quickslotAnimTimeout = null;
        }, 2800); // 2.8s para asegurar que todo termine
    }
}

function ensureQuickslotHudInteractiveStyles() {
    try {
        if (document.getElementById('qs-interactive-styles')) return;
        const style = document.createElement('style');
        style.id = 'qs-interactive-styles';
        style.textContent = `#quickslotHud.qs-interactive{pointer-events:auto;}`;
        document.head.appendChild(style);
    } catch (e) {}
}

function ensureMoveModeStyles() {
    try {
        if (document.getElementById('move-mode-styles')) return;
        const style = document.createElement('style');
        style.id = 'move-mode-styles';
        style.textContent = `
            #inventoryElement .item.move-target{outline:2px dashed #DC143C; box-shadow:0 0 0 2px rgba(220,20,60,.25) inset; cursor:pointer;}
            #inventoryElement .item.move-source{outline:2px solid #DC143C;}
            #quickslotHud .qs-slot.move-target{outline:2px dashed #DC143C; box-shadow:0 0 0 2px rgba(220,20,60,.25) inset; cursor:pointer;}
            #quickslotHud .qs-slot.move-source{outline:2px solid #DC143C;}
            #quickslotHud.qs-interactive{pointer-events:auto;}
        `;
        document.head.appendChild(style);
    } catch (e) {}
}

function setQuickslotHudInteractive(interactive) {
    try {
        ensureQuickslotHudInteractiveStyles();
        const $hud = $('#quickslotHud');
        if (!$hud.length) return;
        if (interactive) $hud.addClass('qs-interactive');
        else $hud.removeClass('qs-interactive');
    } catch (e) {}
}

function isMainInventoryFixedMode() {
    try {
        const fixed = !window.inventoryMoveEnabled;
        if (!fixed) return false;
        try {
            if (typeof type !== 'undefined' && type && type !== 'main') return false;
        } catch (e) {}
        return true;
    } catch (e) {
        return false;
    }
}

function isMainInventoryActuallyOpen() {
    try {
        if (typeof isOpen !== 'undefined' && !!isOpen) return true;
    } catch (e) {}
    try {
        const $hud = $("#inventoryHud");
        if ($hud.length && $hud.is(":visible")) return true;
    } catch (e) {}
    return false;
}

window.quickslotMoveMode = window.quickslotMoveMode || { active: false, slotIndex: null, item: null };
function cancelQuickslotMoveMode() {
    try {
        window.quickslotMoveMode.active = false;
        window.quickslotMoveMode.slotIndex = null;
        window.quickslotMoveMode.item = null;
        $("#inventoryElement .item").removeClass('move-target');
        $("#quickslotHud .qs-slot").removeClass('move-source');
    } catch (e) {}
}

function upsertMainSlotEntry(layoutArr, slotIndex, item) {
    const slot = Number(slotIndex);
    if (!Number.isFinite(slot) || slot < 0) return layoutArr;
    if (!Array.isArray(layoutArr)) layoutArr = [];
    const itemId = (item && item.id !== undefined && item.id !== null && item.id !== 0) ? item.id : (item?.name ?? null);
    const meta = item ? itemMetaHash(item) : null;
    let found = false;
    for (let i = 0; i < layoutArr.length; i++) {
        const e = layoutArr[i];
        if (!e || typeof e !== 'object') continue;
        const s = Number(e.slot);
        if (!Number.isNaN(s) && s === slot) {
            layoutArr[i] = { slot, itemId, meta };
            found = true;
            break;
        }
    }
    if (!found) layoutArr.push({ slot, itemId, meta });
    return layoutArr;
}

function startQuickslotMoveToInventory(slotIndex) {
    try {
        if (!isMainInventoryActuallyOpen()) return;
        if (!isMainInventoryFixedMode()) return;
        ensureMoveModeStyles();
        try { window.cancelMoveMode(); } catch (e) {}
        cancelQuickslotMoveMode();

        const idx = Number(slotIndex);
        if (Number.isNaN(idx) || idx < 0 || idx > 4) return;
        const entry = getQuickslotEntry(window.mainItemsLayout, idx);
        const assigned = window.quickslotAssignedItems || {};
        const item = assigned[String(idx)] || findItemForQuickslotEntry(entry);
        if (!item) return;

        window.quickslotMoveMode.active = true;
        window.quickslotMoveMode.slotIndex = idx;
        window.quickslotMoveMode.item = item;

        $("#quickslotHud .qs-slot").removeClass('move-source');
        $(`#quickslotHud .qs-slot[data-index='${idx}']`).addClass('move-source');

        $("#inventoryElement .item").each(function () {
            const $t = $(this);
            const inv = $t.data('inventory');
            if (inv === 'none') return;
            $t.addClass('move-target');
        });
    } catch (e) {}
}

function ensureNumericItemElementId($el) {
    try {
        const current = ($el && $el.attr) ? String($el.attr('id') || '') : '';
        if (/^item-\d+$/.test(current)) return Number(current.slice(5));
        let next = Number(window.__qsTempDomIdCounter || 0);
        if (!Number.isFinite(next) || next <= 0) {
            next = 0;
            $("#inventoryElement .item").each(function () {
                const id = String(this.id || '');
                if (!id.startsWith('item-')) return;
                const suffix = id.slice(5);
                if (!/^\d+$/.test(suffix)) return;
                const n = Number(suffix);
                if (Number.isFinite(n) && n > next) next = n;
            });
            next++;
        }
        const id = `item-${next}`;
        try { $el.attr('id', id); } catch (e) {}
        window.__qsTempDomIdCounter = next + 1;
        return next;
    } catch (e) {
        return null;
    }
}

function renderItemIntoExistingMainSlot($slot, item) {
    try {
        if (!$slot || !$slot.length || !item) return null;
        clearMainSlotEl($slot);

        const group = item.type !== "item_weapon" ? (!item.group ? 1 : item.group) : 5;
        if (item.type === "item_weapon") {
            const weight = getItemWeight(item.weight, 1);
            const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.serial ?? "Serial: ") + item.serial_number : "";
            const url = imageCache[item.name] || `url("img/items/${item.name}.png")`;
            const label = item.custom_label ? item.custom_label : item.label;
            $slot.attr('data-label', label);
            $slot.attr('data-tooltip', String(weight + info));
            $slot.attr('data-group', String(group));
            $slot.css('background-image', url);
            $slot.css('background-size', '4.5vw 7.7vh');
            $slot.css('background-repeat', 'no-repeat');
            $slot.css('background-position', 'center');
            $slot.append(`<div class='equipped-icon' style='display: ${!item.used && !item.used2 ? "none" : "block"};'></div>`);
        } else {
            const { tooltipData, degradation, image, label, weight } = getItemMetadataInfo(item, false);
            const count = item.count;
            const limit = item.limit;
            const itemWeight = getItemWeight(weight, count);
            const groupKey = getGroupKey(group);
            const { tooltipContent, url } = getItemTooltipContent(image, groupKey, group, limit, itemWeight, degradation, tooltipData);
            const imageOpacity = getItemDegradationPercentage(item) === 0 ? 0.5 : 1;
            $slot.attr('data-label', label);
            $slot.attr('data-tooltip', String(tooltipContent));
            $slot.attr('data-group', String(group));
            $slot.css('background-image', url);
            $slot.css('background-size', '4.5vw 7.7vh');
            $slot.css('background-repeat', 'no-repeat');
            $slot.css('background-position', 'center');
            $slot.css('opacity', String(imageOpacity));
            $slot.append(`<div class='count'><span style='color:Black'>${count}</span></div>`);
        }

        const domIdx = ensureNumericItemElementId($slot);
        if (domIdx == null) return null;
        try { addData(domIdx, item); } catch (e) {}
        return domIdx;
    } catch (e) {
        return null;
    }
}

function moveQuickslotItemToMainSlot(slotIndex0to3, $target) {
    try {
        if (!isMainInventoryActuallyOpen()) return;
        const qsIdx = Number(slotIndex0to3);
        if (Number.isNaN(qsIdx) || qsIdx < 0 || qsIdx > 4) return;

        let item = null;
        try {
            const $qs = $(`#quickslotHud .qs-slot[data-index='${qsIdx}']`);
            item = ($qs && $qs.length) ? $qs.data('qsItem') : null;
        } catch (e) {}
        if (!item) {
            const entry = getQuickslotEntry(window.mainItemsLayout, qsIdx);
            const assigned = window.quickslotAssignedItems || {};
            item = assigned[String(qsIdx)] || findItemForQuickslotEntry(entry);
        }
        if (!item) return;

        // Liberar slot de quickslot en layout y cache asignado
        window.mainItemsLayout = upsertQuickslotEntry(window.mainItemsLayout, qsIdx, null);
        try {
            const assigned = window.quickslotAssignedItems || {};
            delete assigned[String(qsIdx)];
            window.quickslotAssignedItems = assigned;
        } catch (e) {}

        // Determinar índice objetivo si se soltó sobre un slot específico del inventario
        let targetSlotIndex = -1;
        if ($target && $target.length && $target.hasClass('item') && $target.closest('#inventoryElement').length) {
            targetSlotIndex = $("#inventoryElement .item").index($target[0]);
        }

        if (targetSlotIndex >= 0) {
            // Desplazar slots hacia la derecha para insertar en la posición exacta
            if (Array.isArray(window.mainItemsLayout)) {
                for (let i = 0; i < window.mainItemsLayout.length; i++) {
                    const e = window.mainItemsLayout[i];
                    if (e && typeof e === 'object' && ('slot' in e)) {
                        const s = Number(e.slot);
                        if (!Number.isNaN(s) && s >= targetSlotIndex) {
                            e.slot = s + 1;
                        }
                    }
                }
            }
            window.mainItemsLayout = upsertMainSlotEntry(window.mainItemsLayout, targetSlotIndex, item);
        } else {
            // Si se soltó en espacio vacío del inventario, colocar al final del layout
            let maxSlot = -1;
            if (Array.isArray(window.mainItemsLayout)) {
                for (const e of window.mainItemsLayout) {
                    if (e && typeof e === 'object' && ('slot' in e)) {
                        const s = Number(e.slot);
                        if (!Number.isNaN(s) && s > maxSlot) maxSlot = s;
                    }
                }
            }
            const nextSlot = maxSlot >= 0 ? maxSlot + 1 : 0;
            window.mainItemsLayout = upsertMainSlotEntry(window.mainItemsLayout, nextSlot, item);
        }

        // Persistir layout en servidor
        postSaveInventoryLayout(window.mainItemsLayout);

        // Reconstruir lista completa y refrescar inventario principal visualmente
        const full = buildItemsForInventorySetup([item]);
        window.mainItems = full;
        inventorySetup(full);

        // Limpiar estados de movimiento y refrescar HUD de quickslots
        try { $("#quickslotHud .qs-slot").removeClass('move-source'); } catch (e) {}
        cancelQuickslotMoveMode();
        try { updateQuickslotHudFromMain(); } catch (e2) {}
        try { initQuickslotHudDrag(); } catch (e3) {}
        try { initQuickslotHudDrop(); } catch (e4) {}
    } catch (e) {
        console.error('[VORP Inventory] Error in moveQuickslotItemToMainSlot:', e);
    }
}

$(document).on('click', '#inventoryElement .item', function (ev) {
    if (!(window.quickslotMoveMode && window.quickslotMoveMode.active)) return;
    const $t = $(this);
    if (!$t.hasClass('move-target')) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
        const idx = Number(window.quickslotMoveMode.slotIndex);
        const item = window.quickslotMoveMode.item;
        if (!item) { cancelQuickslotMoveMode(); return; }
        moveQuickslotItemToMainSlot(idx, $t);
    } catch (e) {
        cancelQuickslotMoveMode();
    }
});

$(document).on('keydown', function (ev) {
    try {
        if (window.quickslotMoveMode && window.quickslotMoveMode.active && (ev.key === 'Escape' || ev.key === 'Esc')) {
            ev.preventDefault();
            cancelQuickslotMoveMode();
        }
    } catch (e) {}
});

try {
    $(document)
        .off('contextmenu.qsMove', '#quickslotHud .qs-slot')
        .on('contextmenu.qsMove', '#quickslotHud .qs-slot', function (ev) {
            try {
                if (!isMainInventoryActuallyOpen()) return;
                if (!isMainInventoryFixedMode()) return;
                ev.preventDefault();
                ev.stopPropagation();
                const idx = Number($(this).attr('data-index'));
                startQuickslotMoveToInventory(idx);
                try {
                    if (!(window.quickslotMoveMode && window.quickslotMoveMode.active)) {
                        setTimeout(function () {
                            try { startQuickslotMoveToInventory(idx); } catch (e) {}
                        }, 75);
                    }
                } catch (e) {}
            } catch (e) {}
        });
} catch (e) {}

function itemDedupKey(it) {
    try {
        if (!it) return null;
        if (it.id !== undefined && it.id !== null && it.id !== 0) return `id:${String(it.id)}`;
        const base = itemBaseKey(it) ?? '';
        const meta = itemMetaHash(it) ?? '';
        const sn = it.serial_number ?? '';
        return `k:${String(base)}|m:${String(meta)}|sn:${String(sn)}`;
    } catch (e) {
        return null;
    }
}

function buildItemsForInventorySetup(extraItems) {
    const out = [];
    const seen = new Set();
    const pushUnique = (it) => {
        if (!it) return;
        const k = itemDedupKey(it) || `ref:${String(out.length)}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push(it);
    };
    try {
        const main = Array.isArray(window.mainItems) ? window.mainItems : [];
        for (const it of main) pushUnique(it);
    } catch (e) {}
    try {
        const assigned = window.quickslotAssignedItems || {};
        for (const k of Object.keys(assigned)) pushUnique(assigned[k]);
    } catch (e) {}
    try {
        if (Array.isArray(extraItems)) {
            for (const it of extraItems) pushUnique(it);
        }
    } catch (e) {}
    return out;
}

function postSaveInventoryLayout(layout) {
    try {
        const res = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'vorp_inventory';
        $.post(`https://${res}/SaveInventoryLayout`, JSON.stringify({ layout: layout }));
    } catch (e) {}
}

function moveQuickslotToInventory(slotIndex) {
    try {
        const idx = Number(slotIndex);
        if (Number.isNaN(idx) || idx < 0 || idx > 4) return;
        if (!isMainInventoryActuallyOpen()) return;
        if (!isMainInventoryFixedMode()) return;
        const entry = getQuickslotEntry(window.mainItemsLayout, idx);
        const assigned = window.quickslotAssignedItems || {};
        const item = assigned[String(idx)] || findItemForQuickslotEntry(entry);
        if (!item) return;

        window.mainItemsLayout = upsertQuickslotEntry(window.mainItemsLayout, idx, null);
        try { delete assigned[String(idx)]; } catch (e) {}
        window.quickslotAssignedItems = assigned;

        postSaveInventoryLayout(window.mainItemsLayout);
        try { updateQuickslotHudFromMain(); } catch (e) {}

        if (typeof isOpen !== 'undefined' && !!isOpen) {
            const full = buildItemsForInventorySetup([item]);
            window.mainItems = full;
            inventorySetup(full);
            try { updateQuickslotHudFromMain(); } catch (e2) {}
        }
    } catch (e) {}
}

function bindQuickslotHudContextMenu(forceRebind) {
    try {
        ensureQuickslotHudInteractiveStyles();
        const $slots = $('#quickslotHud .qs-slot');
        if (!$slots.length) return;
        $slots.each(function () {
            const $slot = $(this);
            if (!forceRebind && $slot.data('__qs_cm_bound')) return;
            const slotIdx = Number($slot.attr('data-index'));
            $slot.data('__qs_cm_bound', true);
            $slot.contextMenu([[{
                text: (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.movetoinventory) ? LANGUAGE.movetoinventory : 'Mover al inventario',
                action: function () {
                    moveQuickslotToInventory(slotIdx);
                }
            }]], { offsetX: 1, offsetY: 1 });
        });
    } catch (e) {}
}

function initQuickslotHudDrop() {
    try {
        bindQuickslotHudContextMenu(false);
        const $slots = $('#quickslotHud .qs-slot');
        if (!$slots.length) return;
        $slots.each(function () {
            try { $(this).droppable('destroy'); } catch (e) {}
        });
        $slots.droppable({
            accept: "#inventoryElement .item[data-inventory='main']",
            tolerance: "pointer",
            over: function () {
                try { this.style.outline = '2px dashed #DC143C'; } catch (e) {}
            },
            out: function () {
                try { this.style.outline = ''; } catch (e) {}
            },
            drop: function (_, ui) {
                try { this.style.outline = ''; } catch (e) {}
                if (!window.quickslotHudVisible) return;
                const slotIndex = Number($(this).data('index'));
                if (Number.isNaN(slotIndex) || slotIndex < 0) return;
                const $source = $(ui.draggable);
                if (!$source || !$source.length) return;
                if ($source.data('inventory') !== 'main') return;
                const item = $source.data('item');
                if (!item) return;
                
                // Actualizar el layout y asignar el item al quickslot
                window.mainItemsLayout = upsertQuickslotEntry(window.mainItemsLayout, slotIndex, item);
                try {
                    window.quickslotAssignedItems = window.quickslotAssignedItems || {};
                    window.quickslotAssignedItems[String(slotIndex)] = item;
                } catch (e) {}
                
                // Limpiar el slot del inventario principal
                clearMainSlotEl($source);
                
                // Reconstruir el caché de items
                rebuildMainItemsCache();
                
                // Reconstruir window.mainItems desde el layout actualizado
                try {
                    const rebuilt = buildItemsForInventorySetup([]);
                    window.mainItems = rebuilt;
                } catch (e) {}
                
                // Actualizar el inventario principal visualmente
                try {
                    if (typeof window.mainItems !== 'undefined' && Array.isArray(window.mainItems)) {
                        inventorySetup(window.mainItems);
                    }
                } catch (e) {}
                
                // Actualizar el quickslot HUD inmediatamente
                try {
                    updateQuickslotHudFromMain();
                } catch (e) {}
                
                try {
                    setTimeout(function () {
                        try { initQuickslotHudDrag(); } catch (e) {}
                    }, 0);
                } catch (e) {}
            }
        });
    } catch (e) {}
}
try { initQuickslotHudDrop(); } catch (e) {}

function initQuickslotHudDrag() {
    try {
        const $slots = $('#quickslotHud .qs-slot');
        if (!$slots.length) return;
        $slots.each(function () {
            try { $(this).draggable('destroy'); } catch (e) {}
            try { $(this).removeClass('qs-draggable'); } catch (e) {}
        });
        if (!isMainInventoryActuallyOpen()) return;
        ensureMoveModeStyles();
        $slots.each(function () {
            const $s = $(this);
            const item = $s.data('qsItem');
            if (!item) return;
            $s.addClass('qs-draggable');
            $s.draggable({
                helper: function () {
                    try {
                        const $orig = $(this);
                        // Get the item image from .qs-item-image instead of slot background
                        const $itemImage = $orig.find('.qs-item-image');
                        const bg = $itemImage.length ? $itemImage.css('background-image') : 'none';
                        const w = $orig.outerWidth();
                        const h = $orig.outerHeight();
                        const countText = ($orig.find('.qs-count').text() || '').trim();
                        const $helper = $('<div></div>');
                        $helper.css({
                            width: w,
                            height: h,
                            backgroundImage: bg,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: 'contain',
                            position: 'relative'
                        });
                        if (countText) {
                            const $c = $('<div></div>');
                            $c.text(countText);
                            $c.css({
                                position: 'absolute',
                                bottom: '-0.8vh',
                                right: '-0.8vh',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                fontSize: '1.6vh',
                                padding: '0 0.5vh',
                                borderRadius: '2px',
                                minWidth: '2vh',
                                textAlign: 'center',
                                pointerEvents: 'none'
                            });
                            $helper.append($c);
                        }
                        return $helper;
                    } catch (e) {
                        return $(this).clone();
                    }
                },
                appendTo: 'body',
                zIndex: 99999,
                revert: 'invalid',
                start: function () { try { window.stopTooltip = true; } catch (e) {} },
                stop: function () { try { window.stopTooltip = false; } catch (e) {} }
            });
        });
    } catch (e) {}
}

try { initQuickslotHudDrag(); } catch (e) {}


window.addEventListener('message', function (event) {
    const data = event && event.data || {};
    if (data.action === 'display' || data.action === 'show') {
        setQuickslotHudInteractive(true);
        try {
            bindQuickslotHudContextMenu(true);
            initQuickslotHudDrop();
            initQuickslotHudDrag();
        } catch (e) {}
        return;
    }
    if (data.action === 'hide') {
        $("#craftingMenu").fadeOut();
        setQuickslotHudInteractive(false);
        try {
            cancelQuickslotMoveMode();
            $('#quickslotHud .qs-slot').each(function () {
                try { $(this).removeData('__qs_cm_bound'); } catch (e) {}
            });
        } catch (e) {}
        return;
    }
    if (data.action === 'executeJS') {
        // Execute arbitrary JavaScript code sent from Lua
        try {
            if (data.js && typeof data.js === 'string') {
                eval(data.js);
            }
        } catch (e) {
            console.error('[VORP Inventory] Error executing JS:', e);
        }
        return;
    }
    if (data.action === 'setItems') {
        try {
            setQuickslotHudInteractive(true);
            bindQuickslotHudContextMenu(true);
            initQuickslotHudDrop();
            initQuickslotHudDrag();
        } catch (e) {}
        return;
    }
    if (data.action === 'useQuickSlot') {
        const idx = Number(data.index ?? -1);
        if (Number.isNaN(idx) || idx < 0) return;
        useQuickslotIndex(idx);
        return;
    }
    if (data.action === 'toggleQuickslotHud') {
        // No permitir cerrar el quickslot si el inventario principal está visualmente abierto
        const $invHud = $("#inventoryHud");
        if (window.quickslotHudVisible && $invHud.length && $invHud.is(":visible")) {
            // Inventario visualmente abierto, no permitir cerrar quickslot
            return;
        }
        setQuickslotHudVisible(!window.quickslotHudVisible);
        return;
    }
    if (data.action === 'setQuickslotHud') {
        // No permitir cerrar el quickslot si el inventario principal está visualmente abierto
        const $invHud = $("#inventoryHud");
        if (!data.visible && $invHud.length && $invHud.is(":visible")) {
            // Inventario visualmente abierto, no permitir cerrar quickslot
            return;
        }
        setQuickslotHudVisible(!!data.visible);
        return;
    }
});

function tryWrapInventoryMoveToggle() {
    try {
        if (window.__qsToggleWrapped) return true;
        if (typeof window.setInventoryMoveEnabled !== 'function') return false;
        window.__qsToggleWrapped = true;
        const __origSetInvMove = window.setInventoryMoveEnabled;
        window.setInventoryMoveEnabled = function (enabled) {
            const r = __origSetInvMove(enabled);
            try {
                if (isMainInventoryActuallyOpen() && isMainInventoryFixedMode()) {
                    setQuickslotHudInteractive(true);
                    bindQuickslotHudContextMenu(true);
                    initQuickslotHudDrop();
                    initQuickslotHudDrag();
                } else {
                    cancelQuickslotMoveMode();
                    setQuickslotHudInteractive(false);
                    initQuickslotHudDrag();
                }
            } catch (e) {}
            return r;
        };
        return true;
    } catch (e) {
        return false;
    }
}

try {
    if (!tryWrapInventoryMoveToggle()) {
        let __qsWrapTries = 0;
        const __qsWrapTimer = setInterval(function () {
            __qsWrapTries++;
            if (tryWrapInventoryMoveToggle() || __qsWrapTries > 80) {
                try { clearInterval(__qsWrapTimer); } catch (e) {}
            }
        }, 50);
    }
} catch (e) {}

// Refresco periódico cuando esté visible
try {
    if (!window.__qsHudRefreshInterval) {
        window.__qsHudRefreshInterval = setInterval(function() {
            if (window.quickslotHudVisible && typeof updateQuickslotHudFromMain === 'function') {
                updateQuickslotHudFromMain();
            }
        }, 1000);
    }
} catch (e) { /* noop */ }

/* Crafting Logic */
let craftingRecipes = [];

function toggleCraftingMenu() {
    const menu = $("#craftingMenu");
    if (menu.is(":visible")) {
        menu.fadeOut(200);
    } else {
        menu.fadeIn(200);
        renderCraftingList();
    }
}

function renderCraftingList() {
    const list = $("#craftingList");
    list.empty();
    
    craftingRecipes.forEach((recipe) => {
        let matsHtml = "";
        recipe.materials.forEach(mat => {
            matsHtml += `<div class="recipe-material">${mat.count}x ${mat.label}</div>`;
        });
        
        const html = `
            <div class="crafting-recipe">
                <div class="recipe-header">
                    <div class="recipe-info">
                        <div class="recipe-img" style="background-image: url(${recipe.image});"></div>
                        <div class="recipe-name">${recipe.label} (${recipe.craftAmount}x)</div>
                    </div>
                    <button class="recipe-btn" onclick="craftItem('${recipe.id}', ${recipe.craftTime})">CRAFTEAR</button>
                </div>
                <div class="recipe-materials">
                    ${matsHtml}
                </div>
            </div>
        `;
        list.append(html);
    });
}

function craftItem(recipeId, time) {
    // UI Feedback
    $("#crafting-transaction-loader").show();
    setTimeout(() => {
        $("#crafting-transaction-loader").hide();
    }, time);
    
    $.post("https://vorp_inventory/CraftItem", JSON.stringify({
        recipe: recipeId,
        time: time
    }));
}

window.addEventListener('message', function (event) {
    const data = event.data;
    if (data.action === "setCraftingRecipes") {
        craftingRecipes = data.recipes;
    } else if (data.action === "close") {
        $("#craftingMenu").hide();
    }
});
