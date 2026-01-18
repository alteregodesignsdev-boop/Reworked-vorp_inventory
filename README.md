🚀 Update: QuickSlot Refactor & Stability Improvements
This update focuses on making the QuickSlot system fully independent, improving quality of life for item creation, and ensuring script stability during development.

📦 QuickSlot Features
Total Independence: The QuickSlot no longer reads the first slots of the main inventory. It now functions as a completely independent container.

Drag & Drop: Drag and drop functionality has been enabled directly into the QuickSlot.

Configurable Keybinding: You can now change the interaction key via the config.

Default: QuickslotHudKey = 0x8AAA0AD4 (ALT).

🛠️ Configuration & Development
New config_items.lua: Faster item creation. The system now automatically assigns the ID when executing it in the SQL (manually defining it is no longer necessary).

Hot Reload Safe: Support has been enabled to run /ensure with players in-game (IC) without breaking the inventory.

🛡️ Security & Fixes
Critical Exploit Patched: Fixed a critical issue where items could be dumped/exploited using dev-tools.

🔄 Other Changes
Functional adjustments to shared inventories.

🚧 Coming Soon
We are working on a complete UI redesign, while maintaining the aesthetic you already know and love.

💬 Feedback: We look forward to your thoughts on this update and any suggestions for future implementations!

Join our Discord: https://discord.gg/Jb7gmc6zHM