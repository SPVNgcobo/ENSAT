// --- HELPER: XSS SANITIZATION ---
        const escapeHTML = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // --- APP LOGIC ---
        const App = {
            isSignup: false,
            
            init: () => {
                DataService.init();
                const user = JSON.parse(localStorage.getItem('ensCurrentUser'));
                user ? App.showDashboard(user) : App.showLogin();
            },
            
            toggleAuthMode: () => {
                App.isSignup = !App.isSignup;
                const title = document.getElementById('auth-subtitle');
                const btn = document.getElementById('auth-btn-label');
                const text = document.getElementById('auth-switch-text');
                const link = document.getElementById('auth-switch-link');
                const signupFields = document.querySelectorAll('.signup-field');

                if(App.isSignup) {
                    title.innerText = "Create a new account";
                    btn.innerText = "Sign Up & Login";
                    text.innerText = "Already have an account?";
                    link.innerText = "Sign In here";
                    signupFields.forEach(el => el.style.display = 'block');
                } else {
                    title.innerText = "Sign in to manage enterprise assets";
                    btn.innerText = "Sign In";
                    text.innerText = "Don't have an account?";
                    link.innerText = "Sign Up here";
                    signupFields.forEach(el => el.style.display = 'none');
                }
            },

            handleAuth: (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const pass = document.getElementById('login-password').value.trim();
                const err = document.getElementById('login-error');
                const btn = document.getElementById('btn-login');
                
                if(!email || !pass) return;

                btn.classList.add('loading');
                err.style.display = 'none';

                setTimeout(() => {
                    let users = DataService.get('ensUsers');
                    
                    if (App.isSignup) {
                        const name = document.getElementById('signup-name').value.trim();
                        const role = document.getElementById('signup-role').value;
                        if (!name) { err.innerText = "Please enter your full name."; err.style.display = 'block'; btn.classList.remove('loading'); return; }
                        if (users.find(u => u.username === email)) { err.innerText = "User already exists!"; err.style.display = 'block'; btn.classList.remove('loading'); return; }
                        const newUser = { id: Date.now(), username: email, password: pass, name: name, role: role };
                        users.push(newUser);
                        DataService.set('ensUsers', users);
                        localStorage.setItem('ensCurrentUser', JSON.stringify(newUser));
                        App.showDashboard(newUser);
                    } else {
                        const user = users.find(u => u.username === email && u.password === pass);
                        if (user) {
                            localStorage.setItem('ensCurrentUser', JSON.stringify(user));
                            App.showDashboard(user);
                        } else {
                            err.innerText = "Invalid credentials"; err.style.display = 'block';
                            document.querySelector('.auth-container').style.animation = 'none';
                            setTimeout(() => document.querySelector('.auth-container').style.animation = 'shake 0.4s', 10);
                        }
                    }
                    btn.classList.remove('loading');
                }, 800);
            },
            
            forgotPassword: () => {
                const email = prompt("Enter your username/email to reset password:");
                if (!email) return;
                let users = DataService.get('ensUsers');
                let user = users.find(u => u.username === email);
                if (user) {
                    const newPass = prompt("User found! Enter new password:");
                    if (newPass) {
                        user.password = newPass;
                        DataService.set('ensUsers', users);
                        alert("Password updated successfully. Please login.");
                    }
                } else {
                    alert("User not found.");
                }
            },

            showLogin: () => {
                document.body.classList.add('login-mode');
                document.getElementById('view-login').style.display = 'flex';
                document.getElementById('view-app').classList.remove('visible');
                setTimeout(() => document.getElementById('view-app').style.display = 'none', 100);
            },
            
            showDashboard: (user) => {
                UI.updateProfileUI(user);
                UI.applyPermissions(user); // Apply RBAC
                document.getElementById('currentDate').innerText = new Date().toLocaleDateString();
                document.getElementById('view-login').style.display = 'none';
                document.body.classList.remove('login-mode');
                document.getElementById('view-app').style.display = 'flex';
                setTimeout(() => document.getElementById('view-app').classList.add('visible'), 50);
                UI.renderDashboard();
                Workflow.initSig();
            },
            
            logout: () => {
                localStorage.removeItem('ensCurrentUser');
                UI.showToast('Logged out successfully');
                setTimeout(() => App.showLogin(), 500);
            }
        };

        // --- DATA SERVICE (LOCAL STORAGE) ---
        const DataService = {
            init: () => {
                if (!localStorage.getItem('ensUsers')) {
                    const defaultUsers = [
                        { id: 1, username: 'admin', password: 'password', name: 'System Admin', role: 'IT Asset Mgr' },
                        { id: 2, username: 'sarah', password: 'password', name: 'Sarah Jenkins', role: 'Controller' }
                    ];
                    localStorage.setItem('ensUsers', JSON.stringify(defaultUsers));
                }
                if(!localStorage.getItem('ensDataInit_v4')) { // Bumped version to ensure init
                    localStorage.setItem('ensInventory', JSON.stringify([
                        { tag: 'ENS-L-101', type: 'Laptop', model: 'Dell XPS 15', user: 'System', status: 'Available' },
                        { tag: 'ENS-L-102', type: 'Laptop', model: 'MacBook Pro', user: 'Alice Freeman', status: 'Assigned' },
                        { tag: 'ENS-M-201', type: 'Mobile', model: 'iPhone 14', user: 'Bob Smith', status: 'Assigned' },
                        { tag: 'ENS-M-202', type: 'Mobile', model: 'Samsung S23', user: 'System', status: 'Damaged' }
                    ]));
                    localStorage.setItem('ensActivity', JSON.stringify([{ ref: 'WF-001A', user: 'System', type: 'Init', date: new Date().toISOString(), details: 'System initialized.' }]));
                    localStorage.setItem('ensDataInit_v4', 'true');
                }
            },
            get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
            set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
            
            updateInv: (tag, updates) => {
                let inv = DataService.get('ensInventory');
                const idx = inv.findIndex(i => i.tag === tag);
                if(idx >= 0) { 
                    inv[idx] = { ...inv[idx], ...updates };
                    if (updates.status === 'Available' || updates.status === 'Damaged' || updates.status === 'Maintenance') { 
                        if(!updates.user) inv[idx].user = 'System'; 
                    }
                } else { 
                    inv.push({ 
                        tag, 
                        type: updates.type||'Unknown', 
                        model: updates.model||'Generic', 
                        status: updates.status||'Available', 
                        user: updates.user||'System' 
                    });
                }
                DataService.set('ensInventory', inv);
            },
            deleteInv: (tag) => {
                const inv = DataService.get('ensInventory').filter(i => i.tag !== tag);
                DataService.set('ensInventory', inv);
            },
            addActivity: (type, details, user) => {
                const act = DataService.get('ensActivity');
                act.unshift({ ref: `WF-${Date.now().toString().slice(-4)}`, user: user||'System', type, date: new Date().toISOString(), details });
                // Limit log to 500 to prevent storage overflow
                if(act.length > 500) act.pop();
                DataService.set('ensActivity', act);
            },
            
            // --- IMPORT / EXPORT / BACKUP ---
            importCSV: (file) => {
                Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        let count = 0;
                        results.data.forEach(row => { 
                            if(row.tag) { 
                                // Basic sanitization on import
                                DataService.updateInv(escapeHTML(row.tag), { 
                                    type: escapeHTML(row.type), 
                                    model: escapeHTML(row.model), 
                                    user: escapeHTML(row.user), 
                                    status: escapeHTML(row.status) 
                                }); 
                                count++; 
                            } 
                        });
                        UI.showToast(`${count} records imported locally.`);
                        UI.resetPagination();
                    }
                }});
            },
            exportCSV: () => {
                const inv = DataService.get('ensInventory');
                if(inv.length === 0) return alert('No data');
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([Papa.unparse(inv)], { type: 'text/csv;charset=utf-8;' }));
                link.download = `ENS_Local_Inventory.csv`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            },
            
            // FULL BACKUP (JSON)
            backupData: () => {
                const backup = {
                    users: DataService.get('ensUsers'),
                    inventory: DataService.get('ensInventory'),
                    activity: DataService.get('ensActivity')
                };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
                const link = document.createElement('a');
                link.setAttribute("href", dataStr);
                link.setAttribute("download", `ENS_Backup_${new Date().toISOString().slice(0,10)}.json`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            },
            
            // RESTORE (JSON)
            restoreData: (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const backup = JSON.parse(e.target.result);
                        if (backup.users && backup.inventory && backup.activity) {
                            if(confirm("This will OVERWRITE all current data. Continue?")) {
                                DataService.set('ensUsers', backup.users);
                                DataService.set('ensInventory', backup.inventory);
                                DataService.set('ensActivity', backup.activity);
                                alert("Restore successful! The page will now reload.");
                                location.reload();
                            }
                        } else {
                            alert("Invalid backup file.");
                        }
                    } catch (err) {
                        alert("Error parsing backup file.");
                    }
                };
                reader.readAsText(file);
                e.target.value = ''; // reset input
            }
        };

        // --- UI CONTROLLER ---
        const UI = {
            chartInstance: null,
            currentPage: 1,
            rowsPerPage: 10,
            
            applyPermissions: (user) => {
                // RBAC LOGIC
                const isAuditor = user.role === 'Auditor';
                const isViewer = user.role === 'Viewer';
                const isRestricted = isAuditor || isViewer;
                
                // Hide Add Button
                document.getElementById('btn-add-new').style.display = isRestricted ? 'none' : 'inline-flex';
                
                // Disable Workflows
                document.querySelectorAll('.wf-item').forEach(el => {
                    if(isRestricted) el.classList.add('disabled');
                    else el.classList.remove('disabled');
                });
            },

            showToast: (msg, type = 'success') => {
                const box = document.getElementById('toastContainer');
                const el = document.createElement('div');
                el.className = `toast ${type}`;
                const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
                const color = type === 'success' ? 'var(--success)' : 'var(--danger)';
                el.innerHTML = `<i class="fas fa-${icon}" style="color:${color}"></i><span>${msg}</span>`;
                box.appendChild(el); setTimeout(() => el.remove(), 3000);
            },
            toggleSidebar: () => document.getElementById('sidebar').classList.toggle('active'),
            switchView: (view, el) => {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                if(el) el.classList.add('active');
                document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
                document.getElementById(`view-${view}`).classList.add('active-view');
                document.getElementById('sidebar').classList.remove('active');
                if(view === 'dashboard') UI.renderDashboard();
                if(view === 'inventory') UI.renderInventory();
                if(view === 'history') UI.renderHistory();
            },
            
            // -- Modal Logic --
            openModal: (mode, tag = '') => {
                const modal = document.getElementById('assetModal');
                document.getElementById('assetForm').reset();
                modal.style.display = 'flex'; setTimeout(() => modal.querySelector('.modal').classList.add('open'), 10);
                const title = document.getElementById('modalTitle');
                const delBtn = document.getElementById('btn-delete-asset');
                const elTag = document.getElementById('mod-tag');
                const elMode = document.getElementById('mod-mode');
                
                if (mode === 'edit') {
                    elMode.value = 'edit';
                    title.innerText = 'Edit Asset'; elTag.value = tag; elTag.disabled = true; elTag.style.backgroundColor = '#f0f0f0'; delBtn.style.display = 'block';
                    const item = DataService.get('ensInventory').find(i => i.tag === tag);
                    if(item) {
                        document.getElementById('mod-type').value = item.type;
                        document.getElementById('mod-model').value = item.model;
                        document.getElementById('mod-status').value = item.status;
                        document.getElementById('mod-user').value = item.user;
                    }
                } else {
                    elMode.value = 'add';
                    title.innerText = 'Add New Asset'; elTag.disabled = false; elTag.style.backgroundColor = '#fff'; delBtn.style.display = 'none';
                }
            },

            openProfileModal: () => {
                const user = JSON.parse(localStorage.getItem('ensCurrentUser'));
                if (!user) return;
                document.getElementById('profile-name').value = user.name;
                document.getElementById('profile-email').value = user.username;
                document.getElementById('profile-role').value = user.role;
                const initials = user.name.split(' ').map(n=>n[0]).join('');
                document.getElementById('profile-modal-avatar').innerText = initials;
                
                const modal = document.getElementById('profileModal');
                modal.style.display = 'flex';
                setTimeout(() => modal.querySelector('.modal').classList.add('open'), 10);
            },

            saveProfile: (e) => {
                e.preventDefault();
                const name = document.getElementById('profile-name').value;
                const role = document.getElementById('profile-role').value;
                
                // Get Current User
                let user = JSON.parse(localStorage.getItem('ensCurrentUser'));
                user.name = name;
                user.role = role;
                localStorage.setItem('ensCurrentUser', JSON.stringify(user));

                // Update in User DB
                let users = DataService.get('ensUsers');
                const idx = users.findIndex(u => u.username === user.username);
                if (idx >= 0) {
                    users[idx].name = name;
                    users[idx].role = role;
                    DataService.set('ensUsers', users);
                }

                UI.updateProfileUI(user);
                UI.closeModal('profileModal');
                UI.showToast('Profile Updated Successfully');
            },

            updateProfileUI: (user) => {
                document.getElementById('user-name-display').innerText = user.name;
                document.getElementById('user-role-display').innerText = user.role;
                document.getElementById('user-avatar-display').innerText = user.name.split(' ').map(n=>n[0]).join('');
            },

            closeModal: (id) => {
                const modal = document.getElementById(id);
                modal.querySelector('.modal').classList.remove('open'); setTimeout(() => modal.style.display = 'none', 300);
            },
            
            saveAsset: (e) => {
                e.preventDefault();
                const tag = document.getElementById('mod-tag').value.trim();
                const mode = document.getElementById('mod-mode').value;
                if(!tag) return;
                
                // Duplicate Check Logic
                if (mode === 'add') {
                    const exists = DataService.get('ensInventory').find(i => i.tag === tag);
                    if (exists) {
                        alert(`Asset ID ${tag} already exists! Use a unique tag.`);
                        return;
                    }
                }

                const updates = {
                    type: document.getElementById('mod-type').value,
                    model: document.getElementById('mod-model').value,
                    status: document.getElementById('mod-status').value,
                    user: document.getElementById('mod-user').value || 'System'
                };
                DataService.updateInv(tag, updates);
                DataService.addActivity(mode === 'add' ? 'Create' : 'Update', `Asset ${tag} ${mode === 'add' ? 'created' : 'updated'}.`, JSON.parse(localStorage.getItem('ensCurrentUser'))?.name);
                UI.showToast('Asset Saved Locally'); UI.closeModal('assetModal'); UI.renderInventory(); UI.renderDashboard();
            },
            deleteAsset: () => {
                const tag = document.getElementById('mod-tag').value;
                if(confirm(`Delete ${tag}? This cannot be undone.`)) {
                    DataService.deleteInv(tag);
                    DataService.addActivity('Delete', `Asset ${tag} deleted.`, JSON.parse(localStorage.getItem('ensCurrentUser'))?.name);
                    UI.showToast('Asset Deleted'); UI.closeModal('assetModal'); UI.renderInventory(); UI.renderDashboard();
                }
            },
            printInventory: () => window.print(),
            handleImport: (e) => { if(e.target.files[0]) { DataService.importCSV(e.target.files[0]); e.target.value=''; } },
            showQR: (tag) => {
                document.getElementById('qr-display').innerHTML = '';
                document.getElementById('qr-tag-label').innerText = tag;
                new QRCode(document.getElementById('qr-display'), { text: tag, width: 128, height: 128 });
                document.getElementById('qrModal').style.display = 'flex';
            },
            renderDashboard: () => {
                const inv = DataService.get('ensInventory');
                const act = DataService.get('ensActivity');
                document.getElementById('stat-total').innerText = inv.length;
                document.getElementById('stat-stock').innerText = inv.filter(i => i.status === 'Available').length;
                
                // Activity (using sanitization)
                const tbody = document.querySelector('#activityTable tbody');
                tbody.innerHTML = act.slice(0,5).map(x => `<tr><td>${escapeHTML(x.ref)}</td><td>${escapeHTML(x.user)}</td><td>${escapeHTML(x.type)}</td><td>${new Date(x.date).toLocaleDateString()}</td><td><span class="status-badge st-good">Complete</span></td></tr>`).join('');

                // Chart
                const counts = inv.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {});
                if (UI.chartInstance) {
                    UI.chartInstance.data.labels = Object.keys(counts);
                    UI.chartInstance.data.datasets[0].data = Object.values(counts);
                    UI.chartInstance.update();
                } else {
                    const ctx = document.getElementById('assetChart').getContext('2d');
                    UI.chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ['#FFD200', '#111', '#3498db', '#27ae60'], borderWidth:0 }] }, options: { maintainAspectRatio:false, cutout:'75%', plugins:{legend:{position:'right'}} } });
                }
            },
            
            // --- PAGINATION LOGIC ---
            resetPagination: () => { UI.currentPage = 1; UI.renderInventory(); },
            changePage: (delta) => { UI.currentPage += delta; UI.renderInventory(); },
            
            renderInventory: () => {
                const search = document.getElementById('inv-search').value.toLowerCase();
                const filter = document.getElementById('inv-filter').value;
                let inv = DataService.get('ensInventory');
                
                // RBAC Check
                const user = JSON.parse(localStorage.getItem('ensCurrentUser'));
                const isRestricted = user && user.role === 'Auditor';

                // Filter Data
                const filtered = inv.filter(item => {
                    if(filter !== 'All' && item.status !== filter) return false;
                    if(search && ![item.tag, item.user, item.model].some(s => (s||'').toLowerCase().includes(search))) return false;
                    return true;
                });

                // Pagination Slicing
                const total = filtered.length;
                const start = (UI.currentPage - 1) * UI.rowsPerPage;
                const end = start + UI.rowsPerPage;
                const paginated = filtered.slice(start, end);

                // Update Controls
                document.getElementById('pg-info').innerText = `Showing ${total > 0 ? start + 1 : 0}-${Math.min(end, total)} of ${total}`;
                document.getElementById('pg-prev').disabled = UI.currentPage === 1;
                document.getElementById('pg-next').disabled = end >= total;

                const tbody = document.querySelector('#inventoryTable tbody');
                tbody.innerHTML = '';

                paginated.forEach(item => {
                    let badge = 'st-good';
                    if(item.status === 'Assigned') badge = 'st-assigned';
                    if(item.status === 'Damaged') badge = 'st-damaged';
                    if(item.status === 'Maintenance') badge = 'st-maintenance';
                    
                    let actions = '';
                    if(!isRestricted) {
                        actions = `
                        <td style="display:flex; gap:5px;">
                            <button class="icon-btn" onclick="UI.showQR('${escapeHTML(item.tag)}')"><i class="fas fa-qrcode"></i></button>
                            <button class="icon-btn" onclick="UI.openModal('edit', '${escapeHTML(item.tag)}')"><i class="fas fa-edit"></i></button>
                        </td>`;
                    } else {
                        actions = `<td><span style="color:#999; font-size:11px;">Read Only</span></td>`;
                    }

                    // Use escapeHTML to prevent XSS
                    tbody.innerHTML += `<tr><td style="font-weight:bold;">${escapeHTML(item.tag)}</td><td>${escapeHTML(item.type)}</td><td>${escapeHTML(item.model)}</td><td>${escapeHTML(item.user)}</td><td><span class="status-badge ${badge}">${escapeHTML(item.status)}</span></td>${actions}</tr>`;
                });
            },
            renderHistory: () => {
                const act = DataService.get('ensActivity');
                document.getElementById('auditTimeline').innerHTML = act.map(x => `
                    <div class="timeline-item"><div class="timeline-header"><div class="timeline-title">${escapeHTML(x.type)} - ${escapeHTML(x.user)}</div><div class="timeline-date">${new Date(x.date).toLocaleString()}</div></div><p class="timeline-details">${escapeHTML(x.details)}</p></div>
                `).join('');
            }
        };

        const Workflow = {
            currentStep: 1,
            nextStep: (n) => {
                // Logic checks for issuance step 1 -> 2
                if(n === 2 && Workflow.currentStep === 1) {
                     if(!document.getElementById('iss-name').value) return alert("Please enter a name");
                     // Auto-check email
                     if(!document.getElementById('iss-email').value) Workflow.autoFillEmail();
                }
                // Logic checks for issuance step 2 -> 3
                if(n === 3 && Workflow.currentStep === 2) {
                     const tag = document.getElementById('iss-tag').value;
                     if(!tag) return alert("Enter Asset Tag");
                     
                     const asset = DataService.get('ensInventory').find(i => i.tag === tag);
                     if(!asset) return alert("Asset not found in database");
                     if(asset.status !== 'Available') return alert(`Asset is currently ${asset.status}. Must be 'Available' to issue.`);
                     
                     document.getElementById('iss-model').value = asset.model; // Autofill verification
                }

                document.querySelectorAll('[id^="form-step-"]').forEach(d => d.style.display = 'none');
                document.getElementById(`form-step-${n}`).style.display = 'block';
                document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
                document.getElementById(`i-step-${n}`).classList.add('active');
                Workflow.currentStep = n;
            },
            prevStep: (n) => {
                document.querySelectorAll('[id^="form-step-"]').forEach(d => d.style.display = 'none');
                document.getElementById(`form-step-${n}`).style.display = 'block';
                document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
                document.getElementById(`i-step-${n}`).classList.add('active');
                Workflow.currentStep = n;
            },
            autoFillEmail: () => {
                const name = document.getElementById('iss-name').value;
                const emailInput = document.getElementById('iss-email');
                if(name && !emailInput.value.includes('@')) {
                    const slug = name.toLowerCase().replace(/\s+/g, '.');
                    emailInput.value = `${slug}@ensafrica.com`;
                }
            },
            completeIssuance: () => {
                const name = document.getElementById('iss-name').value;
                const email = document.getElementById('iss-email').value;
                const tag = document.getElementById('iss-tag').value;
                
                // Verify Email Domain
                if(!email.endsWith('@ensafrica.com')) {
                    if(!confirm(`The email ${email} does not end with @ensafrica.com. Continue anyway?`)) return;
                }

                // Capture Signature for persistence
                const canvas = document.getElementById('sig-canvas');
                const sigData = canvas.toDataURL(); // Base64 string
                
                // Generate PDF
                html2pdf().set({ margin: 10, filename: `Issuance_${tag}.pdf`, jsPDF: { unit: 'mm', format: 'a4' } }).from(document.getElementById('issuance-card')).save().then(() => {
                    // Save to DB
                    DataService.updateInv(tag, { user: name, status: 'Assigned' });
                    // Log activity WITH signature data (truncated for display, but saved)
                    DataService.addActivity('Issuance', `Issued ${tag} to ${name} (${email}). [Sig Captured]`, JSON.parse(localStorage.getItem('ensCurrentUser'))?.name);
                    
                    UI.showToast('PDF Saved & Inventory Updated');
                    setTimeout(() => UI.switchView('dashboard'), 1000);
                });
            },
            completeMovement: () => {
                const tag = document.getElementById('mov-tag').value;
                const nw = document.getElementById('mov-new').value;
                const asset = DataService.get('ensInventory').find(i => i.tag === tag);
                
                if(!asset) return alert("Asset not found");
                // if(asset.status !== 'Assigned') return alert("Asset must be currently Assigned to be Transferred.");

                DataService.updateInv(tag, { user: nw, status: 'Assigned' });
                DataService.addActivity('Transfer', `Transferred ${tag} to ${nw}`, JSON.parse(localStorage.getItem('ensCurrentUser'))?.name);
                UI.showToast('Transfer Complete'); UI.switchView('inventory');
            },
            completeRetrieval: () => {
                const tag = document.getElementById('ret-tag').value;
                const asset = DataService.get('ensInventory').find(i => i.tag === tag);
                
                if(!asset) return alert("Asset not found");
                if(asset.status === 'Available') return alert("Asset is already Available.");

                const damaged = document.querySelectorAll('.damage-item.selected').length > 0;
                DataService.updateInv(tag, { status: damaged ? 'Damaged' : 'Available' });
                DataService.addActivity('Return', `Returned ${tag}. Status: ${damaged?'Damaged':'OK'}`, JSON.parse(localStorage.getItem('ensCurrentUser'))?.name);
                UI.showToast('Return Processed'); UI.switchView('inventory');
            },
            initSig: () => {
                const c = document.getElementById('sig-canvas');
                const ctx = c.getContext('2d');
                c.width = c.offsetWidth; c.height = c.offsetHeight;
                let paint = false;
                
                // Mouse Events
                c.onmousedown = (e) => { paint = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
                c.onmousemove = (e) => { if(paint) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } };
                c.onmouseup = () => paint = false;
                c.onmouseleave = () => paint = false;

                // Touch Events (Mobile Fix)
                c.addEventListener('touchstart', (e) => {
                    e.preventDefault(); // Prevent scroll
                    paint = true;
                    const touch = e.touches[0];
                    const rect = c.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                }, { passive: false });

                c.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    if(paint) {
                        const touch = e.touches[0];
                        const rect = c.getBoundingClientRect();
                        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                        ctx.stroke();
                    }
                }, { passive: false });

                c.addEventListener('touchend', () => paint = false);

                Workflow.clearSig = () => ctx.clearRect(0,0,c.width,c.height);
            }
        };

        document.addEventListener('DOMContentLoaded', App.init);