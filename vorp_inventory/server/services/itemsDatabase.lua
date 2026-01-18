local Core   = exports.vorp_core:GetCore()
ServerItems = ServerItems or {}
UsersWeapons = UsersWeapons or { default = {} }
UsersWeapons.default = UsersWeapons.default or {}

local function toArrayTable(value)
	if type(value) == "table" then
		local t = {}
		for k, v in pairs(value) do
			t[k] = toArrayTable(v)
		end
		return t
	end
	return value
end

local function normalizeItemDefinition(key, def)
	if type(def) ~= "table" then
		return nil
	end

	local itemName = def.item
	if (itemName == nil or itemName == "") and type(key) == "string" then
		itemName = key
	end

	if type(itemName) ~= "string" or itemName == "" then
		return nil
	end

	return itemName, def
end

local function syncItemsFromConfig()
	if type(ConfigItems) ~= "table" then
		return
	end

	if not ConfigItems.enabled then
		return
	end

	local items = ConfigItems.items
	if type(items) ~= "table" then
		return
	end

	local function processItem(key, def)
		local itemName, itemDef = normalizeItemDefinition(key, def)
		if not itemName then
			return
		end

		local exists = MySQL.single.await("SELECT item FROM items WHERE item = @item LIMIT 1", { item = itemName })

		if exists and exists.item then
			local fields = {}
			local params = { item = itemName }

			if itemDef.label ~= nil then
				fields[#fields + 1] = "label = @label"
				params.label = tostring(itemDef.label)
			end
			if itemDef.limit ~= nil then
				fields[#fields + 1] = "`limit` = @limit"
				params.limit = tonumber(itemDef.limit) or 1
			end
			if itemDef.can_remove ~= nil then
				fields[#fields + 1] = "can_remove = @can_remove"
				params.can_remove = tonumber(itemDef.can_remove) or 1
			end
			if itemDef.type ~= nil then
				fields[#fields + 1] = "type = @type"
				params.type = tostring(itemDef.type)
			end
			if itemDef.usable ~= nil then
				fields[#fields + 1] = "usable = @usable"
				params.usable = tonumber(itemDef.usable) or 0
			end
			if itemDef.useExpired ~= nil then
				fields[#fields + 1] = "useExpired = @useExpired"
				params.useExpired = tonumber(itemDef.useExpired) or 0
			end
			if itemDef.groupId ~= nil then
				fields[#fields + 1] = "groupId = @groupId"
				params.groupId = tonumber(itemDef.groupId) or 1
			end
			if itemDef.metadata ~= nil then
				fields[#fields + 1] = "metadata = @metadata"
				params.metadata = json.encode(toArrayTable(itemDef.metadata))
			end
			if itemDef.desc ~= nil then
				fields[#fields + 1] = "`desc` = @desc"
				params.desc = tostring(itemDef.desc)
			end
			if itemDef.degradation ~= nil then
				fields[#fields + 1] = "degradation = @degradation"
				params.degradation = tonumber(itemDef.degradation) or 0
			end
			if itemDef.weight ~= nil then
				fields[#fields + 1] = "weight = @weight"
				params.weight = tonumber(itemDef.weight) or 0
			end

			if #fields > 0 then
				MySQL.update.await(("UPDATE items SET %s WHERE item = @item"):format(table.concat(fields, ", ")), params)
			end
			return
		end

		MySQL.insert.await(
			"INSERT INTO items (`item`, `label`, `limit`, `can_remove`, `type`, `usable`, `useExpired`, `groupId`, `metadata`, `desc`, `degradation`, `weight`) VALUES (@item, @label, @limit, @can_remove, @type, @usable, @useExpired, @groupId, @metadata, @desc, @degradation, @weight)",
			{
				item = itemName,
				label = tostring(itemDef.label or itemName),
				limit = tonumber(itemDef.limit) or 1,
				can_remove = tonumber(itemDef.can_remove) or 1,
				type = tostring(itemDef.type or "item_standard"),
				usable = tonumber(itemDef.usable) or 0,
				useExpired = tonumber(itemDef.useExpired) or 0,
				groupId = tonumber(itemDef.groupId) or 1,
				metadata = json.encode(toArrayTable(itemDef.metadata or {})),
				desc = tostring(itemDef.desc or "nice item"),
				degradation = tonumber(itemDef.degradation) or 0,
				weight = tonumber(itemDef.weight) or 0,
			}
		)
	end

	if items[1] ~= nil then
		for i, def in ipairs(items) do
			processItem(i, def)
		end
	end

	for key, def in pairs(items) do
		if type(key) ~= "number" then
			processItem(key, def)
		end
	end
end


--- load all player weapons
---@param db_weapon table
local function loadAllWeapons(db_weapon)
	local ammo = json.decode(db_weapon.ammo)
	local comp = json.decode(db_weapon.components)

	if db_weapon.dropped == 0 then
		local label = db_weapon.custom_label or db_weapon.label
		local weight = SvUtils.GetWeaponWeight(db_weapon.name)
		local weapon = Weapon:New({
			id = db_weapon.id,
			propietary = db_weapon.identifier,
			name = db_weapon.name,
			ammo = ammo,
			components = comp,
			used = false,
			used2 = false,
			charId = db_weapon.charidentifier,
			currInv = db_weapon.curr_inv,
			dropped = db_weapon.dropped,
			group = 5,
			label = label,
			serial_number = db_weapon.serial_number,
			custom_label = db_weapon.custom_label,
			custom_desc = db_weapon.custom_desc,
			weight = weight,
		})

		if not UsersWeapons[db_weapon.curr_inv] then
			UsersWeapons[db_weapon.curr_inv] = {}
		end

		UsersWeapons[db_weapon.curr_inv][weapon:getId()] = weapon
	else
		DBService.deleteAsync('DELETE FROM loadout WHERE id = @id', { id = db_weapon.id }, function() end)
	end
end




--- load player default inventory weapons
---@param source number
---@param character table character table data
local function loadPlayerWeapons(source, character)
	local _source = source
	local result = DBService.queryAwait('SELECT * FROM loadout WHERE charidentifier = ? ', { character.charIdentifier }) or {}
	if next(result) then
		for _, db_weapon in pairs(result) do
			if db_weapon.charidentifier and db_weapon.curr_inv == "default" then
				loadAllWeapons(db_weapon)
			end
		end
	end
end

-- convert json string to pure lua table
local function luaTable(value)
	if type(value) == "table" then
		local t = {}
		for k, v in pairs(value) do
			t[k] = luaTable(v)
		end
		return t
	else
		return value
	end
end


MySQL.ready(function()
	Citizen.CreateThread(function()
		syncItemsFromConfig()

		DBService.queryAsync("SELECT * FROM items", {}, function(result)
			for _, db_item in pairs(result) do
				if db_item.id then
					local meta = {}
					if db_item.metadata ~= "{}" then
						meta = luaTable(json.decode(db_item.metadata))
					end
					local item = Item:New({
						id = db_item.id,
						item = db_item.item,
						metadata = meta,
						label = db_item.label,
						limit = db_item.limit,
						type = db_item.type,
						canUse = db_item.usable,
						canRemove = db_item.can_remove,
						desc = db_item.desc,
						group = db_item.groupId,
						weight = db_item.weight,
						maxDegradation = db_item.degradation,
						useExpired = db_item.useExpired == 0 and false or true,
					})
					ServerItems[item.item] = item
				end
			end
		end)

		DBService.queryAsync("SELECT * FROM loadout", {}, function(result)
			for _, db_weapon in pairs(result) do
				if db_weapon.curr_inv ~= "default" then
					loadAllWeapons(db_weapon)
				end
			end
		end)
	end)
end)

local function cacheImages()
	-- only items from the database because items folder can contain duplicates or unused images
	local newtable = {}
	for k, v in pairs(ServerItems) do
		newtable[k] = v.item
	end
	-- all weapon images from config because items folder can contain duplicates or unused images
	for k, _ in pairs(SharedData.Weapons) do
		newtable[k] = k
	end
	local packed = msgpack.pack(newtable)

	return packed
end

-- on player select character event
AddEventHandler("vorp:SelectedCharacter", function(source, char)
	loadPlayerWeapons(source, char)

	local packed = cacheImages()
	TriggerClientEvent("vorp_inventory:server:CacheImages", source, packed)
end)

-- reload on script restart for testing
if Config.DevMode then
	RegisterNetEvent("DEV:loadweapons", function()
		local _source = source
		local character = Core.getUser(_source).getUsedCharacter
		loadPlayerWeapons(_source, character)

		local packed = cacheImages()
		TriggerClientEvent("vorp_inventory:server:CacheImages", _source, packed)
	end)
end
