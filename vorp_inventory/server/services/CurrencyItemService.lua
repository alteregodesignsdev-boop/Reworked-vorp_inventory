-- Currency Item Service
-- Este servicio sincroniza el dinero de vorp_core como items virtuales en el inventario

CurrencyItemService = {}

local Core = exports.vorp_core:GetCore()

-- Configuración de los items de moneda
local CURRENCY_ITEMS = {
    [0] = { -- Money
        name = "dollar",
        label = "Dólares",
        type = "item_money",
        enabled = true -- Siempre habilitado
    },
    [1] = { -- Gold
        name = "goldbar",
        label = "Oro",
        type = "item_money",
        enabled = function() return Config.UseGoldItem end
    },
    [2] = { -- Rol
        name = "rol_token",
        label = "Tokens ROL",
        type = "item_money",
        enabled = function() return Config.UseRolItem end
    },
    [3] = { -- Peso
        name = "peso",
        label = "Pesos Mexicanos",
        type = "item_money",
        enabled = true -- Siempre habilitado
    }
}

-- Función para verificar si un item es de moneda
function CurrencyItemService.IsCurrencyItem(itemName)
    for _, currencyData in pairs(CURRENCY_ITEMS) do
        if currencyData.name == itemName then
            return true
        end
    end
    return false
end

-- Función para obtener el tipo de moneda desde el nombre del item
function CurrencyItemService.GetCurrencyTypeFromItem(itemName)
    for currencyType, currencyData in pairs(CURRENCY_ITEMS) do
        if currencyData.name == itemName then
            return currencyType
        end
    end
    return nil
end

-- Función para crear items virtuales de moneda basados en el character
function CurrencyItemService.CreateCurrencyItems(character)
    local currencyItems = {}
    
    -- Money (siempre habilitado)
    if CURRENCY_ITEMS[0].enabled then
        local moneyAmount = math.floor((character.money or 0) * 100) -- Convertir a centavos
        if moneyAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_money", -- ID virtual único
                name = CURRENCY_ITEMS[0].name,
                label = CURRENCY_ITEMS[0].label,
                type = CURRENCY_ITEMS[0].type,
                count = moneyAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Dinero en efectivo",
                weight = 0.0,
                group = 999, -- Grupo especial para monedas
                degradation = 0
            })
        end
    end
    
    -- Gold
    local goldEnabled = type(CURRENCY_ITEMS[1].enabled) == "function" and CURRENCY_ITEMS[1].enabled() or CURRENCY_ITEMS[1].enabled
    if goldEnabled then
        local goldAmount = math.floor((character.gold or 0) * 100)
        if goldAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_gold",
                name = CURRENCY_ITEMS[1].name,
                label = CURRENCY_ITEMS[1].label,
                type = CURRENCY_ITEMS[1].type,
                count = goldAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Oro puro",
                weight = 0.0,
                group = 999,
                degradation = 0
            })
        end
    end
    
    -- Rol
    local rolEnabled = type(CURRENCY_ITEMS[2].enabled) == "function" and CURRENCY_ITEMS[2].enabled() or CURRENCY_ITEMS[2].enabled
    if rolEnabled then
        local rolAmount = math.floor((character.rol or 0) * 100)
        if rolAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_rol",
                name = CURRENCY_ITEMS[2].name,
                label = CURRENCY_ITEMS[2].label,
                type = CURRENCY_ITEMS[2].type,
                count = rolAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Tokens de rol",
                weight = 0.0,
                group = 999,
                degradation = 0
            })
        end
    end
    
    -- Peso
    if CURRENCY_ITEMS[3].enabled then
        local pesoAmount = math.floor((character.peso or 0) * 100)
        if pesoAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_peso",
                name = CURRENCY_ITEMS[3].name,
                label = CURRENCY_ITEMS[3].label,
                type = CURRENCY_ITEMS[3].type,
                count = pesoAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Pesos Mexicanos",
                weight = 0.0,
                group = 999,
                degradation = 0
            })
        end
    end
    
    return currencyItems
end

