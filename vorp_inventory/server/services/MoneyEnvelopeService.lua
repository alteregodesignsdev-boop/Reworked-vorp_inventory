-- Money Envelope Service
-- Maneja el empaquetado y desempaquetado de dinero en sobres

local Core = exports.vorp_core:GetCore()

MoneyEnvelopeService = {}

-- Cooldown para prevenir spam/duping
local packCooldown = {}
local COOLDOWN_TIME = 5000 -- 5 segundos entre cada empaquetado

-- Empaquetar dinero en un sobre
function MoneyEnvelopeService.PackMoney(amount, currencyName)
    currencyName = currencyName or "dollar"
    local source = source
    local user = Core.getUser(source)
    if not user then return end
    
    local character = user.getUsedCharacter
    if not character then return end
    
    -- ANTI-SPAM: Verificar cooldown
    local currentTime = os.time() * 1000
    if packCooldown[source] and (currentTime - packCooldown[source]) < COOLDOWN_TIME then
        local remaining = math.ceil((COOLDOWN_TIME - (currentTime - packCooldown[source])) / 1000)
        TriggerClientEvent("vorp:TipRight", source, string.format("Espera %d segundos antes de empaquetar más dinero", remaining), 3000)
        return
    end
    
    -- Validaciones de seguridad
    amount = tonumber(amount)
    if not amount then
        print(string.format("^1[SECURITY WARNING]^7 Player %s tried to pack money with invalid type", GetPlayerName(source)))
        return
    end
    
    if amount <= 0 then
        TriggerClientEvent("vorp:TipRight", source, "Cantidad inválida", 3000)
        return
    end
    
    -- Redondear a 2 decimales (centavos exactos)
    amount = math.floor(amount * 100 + 0.5) / 100
    
    -- Límite máximo de seguridad (configurable, directamente en dólares)
    local maxAmount = Config.MaxEnvelopeAmount or 10000
    if amount > maxAmount then
        TriggerClientEvent("vorp:TipRight", source, string.format("No puedes empaquetar más de $%.2f en un sobre", maxAmount), 3000)
        print(string.format("^3[SECURITY]^7 Player %s tried to pack $%.2f (max: $%.2f)", GetPlayerName(source), amount, maxAmount))
        return
    end
    
    -- Verificar que el jugador tenga suficiente dinero
    if currencyName == "peso" then
        if (character.peso or 0) < amount then
            TriggerClientEvent("vorp:TipRight", source, "No tienes suficientes pesos", 3000)
            return
        end
    else
        if (character.money or 0) < amount then
            TriggerClientEvent("vorp:TipRight", source, "No tienes suficiente dinero", 3000)
            return
        end
    end
    
    -- Si se requiere sobre vacío, verificar que el jugador lo tenga
    if Config.RequireEmptyEnvelope then
        local emptyEnvelopeCount = exports.vorp_inventory:getItemCount(source, nil, Config.EmptyEnvelopeItem)
        if emptyEnvelopeCount < 1 then
            TriggerClientEvent("vorp:TipRight", source, "Necesitas un sobre vacío para empaquetar dinero", 3000)
            return
        end
        
        -- Remover el sobre vacío
        local removed = exports.vorp_inventory:subItem(source, Config.EmptyEnvelopeItem, 1)
        if not removed then
            TriggerClientEvent("vorp:TipRight", source, "Error al usar el sobre vacío", 3000)
            return
        end
    end
    
    -- Remover el dinero del personaje y crear metadata
    local metadata = { amount = amount }
    
    if currencyName == "peso" then
        character.removeCurrency(3, amount)
        metadata.currency = "peso"
        metadata.description = string.format("Contiene %.2f Pesos", amount)
    else
        character.removeCurrency(0, amount)
        metadata.currency = "dollar"
        metadata.description = string.format("Contiene $%.2f", amount)
    end
    
    -- Añadir el sobre al inventario
    exports.vorp_inventory:addItem(source, "money_envelope", 1, metadata)
    
    -- Establecer cooldown
    packCooldown[source] = currentTime
    
    if currencyName == "peso" then
        TriggerClientEvent("vorp:TipRight", source, string.format("Empaquetaste %.2f Pesos en un sobre", amount), 3000)
    else
        TriggerClientEvent("vorp:TipRight", source, string.format("Empaquetaste $%.2f en un sobre", amount), 3000)
    end
    
    -- Recargar inventario
    TriggerClientEvent("vorpinventory:updateinventory", source)
end

-- Función para desempaquetar dinero (llamada desde InventoryService.UseItem)
function MoneyEnvelopeService.UnpackMoney(data)
    local source = data.source
    local itemId = data.item.id or data.item.mainid
    
    local user = Core.getUser(source)
    if not user then return end
    
    local character = user.getUsedCharacter
    if not character then return end
    
    -- SEGURIDAD: Obtener el item directamente usando el export correcto
    -- NO confiar en el metadata que viene del cliente
    local serverItem = exports.vorp_inventory:getItemById(source, itemId)
    if not serverItem then
        TriggerClientEvent("vorp:TipRight", source, "Sobre no encontrado", 3000)
        return
    end
    
    -- Verificar que sea realmente un sobre de dinero
    if serverItem.name ~= "money_envelope" then
        TriggerClientEvent("vorp:TipRight", source, "Este no es un sobre de dinero", 3000)
        return
    end
    
    -- Obtener la cantidad de dinero del metadata del SERVIDOR (no del cliente)
    local amount = tonumber(serverItem.metadata and serverItem.metadata.amount) or 0
    local currency = serverItem.metadata and serverItem.metadata.currency or "dollar"
    
    if amount <= 0 then
        TriggerClientEvent("vorp:TipRight", source, "Este sobre está vacío", 3000)
        return
    end
    
    -- Límite máximo de seguridad (configurable, directamente en dólares)
    local maxAmount = Config.MaxEnvelopeAmount or 10000
    if amount > maxAmount then
        TriggerClientEvent("vorp:TipRight", source, "Sobre corrupto - cantidad inválida", 3000)
        -- Log para administradores
        print(string.format("^1[SECURITY WARNING]^7 Player %s tried to unpack envelope with suspicious amount: $%.2f (max: $%.2f)", 
            GetPlayerName(source), amount, maxAmount))
        return
    end
    
    amount = math.floor(amount * 100 + 0.5) / 100
    
    -- Remover el sobre del inventario usando subItemById
    local removed = exports.vorp_inventory:subItemById(source, itemId)
    
    if not removed then
        TriggerClientEvent("vorp:TipRight", source, "Error al remover el sobre", 3000)
        return
    end
    
    -- Añadir el dinero al personaje
    if currency == "peso" then
        character.addCurrency(3, amount)
        TriggerClientEvent("vorp:TipRight", source, string.format("Recuperaste %.2f Pesos del sobre", amount), 3000)
    else
        character.addCurrency(0, amount)
        TriggerClientEvent("vorp:TipRight", source, string.format("Recuperaste $%.2f del sobre", amount), 3000)
    end
    
    -- Recargar inventario
    TriggerClientEvent("vorpinventory:updateinventory", source)
end

-- Limpiar cooldown cuando el jugador se desconecta
AddEventHandler('playerDropped', function()
    local source = source
    if packCooldown[source] then
        packCooldown[source] = nil
    end
end)

return MoneyEnvelopeService
