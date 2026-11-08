Utils = {}

function Utils.cleanAmmo(id)
	-- Protección: Verificar que UserWeapons y el arma existan
	if not UserWeapons or not UserWeapons[id] or not next(UserWeapons[id]) then
		return
	end
	
	-- Protección: Usar pcall para todo el bloque
	local success, err = pcall(function()
		local PlayerPedId = PlayerPedId()
		if not PlayerPedId or PlayerPedId == 0 then
			return
		end
		
		SetPedAmmo(PlayerPedId, joaat(UserWeapons[id]:getName()), 0)
		for k, _ in pairs(UserWeapons[id]:getAllAmmo()) do
			SetPedAmmoByType(PlayerPedId, joaat(k), 0)
		end
	end)
	
	if not success then
		print("^1[UtilityService]^7 Error in cleanAmmo: " .. tostring(err))
	end
end

function Utils.useWeapon(id)
	-- Protección: Verificar que UserWeapons y el arma existan PRIMERO
	if not UserWeapons or not UserWeapons[id] then
		print("^3[UtilityService]^7 useWeapon called but weapon " .. tostring(id) .. " not found")
		return
	end
	
	-- Protección: Usar pcall para todo el bloque
	local success, err = pcall(function()
		local PlayerPedId = PlayerPedId()
		if not PlayerPedId or PlayerPedId == 0 then
			print("^3[UtilityService]^7 useWeapon called but PlayerPedId is invalid")
			return
		end
		
		if UserWeapons[id]:getUsed2() then
			local weaponHash = joaat(UserWeapons[id]:getName())
			GiveWeaponToPed(PlayerPedId, weaponHash, 0, false, true, 3, true, 0.5, 1.0, 752097756, false, 0.0, false)
			SetCurrentPedWeapon(PlayerPedId, weaponHash, false, 3, false, false)
			SetPedAmmo(PlayerPedId, weaponHash, 0)
			for _, ammo in pairs(UserWeapons[id]:getAllAmmo()) do
				SetPedAmmoByType(PlayerPedId, joaat(_), ammo)
			end
			UserWeapons[id]:loadComponents()
		else
			Utils.oldUseWeapon(id)
		end
	end)
	
	if not success then
		print("^1[UtilityService]^7 Error in useWeapon: " .. tostring(err))
	end
end

function Utils.oldUseWeapon(id)
	-- Protección: Verificar que UserWeapons y el arma existan PRIMERO
	if not UserWeapons or not UserWeapons[id] then
		print("^3[UtilityService]^7 oldUseWeapon called but weapon " .. tostring(id) .. " not found")
		return
	end
	
	-- Protección: Usar pcall para todo el bloque
	local success, err = pcall(function()
		local PlayerPedId = PlayerPedId()
		if not PlayerPedId or PlayerPedId == 0 then
			print("^3[UtilityService]^7 oldUseWeapon called but PlayerPedId is invalid")
			return
		end
		
		local weaponHash = joaat(UserWeapons[id]:getName())
		GiveWeaponToPed(PlayerPedId, weaponHash, 0, false, true, 2, true, 0.5, 1.0, 752097756, false, 0.0, false)
		SetCurrentPedWeapon(PlayerPedId, weaponHash, false, 2, false, false)
		SetPedAmmo(PlayerPedId, weaponHash, 0)
		for type, amount in pairs(UserWeapons[id]:getAllAmmo()) do
			SetPedAmmoByType(PlayerPedId, joaat(type), amount)
		end
		UserWeapons[id]:loadComponents()
		UserWeapons[id]:setUsed(true)
		TriggerServerEvent("vorpinventory:setUsedWeapon", id, UserWeapons[id]:getUsed(), UserWeapons[id]:getUsed2())
	end)
	
	if not success then
		print("^1[UtilityService]^7 Error in oldUseWeapon: " .. tostring(err))
	end
end

function Utils.expandoProcessing(object)
	local _obj = {}
	for _, row in pairs(object) do
		_obj[_] = row
	end
	return _obj
end

function Utils.getNearestPlayers()
	local closestDistance = 5.0
	local playerPed = PlayerPedId()
	local coords = GetEntityCoords(playerPed, true, true)
	local closestPlayers = {}

	for _, player in pairs(GetActivePlayers()) do
		local target = GetPlayerPed(player)

		if target ~= playerPed then
			local targetCoords = GetEntityCoords(target, true, true)
			local distance = #(targetCoords - coords)

			if distance < closestDistance then
				table.insert(closestPlayers, player)
			end
		end
	end
	return closestPlayers
end

function Utils.GetWeaponDefaultLabel(hash)
	return SharedData.Weapons[hash].Name or hash
end

function Utils.GetWeaponDefaultDesc(hash)
	return SharedData.Weapons[hash].Desc or hash
end

function Utils.GetWeaponDefaultWeight(hash)
	return SharedData.Weapons[hash].Weight or 0.25
end

function Utils.GetWeaponName(hash)
	return SharedData.Weapons[hash].HashName or hash
end

-- request multiple weapon data
function Utils.GetWeaponsDefaultData(request)
	local weapons = {}
	for _, value in ipairs(request) do
		if SharedData.Weapons[value].HashName == value then
			table.insert(weapons, SharedData.Weapons[value])
		end
	end

	return weapons
end

function Utils.GetAmmoLabel(ammo)
	if type(ammo) == "string" then
		return SharedData.AmmoLabels[ammo]
	end

	if type(ammo) ~= "number" then
		return false
	end

	for _, value in pairs(SharedData.AmmoLabels) do
		if joaat(value) == ammo then
			return value
		end
	end
end

local function getItemData(item)
	return {
		label = item:getMetadata().label or item:getLabel(),
		count = item:getCount(),
		limit = item:getLimit(),
		weight = item:getMetadata().weight or item:getWeight(),
		metadata = item:getMetadata(),
		name = item:getName(),
		desc = item:getMetadata().description or item:getDesc(),
		degradation = item:getDegradation(),
		maxDegradation = item:getMaxDegradation(),
	}
end

function Utils.GetInventoryItem(name)
	if not UserInventory or not name then
		return false
	end

	for _, item in pairs(UserInventory) do
		if name == item:getName() then
			return getItemData(item)
		end
	end

	return false
end

function Utils.GetInventoryItems()
	if not UserInventory then
		return false
	end
	local items = {}
	for _, item in pairs(UserInventory) do
		table.insert(items, getItemData(item))
	end
	return items
end

function Utils.TableRemoveByKey(table, key)
	local element = table[key]
	table[key] = nil
	return element
end

function Utils.GetLabel(hash, id, metadata)
	if id == 2 then
		local label
		if metadata and metadata.label then
			if type(metadata.label) == "string" then
				return metadata.label
			end
		end
		if ClientItems[hash] then
			return ClientItems[hash].label
		end
	else
		return Utils.GetWeaponDefaultLabel(hash)
	end
end

function Utils.filterWeaponsSerialNumber(name)
	return Config.noSerialNumber[name]
end

function Utils.GetServerItem(data)
	if not data then
		return false
	end

	if type(data) == "string" then
		return ClientItems[data]
	end

	if type(data) == "table" then
		local items = {}
		for _, item in ipairs(data) do
			if ClientItems[item] then
				table.insert(items, ClientItems[item])
			end
		end
		return items
	end

	return false
end

