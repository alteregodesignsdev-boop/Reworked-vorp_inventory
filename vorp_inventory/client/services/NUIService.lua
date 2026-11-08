local isProcessingPay     = false
local timerUse           = 0
local candrop             = true
local cangive             = true
local CanOpen             = true
local InventoryIsDisabled = false
local T                   = TranslationInv.Langs[Lang]
local Core                = exports.vorp_core:GetCore()
StoreSynMenu              = false
GenSynInfo                = {}
InInventory               = false
NUIService                = {}
SynPending                = false
local nextUseAt           = 0
local nextQuickSlotAt     = 0


local QuickSlotsCache     = {}
local QuickSlotsCacheReady = false

RegisterNetEvent('inv:dropstatus', function(x)
	candrop = x
end)

RegisterNetEvent('inv:givestatus')
AddEventHandler('inv:givestatus', function(x)
	cangive = x
end)

-- Evento para actualizar el inventario cuando el dinero cambia
RegisterNetEvent('vorpInventory:moneyUpdated')
AddEventHandler('vorpInventory:moneyUpdated', function()
	-- Solo actualizar si el inventario está abierto
	if InInventory and NUIService and type(NUIService.LoadInv) == "function" then
		-- Esperar un poco para asegurar que el StateBag se haya actualizado
		SetTimeout(200, function()
			NUIService.LoadInv()
		end)
	end
end)

function ApplyPosfx()
	if Config.UseFilter then
		AnimpostfxPlay(Config.Filter)
		AnimpostfxSetStrength(Config.Filter, 0.5)
	end
end

function NUIService.ReloadInventory(inventory, packed)
	local payload = {}
	if packed then
		payload = msgpack.unpack(packed)
	else
		payload = json.decode(inventory)
	end

	if payload.itemList == '[]' then
		payload.itemList = {}
	end

	for _, item in pairs(payload.itemList) do
		if item.type == "item_weapon" then
			item.label = item.custom_label or Utils.GetWeaponDefaultLabel(item.name)

			if item.desc and item.custom_desc then
				item.desc = item.custom_desc
			end

			if not item.desc then
				item.desc = Utils.GetWeaponDefaultDesc(item.name)
			end
		else
		
			if not item.desc then
				if ClientItems[item.name] then
					item.desc = ClientItems[item.name].desc
				end
			end
		end
	end

	SendNUIMessage(payload)
	Wait(500)
	NUIService.LoadInv()
	SynPending = false
end

function NUIService.OpenCustomInventory(name, id, capacity, weight)
	CanOpen = Core.Callback.TriggerAwait("vorp_inventory:Server:CanOpenCustom", id)
	if not CanOpen then return end

	ApplyPosfx()
	DisplayRadar(false)
	CanOpen = false
	SetNuiFocus(true, true)
	SendNUIMessage({
		action = "display",
		type = "custom",
		title = tostring(name),
		id = tostring(id),
		capacity = capacity,
		weight = weight,
	})
	InInventory = true
end

function NUIService.NUIMoveToCustom(obj)
	TriggerServerEvent("vorp_inventory:MoveToCustom", json.encode(obj))
end

function NUIService.NUITakeFromCustom(obj)
	TriggerServerEvent("vorp_inventory:TakeFromCustom", json.encode(obj))
end

function NUIService.OpenPlayerInventory(name, id, type)
	CanOpen = Core.Callback.TriggerAwait("vorp_inventory:Server:CanOpenCustom", id)
	if not CanOpen then return end

	CanOpen = false
	ApplyPosfx()
	DisplayRadar(false)
	SetNuiFocus(true, true)
	SendNUIMessage({
		action = "display",
		type = type,
		title = name,
		id = id,
	})
	InInventory = true
end

function NUIService.NUIMoveToPlayer(obj)
	TriggerServerEvent("vorp_inventory:MoveToPlayer", json.encode(obj))
end

function NUIService.NUITakeFromPlayer(obj)
	TriggerServerEvent("vorp_inventory:TakeFromPlayer", json.encode(obj))
end

function NUIService.TransferLimitExceeded(maxValue)
	local message = string.format(T.MaxItemTransfer, maxValue.max)
	Core.NotifyRightTip(message, 4000)
end

function NUIService.CloseInv()
	if Config.UseFilter then
		AnimpostfxStop(Config.Filter)
	end
	if StoreSynMenu then
		StoreSynMenu = false
		GenSynInfo = {}
		for _, item in pairs(UserInventory) do
			if item.metadata ~= nil and item.metadata.description ~= nil and (item.metadata.orgdescription ~= nil or item.metadata.orgdescription == "") then
				if item.metadata.orgdescription == "" then
					item.metadata.description = nil
				else
					item.metadata.description = item.metadata.orgdescription
				end
				item.metadata.orgdescription = nil
			end
		end
	end

	if not CanOpen then
		TriggerServerEvent("vorp_inventory:Server:UnlockCustomInv")
	end
	DisplayRadar(true)
	SetNuiFocus(false, false)
	SendNUIMessage({ action = "hide" })
	InInventory = false
	TriggerEvent("vorp_stables:setClosedInv", false)
	TriggerEvent("syn:closeinv")
end

function NUIService.setProcessingPayFalse()
	isProcessingPay = false
end

function NUIService.NUIUnequipWeapon(obj)
	local data = obj

	if UserWeapons[tonumber(data.id)] then
		UserWeapons[tonumber(data.id)]:UnequipWeapon()
	end

	NUIService.LoadInv()
end

