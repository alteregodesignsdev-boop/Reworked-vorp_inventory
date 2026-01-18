function PostActionPostQty(eventName, itemData, id, propertyName, qty, info) {
    if (isValidating) return;

    processEventValidation();

    $.post(`https://${GetParentResourceName()}/${eventName}`,
        JSON.stringify({
            item: itemData,
            type: itemData.type,
            number: qty,
            [propertyName]: id,
            info: info
        })
    );

}

let isShiftActive = false

document.onkeydown = function (e) {
    isShiftActive = e.shiftKey
};

document.onkeyup = function (e) {
    isShiftActive = e.shiftKey
};

function PostAction(eventName, itemData, id, propertyName, info) {
    disableInventory(500);
    if (itemData.type != "item_weapon") {

        if (itemData.count === 1 || isShiftActive === true) {
            let qty = (isShiftActive) ? itemData.count : 1;
            PostActionPostQty(eventName, itemData, id, propertyName, qty, info);
            return;
        }

        dialog.prompt({
            title: LANGUAGE.prompttitle,
            button: LANGUAGE.promptaccept,
            required: true,
            item: itemData,
            type: itemData.type,
            input: {
                type: "number",
                autofocus: "true",
            },

            validate: function (value, item, type) {
                if (!value || value <= 0 || value > Config.MaxItemTransferAmount || !isInt(value)) {
                    $.post(`https://${GetParentResourceName()}/TransferLimitExceeded`, JSON.stringify({
                        max: Config.MaxItemTransferAmount
                    }));
                                    
                    dialog.close();
                } else {
                    PostActionPostQty(eventName, itemData, id, propertyName, value, info);
                }
            },
        });
    } else {
        PostActionPostQty(eventName, itemData, id, propertyName, 1, info);
    }
}
const ActionTakeList = {
    custom: { action: "TakeFromCustom", id: () => customId, customtype: "id" },
    player: { action: "TakeFromPlayer", id: () => playerId, customtype: "player" },
    cart: { action: "TakeFromCart", id: () => wagonid, customtype: "wagon" },
    house: { action: "TakeFromHouse", id: () => houseId, customtype: "house" },
    hideout: { action: "TakeFromHideout", id: () => hideoutId, customtype: "hideout" },
    bank: { action: "TakeFromBank", id: () => bankId, customtype: "bank" },
    clan: { action: "TakeFromClan", id: () => clanid, customtype: "clan" },
    steal: { action: "TakeFromsteal", id: () => stealid, customtype: "steal" },
    Container: { action: "TakeFromContainer", id: () => Containerid, customtype: "Container" },
    horse: { action: "TakeFromHorse", id: () => horseid, customtype: "horse" },
};

const ActionMoveList = {
    custom: { action: "MoveToCustom", id: () => customId, customtype: "id" },
    player: { action: "MoveToPlayer", id: () => playerId, customtype: "player" },
    cart: { action: "MoveToCart", id: () => wagonid, customtype: "wagon" },
    house: { action: "MoveToHouse", id: () => houseId, customtype: "house" },
    hideout: { action: "MoveToHideout", id: () => hideoutId, customtype: "hideout" },
    bank: { action: "MoveToBank", id: () => bankId, customtype: "bank" },
    clan: { action: "MoveToClan", id: () => clanid, customtype: "clan" },
    steal: { action: "MoveTosteal", id: () => stealid, customtype: "steal" },
    Container: { action: "MoveToContainer", id: () => Containerid, customtype: "Container" },
    horse: { action: "MoveToHorse", id: () => horseid, customtype: "horse" },
};


function takeFromStoreWithPrice(itemData, qty) {

    if (isValidating) return;

    processEventValidation();

    $.post(`https://${GetParentResourceName()}/TakeFromStore`,
        JSON.stringify({
            item: itemData,
            type: itemData.type,
            number: qty,
            price: itemData.price,
            geninfo: geninfo,
            store: StoreId,
        })
    );
}

