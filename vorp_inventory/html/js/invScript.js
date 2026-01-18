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

function loadActionsConfig() {
    if (!actionsConfigLoaded) {
        actionsConfigLoaded = new Promise((resolve, reject) => {
            fetch(`https://${GetParentResourceName()}/getActionsConfig`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                }
            })
                .then(response => response.json())
                .then(actionsConfig => {
                    window.Actions = actionsConfig;
                    resolve(actionsConfig);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    return actionsConfigLoaded;
}

function generateActionButtons(actionsConfig, containerId, inventoryContext, buttonClass) {
    const basePath = "img/itemtypes/";
    const container = document.getElementById(containerId);

    if (container) {
        Object.keys(actionsConfig).forEach(key => {
            const action = actionsConfig[key];
            const button = document.createElement('button');
            button.className = buttonClass;
            button.type = 'button';
            button.setAttribute('data-type', 'itemtype');
            button.setAttribute('data-param', key);
            button.setAttribute('data-desc', action.desc);
            button.setAttribute('onclick', `action('itemtype', '${key}', '${inventoryContext}')`);

            const div = document.createElement('div');
            const img = document.createElement('img');
            img.src = basePath + action.img;
            img.alt = "Image";
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
            document.querySelectorAll('.dropdownButton[data-type="itemtype"]').forEach(btn => btn.classList.remove('active'));
            const activeButtonMain = document.querySelector(`.dropdownButton[data-param="${param}"][data-type="itemtype"]`);
            if (activeButtonMain) activeButtonMain.classList.add('active');
        } else if (inv === "secondInventoryElement") {
            document.querySelectorAll('.dropdownButton1').forEach(btn => {
                if (btn.getAttribute('data-type') === 'itemtype') btn.classList.remove('active');
            });
            const activeButtonSecond = document.querySelector(`.dropdownButton1[data-param="${param}"][data-type="itemtype"]`);
            if (activeButtonSecond) activeButtonSecond.classList.add('active');
        }
        if (param in Actions) {
            const action = Actions[param];
            showItemsByType(action.types, inv);
        } else {
            const defaultAction = Actions['all'];
            showItemsByType(defaultAction.types, inv);
        }
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
    let itemDiv = 0;
    let itemEmpty = 0;
    $(`#${inv} .item`).each(function () {
        const group = $(this).data("group");

        if (itemTypesToShow.length === 0 || itemTypesToShow.includes(group)) {
            if (group != 0) {
                itemDiv = itemDiv + 1;
            } else {
                itemEmpty = itemEmpty + 1;
            }
            $(this).show();
        } else {
            $(this).hide();
        }
    });

    if (itemDiv < 12) {
        if (itemEmpty > 0) {
            for (let i = 0; i < itemEmpty; i++) {
                $(`#${inv} .item[data-group="0"]`).remove();
            }
        }
        /* if itemDiv is less than 12 then create the rest od the divs */
        const emptySlots = 16 - itemDiv;
        for (let i = 0; i < emptySlots; i++) {
            $(`#${inv}`).append(`<div data-group="0" class="item"></div>`);
        }
    }

}

$(document).ready(function () {

    $(document).on('mouseenter', '.item', function () {

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

function moveInventory(inv) {
    const inventoryHud = document.getElementById('inventoryHud');
    // Intentar aplicar posición guardada por jugador
    try {
        const key = (window.currentPlayerId !== undefined && window.currentPlayerId !== null) ? String(window.currentPlayerId) : 'default';
        const raw = localStorage.getItem(`hudPos:${key}`);
        if (raw) {
            const pos = JSON.parse(raw);
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                inventoryHud.style.left = `${pos.left}px`;
                inventoryHud.style.top = `${pos.top}px`;
                return; // Usar posición guardada
            }
        }
    } catch(e) { /* fallback a comportamiento por defecto */ }

    // Comportamiento por defecto si no hay posición guardada
    if (inv === 'main') {
        inventoryHud.style.left = '25%';
    } else if (inv === 'second') {
        inventoryHud.style.left = '1%';
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

    // Add MOVE option to reorder items via click
    try {
        var moveLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.move) ? LANGUAGE.move : 'MOVE';
        data.push({
            text: moveLabel,
            action: function () {
                window.startMoveMode($("#item-" + index));
            }
        });
    } catch (e) {
        data.push({
            text: 'MOVE',
            action: function () {
                try { window.startMoveMode($("#item-" + index)); } catch (err) {}
            }
        });
    }

    if (data.length > 0) {
        $("#item-" + index).contextMenu([data], {
            offsetX: 1,
            offsetY: 1,
        });
    }

    const itemElement = document.getElementById(`item-${index}`);

    itemElement.addEventListener('mouseenter', () => {
        const { label, description } = getItemMetadataInfo(item);
        OverSetTitle(label);
        OverSetDesc(description);

    });

    itemElement.addEventListener('mouseleave', () => {
        OverSetTitle(" ");
        OverSetDesc(" ");
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

    if (item.type === "item_weapon" || item.maxDegradation === 0 || item.degradation === undefined || item.degradation === null || TIME_NOW === undefined) return "";
    const degradationPercentage = getItemDegradationPercentage(item);
    const color = getColorForDegradation(degradationPercentage);

    return `<br>${LANGUAGE.labels.decay}<span style="color: ${color}">${degradationPercentage.toFixed(0)}%</span>`;

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

    $("#inventoryElement").append(`<div data-group='${group}' data-label='${label}' style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center; opacity: ${imageOpacity};' id='item-${index}' class='item' data-tooltip='${tooltipContent}'> 
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
    const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.ammo ?? "Ammo") + item.count + "<br>" + (LANGUAGE.labels?.serial ?? "Serial") + item.serial_number : "";
    const url = imageCache[item.name] || `url("img/items/${item.name}.png")`
    const label = item.custom_label ? item.custom_label : item.label;

    $("#inventoryElement").append(`<div data-label='${label}' data-group='${group}' style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center;' id='item-${index}' class='item' data-tooltip="${weight + info}">
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
    $("#inventoryElement").append(`<div data-label='${label}' data-group='1' style='background-image: ${url}; background-size: 4.5vw 6.7vh; background-repeat: no-repeat; background-position: center;' id='item-${item}' class='item'></div>`);

    $("#item-" + item).contextMenu([data], {
        offsetX: 1,
        offsetY: 1,
    });

    const itemElement = document.getElementById(`item-${item}`);
    itemElement.addEventListener('mouseenter', () => {
        OverSetTitle(label);
        OverSetDesc(description);
    });

    itemElement.addEventListener('mouseleave', () => {
        OverSetTitle(" ");
        OverSetDesc(" ");
    });
}


function inventorySetup(items) {


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
            for (let qs = 0; qs < 4; qs++) {
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
            if (hasSlot[i]) maxSlot = i;
        }
        const slotCount = maxSlot >= 0 ? (maxSlot + 1) : 0;

        const used = new Set();
        try {
            const reserved = Array.isArray(window.__quickslotReservedItems) ? window.__quickslotReservedItems : [];
            for (const it of reserved) used.add(it);
        } catch (e) {}
        let domIndex = 0;
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
                        const group = it.type != "item_weapon" ? !it.group ? 1 : it.group : 5;
                        loadInventoryItems(it, domIndex, group, count, limit);
                        loadInventoryWeapons(it, domIndex, group);
                        addData(domIndex, it);
                        used.add(it);
                        divAmount++;
                        domIndex++;
                    } else {
                        $("#inventoryElement").append(`<div class='item' data-group='0'></div>`);
                    }
                } else {
                    $("#inventoryElement").append(`<div class='item' data-group='0'></div>`);
                }
                slotCountRendered++;
            }
        }

        if (Array.isArray(items) && items.length > 0) {
            for (const it of items) {
                if (!it || used.has(it)) continue;
                const count = it.count;
                const limit = it.limit;
                const group = it.type != "item_weapon" ? !it.group ? 1 : it.group : 5;
                loadInventoryItems(it, domIndex, group, count, limit);
                loadInventoryWeapons(it, domIndex, group);
                addData(domIndex, it);
                divAmount++;
                domIndex++;
                slotCountRendered++;
            }
        }
    } catch(e) {
        slotCountRendered = 0;
        divAmount = 0;
        if (items && items.length > 0) {
            for (const [index, item] of items.entries()) {
                if (item) {
                    const count = item.count;
                    const limit = item.limit;
                    const group = item.type != "item_weapon" ? !item.group ? 1 : item.group : 5;
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
                        giveammotoplayer(ind);
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

    if (Config.AddDollarItem) {

        mainInventoryFixedItems(m_label, m_desc, m_item, data);
        $("#item-" + m_item).data("item", m_item);
        $("#item-" + m_item).data("inventory", "none");
    } else {
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

        if (Config.AddGoldItem) {

            mainInventoryFixedItems(g_label, g_desc, g_item, data);
            $("#item-" + g_item).data("item", g_item);
            $("#item-" + g_item).data("inventory", "none");
        } else {
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

    if (slotCountRendered < 14) {
        const emptySlots = 14 - slotCountRendered;
        const $firstFixed = $("#inventoryElement .item[id^='item-']").filter(function () {
            const id = this && this.id ? String(this.id) : "";
            if (!id.startsWith("item-")) return false;
            const suffix = id.slice(5);
            return suffix && !/^\d+$/.test(suffix);
        }).first();
        for (let i = 0; i < emptySlots; i++) {
            const $empty = $(`<div class='item' data-group='0'></div>`);
            if ($firstFixed && $firstFixed.length) {
                $empty.insertBefore($firstFixed);
            } else {
                $("#inventoryElement").append($empty);
            }
        }
        slotCountRendered += emptySlots;
    }

    // Activar o desactivar reordenación según el modo actual
    if (window.inventoryMoveEnabled) {
        deactivateMainInventoryReorder();
    } else {
        activateMainInventoryReorder();
    }
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
                const targetIsEmpty = ($target.data('inventory') !== 'none') && !$target.data('item');
                if (!targetIsEmpty) return;
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
}

// --- Modo MOVE por menú contextual ---
(function(){
    function injectMoveModeStyles(){
        if (document.getElementById('move-mode-styles')) return;
        const style = document.createElement('style');
        style.id = 'move-mode-styles';
        style.textContent = `
            #inventoryElement .item.move-target{outline:2px dashed #00b7ff; box-shadow:0 0 0 2px rgba(0,183,255,.25) inset; cursor:pointer;}
            #inventoryElement .item.move-source{outline:2px solid #00b7ff;}
            #quickslotHud .qs-slot.move-target{outline:2px dashed #00b7ff; box-shadow:0 0 0 2px rgba(0,183,255,.25) inset; cursor:pointer;}
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
            } else {
                layout.push({ slot: slotIndex, itemId: null });
            }
            slotIndex++;
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

    // Add MOVE option to reorder items via click
    try {
        var moveLabel = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.move) ? LANGUAGE.move : 'MOVE';
        data.push({
            text: moveLabel,
            action: function () {
                window.startMoveMode($("#item-" + index));
            }
        });
    } catch (e) {
        data.push({
            text: 'MOVE',
            action: function () {
                try { window.startMoveMode($("#item-" + index)); } catch (err) {}
            }
        });
    }

    if (data.length > 0) {
        $("#item-" + index).contextMenu([data], {
            offsetX: 1,
            offsetY: 1,
        });
    }

    const itemElement = document.getElementById(`item-${index}`);

    itemElement.addEventListener('mouseenter', () => {
        const { label, description } = getItemMetadataInfo(item);
        OverSetTitle(label);
        OverSetDesc(description);

    });

    itemElement.addEventListener('mouseleave', () => {
        OverSetTitle(" ");
        OverSetDesc(" ");
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

    if (item.type === "item_weapon" || item.maxDegradation === 0 || item.degradation === undefined || item.degradation === null || TIME_NOW === undefined) return "";
    const degradationPercentage = getItemDegradationPercentage(item);
    const color = getColorForDegradation(degradationPercentage);

    return `<br>${LANGUAGE.labels.decay}<span style="color: ${color}">${degradationPercentage.toFixed(0)}%</span>`;

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

    $("#inventoryElement").append(`<div data-group='${group}' data-label='${label}' style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center; opacity: ${imageOpacity};' id='item-${index}' class='item' data-tooltip='${tooltipContent}'> 
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
    const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.ammo ?? "Ammo") + item.count + "<br>" + (LANGUAGE.labels?.serial ?? "Serial") + item.serial_number : "";
    const url = imageCache[item.name] || `url("img/items/${item.name}.png")`
    const label = item.custom_label ? item.custom_label : item.label;

    $("#inventoryElement").append(`<div data-label='${label}' data-group='${group}' style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center;' id='item-${index}' class='item' data-tooltip="${weight + info}">
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
    $("#inventoryElement").append(`<div data-label='${label}' data-group='1' style='background-image: ${url}; background-size: 4.5vw 6.7vh; background-repeat: no-repeat; background-position: center;' id='item-${item}' class='item'></div>`);

    $("#item-" + item).contextMenu([data], {
        offsetX: 1,
        offsetY: 1,
    });

    const itemElement = document.getElementById(`item-${item}`);
    itemElement.addEventListener('mouseenter', () => {
        OverSetTitle(label);
        OverSetDesc(description);
    });

    itemElement.addEventListener('mouseleave', () => {
        OverSetTitle(" ");
        OverSetDesc(" ");
    });
}


function inventorySetup(items) {


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
            for (let qs = 0; qs < 4; qs++) {
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
            if (hasSlot[i]) maxSlot = i;
        }
        const slotCount = maxSlot >= 0 ? (maxSlot + 1) : 0;

        const used = new Set();
        try {
            const reserved = Array.isArray(window.__quickslotReservedItems) ? window.__quickslotReservedItems : [];
            for (const it of reserved) used.add(it);
        } catch (e) {}
        let domIndex = 0;
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
                        const group = it.type != "item_weapon" ? !it.group ? 1 : it.group : 5;
                        loadInventoryItems(it, domIndex, group, count, limit);
                        loadInventoryWeapons(it, domIndex, group);
                        addData(domIndex, it);
                        used.add(it);
                        divAmount++;
                        domIndex++;
                    } else {
                        $("#inventoryElement").append(`<div class='item' data-group='0'></div>`);
                    }
                } else {
                    $("#inventoryElement").append(`<div class='item' data-group='0'></div>`);
                }
                slotCountRendered++;
            }
        }

        if (Array.isArray(items) && items.length > 0) {
            for (const it of items) {
                if (!it || used.has(it)) continue;
                const count = it.count;
                const limit = it.limit;
                const group = it.type != "item_weapon" ? !it.group ? 1 : it.group : 5;
                loadInventoryItems(it, domIndex, group, count, limit);
                loadInventoryWeapons(it, domIndex, group);
                addData(domIndex, it);
                divAmount++;
                domIndex++;
                slotCountRendered++;
            }
        }
    } catch(e) {
        slotCountRendered = 0;
        divAmount = 0;
        if (items && items.length > 0) {
            for (const [index, item] of items.entries()) {
                if (item) {
                    const count = item.count;
                    const limit = item.limit;
                    const group = item.type != "item_weapon" ? !item.group ? 1 : item.group : 5;
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
                        giveammotoplayer(ind);
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

    if (Config.AddDollarItem) {

        mainInventoryFixedItems(m_label, m_desc, m_item, data);
        $("#item-" + m_item).data("item", m_item);
        $("#item-" + m_item).data("inventory", "none");
    } else {
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

        if (Config.AddGoldItem) {

            mainInventoryFixedItems(g_label, g_desc, g_item, data);
            $("#item-" + g_item).data("item", g_item);
            $("#item-" + g_item).data("inventory", "none");
        } else {
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

    if (slotCountRendered < 14) {
        const emptySlots = 14 - slotCountRendered;
        const $firstFixed = $("#inventoryElement .item[id^='item-']").filter(function () {
            const id = this && this.id ? String(this.id) : "";
            if (!id.startsWith("item-")) return false;
            const suffix = id.slice(5);
            return suffix && !/^\d+$/.test(suffix);
        }).first();
        for (let i = 0; i < emptySlots; i++) {
            const $empty = $(`<div class='item' data-group='0'></div>`);
            if ($firstFixed && $firstFixed.length) {
                $empty.insertBefore($firstFixed);
            } else {
                $("#inventoryElement").append($empty);
            }
        }
        slotCountRendered += emptySlots;
    }

    // Activar o desactivar reordenación según el modo actual
    if (window.inventoryMoveEnabled) {
        deactivateMainInventoryReorder();
    } else {
        activateMainInventoryReorder();
    }
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
            } else {
                layout.push({ slot: slotIndex, itemId: null });
            }
            slotIndex++;
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
        for (let i = 0; i < 4; i++) {
            const el = slots[i];
            if (!el) continue;
            const entry = getQuickslotEntry(window.mainItemsLayout, i);
            const assigned = window.quickslotAssignedItems || {};
            const item = assigned[String(i)] || findItemForQuickslotEntry(entry);
            const countEl = el.querySelector('.qs-count');
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
                el.style.backgroundImage = url;
                if (countEl) countEl.textContent = (item.count != null ? item.count : '');
            } else {
                el.style.backgroundImage = 'none';
                if (countEl) countEl.textContent = '';
                try { $(el).removeData('qsItem'); } catch (e) {}
            }
        }
    } catch (e) { /* noop */ }
}

window.quickslotHudVisible = window.quickslotHudVisible || false;
function setQuickslotHudVisible(visible) {
    const hud = document.getElementById('quickslotHud');
    if (!hud) return;
    window.quickslotHudVisible = !!visible;
    if (window.quickslotHudVisible) {
        hud.style.display = 'grid';
        try {
            hud.classList.remove('qs-animate-enter');
            void hud.offsetWidth; // reflow para reiniciar animación
            hud.classList.add('qs-animate-enter');
            const onEnd = (e) => {
                if (e && e.target === hud) {
                    hud.classList.remove('qs-animate-enter');
                    hud.removeEventListener('animationend', onEnd);
                }
            };
            hud.addEventListener('animationend', onEnd);
        } catch (e) { /* noop */ }
        updateQuickslotHudFromMain();
    } else {
        hud.style.display = 'none';
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
            #inventoryElement .item.move-target{outline:2px dashed #00b7ff; box-shadow:0 0 0 2px rgba(0,183,255,.25) inset; cursor:pointer;}
            #inventoryElement .item.move-source{outline:2px solid #00b7ff;}
            #quickslotHud .qs-slot.move-target{outline:2px dashed #00b7ff; box-shadow:0 0 0 2px rgba(0,183,255,.25) inset; cursor:pointer;}
            #quickslotHud .qs-slot.move-source{outline:2px solid #00b7ff;}
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
        if (Number.isNaN(idx) || idx < 0 || idx > 3) return;
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
            const hasItem = !!$t.data('item');
            if (!hasItem) $t.addClass('move-target');
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
            const info = item.serial_number ? "<br>" + (LANGUAGE.labels?.ammo ?? "Ammo") + item.count + "<br>" + (LANGUAGE.labels?.serial ?? "Serial") + item.serial_number : "";
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
        if (!isMainInventoryFixedMode()) return;
        const qsIdx = Number(slotIndex0to3);
        if (Number.isNaN(qsIdx) || qsIdx < 0 || qsIdx > 3) return;
        if (!$target || !$target.length) return;
        if ($target.data('inventory') === 'none') return;
        if ($target.data('item')) return;
        const slotIndex = $("#inventoryElement .item").index($target[0]);
        if (slotIndex < 0) return;

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

        window.mainItemsLayout = upsertQuickslotEntry(window.mainItemsLayout, qsIdx, null);
        window.mainItemsLayout = upsertMainSlotEntry(window.mainItemsLayout, slotIndex, item);
        try {
            const assigned = window.quickslotAssignedItems || {};
            delete assigned[String(qsIdx)];
            window.quickslotAssignedItems = assigned;
        } catch (e) {}

        renderItemIntoExistingMainSlot($target, item);
        try {
            if (typeof activateMainInventoryReorder === 'function') {
                setTimeout(function () { try { activateMainInventoryReorder(); } catch (e) {} }, 0);
            }
        } catch (e) {}
        try { $("#quickslotHud .qs-slot").removeClass('move-source'); } catch (e) {}
        cancelQuickslotMoveMode();
        try { rebuildMainItemsCache(); } catch (e2) {}
        try { updateQuickslotHudFromMain(); } catch (e3) {}
        try { initQuickslotHudDrag(); } catch (e4) {}
    } catch (e) {}
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
        if (Number.isNaN(idx) || idx < 0 || idx > 3) return;
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
                    startQuickslotMoveToInventory(slotIdx);
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
                try { this.style.outline = '2px dashed #00b7ff'; } catch (e) {}
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
        if (!isMainInventoryFixedMode()) return;
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
                        const bg = $orig.css('background-image');
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
        setQuickslotHudInteractive(isMainInventoryFixedMode());
        try {
            if (isMainInventoryFixedMode()) {
                bindQuickslotHudContextMenu(true);
                initQuickslotHudDrop();
                initQuickslotHudDrag();
            }
        } catch (e) {}
        return;
    }
    if (data.action === 'hide') {
        setQuickslotHudInteractive(false);
        try {
            cancelQuickslotMoveMode();
            $('#quickslotHud .qs-slot').each(function () {
                try { $(this).removeData('__qs_cm_bound'); } catch (e) {}
            });
        } catch (e) {}
        return;
    }
    if (data.action === 'setItems') {
        try {
            if (isMainInventoryActuallyOpen() && isMainInventoryFixedMode()) {
                setQuickslotHudInteractive(true);
                bindQuickslotHudContextMenu(true);
                initQuickslotHudDrop();
                initQuickslotHudDrag();
            } else {
                setQuickslotHudInteractive(false);
                initQuickslotHudDrag();
            }
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
        setQuickslotHudVisible(!window.quickslotHudVisible);
        return;
    }
    if (data.action === 'setQuickslotHud') {
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
