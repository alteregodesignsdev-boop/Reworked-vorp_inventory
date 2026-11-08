Weapon = {}
Weapon.name = nil
Weapon.label = nil
Weapon.id = nil
Weapon.propietary = nil
Weapon.ammo = {}
Weapon.components = {}
Weapon.used = false
Weapon.used2 = false
Weapon.desc = nil
Weapon.currInv = ''
Weapon.group = 5
Weapon.custom_label = nil
Weapon.serial_number = nil
Weapon.source = nil
Weapon.custom_desc = nil
Weapon.weight = nil

local equippedWeapons = {}

local function getGuidFromItemId(inventoryId, itemData, category, slotId)
	local outItem = DataView.ArrayBuffer(8 * 13)
	local success = Citizen.InvokeNative(0x886DFD3E185C8A89, inventoryId, itemData and itemData or 0, category, slotId,
		outItem:Buffer())
	return success and outItem or nil
end

local function moveInventoryItem(inventoryId, old, new, slot)
	local outGUID = DataView.ArrayBuffer(8 * 13)
	if not slot then slot = 1 end
	local sHash = "SLOTID_WEAPON_" .. tostring(slot)
	local success = Citizen.InvokeNative(0xDCCAA7C3BFD88862, inventoryId, old, new, joaat(sHash), 1,
		outGUID:Buffer())
	return success and outGUID or nil
end

local function addWeapon(weapon, slot, id)
	local playerPedId = PlayerPedId()
	local weaponHash  = joaat(weapon)
	local reason      = joaat("ADD_REASON_DEFAULT")
	local inventoryId = 1

	-- Comprobar validez de la clave en la base de datos de objetos
	local isValid = Citizen.InvokeNative(0x6D5D51B188333FD1, weaponHash, 0) -- ItemdatabaseIsKeyValid
	if not isValid then
		print("^3[vorp_inventory]^7 Clave de arma no válida: " .. tostring(weapon))
		return false
	end

	local characterItem = getGuidFromItemId(inventoryId, nil, joaat("CHARACTER"), 0xA1212100)
	if not characterItem then
		print("^3[vorp_inventory]^7 no characterItem")
		return false
	end

	local weaponItem = getGuidFromItemId(inventoryId, characterItem:Buffer(), 923904168, -740156546)
	if not weaponItem then
		print("^3[vorp_inventory]^7 no weaponItem")
		return false
	end

	-- Recuperación automática / reinicio en caliente (hot reload):
	-- Si slot == 1 (secundaria) pero equippedWeapons está vacío en memoria de este cliente,
	-- sincronizar el arma primaria existente en UserWeapons antes de añadir la secundaria.
	if slot == 1 and #equippedWeapons == 0 and UserWeapons then
		for uid, uw in pairs(UserWeapons) do
			if uid ~= id and uw:getUsed() and not uw:getUsed2() then
				local uwHash = joaat(uw:getName())
				if Citizen.InvokeNative(0x705BE297EEBDB95D, uwHash) and Citizen.InvokeNative(0xD955FEE4B87AFA07, uwHash) then
					addWeapon(uw:getName(), 0, uid)
					break
				end
			end
		end
	end

	if slot == 0 and id then
		if #equippedWeapons > 0 then
			slot = 1
		end
	end

	local slotHash = joaat('SLOTID_WEAPON_0')
	local move = false

	if slot == 1 and id then
		if #equippedWeapons > 0 then
			-- Buscar el arma que está en el slot 0 (primaria) para reubicarla al slot 1 (off-hand)
			local primaryWep = nil
			for _, w in ipairs(equippedWeapons) do
				if w.slot == 0 then
					primaryWep = w
					break
				end
			end
			if not primaryWep and #equippedWeapons > 0 then
				primaryWep = equippedWeapons[1]
			end

			if primaryWep and primaryWep.guid then
				local newGUID = moveInventoryItem(inventoryId, primaryWep.guid:Buffer(), weaponItem:Buffer(), 1)
				if newGUID then
					-- CRUCIAL: Actualizar la referencia al nuevo GUID generado por la nativa
					primaryWep.guid = newGUID
					primaryWep.slot = 1
					move = true
				else
					print("^3[vorp_inventory]^7 No se pudo mover el arma primaria al slot 1")
					return false
				end
			end
		end
	end

	local itemData = DataView.ArrayBuffer(8 * 13)
	local isAdded = Citizen.InvokeNative(0xCB5D11F9508A928D, inventoryId, itemData:Buffer(), weaponItem:Buffer(), weaponHash, slotHash, 1, reason)
	if not isAdded then
		print("^3[vorp_inventory]^7 No se pudo añadir el arma a la base de datos de inventario")
		return false
	end

	local equipped = Citizen.InvokeNative(0x734311E2852760D0, inventoryId, itemData:Buffer(), true)
	if not equipped then
		print("^3[vorp_inventory]^7 No se pudo equipar en la base de datos de inventario")
		return false
	end

	-- Equipar la nueva arma en el ped en el slot 0 (cartuchera derecha / primaria)
	Citizen.InvokeNative(0x12FB95FE3D579238, playerPedId, itemData:Buffer(), true, 0, false, false)

	-- Si se reubicó el arma primaria al slot 1 (cartuchera izquierda / offhand),
	-- activarla en el ped usando su NUEVO GUID válido
	if move and #equippedWeapons > 0 then
		for _, w in ipairs(equippedWeapons) do
			if w.slot == 1 and w.guid then
				Citizen.InvokeNative(0x12FB95FE3D579238, playerPedId, w.guid:Buffer(), true, 1, false, false)
			end
		end
	end

	if id then
		local nWeapon = {
			id = id,
			guid = itemData,
			slot = 0,
			name = weapon
		}
		table.insert(equippedWeapons, nWeapon)
	end

	return true
