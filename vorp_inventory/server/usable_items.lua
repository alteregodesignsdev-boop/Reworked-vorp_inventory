-- Usable Items Registration
-- Este archivo registra los items usables del inventario

-- Esperar a que el sistema esté listo
CreateThread(function()
    Wait(1000) -- Esperar 1 segundo para asegurar que todo esté cargado
    
    -- Registrar el sobre de dinero como item usable
    exports.vorp_inventory:registerUsableItem("money_envelope", function(data)
        MoneyEnvelopeService.UnpackMoney(data)
    end)
    
    print("^2[vorp_inventory]^7 Items usables registrados correctamente")
end)
