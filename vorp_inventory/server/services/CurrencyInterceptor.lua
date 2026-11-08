-- Currency Interceptor
-- Intercepta eventos de movimiento de items para manejar dinero especialmente

local Core = exports.vorp_core:GetCore()

-- Lista de eventos a interceptar
local MOVE_EVENTS = {
    "vorp_stables:MoveToHorse",
    "syn_Container:MoveToContainer",
    "vorp_inventory:MoveToCart",
    "vorp_inventory:MoveToHouse",
    "vorp_inventory:MoveToBank",
    -- Añadir más eventos según sea necesario
}

local TAKE_EVENTS = {
    "vorp_stables:TakeFromHorse",
    "syn_Container:TakeFromContainer",
    "vorp_inventory:TakeFromCart",
    "vorp_inventory:TakeFromHouse",
    "vorp_inventory:TakeFromBank",
    -- Añadir más eventos según sea necesario
}

-- Interceptar eventos de movimiento a inventarios secundarios
for _, eventName in ipairs(MOVE_EVENTS) do
    RegisterServerEvent("currency_intercept_move_" .. eventName)
    AddEventHandler("currency_intercept_move_" .. eventName, function(itemData)
        local source = source
        local data = type(itemData) == "string" and json.decode(itemData) or itemData
        
        -- Verificar si es un item de dinero
        local itemName = data.item and data.item.name or data.item
        if CurrencyItemService.IsCurrencyItem(itemName) then
            -- Manejar el movimiento de dinero
            local handled = CurrencyItemService.HandleMoveToSecondary(source, data, function(moneyItem)
                -- El dinero fue removido del personaje, ahora continuar con el evento original
                -- pero con el item convertido
                data.item = moneyItem
                TriggerEvent(eventName, source, json.encode(data))
            end)
            
            if handled then
                -- Recargar el inventario del jugador
                TriggerClientEvent("vorpinventory:updateinventory", source)
            end
        else
            -- No es dinero, continuar con el evento original
            TriggerEvent(eventName, source, itemData)
        end
    end)
end

-- Interceptar eventos de sacar items de inventarios secundarios
for _, eventName in ipairs(TAKE_EVENTS) do
    RegisterServerEvent("currency_intercept_take_" .. eventName)
    AddEventHandler("currency_intercept_take_" .. eventName, function(itemData)
        local source = source
        local data = type(itemData) == "string" and json.decode(itemData) or itemData
        
        -- Verificar si es un item de dinero
        local itemName = data.item and data.item.name or data.item
        if CurrencyItemService.IsCurrencyItem(itemName) then
            -- Primero ejecutar el evento original para remover del inventario secundario
            TriggerEvent(eventName, source, itemData)
            
            -- Luego añadir el dinero al personaje
            Wait(100) -- Pequeña espera para asegurar que se removió del inventario secundario
            CurrencyItemService.HandleTakeFromSecondary(source, data, function()
                -- Recargar el inventario del jugador
                TriggerClientEvent("vorpinventory:updateinventory", source)
            end)
        else
            -- No es dinero, continuar con el evento original
            TriggerEvent(eventName, source, itemData)
        end
    end)
end

print("^2[Currency Interceptor]^7 Interceptor de eventos de moneda cargado")