function initSecondaryInventoryHandlers() {
    $("#inventoryElement").droppable({
        drop: function (event, ui) {
            itemData = ui.draggable.data("item");
            itemInventory = ui.draggable.data("inventory");
            var info = $("#secondInventoryElement").data("info");

            if (itemInventory === "second") {
                try {
                    if (window.__secondToMainSlotTargetingActive && typeof window.__handleSecondToMainSlotDrop === 'function') {
                        const handled = window.__handleSecondToMainSlotDrop(event, ui, info);
                        if (handled) return;
                    }
                } catch (e) {}
                if (type in ActionTakeList) {
                    const { action, id, customtype } = ActionTakeList[type];
                    const Id = id();
                    PostAction(action, itemData, Id, customtype, info);
                } else if (type === "store") {
                    disableInventory(500);
                    if (itemData.type != "item_weapon") {

                        if (itemData.count === 1 || isShiftActive === true) {
                            let qty = (isShiftActive) ? itemData.count : 1;
                            takeFromStoreWithPrice(itemData, qty);
                            return;
                        }

                        dialog.prompt({
                            title: LANGUAGE.prompttitle,
                            button: LANGUAGE.promptaccept,
                            required: true,
                            item: itemData,
                            type: itemData.type,
                            input: {
                                type: "number",
                                autofocus: "true",
                            },

                            validate: function (value) {
                                if (!value) {
                                    dialog.close();
                                    return;
                                }

                                if (!isInt(value)) {
                                    return;
                                }

                                takeFromStoreWithPrice(itemData, value);
                            },
                        });
                    } else {
                        let qty = 1;
                        takeFromStoreWithPrice(itemData, qty);
                    }
                }
            }
        },
    });


    function moveToStore(itemData, qty) {

        if (isValidating) return;

        processEventValidation();

        $.post(`https://${GetParentResourceName()}/MoveToStore`,
            JSON.stringify({
                item: itemData,
                type: itemData.type,
                number: qty,
                geninfo: geninfo,
                store: StoreId,
            })
        );
    }

    function moveToStoreWithPrice(itemData, qty, price) {

        if (isValidating) return;

        processEventValidation();

        $.post(`https://${GetParentResourceName()}/MoveToStore`,
            JSON.stringify({
                item: itemData,
                type: itemData.type,
                number: qty,
                price: price,
                geninfo: geninfo,
                store: StoreId,
            })
        );
    }

    function moveToStorePriceDialog(itemData, qty) {

        if (isValidating) return;

        processEventValidation();

        dialog.prompt({
            title: LANGUAGE.prompttitle2,
            button: LANGUAGE.promptaccept,
            required: true,
            item: itemData,
            type: itemData.type,
            input: {
                type: "number",
                autofocus: "true",
            },
            validate: function (value2, item, type) {
                if (!value2) {
                    dialog.close();
                    return;
                }

                moveToStoreWithPrice(itemData, qty, value2);
            },
        });
    }

    $("#secondInventoryElement").droppable({
        drop: function (_, ui) {
            itemData = ui.draggable.data("item");
            itemInventory = ui.draggable.data("inventory");
            var info = $(this).data("info");

            if (itemInventory === "main") {
                if (type in ActionMoveList) {
                    const { action, id, customtype } = ActionMoveList[type];
                    const Id = id();
                    PostAction(action, itemData, Id, customtype, info);
                } else if (type === "store") {
                    disableInventory(500);

                    // this action is different than all the others
                    if (itemData.type != "item_weapon") {

                        if (itemData.count === 1 || isShiftActive === true) {
                            let qty = (isShiftActive) ? itemData.count : 1;
                            if (geninfo.isowner != 0) {
                                moveToStorePriceDialog(itemData, qty);
                            } else {
                                moveToStore(itemData, qty);
                            }
                            return;
                        }

                        dialog.prompt({
                            title: LANGUAGE.prompttitle,
                            button: LANGUAGE.promptaccept,
                            required: true,
                            item: itemData,
                            type: itemData.type,
                            input: {
                                type: "number",
                                autofocus: "true",
                            },
                            validate: function (value, item, type) {
                                if (!value) {
                                    dialog.close();
                                    return;
                                }

                                if (!isInt(value)) {
                                    return;
                                }

                                if (geninfo.isowner != 0) {
                                    moveToStorePriceDialog(itemData, value);
                                } else {
                                    moveToStore(itemData, value);
                                }
                            },
                        });
                    } else {
                        let qty = 1;
                        if (geninfo.isowner != 0) {
                            moveToStorePriceDialog(itemData, qty);
                        } else {
                            moveToStore(itemData, qty);
                        }
                    }
                }
            }
        },
    });
}

/**
 *  set up mouse events for the item
 * @param {object} item 
 * @param {number} index 
 */
