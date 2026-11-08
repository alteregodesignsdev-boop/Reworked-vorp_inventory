-- Currency Item Service (Client)
-- Maneja la sincronización de items de moneda en el cliente

CurrencyItemService = {}

local Core = exports.vorp_core:GetCore()

-- Variables para rastrear el dinero anterior
local lastMoney = 0
local lastGold = 0
local lastRol = 0
local lastPeso = 0

-- Variable para controlar el thread
local monitorThreadActive = false
local monitorThreadStarted = false
local resourceName = GetCurrentResourceName()

-- Detener el thread cuando el recurso se detenga
AddEventHandler('onResourceStop', function(resource)
    if resource == resourceName then
        monitorThreadActive = false
        monitorThreadStarted = false
        print("^3[CurrencyItemService]^7 Monitor thread stopped")
    end
end)

-- Función para agregar items de moneda virtuales a la lista de items
function CurrencyItemService.AddCurrencyItemsToInventory(items, moneyData)
    if not moneyData then 
        print("^3[CurrencyItemService]^7 moneyData es nil")
        return items 
    end
    
    local currencyItems = {}
    
    -- Money (dólares) - ya viene en dólares desde el servidor
    local moneyAmount = math.floor((moneyData.money or 0) * 100 + 0.5) / 100 -- Redondear a 2 decimales
    -- Solo agregar si tiene dinero
    if moneyAmount > 0 then
        table.insert(currencyItems, {
            id = "currency_money",
            name = "dollar",
            label = "Dólares",
            type = "item_money",
            count = moneyAmount,
            limit = 999999,
            canUse = false,
            canRemove = false,
            metadata = {},
            desc = "Dinero en efectivo - $" .. string.format("%.2f", moneyAmount),
            weight = 0.0,
            group = 1,
            degradation = nil,
            maxDegradation = 0
        })
    end
    
    -- Gold (oro)
    if Config.UseGoldItem then
        local goldAmount = math.floor((moneyData.gold or 0) * 100 + 0.5) / 100
        -- Solo agregar si tiene oro
        if goldAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_gold",
                name = "goldbar",
                label = "Oro",
                type = "item_money",
                count = goldAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Oro puro - " .. string.format("%.2f", goldAmount) .. " oz",
                weight = 0.0,
                group = 1,
                degradation = nil,
                maxDegradation = 0
            })
        end
    end
    
    -- Rol tokens
    if Config.UseRolItem then
        local rolAmount = math.floor((moneyData.rol or 0) * 100 + 0.5) / 100
        -- Solo agregar si tiene tokens
        if rolAmount > 0 then
            table.insert(currencyItems, {
                id = "currency_rol",
                name = "rol_token",
                label = "Tokens ROL",
                type = "item_money",
                count = rolAmount,
                limit = 999999,
                canUse = false,
                canRemove = false,
                metadata = {},
                desc = "Tokens de rol - " .. string.format("%.2f", rolAmount),
                weight = 0.0,
                group = 1,
                degradation = nil,
                maxDegradation = 0
            })
        end
    end
    
    -- Peso
    local pesoAmount = math.floor((moneyData.peso or 0) * 100 + 0.5) / 100
    if pesoAmount > 0 then
        table.insert(currencyItems, {
            id = "currency_peso",
            name = "peso",
            label = "Pesos Mexicanos",
            type = "item_money",
            count = pesoAmount,
            limit = 999999,
            canUse = false,
            canRemove = false,
            metadata = {},
            desc = "Pesos Mexicanos - " .. string.format("%.2f", pesoAmount),
            weight = 0.0,
            group = 1,
            degradation = nil,
            maxDegradation = 0
        })
    end
    
    -- Agregar los items de moneda al principio de la lista
    local result = {}
    for _, currencyItem in ipairs(currencyItems) do
        table.insert(result, currencyItem)
    end
    
    -- Agregar el resto de items
    for _, item in ipairs(items) do
        table.insert(result, item)
    end
    
    return result
end

-- Función para verificar si un item es de moneda
function CurrencyItemService.IsCurrencyItem(itemName)
    return itemName == "dollar" or itemName == "goldbar" or itemName == "rol_token" or itemName == "peso"
end

-- Función para iniciar el monitor (se llama después de que todo esté cargado)
function CurrencyItemService.StartMonitor()
    if monitorThreadStarted then
        print("^3[CurrencyItemService]^7 Monitor thread already started")
        return
    end
    
    monitorThreadStarted = true
    monitorThreadActive = true
    
    CreateThread(function()
        -- Esperar a que todo esté inicializado
        Wait(2000)
        
        print("^2[CurrencyItemService]^7 Starting monitor thread...")
        
        while monitorThreadActive do
            Wait(1000) -- Verificar cada segundo
            
            -- Protección: Verificar que todo esté inicializado
            if not Core then
                Wait(5000) -- Esperar más tiempo si Core no está disponible
                goto continue
            end
            
            -- Protección: Usar pcall para evitar crashes
            local success, err = pcall(function()
                -- Obtener el dinero desde el StateBag del jugador
                local playerId = PlayerId()
                if not playerId or playerId == -1 then
                    return
                end
                
                local playerState = Player(playerId).state
                
                if playerState and playerState.Character then
                    local currentMoney = playerState.Character.Money or 0
                    local currentGold = playerState.Character.Gold or 0
                    local currentRol = playerState.Character.Rol or 0
                    local currentPeso = playerState.Character.Peso or 0
                    
                    -- Si el dinero cambió, actualizar el inventario
                    if currentMoney ~= lastMoney or currentGold ~= lastGold or currentRol ~= lastRol or currentPeso ~= lastPeso then
                        lastMoney = currentMoney
                        lastGold = currentGold
                        lastRol = currentRol
                        lastPeso = currentPeso
                        
                        -- Solo actualizar si el inventario está abierto y NUIService existe
                        if InInventory and NUIService and type(NUIService.LoadInv) == "function" then
                            NUIService.LoadInv()
                        end
                    end
                end
            end)
            
            if not success then
                print("^1[CurrencyItemService]^7 Error in monitor thread: " .. tostring(err))
                Wait(5000) -- Esperar más tiempo si hay error
            end
            
            ::continue::
        end
        
        print("^3[CurrencyItemService]^7 Monitor thread exited")
    end)
end

return CurrencyItemService