end

function Weapon:UnequipWeapon()
	self:setUsed(false)
	self:setUsed2(false)
	TriggerServerEvent("vorpinventory:setUsedWeapon", self.id, self:getUsed(), self:getUsed2())
	self:RemoveWeaponFromPed()
	Utils.cleanAmmo(self.id)

	-- Si se desequipa el arma primaria y queda un arma secundaria equipada (used2),
	-- promoverla a primaria (used = true, used2 = false) para que no quede huérfana
	if UserWeapons then
		for _, otherW in pairs(UserWeapons) do
			if otherW:getId() ~= self.id and otherW:getUsed() and otherW:getUsed2() then
				otherW:setUsed2(false)
				TriggerServerEvent("vorpinventory:setUsedWeapon", otherW:getId(), true, false)
				break
			end
		end
	end
end

function Weapon:RemoveWeaponFromPed()
	if joaat(self.name) == `WEAPON_FISHINGROD` then
		TriggerEvent("vorp_fishing:resetFishing")
	end

	local isWeaponAGun = Citizen.InvokeNative(0x705BE297EEBDB95D, joaat(self.name))
	local isWeaponOneHanded = Citizen.InvokeNative(0xD955FEE4B87AFA07, joaat(self.name))
	local playerPedId = PlayerPedId()
	local inventoryId = 1

	if isWeaponAGun and isWeaponOneHanded then
		local removeIndex = nil
		for k, v in ipairs(equippedWeapons) do
			if v.id == self.id then
				removeIndex = k
				break
			end
		end

		if removeIndex then
			local removedWep = equippedWeapons[removeIndex]
			if removedWep.guid then
				Citizen.InvokeNative(0x3E4E811480B3AE79, 1, removedWep.guid:Buffer(), 1, joaat("ADD_REASON_DEFAULT"))
			end
			table.remove(equippedWeapons, removeIndex)

			-- Si queda otra arma equipada, asegurarse de que quede en el slot 0 (cartuchera primaria)
			if #equippedWeapons > 0 then
				local keepWep = equippedWeapons[1]
				if keepWep.slot == 1 then
					local characterItem = getGuidFromItemId(1, nil, joaat("CHARACTER"), 0xA1212100)
					if characterItem then
						local weaponItem = getGuidFromItemId(1, characterItem:Buffer(), 923904168, -740156546)
						if weaponItem and keepWep.guid then
							local newGUID = moveInventoryItem(inventoryId, keepWep.guid:Buffer(), weaponItem:Buffer(), 0)
							if newGUID then
								keepWep.guid = newGUID
								keepWep.slot = 0
								Citizen.InvokeNative(0x12FB95FE3D579238, playerPedId, keepWep.guid:Buffer(), true, 0, false, false)
							end
						end
					end
				else
					if keepWep.guid then
						Citizen.InvokeNative(0x12FB95FE3D579238, playerPedId, keepWep.guid:Buffer(), true, 0, false, false)
					end
				end
				-- Garantizar que el arma restante permanezca en la cartuchera primaria (attachPoint 2)
				GiveWeaponToPed(playerPedId, joaat(keepWep.name), 0, false, true, 2, true, 0.5, 1.0, 752097756, false, 0.0, false)
			else
				RemoveWeaponFromPed(playerPedId, joaat(self.name), true, 0)
			end
		else
			RemoveWeaponFromPed(playerPedId, joaat(self.name), true, 0)
		end
	else
		RemoveWeaponFromPed(playerPedId, joaat(self.name), true, 0)
	end
end

