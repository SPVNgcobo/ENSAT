ENSAT | Enterprise Asset Tracker v3.2
ENSAT is a lightweight, client-side web application designed for tracking enterprise IT assets (Laptops, Mobiles, Monitors). It features a dashboard, inventory database, and digitized workflows for issuing and returning assets, complete with digital signatures and PDF receipt generation.

🚀 Quick Start
Ensure you have an internet connection (required for loading icons and charts).

Download/Save the three source files into the same folder:

index.html

style.css

script.js

Double-click index.html to launch the application in your web browser.

🔑 Default Login Credentials
Username: admin

Password: password

(Note: You can create new accounts by clicking "Sign Up" on the login screen.)

✨ Features
1. Dashboard & Analytics
Real-time overview of total assets and stock levels.

"Actions Required" and "Overdue" alerts.

Visual breakdown of asset types (Chart.js).

Live activity feed.

2. Inventory Management
CRUD Operations: Add, Edit, Delete, and Clone assets.

Search & Filter: Real-time search by Tag, Model, or User.

History: View the full chain of custody for any specific asset.

Import/Export:

Import assets via CSV.

Export current inventory to CSV (Excel compatible).

3. Digital Workflows
Issuance (New Starters): Assign assets to users, capture digital signatures on-screen, and generate a PDF handover form automatically.

Transfer (Movers): Re-assign assets from one user to another.

Return (Leavers): Check assets back into stock with condition assessments and return receipts.

4. System Tools
Dark Mode: Built-in theme toggling.

Backup & Restore: Download the entire database (Users + Inventory + History) as a JSON file and restore it later.

Responsive Design: Works on Desktop and Mobile/Tablets.

📂 File Structure
Plaintext

/ENSAT-Project-Folder
│
├── index.html      # Main application structure and libraries
├── style.css       # Visual styling, themes, and layout
└── script.js       # Application logic, data handling, and workflows
🛠 Technologies Used
HTML5 / CSS3 / JavaScript (ES6)

Local Storage: Uses the browser's built-in storage database (no external database server required).

External Libraries (via CDN):

Chart.js (Data visualization)

FontAwesome (Icons)

html2pdf.js (PDF Generation)

PapaParse (CSV Parsing)

⚠️ Important Notes
Data Persistence: This application runs entirely in your browser using Local Storage. The data is saved on your specific computer and browser.

If you clear your browser cache, you will lose your data.

To move data to another computer, use the Full Backup (JSON) feature in the sidebar.

Internet Connection: While the logic is local, the application requires an internet connection to load the external libraries (Charts, PDF generator, Icons).

📜 License
This is a personal project template meant for educational or internal tool usage.
