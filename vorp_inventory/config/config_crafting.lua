ConfigCrafting = {
    {
        id = "craft_campfire",
        label = "Kit de Fogata",
        itemToCraft = "campfire_kit",
        craftAmount = 1,
        craftTime = 5000, -- tiempo en milisegundos
        image = "img/items/campfire_kit.png",
        materials = {
            { item = "piedras", count = 5, label = "Piedras" },
            { item = "broza", count = 3, label = "Broza" }
        }
    },
    {
        id = "resource_salt",
        label = "Sal",
        itemToCraft = "resource_salt",
        craftAmount = 8,
        craftTime = 5000, -- tiempo en milisegundos
        image = "img/items/resource_salt.png",
        materials = {
            { item = "resource_salt_rock", count = 1, label = "Roca de Sal" },
        }
    }
}
