-- ============================================
-- RESTART HANDLER - Hot Reload Support
-- ============================================
-- This file handles resource restart with players online
-- Preserves inventory state and re-syncs all connected players

local resourceName = GetCurrentResourceName()

-- Store player states before restart
local function SavePlayerStates()
    local players = GetPlayers()
    local stateData = {}
    
    for _, playerId in ipairs(players) do
        local source = tonumber(playerId)
        if source then
            stateData[source] = {
                inventoryOpen = InInventory and InInventory[source] or false,
                -- Add any other state you need to preserve
            }
        end
    end
    
    -- Store in global state (persists across restart)
    GlobalState['vorp_inventory_restart_data'] = stateData
    
    print(string.format("^2[VORP Inventory]^7 Saved state for %d players before restart", #players))
end

-- Restore player states after restart
local function RestorePlayerStates()
    local stateData = GlobalState['vorp_inventory_restart_data']
    
    if not stateData then
        print("^2[VORP Inventory]^7 No previous state found, fresh start")
        return
    end
    
    local players = GetPlayers()
    local restoredCount = 0
    
    for _, playerId in ipairs(players) do
        local source = tonumber(playerId)
        if source and stateData[source] then
            -- Close any open inventories
            if stateData[source].inventoryOpen then
                TriggerClientEvent("vorp_inventory:CloseInv", source)
            end
            
            restoredCount = restoredCount + 1
        end
    end
    
    -- Clear the saved state
    GlobalState['vorp_inventory_restart_data'] = nil
    
    print(string.format("^2[VORP Inventory]^7 Restored state for %d players after restart", restoredCount))
end

-- Clean up before resource stops
AddEventHandler('onResourceStop', function(resource)
    if resource ~= resourceName then return end
    
    print("^3[VORP Inventory]^7 Resource stopping, closing all inventories...")
    
    -- FIRST: Close all open inventories immediately
    local players = GetPlayers()
    for _, playerId in ipairs(players) do
        local source = tonumber(playerId)
        if source then
            -- Send close event
            TriggerClientEvent("vorp_inventory:CloseInv", source)
            TriggerClientEvent("vorp_inventory:Client:CleanupBeforeRestart", source)
        end
    end
    
    -- Wait a bit to ensure clients receive the close event
    Wait(200)
    
    -- THEN: Save all player states
    SavePlayerStates()
    
    -- Clear server-side inventory locks
    if InventoryBeingUsed then
        for k in pairs(InventoryBeingUsed) do
            InventoryBeingUsed[k] = nil
        end
    end
    
    print("^2[VORP Inventory]^7 Cleanup complete, resource can restart safely")
end)

-- Restore state after resource starts
AddEventHandler('onResourceStart', function(resource)
    if resource ~= resourceName then return end
    
    print("^2[VORP Inventory]^7 Resource started, checking for player states...")
    
    -- Wait a bit for everything to initialize
    SetTimeout(2000, function()
        RestorePlayerStates()
        
        -- Re-sync all connected players staggered
        Citizen.CreateThread(function()
            local players = GetPlayers()
            local batchSize = 3
            local count = 0
            
            for _, playerId in ipairs(players) do
                local source = tonumber(playerId)
                if source then
                    -- Trigger full inventory reload on client
                    TriggerClientEvent("vorp_inventory:Client:FullReload", source)
                    count = count + 1
                    
                    -- Stagger to avoid overwhelming the server thread/DB and network
                    if count >= batchSize then
                        count = 0
                        Wait(500)
                    end
                end
            end
            
            print(string.format("^2[VORP Inventory]^7 Hot reload complete for %d players", #players))
        end)
    end)
end)

-- Export for manual restart trigger
exports('RestartInventory', function()
    SavePlayerStates()
    
    SetTimeout(100, function()
        ExecuteCommand('restart ' .. resourceName)
    end)
end)