function Weapon:equipwep()
	local weaponHash_0 = joaat(self.name)
	local isWeaponMelee = Citizen.InvokeNative(0x959383DCD42040DA, weaponHash_0)
	local isWeaponThrowable = Citizen.InvokeNative(0x30E7C16B12DA8211, weaponHash_0)
	local isWeaponAGun = Citizen.InvokeNative(0x705BE297EEBDB95D, weaponHash_0)
	local isWeaponOneHanded = Citizen.InvokeNative(0xD955FEE4B87AFA07, weaponHash_0)
	local isWeaponPetrolCan = GetWeapontypeGroup(weaponHash_0) == joaat("GROUP_PETROLCAN")
	local playerPedId = PlayerPedId()
	local ammoCount = 0
	-- is weapon assigned as no ammo needed then set to 1 so it can be used
	if Config.nonAmmoThrowables[self.name] then
		ammoCount = 1
	end

	if isWeaponMelee or isWeaponThrowable or isWeaponPetrolCan then
		GiveDelayedWeaponToPed(playerPedId, weaponHash_0, ammoCount, true, 0)
	else
		if self.used2 then
			if isWeaponAGun and isWeaponOneHanded then
				addWeapon(self.name, 1, self.id)
			else
				local _, weaponHash_1 = GetCurrentPedWeapon(playerPedId, false, 0, false)
				Citizen.InvokeNative(0x5E3BDDBCB83F3D84, playerPedId, weaponHash_1, 1, 1, 1, 2, false, 0.5, 1.0, 752097756, 0, true, 0.0)
				Citizen.InvokeNative(0x5E3BDDBCB83F3D84, playerPedId, weaponHash_0, 1, 1, 1, 3, false, 0.5, 1.0, 752097756, 0, true, 0.0)
				Citizen.InvokeNative(0xADF692B254977C0C, playerPedId, weaponHash_1, 0, 1, 0, 0)
				Citizen.InvokeNative(0xADF692B254977C0C, playerPedId, weaponHash_0, 0, 0, 0, 0)
			end
		else
			if isWeaponAGun and isWeaponOneHanded then
				addWeapon(self.name, 0, self.id)
			else
				GiveDelayedWeaponToPed(playerPedId, weaponHash_0, ammoCount, true, 0)
			end
		end
	end
end

function Weapon:loadComponents()
	local playerPedId = PlayerPedId()
	for _, value in pairs(self.components) do
		Citizen.InvokeNative(0x74C9090FDD1BB48E, playerPedId, joaat(value), joaat(self.name), true)
	end
end

function Weapon:getAllComponents()
	return self.components
end

function Weapon:setComponent(component)
	table.insert(self.components, component)
end

function Weapon:quitComponent(component)
	local componentExists = FindIndexOf(self.components, component)
	if componentExists then
		table.remove(self.component, componentExists)
		return true
	end
	return false
end

function Weapon:getUsed()
	return self.used
end

function Weapon:getUsed2()
	return self.used2
end

function Weapon:setUsed(used)
	self.used = used
	TriggerServerEvent("vorpinventory:setUsedWeapon", self.id, used, self.used2)
end

function Weapon:setUsed2(used2)
	self.used2 = used2
	TriggerServerEvent("vorpinventory:setUsedWeapon", self.id, self.used, used2)
end

function Weapon:getPropietary()
	return self.propietary
end

function Weapon:setPropietary(propietary)
	self.propietary = propietary
end

function Weapon:getId()
	return self.id
end

function Weapon:setId(id)
	self.id = id
end

function Weapon:getName()
	return self.name
end

function Weapon:setName(name)
	self.name = name
end

function Weapon:getAllAmmo()
	return self.ammo
end

function Weapon:getAmmo(type)
	if self.ammo[type] ~= nil then
		return self.ammo[type]
	end
	return 0
end

function Weapon:getTotalAmmoCount()
	local count = 0
	for type, value in pairs(self.ammo) do
		count = count + value
	end
	return count
end

function Weapon:setAmmo(type, amount) -- not being used?
	self.ammo[type] = tonumber(amount)
	TriggerServerEvent("vorpinventory:setWeaponBullets", self.id, type, amount)
end

function Weapon:addAmmo(type, amount) -- not being used?
	if self.ammo[type] ~= nil then
		self.ammo[type] = self.ammo[type] + tonumber(amount)
	else
		self.ammo[type] = tonumber(amount)
	end
end

function Weapon:subAmmo(type, amount)
	if self.ammo[type] ~= nil then
		self.ammo[type] = self.ammo[type] - tonumber(amount)

		if self.ammo[type] <= 0 then
			Utils.TableRemoveByKey(self.ammo, type)
		end
	end
end

function Weapon:getLabel()
	return self.label
end

function Weapon:New(t)
	t = t or {}
	setmetatable(t, self)
	self.__index = self
	return t
end

function FindIndexOf(table, value)
	for k, v in pairs(table) do
		if v == value then
			return k
		end
	end
	return false
end

function Weapon:setLabel(label)
	self.label = label
end

function Weapon:setDesc(desc)
	self.desc = desc
end

function Weapon:getDesc()
	return self.desc
end

function Weapon:setCurrInv(invId)
	self.currInv = invId
end

function Weapon:getCurrInv()
	return self.currInv
end

function Weapon:getGroup()
	self.group = self.group
end

function Weapon:getCustomLabel()
	return self.custom_label
end

function Weapon:setCustomLabel(custom_label)
	self.custom_label = custom_label
end

function Weapon:getSerialNumber()
	return self.serial_number
end

function Weapon:setSerialNumber(serial_number)
	self.serial_number = serial_number
end

function Weapon:setCustomDesc(custom_desc)
	self.custom_desc = custom_desc
end

function Weapon:getCustomDesc()
	return self.custom_desc
end

function Weapon:getWeight()
	return self.weight
end