function NUIService.NUIGetNearPlayers(obj)
	local nearestPlayers = Utils.getNearestPlayers()

	local playerIds = {}
	for _, player in ipairs(nearestPlayers) do
		if player ~= PlayerId() then
			local playerId = GetPlayerServerId(player)
			if Config.ShowCharacterNameOnGive then
				local name = Player(playerId).state.Character.FirstName .. " " .. Player(playerId).state.Character.LastName
				playerIds[#playerIds + 1] = { label = name, player = playerId }
			else
				playerIds[#playerIds + 1] = { label = playerId, player = playerId }
			end
		end
	end
	if #playerIds > 0 then
		NUIService.NUISetNearPlayers(obj, playerIds)
	else
		Core.NotifyRightTip(T.noplayersnearby, 5000)
	end
end

function NUIService.NUISetNearPlayers(obj, nearestPlayers)
	local nuiReturn = {}

	nuiReturn.action = "nearPlayers"
	nuiReturn.foundAny = true
	nuiReturn.players = nearestPlayers
	nuiReturn.item = obj.item
	nuiReturn.hash = obj.hash or 1
	nuiReturn.count = obj.count or 1
	nuiReturn.id = obj.id or 0
	nuiReturn.type = obj.type
	nuiReturn.what = obj.what
	SendNUIMessage(nuiReturn)
end

function NUIService.NUIGiveItem(obj)
	if not cangive then
		return Core.NotifyRightTip(T.cantgivehere, 5000)
	end

	local nearestPlayers = Utils.getNearestPlayers()
	local data = obj
	local data2 = data.data
	local isvalid = Validator.IsValidNuiCallback(data.hsn)

	if isvalid then
		for _, player in ipairs(nearestPlayers) do
			if GetPlayerServerId(player) == tonumber(data.player) then
				local itemId = data2.id
				local target = tonumber(data.player)

				-- Manejar items de moneda (dollar, goldbar, rol_token)
				if data2.type == "item_money" then
					if isProcessingPay then return end
					isProcessingPay = true
					
					-- El count ya está en dólares, no necesita conversión
					local realAmount = tonumber(data2.count)
					
					-- Validación: No permitir dar $0
					if realAmount <= 0 then
						Core.NotifyRightTip("No puedes dar $0", 3000)
						isProcessingPay = false
						return
					end
					
					-- Redondear a 2 decimales para evitar problemas de precisión
					realAmount = math.floor(realAmount * 100 + 0.5) / 100
					
					if data2.item == "dollar" or data2.name == "dollar" then
						TriggerServerEvent("vorpinventory:giveMoneyToPlayer", target, realAmount)
					elseif data2.item == "goldbar" or data2.name == "goldbar" then
						TriggerServerEvent("vorpinventory:giveGoldToPlayer", target, realAmount)
					elseif data2.item == "peso" or data2.name == "peso" then
						TriggerServerEvent("vorpinventory:givePesoToPlayer", target, realAmount)
					elseif data2.item == "rol_token" or data2.name == "rol_token" then
						-- Agregar evento para ROL si es necesario
						Core.NotifyRightTip("No se puede transferir ROL tokens", 3000)
						isProcessingPay = false
						return
					end
				elseif Config.UseGoldItem and data2.type == "item_gold" then
					if isProcessingPay then return end
					isProcessingPay = true
					TriggerServerEvent("vorpinventory:giveGoldToPlayer", target, tonumber(data2.count))
				elseif data2.type == "item_ammo" then
					if isProcessingPay then return end
					isProcessingPay = true
					local amount = tonumber(data2.count)
					local ammotype = data2.item
					local maxcount = SharedData.MaxAmmo[ammotype]
					if amount > 0 and maxcount >= amount then
						TriggerServerEvent("vorpinventory:servergiveammo", ammotype, amount, target, maxcount)
					end
				elseif data2.type == "item_standard" then
					local amount = tonumber(data2.count)
					local item = UserInventory[itemId]

					if amount > 0 and item ~= nil and item:getCount() >= amount then
						TriggerServerEvent("vorpinventory:serverGiveItem", itemId, amount, target)
					end
				else
					TriggerServerEvent("vorpinventory:serverGiveWeapon", tonumber(itemId), target)
				end

				NUIService.LoadInv()
			end
		end
	end
end

-- Función para empaquetar dinero en un sobre
function NUIService.NUIPackMoney(obj, cb)
	local reply = cb or function() end
	local isvalid = Validator.IsValidNuiCallback(obj.hsn)
	
	if not isvalid then
		return reply("ok")
	end
	
	local amount = tonumber(obj.amount) or 0
	local currency = obj.currency or "dollar"
	
	if amount <= 0 then
		Core.NotifyRightTip("Cantidad inválida", 3000)
		return reply("ok")
	end
	
	TriggerServerEvent("vorpinventory:serverPackMoney", amount, currency)
	return reply("ok")
end

function NUIService.NUIDropItem(obj, cb)
	local reply = cb or function()
	end
	
	if not candrop then
		Core.NotifyRightTip(T.cantdrophere, 5000)
		return reply("ok")
	end

	local aux = Utils.expandoProcessing(obj)
	if type(aux) ~= "table" then
		return reply("ok")
	end
	
	local isvalid = Validator.IsValidNuiCallback(aux.hsn)

	if isvalid then
		local itemName = aux.item
		local itemId = aux.id
		local metadata = aux.metadata
		local type = aux.type
		local qty = tonumber(aux.number)
		local degradation = aux.degradation
		
		-- Manejar items de moneda
		if type == "item_money" then
			local realAmount = qty
			
			if realAmount <= 0 then
				Core.NotifyRightTip("No puedes dropear $0", 3000)
				return reply("ok")
			end
			
			realAmount = math.floor(realAmount * 100 + 0.5) / 100
			
			if itemName == "dollar" or aux.name == "dollar" then
				TriggerServerEvent("vorpinventory:serverDropMoney", realAmount)
			elseif itemName == "goldbar" or aux.name == "goldbar" then
				if Config.UseGoldItem then
					TriggerServerEvent("vorpinventory:serverDropGold", realAmount)
				end
			elseif itemName == "rol_token" or aux.name == "rol_token" then
				Core.NotifyRightTip("No se puede dropear ROL tokens", 3000)
				return reply("ok")
			elseif itemName == "peso" or aux.name == "peso" then
				Core.NotifyRightTip("No se pueden dropear Pesos Mexicanos", 3000)
				return reply("ok")
			end
		end

		if Config.UseGoldItem then
			if type == "item_gold" then
				TriggerServerEvent("vorpinventory:serverDropGold", qty)
			end
		end

		if type == "item_standard" then
			if aux.number ~= nil and aux.number ~= '' then
				local item = UserInventory[itemId]
				if not item then return end

				if qty <= 0 or qty > item:getCount() then return end

				TriggerServerEvent("vorpinventory:serverDropItem", itemName, itemId, qty, metadata, degradation)
			end
		end

		if type == "item_weapon" then
			TriggerServerEvent("vorpinventory:serverDropWeapon", aux.id)

			if UserWeapons[aux.id] then
				local weapon = UserWeapons[aux.id]

				if weapon:getUsed() then
					weapon:setUsed(false)
					weapon:UnequipWeapon()
				end

				UserWeapons[aux.id] = nil
			end
		end
		SetTimeout(100, function()
			NUIService.LoadInv()
		end)
	end
	reply("ok")
end

local function getGuidFromItemId(inventoryId, itemData, category, slotId)
	local outItem = DataView.ArrayBuffer(8 * 13)

	if not itemData then
		itemData = 0
	end
	--InventoryGetGuidFromItemid
	local success = Citizen.InvokeNative(0x886DFD3E185C8A89, inventoryId, itemData, category, slotId, outItem:Buffer())
	if success then
		return outItem:Buffer() 
	else
		return nil
	end
end

local function addWardrobeInventoryItem(itemName, slotHash)
	local itemHash    = joaat(itemName)
	local addReason   = joaat("ADD_REASON_DEFAULT")
	local inventoryId = 1

	
	local isValid     = Citizen.InvokeNative(0x6D5D51B188333FD1, itemHash, 0) 
	if not isValid then
		return false
	end

	local characterItem = getGuidFromItemId(inventoryId, nil, joaat("CHARACTER"), 0xA1212100)
	if not characterItem then
		return false
	end

	local wardrobeItem = getGuidFromItemId(inventoryId, characterItem, joaat("WARDROBE"), 0x3DABBFA7)
	if not wardrobeItem then
		return false
	end

	local itemData = DataView.ArrayBuffer(8 * 13)

	
	local isAdded = Citizen.InvokeNative(0xCB5D11F9508A928D, inventoryId, itemData:Buffer(), wardrobeItem, itemHash, slotHash, 1, addReason)
	if not isAdded then
		return false
	end

	
	local equipped = Citizen.InvokeNative(0x734311E2852760D0, inventoryId, itemData:Buffer(), true)
	return equipped;
end

local function HasOffhandHolster(ped)
	ped = ped or PlayerPedId()
	if not ped or ped == 0 or not DoesEntityExist(ped) then return false end

	-- 1. Verificación primaria mediante jo_libs component module
	local success, hasEquipped = pcall(function()
		local comp = exports.jo_libs:jo_component_get()
		if comp and comp.isCategoryEquiped then
			return comp.isCategoryEquiped(ped, "holsters_left") or comp.isCategoryEquiped(ped, "holsters_crossdraw")
		end
		return false
	end)
	if success and hasEquipped then
		return true
	end

	-- 2. Verificación nativa directa Meta-Ped de RedM/RDR3
	-- 0xB6B6122D = `holsters_left` (Cartuchera izquierda / off-hand)
	-- 0x49C89D9B = `holsters_crossdraw` (Cartuchera de tiro cruzado)
	if Citizen.InvokeNative(0xFB4891BD7578CDC1, ped, 0xB6B6122D) == 1 then
		return true
	end
	if Citizen.InvokeNative(0xFB4891BD7578CDC1, ped, 0x49C89D9B) == 1 then
		return true
	end

	-- 3. Fallback por escaneo de componentes adjuntos al ped
	local numComps = Citizen.InvokeNative(0x90403E8107B60E81, ped)
	if numComps and numComps > 0 then
		for i = 0, numComps - 1 do
			local cat = Citizen.InvokeNative(0xCCB97B51893C662F, ped, i, Citizen.ResultAsInteger())
			if cat == 0xB6B6122D or cat == 0x49C89D9B then
				return true
			end
		end
	end

	return false
end

local function useWeapon(data)
	data.type = data.type or "item_weapon"
	local now = GetGameTimer()
	if nextUseAt > 0 and now < nextUseAt then
		Core.NotifyRightTip(T.slow, 2000)
		return
	end

	local ped = PlayerPedId()
	local _, weaponHash = GetCurrentPedWeapon(ped, false, 0, false)
	local weaponId = tonumber(data.id)
	if not weaponId then
		return
	end
	if weaponId and not UserWeapons[weaponId] then
		return
	end
	local weapName = joaat(UserWeapons[weaponId]:getName())
	local isWeaponAGun = Citizen.InvokeNative(0x705BE297EEBDB95D, weapName)
	local isWeaponOneHanded = Citizen.InvokeNative(0xD955FEE4B87AFA07, weapName)
	local isArmed = Citizen.InvokeNative(0xCB690F680A3EA971, ped, 4)
	
	-- Comprobar si ya tiene armas cortas de una mano equipadas (primaria y/o secundaria)
	local hasPrimaryOneHanded = false
	local hasSecondaryOneHanded = false
	for id, w in pairs(UserWeapons) do
		if id ~= weaponId and w:getUsed() then
			local name = joaat(w:getName())
			if Citizen.InvokeNative(0x705BE297EEBDB95D, name) and Citizen.InvokeNative(0xD955FEE4B87AFA07, name) then
				if w:getUsed2() then
					hasSecondaryOneHanded = true
				else
					hasPrimaryOneHanded = true
				end
			end
		end
	end

	if isWeaponAGun and isWeaponOneHanded then
		if hasPrimaryOneHanded and hasSecondaryOneHanded then
			TriggerEvent('vorp:NotifyLeft', "Armas", "Ya tienes el máximo de armas cortas equipadas.", "generic_textures", "lock", 4000, "COLOR_YELLOW")
			nextUseAt = now + (Config.SpamDelay or 1000)
			timerUse = 0
			SendNUIMessage({ action = "setCooldown", delay = (Config.SpamDelay or 1000) })
			NUIService.LoadInv()
			return
		elseif hasPrimaryOneHanded and Config.DuelWield then
			if Config.RequireOffhandHolster and not HasOffhandHolster(ped) then
				TriggerEvent('vorp:NotifyLeft', "Armas Duales", "No puedes llevar un arma secundaria sin tener equipada una cartuchera izquierda.", "generic_textures", "lock", 4000, "COLOR_RED")
				nextUseAt = now + (Config.SpamDelay or 1000)
				timerUse = 0
				SendNUIMessage({ action = "setCooldown", delay = (Config.SpamDelay or 1000) })
				NUIService.LoadInv()
				return
			end

			UserWeapons[weaponId]:setUsed2(true)
			UserWeapons[weaponId]:setUsed(true)
			UserWeapons[weaponId]:equipwep()
			UserWeapons[weaponId]:loadComponents()
		else
			UserWeapons[weaponId]:setUsed2(false)
			UserWeapons[weaponId]:setUsed(true)
			UserWeapons[weaponId]:equipwep()
			UserWeapons[weaponId]:loadComponents()
		end
	else
		UserWeapons[weaponId]:setUsed2(false)
		UserWeapons[weaponId]:setUsed(true)
		UserWeapons[weaponId]:equipwep()
		UserWeapons[weaponId]:loadComponents()
	end
	if UserWeapons[weaponId]:getUsed() then
		local serial = UserWeapons[weaponId]:getSerialNumber()
		local info = { weaponId = weaponId, serialNumber = serial }
		local key = string.format("GetEquippedWeaponData_%d", weapName)
		LocalPlayer.state:set(key, info, true)
	end
	TriggerServerEvent("vorpinventory:setUsedWeapon", weaponId, UserWeapons[weaponId]:getUsed(), UserWeapons[weaponId]:getUsed2())

	nextUseAt = now + (Config.SpamDelay or 2000)
	timerUse = 0
	SendNUIMessage({ action = "setCooldown", delay = (Config.SpamDelay or 2000) })

	NUIService.LoadInv()
end

-- Hilo de verificación automática: si el jugador se quita la cartuchera izquierda, se desequipa el arma secundaria
CreateThread(function()
	while true do
		Wait(2000)
		if Config.RequireOffhandHolster then
			local ped = PlayerPedId()
			if DoesEntityExist(ped) and not IsEntityDead(ped) then
				local hasOffhand = HasOffhandHolster(ped)
				if not hasOffhand and UserWeapons then
					for _, weapon in pairs(UserWeapons) do
						if weapon:getUsed2() then
							weapon:UnequipWeapon()
							TriggerEvent('vorp:NotifyLeft', "Armas Duales", "Te has quitado la cartuchera izquierda: arma secundaria desequipada.", "generic_textures", "lock", 4000, "COLOR_YELLOW")
							NUIService.LoadInv()
						end
					end
				end
			end
		end
	end
end)

exports("useWeapon", useWeapon)


local function useItem(data)
	local now = GetGameTimer()
	if nextUseAt > 0 and now < nextUseAt then
		Core.NotifyRightTip(T.slow, 2000)
		return
	end

	TriggerServerEvent("vorp_inventory:useItem", data)
nextUseAt = now + (Config.SpamDelay or 2000)
timerUse = 0
SendNUIMessage({ action = "setCooldown", delay = (Config.SpamDelay or 2000) })
end

function NUIService.NUIUseItem(data)
	if data.type == "item_standard" then
		useItem(data)
	elseif data.type == "item_weapon" then
		useWeapon(data)
	end
end

exports("useItem", useItem) 


function NUIService.NUISound()
	if Config.SFX.ItemHover then
		PlaySoundFrontend("BACK", "RDRO_Character_Creator_Sounds", true, 0)
	end
end

function NUIService.NUIFocusOff()
	if Config.UseFilter then
		AnimpostfxStop(Config.Filter)
	end
	DisplayRadar(true)
	if Config.SFX.CloseInventory then
		PlaySoundFrontend("SELECT", "RDRO_Character_Creator_Sounds", true, 0)
	end
	NUIService.CloseInv()
end

local function loadItems()
	local items = {}
	
	-- Protección: Verificar que UserInventory exista
	if not UserInventory then
		print("^3[NUIService]^7 loadItems: UserInventory is nil")
		return items
	end
	
	-- Protección: Usar pcall para cada item
	if not StoreSynMenu then
		for id, item in pairs(UserInventory) do
			local success, err = pcall(function()
				if item and item.maxDegradation and item.maxDegradation > 0 and item.degradation and tonumber(item.degradation) and tonumber(item.degradation) > 0 then
					item.percentage = item:getPercentage()
				end
				table.insert(items, item)
			end)
			if not success then
				print("^1[NUIService]^7 Error loading item " .. tostring(id) .. ": " .. tostring(err))
			end
		end
	elseif StoreSynMenu then
		for _, item in pairs(UserInventory) do
			local success, err = pcall(function()
				if item.metadata ~= nil and item.metadata.orgdescription ~= nil then
					item.metadata.description = item.metadata.orgdescription
					item.metadata.orgdescription = nil
				end
			end)
			if not success then
				print("^1[NUIService]^7 Error processing item metadata: " .. tostring(err))
			end
		end

		local buyitems = GenSynInfo.buyitems
		if buyitems and next(buyitems) then
			for _, item in pairs(UserInventory) do
				local success, err = pcall(function()
					for k, v in ipairs(buyitems) do
						if item.name == v.name then
							item.metadata = item.metadata or {}
							if item.metadata.orgdescription == nil then
								if item.metadata.description ~= nil then
									item.metadata.orgdescription = item.metadata.description
								else
									item.metadata.orgdescription = ""
								end
							else
							end
							item.metadata.description = T.cansell .. "<span style=color:Green;>" .. v.price .. "</span>"
						end
					end
					if item and item.maxDegradation and item.maxDegradation > 0 and item.degradation and tonumber(item.degradation) and tonumber(item.degradation) > 0 then
						item.percentage = item:getPercentage()
					end
					table.insert(items, item)
				end)
				if not success then
					print("^1[NUIService]^7 Error processing store item: " .. tostring(err))
				end
			end
		else
			for _, item in pairs(UserInventory) do
				local success, err = pcall(function()
					if item and item.maxDegradation and item.maxDegradation > 0 and item.degradation and tonumber(item.degradation) and tonumber(item.degradation) > 0 then
						item.percentage = item:getPercentage()
					end
					table.insert(items, item)
				end)
				if not success then
					print("^1[NUIService]^7 Error loading item: " .. tostring(err))
				end
			end
		end
	end
	return items
end

local function loadWeapons()
	local weapons = {}
	
	-- Protección: Verificar que UserWeapons exista
	if not UserWeapons then
		print("^3[NUIService]^7 loadWeapons: UserWeapons is nil")
		return weapons
	end
	
	for _, currentWeapon in pairs(UserWeapons) do
		-- Protección: Usar pcall para cada arma
		local success, err = pcall(function()
			local weapon = {}
			weapon.count = currentWeapon:getTotalAmmoCount()
			weapon.limit = -1
			weapon.label = currentWeapon:getLabel()
			weapon.name = currentWeapon:getName()
			weapon.metadata = {}
			weapon.hash = GetHashKey(currentWeapon:getName())
			weapon.type = "item_weapon"
			weapon.canUse = true
			weapon.canRemove = true
			weapon.id = currentWeapon:getId()
			weapon.used = currentWeapon:getUsed()
			weapon.used2 = currentWeapon:getUsed2()
			weapon.desc = currentWeapon:getDesc()
			weapon.group = 5
			weapon.serial_number = currentWeapon:getSerialNumber()
			weapon.custom_label = currentWeapon:getCustomLabel()
			weapon.custom_desc = currentWeapon:getCustomDesc()
			weapon.custom_label = currentWeapon:getCustomLabel()
			weapon.weight = currentWeapon:getWeight()
			table.insert(weapons, weapon)
		end)
		
		if not success then
			print("^1[NUIService]^7 Error loading weapon: " .. tostring(err))
		end
	end
	return weapons
end



local LocalInventoryLayout = nil

local function loadItemsAndWeapons()
	local itemsToSend = {}
	
	-- Protección: Usar pcall para cargar items y armas
	local items = {}
	local weapons = {}
	
	local success1, result1 = pcall(function()
		return loadItems()
	end)
	
	if success1 and result1 then
		items = result1
	else
		print("^1[NUIService]^7 Error loading items: " .. tostring(result1))
	end
	
	local success2, result2 = pcall(function()
		return loadWeapons()
	end)
	
	if success2 and result2 then
		weapons = result2
	else
		print("^1[NUIService]^7 Error loading weapons: " .. tostring(result2))
	end

	if Config.InventoryOrder == "items" then
		for _, item in pairs(items) do
			table.insert(itemsToSend, item)
		end
		for _, weapon in pairs(weapons) do
			table.insert(itemsToSend, weapon)
		end
	else
		for _, weapon in pairs(weapons) do
			table.insert(itemsToSend, weapon)
		end
		for _, item in pairs(items) do
			table.insert(itemsToSend, item)
		end
	end

	return itemsToSend
end


local function normalizeLayoutKey(entry)
	if entry == nil then return nil end
	local t = type(entry)
	if t == "number" or t == "string" then
		return tostring(entry)
	elseif t == "table" then
		if entry.itemId ~= nil then return tostring(entry.itemId) end
		if entry.id ~= nil then return tostring(entry.id) end
		if entry.name ~= nil then return tostring(entry.name) end
	end
	return nil
end

local function keyForItem(it)
	if not it then return nil end
	local id = it.id
	if id ~= nil and id ~= 0 and id ~= "0" then
		return tostring(id)
	end
	local name = it.name
	if name ~= nil then return tostring(name) end
	return nil
end

local function normalizeLayoutMeta(entry)
	if entry == nil then return nil end
	if type(entry) == "table" and entry.meta ~= nil then
		return tostring(entry.meta)
	end
	return nil
end

local function stableEncode(v)
	local tv = type(v)
	if v == nil then return "null" end
	if tv == "string" then return string.format("%q", v) end
	if tv == "number" or tv == "boolean" then return tostring(v) end
	if tv ~= "table" then return string.format("%q", tostring(v)) end
	local isArray = true
	local maxIndex = 0
	for k, _ in pairs(v) do
		if type(k) ~= "number" then
			isArray = false
			break
		end
		if k > maxIndex then maxIndex = k end
	end
	if isArray then
		local parts = {}
		for i = 1, maxIndex do
			table.insert(parts, stableEncode(v[i]))
		end
		return "[" .. table.concat(parts, ",") .. "]"
	end
	local keys = {}
	for k, _ in pairs(v) do
		table.insert(keys, k)
	end
	table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
	local parts = {}
	for _, k in ipairs(keys) do
		table.insert(parts, string.format("%q", tostring(k)) .. ":" .. stableEncode(v[k]))
	end
	return "{" .. table.concat(parts, ",") .. "}"
end

local function fnv1a32(str)
	local hash = 2166136261
	for i = 1, #str do
		hash = hash ~ str:byte(i)
		hash = (hash * 16777619) % 4294967296
	end
	return tostring(hash)
end

local function itemMetaHash(it)
	if not it then return nil end
	local metaObj = {
		name = it.name,
		metadata = it.metadata,
		serial_number = it.serial_number
	}
	return fnv1a32(stableEncode(metaObj))
end

local function applyLayoutOrder(items, layout)
	if not layout or type(layout) ~= "table" then return items end
	local indicesByKey = {}
	for i, it in ipairs(items) do
		local k = keyForItem(it)
		if k then
			indicesByKey[k] = indicesByKey[k] or {}
			table.insert(indicesByKey[k], i)
		end
	end
	local used = {}
	local ordered = {}
	for _, entry in ipairs(layout) do
		local skip = false
		if type(entry) == "table" and entry.slot ~= nil then
			local s = tonumber(entry.slot)
			if s ~= nil and s < 0 then
				skip = true
			end
		end
		if not skip then
			local lk = normalizeLayoutKey(entry)
			if lk and indicesByKey[lk] and #indicesByKey[lk] > 0 then
				local desiredMeta = normalizeLayoutMeta(entry)
				local chosenIdx = nil
				if desiredMeta then
					for pos, idx in ipairs(indicesByKey[lk]) do
						local it = items[idx]
						if it and itemMetaHash(it) == desiredMeta and not used[idx] then
							chosenIdx = idx
							table.remove(indicesByKey[lk], pos)
							break
						end
					end
				end
				if not chosenIdx then
					while #indicesByKey[lk] > 0 do
						local idx = table.remove(indicesByKey[lk], 1)
						if idx and not used[idx] then
							chosenIdx = idx
							break
						end
					end
				end
				if chosenIdx and not used[chosenIdx] then
					table.insert(ordered, items[chosenIdx])
					used[chosenIdx] = true
				end
			end
		end
	end
	for i, it in ipairs(items) do
		if not used[i] then table.insert(ordered, it) end
	end
	return ordered
end

local function buildQuickSlotsCacheBySlot(items, layout)
	if type(layout) ~= "table" then return nil end
	local entriesBySlot = {}
	for i, entry in ipairs(layout) do
		if type(entry) == "table" and entry.slot ~= nil then
			local s = tonumber(entry.slot)
			if s ~= nil then
				entriesBySlot[s] = entry
			end
		end
	end
	local indicesByKey = {}
	for i, it in ipairs(items) do
		local k = keyForItem(it)
		if k then
			indicesByKey[k] = indicesByKey[k] or {}
			table.insert(indicesByKey[k], i)
		end
	end
	local used = {}
	local cache = {}
	for slotIndex = 1, 5 do
		local entry = entriesBySlot[-slotIndex]
		local lk = normalizeLayoutKey(entry)
		if lk and indicesByKey[lk] and #indicesByKey[lk] > 0 then
			local desiredMeta = normalizeLayoutMeta(entry)
			local chosenIdx = nil
			if desiredMeta then
				for pos, idx in ipairs(indicesByKey[lk]) do
					local it = items[idx]
					if it and itemMetaHash(it) == desiredMeta and not used[idx] then
						chosenIdx = idx
						table.remove(indicesByKey[lk], pos)
						break
					end
				end
			end
			if not chosenIdx then
				while #indicesByKey[lk] > 0 do
					local idx = table.remove(indicesByKey[lk], 1)
					if idx and not used[idx] then
						chosenIdx = idx
						break
					end
				end
			end
			if chosenIdx and not used[chosenIdx] then
				cache[slotIndex] = items[chosenIdx]
				used[chosenIdx] = true
			end
		end
	end
	return cache
end

function NUIService.RefreshQuickSlotsCache()
	local itemsAndWeapons = loadItemsAndWeapons()
	local layout = LocalInventoryLayout
	if not layout or type(layout) ~= "table" then
		local serverLayout = Core.Callback.TriggerAwait("vorp_inventory:Server:GetInventoryLayout", nil)
		if serverLayout and type(serverLayout) == "table" then
			LocalInventoryLayout = serverLayout
			layout = serverLayout
		end
	end
	if not layout or type(layout) ~= "table" then
		QuickSlotsCache = {}
		QuickSlotsCacheReady = false
		return
	end
	local bySlot = buildQuickSlotsCacheBySlot(itemsAndWeapons, layout)
	QuickSlotsCache = bySlot or {}
	QuickSlotsCacheReady = true
end

function NUIService.SaveInventoryLayout(data)
	-- Guardar en el servidor y actualizar el layout local inmediato
	if type(data) == "table" and type(data.layout) == "table" then
		LocalInventoryLayout = data.layout
		local itemsAndWeapons = loadItemsAndWeapons()
		local bySlot = buildQuickSlotsCacheBySlot(itemsAndWeapons, LocalInventoryLayout)
		QuickSlotsCache = bySlot or {}
		QuickSlotsCacheReady = true
	end
	TriggerServerEvent("vorp_inventory:Server:SaveInventoryLayout", json.encode(data))
end

function NUIService.LoadInv()
	-- Protección contra llamadas durante reinicio
	if not Core then 
		print("^1[VORP Inventory]^7 LoadInv called but Core is not available (restart in progress?)")
		return 
	end
	
	local payload = {}
	local result = nil
	local moneyData = { money = 0, gold = 0, rol = 0 }
	
	-- Protección: Intentar obtener datos con timeout usando TriggerAsync en lugar de TriggerAwait
	local callbackReceived = false
	
	Core.Callback.TriggerAsync("vorpinventory:get_slots", function(data)
		if data then
			result = data
			moneyData = {
				money = data.money or 0,
				gold = data.gold or 0,
				rol = data.rol or 0,
				peso = data.peso or 0
			}
		end
		callbackReceived = true
	end, nil)
	
	-- Esperar con timeout de 2 segundos
	local timeout = 0
	while not callbackReceived and timeout < 20 do
		Wait(100)
		timeout = timeout + 1
	end
	
	if not callbackReceived or not result then 
		print("^3[VORP Inventory]^7 Timeout or no result from get_slots callback")
		return 
	end

	SendNUIMessage({ action = "changecheck", check = string.format("%.1f", result.totalInvWeight or 0), info = string.format("%.1f", result.slots or 0) })
	
	-- Mantener updateStatusHud para compatibilidad con otros scripts
	SendNUIMessage({
		action = "updateStatusHud",
		show   = not IsRadarHidden(),
		money  = result.money or 0,
		gold   = result.gold or 0,
		rol    = result.rol or 0,
		id     = GetPlayerServerId(PlayerId()),
	})

	local itemsAndWeapons = loadItemsAndWeapons()

	-- Agregar items de moneda al inventario
	if CurrencyItemService and CurrencyItemService.AddCurrencyItemsToInventory then
		local success2, newItems = pcall(function()
			return CurrencyItemService.AddCurrencyItemsToInventory(itemsAndWeapons, moneyData)
		end)
		
		if success2 and newItems then
			itemsAndWeapons = newItems
		else
			print("^1[VORP Inventory]^7 Error adding currency items: " .. tostring(newItems))
		end
	end

	payload.action = "setItems"
	payload.timenow = GlobalState.TimeNow

	-- Obtener layout con callback async y timeout
	local layoutReceived = false
	local layout = nil
	
	Core.Callback.TriggerAsync("vorp_inventory:Server:GetInventoryLayout", function(data)
		layout = data
		layoutReceived = true
	end, nil)
	
	-- Esperar con timeout de 2 segundos
	timeout = 0
	while not layoutReceived and timeout < 20 do
		Wait(100)
		timeout = timeout + 1
	end
	
	if layout and type(layout) == "table" then
		LocalInventoryLayout = layout
		itemsAndWeapons = applyLayoutOrder(itemsAndWeapons, layout)
		payload.layout = layout
	end

	local bySlot = buildQuickSlotsCacheBySlot(itemsAndWeapons, layout)
	QuickSlotsCache = bySlot or {}
	QuickSlotsCacheReady = type(layout) == "table"
	payload.itemList = itemsAndWeapons

	SendNUIMessage(payload)
end

function NUIService.OpenInv()
	ApplyPosfx()
	DisplayRadar(false)
	if Config.SFX.OpenInventory then
		PlaySoundFrontend("SELECT", "RDRO_Character_Creator_Sounds", true, 0)
	end
	SetNuiFocus(true, true)
	SendNUIMessage({
		action = "display",
		type = "main",
		search = Config.InventorySearchable,
		autofocus = Config.InventorySearchAutoFocus
	})
	InInventory = true 
	NUIService.LoadInv()
end

function NUIService.TransactionStarted()
	SetNuiFocus(true, false)
	SendNUIMessage({ action = "transaction", type = "started", text = T.TransactionLoading })
end

function NUIService.TransactionComplete(keepInventoryOpen)
	keepInventoryOpen = keepInventoryOpen == nil and true or keepInventoryOpen
	SetNuiFocus(keepInventoryOpen, keepInventoryOpen)
	SendNUIMessage({ action = "transaction", type = "completed" })
end

function NUIService.initiateData()

	SendNUIMessage({
		action = "initiate",
		language = {
			empty = T.emptyammo,
			prompttitle = T.prompttitle,
			prompttitle2 = T.prompttitle2,
			promptaccept = T.promptaccept,
			inventoryclose = T.inventoryclose,
			inventorysearch = T.inventorysearch,
			toplayerpromptitle = T.toplayerpromptitle,
			toplaterpromptaccept = T.toplaterpromptaccept,
			gunbeltlabel = T.gunbeltlabel,
			gunbeltdescription = T.gunbeltdescription,
			inventorymoneylabel = T.inventorymoneylabel,
			inventorymoneydescription = T.inventorymoneydescription,
			givemoney = T.givemoney,
			dropmoney = T.dropmoney,
			packenvelope = T.packenvelope, -- Nueva traducción para empaquetar dinero
			inventorygoldlabel = T.inventorygoldlabel,
			inventorygolddescription = T.inventorygolddescription,
			givegold = T.givegold,
			dropgold = T.dropgold,
			unequip = T.unequip,
			equip = T.equip,
			use = T.use,
			give = T.give,
			drop = T.drop,
			copyserial = T.copyserial,
			durability = T.durability or (T.labels and T.labels.durability) or "Durabilidad",
			labels = T.labels
		},
		config = {
			UseGoldItem = Config.UseGoldItem,
			AddGoldItem = Config.AddGoldItem,
			AddDollarItem = Config.AddDollarItem,
			AddAmmoItem = Config.AddAmmoItem,
			DoubleClickToUse = Config.DoubleClickToUse,
			UseRolItem = Config.UseRolItem,
			WeightMeasure = Config.WeightMeasure or "Kg",
			SpamDelay = Config.SpamDelay or 5000,
		}
	})
end

local blockInventory = false

CreateThread(function()
	local controlVar = false 

	repeat Wait(2000) until LocalPlayer.state.IsInSession
	NUIService.initiateData()

	while true do
		local sleep = 1000
		if not InInventory and not blockInventory then
			sleep = 0
			if IsControlJustReleased(1, Config.OpenKey) then
				local player = PlayerPedId()
				local hogtied = IsPedHogtied(player) == 1
				local cuffed = IsPedCuffed(player)
				if not hogtied and not cuffed and not InventoryIsDisabled then
					NUIService.OpenInv()
				end
			end
		end

		if Config.DisableDeathInventory then
			if InInventory and IsPedDeadOrDying(PlayerPedId(), false) then
				NUIService.CloseInv()
			end
		end

		if InInventory then
			if not controlVar then
				controlVar = true
				LocalPlayer.state:set("IsInvActive", true, true) 
				TriggerEvent("vorp_inventory:Client:OnInvStateChange", true)
			end
		else
			if controlVar then
				controlVar = false
				LocalPlayer.state:set("IsInvActive", false, true)
				TriggerEvent("vorp_inventory:Client:OnInvStateChange", false)
			end
		end

		Wait(sleep)
	end
end)


local function UseQuickSlot(slotIndex)
	if InventoryIsDisabled then
		return
	end
	local now = GetGameTimer()
	if now < nextUseAt then
		return
	end
	if now < nextQuickSlotAt then
		return
	end
	nextQuickSlotAt = now + 250
	if not QuickSlotsCacheReady then
		NUIService.RefreshQuickSlotsCache()
	end
	local entry = QuickSlotsCache[slotIndex]
	if not entry then
		NUIService.RefreshQuickSlotsCache()
		entry = QuickSlotsCache[slotIndex]
		if not entry then
			return
		end
	end

	if entry.type == "item_weapon" then
		local weaponId = tonumber(entry.id)
		if entry.used or entry.used2 then
			NUIService.NUIUnequipWeapon({ id = weaponId })
		else
			useWeapon({ id = weaponId })
		end
	elseif entry.type == "item_standard" then
		useItem({ id = entry.id, item = entry.name })
	end
end

RegisterCommand("vorp_inv_quick1", function()
    if InInventory then return end
	UseQuickSlot(1)
end, false)
RegisterCommand("vorp_inv_quick2", function()
    if InInventory then return end
	UseQuickSlot(2)
end, false)
RegisterCommand("vorp_inv_quick3", function()
    if InInventory then return end
	UseQuickSlot(3)
end, false)
RegisterCommand("vorp_inv_quick4", function()
    if InInventory then return end
	UseQuickSlot(4)
end, false)
RegisterCommand("vorp_inv_quick5", function()
    if InInventory then return end
	UseQuickSlot(5)
end, false)

if RegisterKeyMapping then
	local keys = nil
	if Config and type(Config.QuickslotUseKeys) == "table" then
		keys = Config.QuickslotUseKeys
	end
	local key1 = type(keys) == "table" and tostring(keys[1] or "") or ""
	local key2 = type(keys) == "table" and tostring(keys[2] or "") or ""
	local key3 = type(keys) == "table" and tostring(keys[3] or "") or ""
	local key4 = type(keys) == "table" and tostring(keys[4] or "") or ""
	local key5 = type(keys) == "table" and tostring(keys[5] or "") or ""
	if key1 == "" then key1 = "1" end
	if key2 == "" then key2 = "2" end
	if key3 == "" then key3 = "3" end
	if key4 == "" then key4 = "4" end
	if key5 == "" then key5 = "5" end

	RegisterCommand("+vorp_inv_quick1", function()
		if InInventory then return end
		UseQuickSlot(1)
	end, false)
	RegisterCommand("-vorp_inv_quick1", function() end, false)
	RegisterKeyMapping("+vorp_inv_quick1", "VORP Inventory: Quickslot 1", "keyboard", key1)

	RegisterCommand("+vorp_inv_quick2", function()
		if InInventory then return end
		UseQuickSlot(2)
	end, false)
	RegisterCommand("-vorp_inv_quick2", function() end, false)
	RegisterKeyMapping("+vorp_inv_quick2", "VORP Inventory: Quickslot 2", "keyboard", key2)

	RegisterCommand("+vorp_inv_quick3", function()
		if InInventory then return end
		UseQuickSlot(3)
	end, false)
	RegisterCommand("-vorp_inv_quick3", function() end, false)
	RegisterKeyMapping("+vorp_inv_quick3", "VORP Inventory: Quickslot 3", "keyboard", key3)

	RegisterCommand("+vorp_inv_quick4", function()
		if InInventory then return end
		UseQuickSlot(4)
	end, false)
	RegisterCommand("-vorp_inv_quick4", function() end, false)
	RegisterKeyMapping("+vorp_inv_quick4", "VORP Inventory: Quickslot 4", "keyboard", key4)

	RegisterCommand("+vorp_inv_quick5", function()
		if InInventory then return end
		UseQuickSlot(5)
	end, false)
	RegisterCommand("-vorp_inv_quick5", function() end, false)
	RegisterKeyMapping("+vorp_inv_quick5", "VORP Inventory: Quickslot 5", "keyboard", key5)
end

-- Tecla ALT (LALT): toggle HUD quickslots desde Lua (sin KeyMapping)
CreateThread(function()
    local configuredKeys = Config and (Config.QuickslotHudKeys or Config.QuickslotHudKey) or nil
    local ALT_KEYS
    if type(configuredKeys) == "table" then
        ALT_KEYS = configuredKeys
    elseif type(configuredKeys) == "number" then
        ALT_KEYS = { configuredKeys }
    else
        ALT_KEYS = { 0x8AAA0AD4, 0xE8342FF2 }
    end
    local groups = {0,1,2,3,4,5,6,7}
    while true do
        local sleep = 250
        if not InventoryIsDisabled then
            local pressed = false
            for _, g in ipairs(groups) do
                for _, code in ipairs(ALT_KEYS) do
                    if IsDisabledControlJustPressed(g, code) or IsControlJustPressed(g, code) then
                        pressed = true
                        break
                    end
                end
                if pressed then break end
            end
            if pressed then
                SendNUIMessage({ action = "toggleQuickslotHud" })
                Wait(250)
            end
            sleep = 0
        end
        Wait(sleep)
    end
end)

RegisterCommand("vorp_inv_debug_qs_on", function() QuickSlotDebug = true end, false)
RegisterCommand("vorp_inv_debug_qs_off", function() QuickSlotDebug = false end, false)

local AggressiveQuickSlotCapture = false
local QuickSlotScan = false
RegisterCommand("vorp_inv_qs_aggr_on", function()
    AggressiveQuickSlotCapture = true
    SetNuiFocusKeepInput(true)
end, false)
RegisterCommand("vorp_inv_qs_aggr_off", function()
    AggressiveQuickSlotCapture = false
    SetNuiFocusKeepInput(false)
end, false)
RegisterCommand("vorp_inv_qs_scan_on", function()
    QuickSlotScan = true
end, false)
RegisterCommand("vorp_inv_qs_scan_off", function()
    QuickSlotScan = false
end, false)
RegisterCommand("vorp_inv_debug_qs_off", function() QuickSlotDebug = false end, false)

CreateThread(function()
	local fallbackEnabled = false
	if not fallbackEnabled then return end
	local keyToSlot = {}
	local groups = {0,1,2,3,4,5,6,7}
	local lastHeartbeat = 0
	while true do
		local sleep = 250
		if not InInventory and not InventoryIsDisabled then
			sleep = 0
			if QuickSlotDebug then
				local now = GetGameTimer()
				if now - lastHeartbeat > 1000 then
					lastHeartbeat = now
					for control, slotIndex in pairs(keyToSlot) do
						local enabledAny = false
						for _,g in ipairs(groups) do
							if IsControlEnabled(g, control) then enabledAny = true end
						end
					end
				end
			end
			for control, slotIndex in pairs(keyToSlot) do
				local pressed = false
				if AggressiveQuickSlotCapture then
					for _,g in ipairs(groups) do
						DisableControlAction(g, control, true)
						if IsDisabledControlJustPressed(g, control) then
							pressed = true
							break
						end
					end
				else
					for _,g in ipairs(groups) do
						if IsControlJustPressed(g, control) or IsDisabledControlJustPressed(g, control) then
							pressed = true
							break
						end
					end
				end
				if pressed then
					UseQuickSlot(slotIndex)
					break
				end
			end
		else
			if QuickSlotDebug then
				local now = GetGameTimer()
				if now - lastHeartbeat > 2000 then
					lastHeartbeat = now
				end
			end
		end
		Wait(sleep)
	end
end)

CreateThread(function()
	local keys = {
		[0xE6F612E4] = 1,
		[0x1CE6D9EB] = 2,
		[0x4F49CC4C] = 3,
		[0x8F9F9E58] = 4,
		[0xAB62E997] = 5,
	}
	local groups = {0,1,2,3,4,5,6,7}
	while true do
		local sleep = 250
		if not InInventory and not InventoryIsDisabled then
			sleep = 0
			for control, slotIndex in pairs(keys) do
				for _, g in ipairs(groups) do
					DisableControlAction(g, control, true)
					if IsDisabledControlJustPressed(g, control) then
						SendNUIMessage({ action = "useQuickSlot", index = slotIndex - 1 })
						Wait(250)
						break
					end
				end
			end
		end
		Wait(sleep)
	end
end)

RegisterNetEvent("vorp_inventory:blockInventory")
AddEventHandler("vorp_inventory:blockInventory", function(state)
	blockInventory = state
	if InInventory then
		NUIService.CloseInv()
	end
end)

-- Prevent Spam (global)
CreateThread(function()
	while true do
		Wait(1000)
		if timerUse and timerUse > 0 then
			timerUse = timerUse - 1000
			if timerUse < 0 then timerUse = 0 end
		end
	end
end)

function NUIService.ChangeClothing(item)
	if item then
		ExecuteCommand(tostring(item))
	end
end

function NUIService.DisableInventory(param)
	local t = type(param)
	if t == "boolean" then
		InventoryIsDisabled = param
		return
	end

	local ms = tonumber(param) or 0
	if ms <= 0 then
		InventoryIsDisabled = false
		return
	end
	InventoryIsDisabled = true
	SetTimeout(ms, function()
		InventoryIsDisabled = false
	end)
end

function NUIService.getActionsConfig(_, cb)
	cb(Actions)
end

function NUIService.CacheImages(info)
	local unpack = msgpack.unpack(info)
	SendNUIMessage({ action = "cacheImages", info = unpack })
end

function NUIService.ContextMenu(data)
	if not data then return end

	if data.close then
		NUIService.CloseInv()
	end

	local ev = data.event
	if ev and ev.client then
		TriggerEvent(ev.client, ev.arguments, data.itemid)
	elseif ev and ev.server then
		TriggerServerEvent(ev.server, ev.arguments, data.itemid)
	end
end

CreateThread(function()
    local lastScanHeartbeat = 0
    while true do
        local sleep = 1000
        if QuickSlotScan and not InventoryIsDisabled then
            sleep = 0
            local now = GetGameTimer()
            if QuickSlotDebug and now - lastScanHeartbeat > 500 then
                    lastScanHeartbeat = now
                    -- (debug tick suprimido)
                end
            for _,g in ipairs({0,1,2,3,4,5,6,7}) do
                for code=0,512 do
                    if IsControlJustPressed(g, code) or IsDisabledControlJustPressed(g, code) then
						-- (detección de control suprimida)
					end
                end
            end
        end
        Wait(sleep)
    end
end)

function NUIService.NUICraftItem(data, cb)
    if data and data.recipe then
        CreateThread(function()
            local ped = PlayerPedId()
            local dict = "mech_inventory@crafting@fallbacks@in_hand@male_a"
            local name = "craft_trans_stow"
            
            RequestAnimDict(dict)
            while not HasAnimDictLoaded(dict) do Wait(10) end
            
            -- Reproducir animación
            TaskPlayAnim(ped, dict, name, 8.0, -8.0, -1, 1, 0, true, 0, false, 0, false)
            
            TriggerServerEvent("vorp_inventory:server:ProcessCrafting", data.recipe)
            
            -- Obtener el tiempo de crafteo del cliente
            local craftTime = 3000
            if ConfigCrafting then
                for _, r in ipairs(ConfigCrafting) do
                    if r.id == data.recipe then
                        craftTime = r.craftTime or 3000
                        break
                    end
                end
            end
            
            Wait(craftTime)
            ClearPedTasks(ped)
            RemoveAnimDict(dict)
        end)
    end
    if cb then cb("ok") end
end