-- Función para interceptar operaciones de dar/dropear items de moneda
-- Redirige a las funciones de vorp_core
function CurrencyItemService.HandleCurrencyOperation(source, operation, itemName, amount, target)
    local currencyType = CurrencyItemService.GetCurrencyTypeFromItem(itemName)
    if not currencyType then
        return false -- No es un item de moneda
    end
    
    local user = Core.getUser(source)
    if not user then return true end -- Bloquear si no hay usuario
    
    local character = user.getUsedCharacter
    if not character then return true end
    
    -- Convertir de centavos a dólares/oro/rol
    local realAmount = amount / 100.0
    
    if operation == "give" and target then
        -- Dar dinero a otro jugador
        local targetUser = Core.getUser(target)
        if not targetUser then return true end
        
        local targetCharacter = targetUser.getUsedCharacter
        if not targetCharacter then return true end
        
        -- Verificar que el jugador tenga suficiente dinero
        local currentAmount = 0
        if currencyType == 0 then
            currentAmount = character.money
        elseif currencyType == 1 then
            currentAmount = character.gold
        elseif currencyType == 2 then
            currentAmount = character.rol
        elseif currencyType == 3 then
            currentAmount = character.peso
        end
        
        if currentAmount < realAmount then
            return true -- No tiene suficiente
        end
        
        -- Remover del source
        character.removeCurrency(currencyType, realAmount)
        
        -- Agregar al target
        targetCharacter.addCurrency(currencyType, realAmount)
        
        return true -- Operación manejada
        
    elseif operation == "drop" then
        -- Dropear dinero (usar las funciones existentes del inventario)
        -- Esto se maneja en InventoryService, solo retornamos false para que continúe
        return false
    end
    
    return true -- Bloquear otras operaciones
end

-- Función para manejar el movimiento de dinero a inventarios secundarios
-- Convierte el dinero virtual en un item real que se puede almacenar
function CurrencyItemService.HandleMoveToSecondary(source, itemData, callback)
    local itemName = itemData.item and itemData.item.name or itemData.item
    local currencyType = CurrencyItemService.GetCurrencyTypeFromItem(itemName)
    
    if not currencyType then
        return false -- No es un item de moneda, continuar con el flujo normal
    end
    
    local user = Core.getUser(source)
    if not user then return true end
    
    local character = user.getUsedCharacter
    if not character then return true end
    
    local amount = tonumber(itemData.number) or 0
    local realAmount = amount / 100.0 -- Convertir de centavos a dólares
    
    -- Verificar que el jugador tenga suficiente dinero
    local currentAmount = 0
    if currencyType == 0 then
        currentAmount = character.money
    elseif currencyType == 1 then
        currentAmount = character.gold
    elseif currencyType == 2 then
        currentAmount = character.rol
    elseif currencyType == 3 then
        currentAmount = character.peso
    end
    
    if currentAmount < realAmount then
        TriggerClientEvent("vorp:TipRight", source, "No tienes suficiente dinero", 3000)
        return true -- Bloquear operación
    end
    
    -- Remover el dinero del personaje
    character.removeCurrency(currencyType, realAmount)
    
    -- Crear un item real de dinero para el inventario secundario
    local moneyItem = {
        name = itemName,
        label = itemData.item.label or "Dinero",
        count = amount, -- En centavos
        type = "item_money",
        metadata = {},
        degradation = 0
    }
    
    -- Llamar al callback con el item convertido
    if callback then
        callback(moneyItem)
    end
    
    return true -- Operación manejada
end

-- Función para manejar cuando se saca dinero de inventarios secundarios
-- Convierte el item real de vuelta a dinero virtual del personaje
function CurrencyItemService.HandleTakeFromSecondary(source, itemData, callback)
    local itemName = itemData.item and itemData.item.name or itemData.item
    local currencyType = CurrencyItemService.GetCurrencyTypeFromItem(itemName)
    
    if not currencyType then
        return false -- No es un item de moneda, continuar con el flujo normal
    end
    
    local user = Core.getUser(source)
    if not user then return true end
    
    local character = user.getUsedCharacter
    if not character then return true end
    
    local amount = tonumber(itemData.number) or 0
    local realAmount = amount / 100.0 -- Convertir de centavos a dólares
    
    -- Añadir el dinero al personaje
    character.addCurrency(currencyType, realAmount)
    
    -- Llamar al callback para confirmar la operación
    if callback then
        callback()
    end
    
    return true -- Operación manejada
end

return CurrencyItemService