function addDataToCustomInv(item, index) {
    const $el = $("#second-item-" + index);
    $el.data("item", item);
    $el.data("inventory", "second");
    $el.attr("data-inventory", "second");

    const itemElement = document.getElementById(`second-item-${index}`);

    itemElement.addEventListener('mouseenter', () => {
        const { label, description } = getItemMetadataInfo(item);
        OverSetTitleSecond(label);
        OverSetDescSecond(description);
    });

    itemElement.addEventListener('mouseleave', () => {
        OverSetTitleSecond(" ");
        OverSetDescSecond(" ");
    });

}

/**
 * Get the degradation percentage 
 * @param {Object} item - The item object
 * @returns {string}
 */
function getDegradationCustom(item) {

    if (item.type === "item_weapon" || item.maxDegradation === 0 || item.degradation === undefined || item.degradation === null || item.percentage === undefined || item.percentage === null) return "";
    const degradationPercentage = item.percentage
    const color = getColorForDegradation(degradationPercentage);
    return `<br>${LANGUAGE.labels.decay}<span style="color: ${color}">${degradationPercentage.toFixed(0)}%</span>`;
}


function loadCustomInventoryItems(item, index, group, count, limit) {
    if (item.type === "item_weapon") return;

    const { tooltipData, degradation, image, label, weight } = getItemMetadataInfo(item, true);
    const itemWeight = getItemWeight(weight, 1);
    const groupKey = getGroupKey(group);
    const { tooltipContent, url } = getItemTooltipContent(image, groupKey, group, limit, itemWeight, degradation, tooltipData);

    $("#secondInventoryElement").append(`<div data-label='${label}' data-group ='${group}' style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center;' id="second-item-${index}" class='item' data-tooltip='${tooltipContent}'> ${count > 0 ? `<div class='count'>${count}</div>` : ``} </div>`);

}

function loadCustomInventoryItemsWeapons(item, index, group) {
    if (item.type != "item_weapon") return;

    const info = item.serial_number ? "<br>" + LANGUAGE.labels.ammo + item.count + "<br>" + LANGUAGE.labels.serial + item.serial_number : "";
    const weight = getItemWeight(item.weight, item.count);
    const url = imageCache[item.name] || `url("img/items/${item.name}.png")`

    $("#secondInventoryElement").append(`<div data-label='${item.label}' data-group ='${group}'
    style='background-image: ${url}; background-size: 4.5vw 7.7vh; background-repeat: no-repeat; background-position: center;' id='second-item-${index}' class='item' data-tooltip="${weight + info}"></div>`);

}

function secondInventorySetup(items, info) {
    $("#secondInventoryElement").html("").data("info", info);
    var divCount = 0;

    if (items.length > 0) {
        $.each(items, function () {
            divCount = divCount + 1;
        });

        for (const [index, item] of items.entries()) {
            count = item.count;
            const group = item.type != "item_weapon" ? !item.group ? 1 : item.group : 5;
            const limit = item.limit;
            loadCustomInventoryItems(item, index, group, count, limit);
            loadCustomInventoryItemsWeapons(item, index, group);
            addDataToCustomInv(item, index);
        };
    }

    /* in here we ensure that at least all divs are filled */
    if (divCount < 14) {
        var emptySlots = 16 - divCount;
        for (var i = 0; i < emptySlots; i++) {
            $("#secondInventoryElement").append(`<div class='item' data-group='0'></div>`);
        }
    }
}

window.__secondToMainSlotTargetingActive = window.__secondToMainSlotTargetingActive || false;
window.__secondDragMainSlotDroppablesDisabled = window.__secondDragMainSlotDroppablesDisabled || false;

window.disableMainSlotDroppablesDuringSecondDrag = function () {
    try {
        if (window.__secondDragMainSlotDroppablesDisabled) return;
        $("#inventoryElement .item").each(function () {
            try { $(this).droppable("disable"); } catch (e) {}
        });
        window.__secondDragMainSlotDroppablesDisabled = true;
    } catch (e) {}
};

window.restoreMainSlotDroppablesAfterSecondDrag = function () {
    try {
        window.__secondDragMainSlotDroppablesDisabled = false;
        try {
            if (window.inventoryMoveEnabled) {
                if (typeof deactivateMainInventoryReorder === 'function') deactivateMainInventoryReorder();
            } else {
                if (typeof activateMainInventoryReorder === 'function') activateMainInventoryReorder();
            }
        } catch (e) {}
    } catch (e) {}
};

