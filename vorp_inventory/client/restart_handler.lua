-- ============================================
-- CLIENT RESTART HANDLER - Hot Reload Support
-- ============================================
-- Handles client-side cleanup and restoration during resource restart

local resourceName = GetCurrentResourceName()

-- CRITICAL: This runs SYNCHRONOUSLY when resource stops
-- Must be at the top to execute first
AddEventHandler('onResourceStop', function(resource)
    if resource ~= resourceName then return end
    
    -- IMMEDIATE cleanup - runs before anything else
    local ped = PlayerPedId()
    
    -- Force close NUI immediately
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({ 
        action = "hide",
        force = true 
    })
    
    -- Clear inventory state
    if InInventory then
        InInventory = false
    end
    
    -- Re-enable ALL controls immediately
    for i = 0, 255 do
        EnableControlAction(0, i, true)
    end
    
    -- Clear local variables
    if UserInventory then
        for k in pairs(UserInventory) do
            UserInventory[k] = nil
        end
    end
    
    if UserWeapons then
        for k in pairs(UserWeapons) do
            UserWeapons[k] = nil
        end
    end
    
    if ClientItems then
        for k in pairs(ClientItems) do
            ClientItems[k] = nil
        end
    end
    
    print("^3[VORP Inventory Client]^7 Cleaned up before restart")
end)

-- Handle restart from server
RegisterNetEvent("vorp_inventory:Client:CleanupBeforeRestart", function()
    -- Force close any open inventory immediately
    if InInventory then
        InInventory = false
    end
    
    -- Force close NUI
    SetNuiFocus(false, false)
    SendNUIMessage({ 
        action = "hide",
        force = true 
    })
    
    -- Re-enable all controls
    for i = 0, 255 do
        EnableControlAction(0, i, true)
    end
    
    print("^3[VORP Inventory Client]^7 Forced inventory close before restart")
end)

-- Full reload after restart
RegisterNetEvent("vorp_inventory:Client:FullReload", function()
    print("^2[VORP Inventory Client]^7 Reloading inventory after restart...")
    
    -- Wait for player to be ready
    if not LocalPlayer.state.IsInSession then
        repeat Wait(500) until LocalPlayer.state.IsInSession
    end
    
    -- CRITICAL: Force close NUI and clear ALL client data first
    SendNUIMessage({ action = "hide" })
    SetNuiFocus(false, false)
    
    -- Clear ALL old data completely
    if UserInventory then
        for k in pairs(UserInventory) do
            UserInventory[k] = nil
        end
    end
    UserInventory = {}
    
    if UserWeapons then
        for k in pairs(UserWeapons) do
            UserWeapons[k] = nil
        end
    end
    UserWeapons = {}
    
    if ClientItems then
        for k in pairs(ClientItems) do
            ClientItems[k] = nil
        end
    end
    ClientItems = {}
    
    -- Wait to ensure everything is cleared
    Wait(500)
    
    -- Now reload everything from server (ONE TIME ONLY)
    TriggerServerEvent("vorpinventory:getItemsTable")
    Wait(300)
    TriggerServerEvent("vorpinventory:getInventory")
    Wait(500)
    TriggerServerEvent("vorpCore:LoadAllAmmo")
    Wait(300)
    
    -- Refresh NUI with clean data
    if NUIService and NUIService.initiateData then
        NUIService.initiateData()
    end
    if NUIService and NUIService.LoadInv then
        NUIService.LoadInv()
    end
    
    if NUIService and NUIService.RefreshQuickSlotsCache then
        NUIService.RefreshQuickSlotsCache()
    end
    
    print("^2[VORP Inventory Client]^7 Reload complete!")
end)

-- Reload after restart (lighter version)
RegisterNetEvent("vorp_inventory:Client:ReloadAfterRestart", function()
    -- Just reload inventory data without full reset
    Wait(500)
    TriggerServerEvent("vorpinventory:getInventory")
    Wait(300)
    
    if NUIService and NUIService.initiateData then
        NUIService.initiateData()
    end
    if NUIService and NUIService.LoadInv then
        NUIService.LoadInv()
    end
end)

-- Handle resource start
AddEventHandler('onClientResourceStart', function(resource)
    if resource ~= resourceName then return end
    
    -- Check if this is a hot reload (player already in session)
    if LocalPlayer.state.IsInSession then
        print("^3[VORP Inventory Client]^7 Hot reload detected, waiting for server to trigger sync...")
        
        -- Give server time to initialize
        -- The server will trigger "vorp_inventory:Client:FullReload" in a staggered manner to prevent crash
        -- Wait(1000)
        -- TriggerEvent("vorp_inventory:Client:FullReload")
    end
end)
