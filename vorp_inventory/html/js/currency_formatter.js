// Currency Formatter - Formatea el contador de items de moneda
// Este archivo sobrescribe la función loadInventoryItems para formatear el dinero

(function() {
    // Guardar la función original
    const originalLoadInventoryItems = window.loadInventoryItems;
    
    // Sobrescribir con la nueva función que formatea moneda
    window.loadInventoryItems = function(item, index, group, count, limit) {
        
        if (item.type === "item_weapon") return;

        const { tooltipData, degradation, image, label, weight } = getItemMetadataInfo(item, false);
        const itemWeight = getItemWeight(weight, count);
        const groupKey = getGroupKey(group);
        const { tooltipContent, url } = getItemTooltipContent(image, groupKey, group, limit, itemWeight, degradation, tooltipData);
        const imageOpacity = getItemDegradationPercentage(item) === 0 ? 0.5 : 1;

        // Formatear el contador para items de moneda
        let displayCount = count;
        let countStyle = ""; // Estilo para ocultar el contador en items de dinero
        
        if (item.type === "item_money") {
            // count ya viene en dólares desde CurrencyItemService
            displayCount = "$" + count.toFixed(2);
            countStyle = "display: none;"; // Ocultar el círculo blanco
        }

        $("#inventoryElement").append(`<div data-group='${group}' data-label='${label}' style='background-image: ${url}, url("img/slot.png"); background-size: 4.2vw 6.5vh, 100% 100%; background-repeat: no-repeat, no-repeat; background-position: center, center; opacity: ${imageOpacity};' id='item-${index}' class='item' data-tooltip='${tooltipContent}'> 
            <div class='count' style='${countStyle}'>
                <span style='color:Black'>${displayCount}</span>
            </div>
        </div>`);

        // Si es un item de dinero, agregar menú contextual personalizado
        if (item.type === "item_money") {
            addMoneyContextMenu(index, item, count);
        }
    };

    // Función para agregar menú contextual a items de dinero
    function addMoneyContextMenu(index, item, count) {
        $("#item-" + index).data("item", item);
        $("#item-" + index).data("inventory", "main");
        $("#item-" + index).attr("data-inventory", "main");
        
        // Marcar como item de dinero para evitar que addData lo procese
        $("#item-" + index).data("isMoney", true);

        const data = [];

        // count ya viene en dólares desde CurrencyItemService, no necesita conversión
        const realAmount = count;

        // Opción "Give money"
        data.push({
            text: LANGUAGE.givemoney || "Give money",
            action: function () {
                giveMoneyPrompt(realAmount, item);
            },
        });

        // Opción "Drop money" (Oculto para monedas que no se pueden tirar)
        if (item.name !== "peso" && item.name !== "rol_token") {
            data.push({
                text: LANGUAGE.dropmoney || "Drop money",
                action: function () {
                    dropMoneyPrompt(realAmount, item);
                },
            });
        }

        // Opción "Pack money" (Empaquetar en sobre) para dólares y pesos
        if (item.name === "dollar" || item.name === "peso") {
            const rawPack = (typeof LANGUAGE !== 'undefined' && LANGUAGE && LANGUAGE.packenvelope) ? LANGUAGE.packenvelope : "Pack money";
            const packText = rawPack.replace(/\s+dinero/i, '').replace(/\s+money/i, '');
            data.push({
                text: packText,
                action: function () {
                    packMoneyPrompt(realAmount, item);
                },
            });
        }

        $("#item-" + index).data("panelActions", data);

        // Agregar eventos de mouse
        const itemElement = document.getElementById(`item-${index}`);
        itemElement.addEventListener('mouseenter', () => {
            window.showItemInPanel($("#item-" + index));
        });
    }

    // Sobrescribir addData para evitar que procese items de dinero
    const originalAddData = window.addData;
    window.addData = function(index, item) {
        // Si es un item de dinero, no hacer nada (ya tiene su menú contextual)
        if (item.type === "item_money") {
            return;
        }
        // Para otros items, usar la función original
        if (originalAddData) {
            originalAddData(index, item);
        }
    };

    // Función para dar dinero
    function giveMoneyPrompt(maxAmount, item) {
        dialog.prompt({
            title: LANGUAGE.toplayerpromptitle || "How much money do you want to give?",
            button: LANGUAGE.toplaterpromptaccept || "Give",
            callback: function(value) {
                // Si el input está vacío o es null, usar el máximo disponible
                let amount;
                if (!value || String(value).trim() === "") {
                    amount = maxAmount;
                } else {
                    amount = parseFloat(String(value).trim().replace(',', '.'));
                }
                
                if (amount && amount > 0 && amount <= maxAmount) {
                    // El servidor ahora maneja dólares directamente, no centavos
                    
                    // Obtener jugadores cercanos usando secureCallbackToNui
                    secureCallbackToNui("vorp_inventory", "GetNearPlayers", {
                        item: item.name || item.item,
                        type: "item_money",
                        count: amount, // Enviar en dólares
                        what: "give"
                    });
                }
            }
        });
    }

    // Función para dropear dinero
    function dropMoneyPrompt(maxAmount, item) {
        dialog.prompt({
            title: LANGUAGE.prompttitle || "How much money do you want to drop?",
            button: LANGUAGE.promptaccept || "Drop",
            callback: function(value) {
                // Si el input está vacío o es null, usar el máximo disponible
                let amount;
                if (!value || String(value).trim() === "") {
                    amount = maxAmount;
                } else {
                    amount = parseFloat(String(value).trim().replace(',', '.'));
                }
                
                if (amount && amount > 0 && amount <= maxAmount) {
                    // El servidor ahora maneja dólares directamente, no centavos
                    
                    // Usar secureCallbackToNui para añadir el hash de seguridad
                    secureCallbackToNui("vorp_inventory", "DropItem", {
                        item: item.name || item.item,
                        type: "item_money",
                        number: amount, // Enviar en dólares
                        id: item.id || ("currency_" + (item.name || item.item))
                    });
                }
            }
        });
    }

    // Función para empaquetar dinero en un sobre
    function packMoneyPrompt(maxAmount, item) {
        dialog.prompt({
            title: LANGUAGE.packenvelope || "Confirma la cantidad que quiere guardar",
            button: LANGUAGE.packenvelope || "Meter en sobre",
            callback: function(value) {
                // Si el input está vacío o es null, usar el máximo disponible
                let amount;
                if (!value || String(value).trim() === "") {
                    amount = maxAmount;
                } else {
                    amount = parseFloat(String(value).trim().replace(',', '.'));
                }
                
                if (amount && amount > 0 && amount <= maxAmount) {
                    // El servidor ahora maneja dólares directamente, no centavos
                    
                    // Enviar al servidor para crear el sobre
                    secureCallbackToNui("vorp_inventory", "PackMoney", {
                        amount: amount, // Enviar en dólares
                        currency: item.name || item.item
                    });
                }
            }
        });
    }
})();