function isFixedMainSlotElement(el) {
    try {
        const id = el && el.id ? String(el.id) : '';
        if (!id.startsWith('item-')) return false;
        const suffix = id.slice(5);
        return !!(suffix && !/^\d+$/.test(suffix));
    } catch (e) {
        return false;
    }
}

function isEmptyMainSlot($slot) {
    try {
        if (!$slot || !$slot.length) return false;
        if (isFixedMainSlotElement($slot[0])) return false;
        const hasItem = !!$slot.data('item');
        if (hasItem) return false;
        const inv = $slot.data('inventory');
        const grp = $slot.data('group');
        if (inv === 'none') return false;
        if (grp === 0 || grp === '0') return true;
        return (inv === undefined || inv === null);
    } catch (e) {
        return false;
    }
}

function getMainSlotIndex($slot) {
    try {
        if (!$slot || !$slot.length) return null;
        const target = $slot[0];
        let idx = 0;
        let found = null;
        $("#inventoryElement .item").each(function () {
            if (isFixedMainSlotElement(this)) return;
            if (this === target) {
                found = idx;
                return false;
            }
            idx++;
        });
        return found;
    } catch (e) {
        return null;
    }
}

function findEmptySlotUnderPointer(event, ui) {
    try {
        if (!event) return null;
        const oe = event.originalEvent || event;
        let cx = oe.clientX;
        let cy = oe.clientY;
        if ((cx === undefined || cx === null) && oe.pageX !== undefined && oe.pageY !== undefined) {
            cx = oe.pageX - window.pageXOffset;
            cy = oe.pageY - window.pageYOffset;
        }
        if (cx === undefined || cy === undefined) return null;
        let helper = null;
        try { helper = ui && ui.helper ? $(ui.helper) : null; } catch (e) { helper = null; }
        try { if (helper && helper.length) helper.hide(); } catch (e) {}
        const el = document.elementFromPoint(cx, cy);
        try { if (helper && helper.length) helper.show(); } catch (e) {}
        if (!el) return null;
        const $slot = $(el).closest("#inventoryElement .item");
        if (!$slot.length) return null;
        if (!isEmptyMainSlot($slot)) return null;
        return $slot;
    } catch (e) {
        return null;
    }
}

function highlightEmptyMainSlots(active) {
    try {
        if (typeof ensureMoveModeStyles === 'function') ensureMoveModeStyles();
        if (!active) {
            $("#inventoryElement .item").removeClass('move-target');
            return;
        }
        $("#inventoryElement .item").each(function () {
            const $t = $(this);
            if (isEmptyMainSlot($t)) $t.addClass('move-target');
            else $t.removeClass('move-target');
        });
    } catch (e) {}
}

window.enableSecondToMainSlotTargeting = function (itemData) {
    try {
        if (!itemData) return;
        if (typeof isNonStackableSecondToMainSlotTarget === 'function' && !isNonStackableSecondToMainSlotTarget(itemData)) return;
        window.__secondToMainSlotTargetingActive = true;
        highlightEmptyMainSlots(true);
    } catch (e) {}
};

window.disableSecondToMainSlotTargeting = function () {
    try {
        window.__secondToMainSlotTargetingActive = false;
        highlightEmptyMainSlots(false);
    } catch (e) {}
};

window.__handleSecondToMainSlotDrop = function (event, ui, info) {
    try {
        const $drag = ui && ui.draggable ? $(ui.draggable) : null;
        if (!$drag || !$drag.length) return false;
        const inv = $drag.data('inventory');
        if (inv !== 'second') return false;
        const item = $drag.data('item');
        if (!item || (typeof isNonStackableSecondToMainSlotTarget === 'function' && !isNonStackableSecondToMainSlotTarget(item))) return false;

        let $slot = null;
        try { $slot = findEmptySlotUnderPointer(event, ui); } catch (e) { $slot = null; }
        if (!$slot || !$slot.length) return false;
        const slotIndex = getMainSlotIndex($slot);
        if (slotIndex === null) return false;

        const meta = (typeof itemMetaHash === 'function') ? itemMetaHash(item) : null;
        window.__pendingSecondToMainSlotAssignment = { slotIndex: Number(slotIndex), from: { name: item.name, meta: meta } };

        if (type in ActionTakeList) {
            const { action, id, customtype } = ActionTakeList[type];
            const Id = id();
            PostAction(action, item, Id, customtype, info);
            try { window.disableSecondToMainSlotTargeting(); } catch (e) {}
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
};
