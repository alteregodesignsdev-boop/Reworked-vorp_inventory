# 🤠 VORP Inventory - Update 2.0 (Overhaul & Improvements)

This update delivers a complete visual overhaul, major Quality of Life (QoL) additions, and permanent fixes for dual-wield weapon synchronization and money envelope packaging.

---

### ✨ Visual Overhaul & New Features

* **🎨 Modern Western UI (100% Responsive)**:
  * Clean, authentic Wild West aesthetic featuring dark translucent backdrops, embossed leather textures, and vintage filigree borders.
  * Removed redundant header titles ("INVENTORY", bulky container labels) for an immersive, cinematic experience.
  * **Fully Responsive**: Seamlessly adapts to any display resolution (1080p, 1440p / 2K, 4K, ultrawide monitors, and windowed mode) without texture distortion or text clipping.

* **⚡ Expanded Quickslots (5 Slots)**:
  * Upgraded from 4 to **5 quick access slots** (keys `1` through `5`) to give players more flexibility for consumables, tools, and sidearms.
  * Brand-new custom HD 5-slot ornamental frame with wrought iron corners and worn leather accents.

* **👁️ Non-Intrusive / Silent Quickslot Mode**:
  * Players can now trigger items using hotkeys 1–5 without forcing the HUD overlay onto the screen—keeping line-of-sight clear during gunfights and active roleplay.
  * Removed bulky black quantity boxes and numbers from quickslot icons for a cleaner, distraction-free interface.

* **🖌️ New Handcrafted Item Artwork**:
  * Designed and integrated high-resolution icons matching RDR2's native art direction:
    * 🐎 **Horse Trough (`bebederohorse`)**
    * 🗝️ **Ranch Chest Key (`ranch_chest_key`)**
    * 🐝 **Beehive (`bee_hive`)**
  * Audited and synchronized weapon parts and provision names with their corresponding `.png` assets.

---

### 🛠️ Bug Fixes & Stability

* **🔫 Complete Dual-Wield Weapon System Fix**:
  * **No More Vanishing Sidearms**: Fixed the native GUID loss issue where equipping a second revolver caused the primary weapon to completely disappear from the character.
  * **Dual Identical Weapons**: Full support for equipping two of the exact same weapon model (e.g., dual Cattleman or Schofield revolvers) without game engine rejection.
  * **Hot-Reload Resilient**: Equipped weapons remain synced and auto-recover gracefully even after live resource restarts (`restart vorp_inventory`).
  * **Smart Unequipping & Auto-Promotion**: Unequipping your primary sidearm automatically promotes your off-hand weapon to your primary holster (slot 0 / right hip) and updates the database.
  * **Holster Capacity Guard**: Automatic on-screen notification if a player attempts to equip more than 2 one-handed sidearms.

* **✉️ Money Envelope Packaging Fix**:
  * Fixed a decimal conversion flaw where packaging whole dollar amounts (e.g., $85) saved them as cents ($0.85). Envelopes now correctly store and unpack the exact dollar and cent value entered.
  * Added strict server-side validation to prevent negative values, NaN inputs, or balance desyncs.

---

### 📦 Key Files Affected
- `html/` (Responsive CSS styles, NUI scripts, and new HD assets).
- `client/` (Native GUID weapon handling, dual-wield lifecycles, and clothing checks).
- `server/` (Money envelope transaction validation).
- `config/` (5-slot hotbar support and item configuration alignment).
