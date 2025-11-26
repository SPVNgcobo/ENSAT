/* ---------- UTILS ---------- */
const Utils = {
  escape: (str) => str ? String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]) : '',
  debounce: (func, wait=300) => {
    let timeout = null;
    return function(...args){
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },
  formatDate: (iso) => {
    try {
      const d = new Date(iso);
      if(isNaN(d)) return iso;
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch(e){ return iso; }
  },
  hash: async (str) => {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
  isValidEmail: (email) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
};

/* ---------- APP CORE ---------- */
const App = {
  isSignup:false,
  init: () => {
    if(localStorage.getItem('ensTheme') === 'dark') document.body.classList.add('dark-mode');
    
    DataService.init();
    const user = JSON.parse(localStorage.getItem('ensCurrentUser') || 'null');
    user ? App.showDashboard(user) : App.showLogin();
    
    const logoImg = document.getElementById('login-logo');
    logoImg.onerror = () => { logoImg.style.display='none'; };

    document.addEventListener('click', (e) => {
        if(!e.target.closest('.profile-widget')) document.getElementById('profile-dropdown').classList.remove('active');
        // Mobile sidebar close
        if(!e.target.closest('.sidebar') && !e.target.closest('.mobile-toggle') && document.getElementById('sidebar').classList.contains('active')) {
            UI.toggleSidebar();
        }
    });
    window.addEventListener('resize', () => { if(Workflow.currentStep === 3) Workflow.initSig(); });
  },

  toggleAuthMode: () => {
    App.isSignup = !App.isSignup;
    document.querySelectorAll('.signup-field').forEach(f => f.style.display = App.isSignup ? 'block':'none');
    document.getElementById('auth-subtitle').innerText = App.isSignup ? 'Create a new account' : 'Enterprise Asset Management';
    document.getElementById('auth-btn-label').innerText = App.isSignup ? 'Create Account' : 'Sign In';
    document.getElementById('auth-switch-text').innerText = App.isSignup ? 'Have an account?':'Don\'t have an account?';
    document.getElementById('auth-switch-link').innerText = App.isSignup ? 'Sign In' : 'Sign Up';
  },

  handleAuth: async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email').value || '').trim();
    const passRaw = (document.getElementById('login-password').value || '').trim();
    const err = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    err.style.display='none';
    if(!email || !passRaw){ err.innerText='All fields required'; err.style.display='block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    const passHash = await Utils.hash(passRaw);
    
    setTimeout(() => {
      let users = DataService.get('ensUsers');
      if(App.isSignup){
        const name = (document.getElementById('signup-name').value||'').trim();
        const role = document.getElementById('signup-role').value;
        if(!name){ err.innerText='Name required'; err.style.display='block'; btn.disabled=false; btn.innerHTML='Create Account'; return; }
        if(users.find(u=>u.username===email)){ err.innerText='User already exists'; err.style.display='block'; btn.disabled=false; btn.innerHTML='Create Account'; return; }
        
        const newUser = { id: Date.now(), username: email, password: passHash, name, role, office:'HQ' };
        users.push(newUser);
        DataService.set('ensUsers', users);
        localStorage.setItem('ensCurrentUser', JSON.stringify(newUser));
        App.showDashboard(newUser);
      } else {
        const user = users.find(u=>u.username===email && u.password===passHash);
        const legacyUser = users.find(u=>u.username===email && u.password===passRaw); // Support V1 passwords
        
        if(user){ 
             localStorage.setItem('ensCurrentUser', JSON.stringify(user)); App.showDashboard(user); 
        } else if (legacyUser) {
             legacyUser.password = passHash; // Upgrade to hash
             DataService.set('ensUsers', users);
             localStorage.setItem('ensCurrentUser', JSON.stringify(legacyUser)); App.showDashboard(legacyUser);
        } else { 
             err.innerText='Invalid credentials'; err.style.display='block'; 
        }
      }
      btn.disabled=false;
      if(!App.isSignup) btn.innerHTML = '<span id="auth-btn-label">Sign In</span> <i class="fas fa-arrow-right"></i>';
    }, 500);
  },

  logout: () => {
    localStorage.removeItem('ensCurrentUser'); location.reload();
  },

  showLogin: () => {
    document.getElementById('view-login').style.display='block';
    document.body.classList.add('login-mode');
    document.getElementById('view-app').style.display='none';
  },

  showDashboard: (user) => {
    UI.updateProfile(user);
    UI.applyPermissions(user);
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
    document.getElementById('view-login').style.display='none';
    document.body.classList.remove('login-mode');
    document.getElementById('view-app').style.display='flex';
    UI.renderDashboard();
  }
};

/* ---------- DATA SERVICE ---------- */
const DataService = {
  init: async () => {
    if(!localStorage.getItem('ensUsers')){
      const adminHash = await Utils.hash('password');
      localStorage.setItem('ensUsers', JSON.stringify([{ id:1, username:'admin', password:adminHash, name:'Admin User', role:'IT Manager', office:'Sandton'}]));
    }
    if(!localStorage.getItem('ensInventory')){
      localStorage.setItem('ensInventory', JSON.stringify([
        { tag:'ENS-L-001', type:'Laptop', model:'Dell Latitude 7420', user:'System', status:'Available', notes:'Brand new stock', searchStr:'ens-l-001 laptop dell latitude 7420 system available brand new stock' },
        { tag:'ENS-M-102', type:'Mobile', model:'iPhone 13', user:'Sarah Connor', status:'Assigned', notes:'Screen protector applied', searchStr:'ens-m-102 mobile iphone 13 sarah connor assigned screen protector applied' }
      ]));
    }
    if(!localStorage.getItem('ensActivity')) localStorage.setItem('ensActivity', JSON.stringify([]));
  },

  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e){ return []; } },
  set: (k, v) => { localStorage.setItem(k, JSON.stringify(v)); },

  updateInv: (tag, data) => {
    let inv = DataService.get('ensInventory');
    const idx = inv.findIndex(i => i.tag === tag);
    // Be careful not to overwrite the searchStr if not needed, but here we rebuild it to include notes
    const sStr = ( (data.tag||inv[idx]?.tag||tag) + ' ' + (data.type||inv[idx]?.type||'') + ' ' + (data.model||inv[idx]?.model||'') + ' ' + (data.user||inv[idx]?.user||'') + ' ' + (data.status||inv[idx]?.status||'') + ' ' + (data.notes||inv[idx]?.notes||'') ).toLowerCase();
    data.searchStr = sStr;
    
    if(idx > -1) inv[idx] = { ...inv[idx], ...data };
    else inv.push({ tag, ...data });
    DataService.set('ensInventory', inv);
  },
  
  getAssetHistory: (tag) => {
      const allLogs = DataService.get('ensActivity');
      return allLogs.filter(l => l.details.includes(tag) || l.ref.includes(tag));
  },

  log: (type, details, user) => {
    let log = DataService.get('ensActivity') || [];
    log.unshift({ ref: `LOG-${Date.now().toString().slice(-5)}`, type, user, date: new Date().toISOString(), details });
    if(log.length > 2000) log.length = 2000;
    DataService.set('ensActivity', log);
  },

  // INVENTORY ONLY - For Excel/Reporting
  exportCSV: () => {
    const data = DataService.get('ensInventory').map(({searchStr, contract, ...rest}) => rest); // Exclude large objects
    const csv = Papa.unparse(data);
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `ENS_Inventory_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // FULL SYSTEM BACKUP - For Restore functionality
  backupJSON: () => {
      const fullState = {
          ensInventory: DataService.get('ensInventory'),
          ensUsers: DataService.get('ensUsers'),
          ensActivity: DataService.get('ensActivity')
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState, null, 2));
      const link = document.createElement('a');
      link.href = dataStr;
      link.download = `ENS_System_Backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
  },

  triggerImport: () => { document.getElementById('import-csv').click(); },

  handleImport: (ev) => {
      const file = ev.target.files[0];
      if(!file) return;
      Papa.parse(file, {
          header: true, skipEmptyLines: true,
          complete: function(results) {
              if(results.data && results.data.length > 0) {
                  let count = 0;
                  results.data.forEach(row => {
                      const tag = row.Tag || row.tag;
                      if(tag) {
                          DataService.updateInv(tag, {
                              type: row.Type || row.type || 'Unknown',
                              model: row.Model || row.model || 'Unknown',
                              user: row.User || row.user || '',
                              status: row.Status || row.status || 'Available',
                              notes: row.Notes || row.notes || ''
                          });
                          count++;
                      }
                  });
                  UI.toast(`Successfully imported ${count} assets`, 'success');
                  UI.renderInventory(); UI.renderDashboard();
                  DataService.log('System', `Imported ${count} assets from CSV`, 'Admin');
              } else { UI.toast('No valid data found in CSV', 'error'); }
          }
      });
      ev.target.value = '';
  },

  restoreData: (ev) => {
    const file = ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        // Validation
        if(!json.ensInventory && !json.ensUsers) throw new Error('Invalid Backup File');
        
        if(!confirm('WARNING: This will overwrite your current data with the backup. Continue?')) return;

        if(json.ensInventory) localStorage.setItem('ensInventory', JSON.stringify(json.ensInventory));
        if(json.ensUsers) localStorage.setItem('ensUsers', JSON.stringify(json.ensUsers));
        if(json.ensActivity) localStorage.setItem('ensActivity', JSON.stringify(json.ensActivity));
        
        alert('System restored successfully!');
        location.reload();
      } catch(err){ 
          alert('Invalid backup file. Please use a JSON file generated by "Full Backup".'); 
      }
    };
    reader.readAsText(file);
    ev.target.value = ''; // Reset
  },

  factoryReset: () => {
      if(confirm('DANGER: This will delete ALL assets, history, and users. It cannot be undone. Are you sure?')) {
          localStorage.clear();
          location.reload();
      }
  }
};


/* ---------- UI CONTROLLER ---------- */
const UI = {
  pg:1, limit:10, sort:{col:null,asc:true},

  toggleTheme: () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('ensTheme', document.body.classList.contains('dark-mode') ? 'dark':'light');
    const icon = document.getElementById('dm-icon');
    if(icon) icon.className = document.body.classList.contains('dark-mode') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
    // Re-render chart for colors
    UI.renderDashboard();
  },
  
  toggleProfileMenu: (e) => {
      e.stopPropagation(); 
      const drop = document.getElementById('profile-dropdown');
      drop.classList.toggle('active');
      const icon = document.getElementById('dm-icon');
      if(icon) icon.className = document.body.classList.contains('dark-mode') ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
  },

  applyPermissions: (user) => {
    const readOnly = ['Auditor','Viewer'].includes(user.role);
    const btn = document.getElementById('btn-add-new');
    if(btn) btn.style.display = readOnly ? 'none' : 'inline-flex';
  },

  updateProfile: (u) => {
    document.getElementById('user-name-display').innerText = u.name || 'User';
    document.getElementById('user-role-display').innerText = u.role || '';
    document.getElementById('user-avatar-display').innerText = (u.name||'').substring(0,2).toUpperCase();
    document.getElementById('dropdown-email').innerText = u.username || '';
  },

  toast: (msg, type='info') => {
      const c = document.getElementById('toastContainer');
      const t = document.createElement('div');
      t.className = 'toast';
      t.style.borderLeft = `4px solid ${type==='error'?'#FF4842':type==='success'?'#229A16':'#FFD200'}`;
      let icon = type==='error'?'fa-exclamation-circle':type==='success'?'fa-check-circle':'fa-info-circle';
      t.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
      c.appendChild(t);
      setTimeout(()=>t.remove(), 4000);
  },

  switchView: (view, btn) => {
    document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.querySelectorAll('.view-section').forEach(e=>e.classList.remove('active-view'));
    const el = document.getElementById('view-'+view);
    if(el) el.classList.add('active-view');
    document.getElementById('sidebar').classList.remove('active');
    
    if(view==='dashboard') UI.renderDashboard();
    if(view==='inventory') UI.renderInventory();
    if(view==='history') UI.renderHistory();
    // NEW: Initialize issuance details when opening the view
    if(view==='issuance') Workflow.initIssuance(); 
  },

  toggleSidebar: () => document.getElementById('sidebar').classList.toggle('active'),

  renderDashboard: () => {
    const inv = DataService.get('ensInventory');
    const logs = DataService.get('ensActivity');

    document.getElementById('stat-total').innerText = (inv||[]).length;
    document.getElementById('stat-stock').innerText = (inv||[]).filter(i=>i.status==='Available').length;

    const tbody = document.querySelector('#activityTable tbody');
    const empty = document.getElementById('activity-empty');
    
    if(!logs || logs.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = logs.slice(0,5).map(l => `
          <tr>
            <td><span style="font-family:monospace;background:rgba(0,0,0,0.05);padding:2px 4px;border-radius:4px;">${Utils.escape(l.ref)}</span></td>
            <td><span style="font-weight:500">${Utils.escape(l.user)}</span></td>
            <td>${Utils.escape(l.type)}</td>
            <td>${Utils.formatDate(l.date)}</td>
            <td><span class="status-badge st-good">Done</span></td>
          </tr>
        `).join('');
    }

    // Chart
    const counts = {};
    (inv||[]).forEach(i => counts[i.type] = (counts[i.type]||0) + 1);
    const isDark = document.body.classList.contains('dark-mode');

    const ctx = document.getElementById('assetChart');
    if(ctx && ctx.offsetParent !== null) {
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: Object.keys(counts),
            datasets: [{ 
                data: Object.values(counts), 
                backgroundColor: ['#FFD200','#212B36','#1890FF','#FF4842', '#00AB55'], 
                borderWidth:0,
                hoverOffset: 4
            }]
          },
          options:{
              responsive:true,
              maintainAspectRatio:false,
              cutout:'70%',
              plugins:{
                  legend:{position:'right', labels:{color: isDark ? '#fff':'#111', usePointStyle:true, padding:20}}
              },
              layout: { padding: 20 }
          }
        });
    }
  },
  
  renderHistory: () => {
      const logs = DataService.get('ensActivity');
      const tbody = document.getElementById('history-body');
      tbody.innerHTML = logs.map(l => `
          <tr>
            <td style="font-family:monospace;font-weight:600" data-label="REF">${Utils.escape(l.ref)}</td>
            <td data-label="ACTION">${Utils.escape(l.type)}</td>
            <td data-label="BY">${Utils.escape(l.user)}</td>
            <td data-label="DETAILS">${Utils.escape(l.details)}</td>
            <td data-label="DATE">${Utils.formatDate(l.date)}</td>
          </tr>
      `).join('');
  },

  debouncedSearch: Utils.debounce(()=>UI.renderInventory(), 300),

  clearSearch: () => {
      document.getElementById('inv-search').value = '';
      UI.renderInventory();
  },

  sortData: (col) => {
    if(UI.sort.col === col) UI.sort.asc = !UI.sort.asc;
    else { UI.sort.col = col; UI.sort.asc = true; }
    UI.renderInventory();
  },

  renderInventory: () => {
    const search = (document.getElementById('inv-search').value || '').toLowerCase();
    // Show/Hide clear button
    document.getElementById('search-clear-btn').style.display = search ? 'block' : 'none';

    const filter = (document.getElementById('inv-filter').value || 'All');
    let data = DataService.get('ensInventory') || [];

    data = data.filter(i => {
      const matchSearch = !search || (i.searchStr && i.searchStr.includes(search));
      const matchFilter = filter==='All' || i.status === filter;
      return matchSearch && matchFilter;
    });

    // sorting
    if(UI.sort.col){
      data.sort((a,b)=>{
        let va = a[UI.sort.col] || '';
        let vb = b[UI.sort.col] || '';
        const numA = parseFloat(va), numB = parseFloat(vb);
        if(!isNaN(numA) && !isNaN(numB)) return UI.sort.asc ? numA - numB : numB - numA;
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        if(va < vb) return UI.sort.asc ? -1 : 1;
        if(va > vb) return UI.sort.asc ? 1 : -1;
        return 0;
      });
    }

    const total = data.length;
    const start = (UI.pg - 1) * UI.limit;
    const pageData = data.slice(start, start + UI.limit);

    const startText = total === 0 ? 0 : Math.min(start + 1, total);
    const endText = total === 0 ? 0 : Math.min(start + UI.limit, total);

    document.getElementById('pg-info').innerText = `Showing ${startText} - ${endText} of ${total}`;
    document.getElementById('pg-prev').disabled = UI.pg === 1;
    document.getElementById('pg-next').disabled = start + UI.limit >= total;

    const tbody = document.getElementById('inv-body');
    const emptyState = document.getElementById('inv-empty');
    tbody.innerHTML = '';
    
    if(pageData.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        const frag = document.createDocumentFragment();
        
        // Highlighter helper
        const h = (txt) => {
            if(!search) return Utils.escape(txt);
            const regex = new RegExp(`(${search})`, 'gi');
            return Utils.escape(txt).replace(regex, '<span class="highlight">$1</span>');
        };

        pageData.forEach(row=>{
          const tr = document.createElement('tr');
          let badgeClass = row.status === 'Available' ? 'st-good' : row.status === 'Assigned' ? 'st-assigned' : row.status === 'Maintenance' ? 'st-maint' : 'st-damaged';
          tr.innerHTML = `
            <td data-label="TAG" style="font-weight:600;font-family:monospace">${h(row.tag)}</td>
            <td data-label="TYPE">${h(row.type)}</td>
            <td data-label="MODEL">${h(row.model)}</td>
            <td data-label="USER">${h(row.user)}</td>
            <td data-label="STATUS"><span class="status-badge ${badgeClass}">${row.status}</span></td>
            <td data-label="ACTIONS">
              <button class="btn btn-secondary" style="padding:6px 10px;" onclick="UI.openModal('edit','${row.tag}')" title="Edit"><i class="fas fa-edit"></i></button>
            </td>
          `;
          frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    }
  },

  changePage: (dir) => { UI.pg = Math.max(1, UI.pg + dir); UI.renderInventory(); },
  resetPagination: () => { UI.pg = 1; UI.renderInventory(); },

  openModal: (mode, tag) => {
    const modal = document.getElementById('assetModal');
    document.getElementById('mod-mode').value = mode;
    const form = modal.querySelector('form');
    form.reset();
    
    const historyBox = document.getElementById('modal-history-section');
    const timelineContent = document.getElementById('modal-timeline-content');
    
    const btnDel = document.getElementById('btn-delete-asset');
    const btnClone = document.getElementById('btn-clone-asset');
    const btnContract = document.getElementById('btn-view-contract');

    if(mode === 'edit'){
      document.getElementById('modal-title').innerText = `Edit ${tag}`;
      const item = DataService.get('ensInventory').find(i => i.tag === tag) || {};
      document.getElementById('mod-tag').value = item.tag || '';
      document.getElementById('mod-tag').disabled = true;
      document.getElementById('mod-type').value = item.type || 'Laptop';
      document.getElementById('mod-model').value = item.model || '';
      document.getElementById('mod-status').value = item.status || 'Available';
      document.getElementById('mod-user').value = item.user || '';
      document.getElementById('mod-notes').value = item.notes || '';
      
      btnDel.style.display = 'inline-flex';
      btnClone.style.display = 'inline-flex';
      
      // NEW: Check for contract data
      if(item.contract && item.contract.signature) {
          btnContract.style.display = 'inline-flex';
          // Store the tag on the button for easy access
          btnContract.dataset.tag = tag;
      } else {
          btnContract.style.display = 'none';
      }
      
      // Show History
      historyBox.style.display = 'block';
      const history = DataService.getAssetHistory(tag);
      if(history.length > 0) {
          timelineContent.innerHTML = history.slice(0, 10).map((h, i) => `
              <div class="timeline-item ${i===0?'latest':''}">
                  <div style="font-weight:600;font-size:13px">${Utils.escape(h.type)}</div>
                  <div style="color:var(--text-light);font-size:13px;">${Utils.escape(h.details)}</div>
                  <div style="color:var(--text-light);font-size:11px;margin-top:2px;opacity:0.7">${Utils.formatDate(h.date)} by ${h.user}</div>
              </div>
          `).join('');
      } else {
          timelineContent.innerHTML = '<div style="color:var(--text-light);font-style:italic;font-size:13px;">No history recorded for this asset.</div>';
      }

    } else {
      document.getElementById('modal-title').innerText = 'Add New Asset';
      document.getElementById('mod-tag').disabled = false;
      btnDel.style.display = 'none';
      btnClone.style.display = 'none';
      btnContract.style.display = 'none';
      historyBox.style.display = 'none';
    }
    modal.style.display = 'flex';
    setTimeout(()=>modal.classList.add('open'),10);
  },
  
  cloneAsset: () => {
      // Grab current values
      const type = document.getElementById('mod-type').value;
      const model = document.getElementById('mod-model').value;
      const status = document.getElementById('mod-status').value;
      const notes = document.getElementById('mod-notes').value;
      
      UI.closeModal('assetModal');
      
      setTimeout(() => {
          UI.openModal('add');
          // Pre-fill
          document.getElementById('mod-type').value = type;
          document.getElementById('mod-model').value = model;
          document.getElementById('mod-status').value = status;
          document.getElementById('mod-notes').value = notes;
          UI.toast('Cloning asset... Enter new Tag ID.', 'info');
      }, 300);
  },
  
  viewContract: () => {
      // Get tag from the button we setup in openModal
      const tag = document.getElementById('btn-view-contract').dataset.tag;
      const item = DataService.get('ensInventory').find(i => i.tag === tag);
      
      if(!item || !item.contract) {
          UI.toast('No contract found for this asset', 'error');
          return;
      }

      const c = item.contract;

      // Populate the Paper View
      document.getElementById('con-ref').innerText = c.ref || 'N/A';
      document.getElementById('con-issuer').innerText = c.issuer || 'System';
      document.getElementById('con-date').innerText = c.issueDate || '';
      
      document.getElementById('con-name').innerText = item.user;
      document.getElementById('con-email').innerText = c.recipientEmail || '';
      
      document.getElementById('con-tag').innerText = item.tag;
      document.getElementById('con-model').innerText = item.model;
      document.getElementById('con-type').innerText = item.type;
      
      document.getElementById('con-initials').innerText = c.initials || '';
      document.getElementById('con-sig-img').src = c.signature; // Load the saved image

      // Show Modal
      const modal = document.getElementById('contractModal');
      modal.style.display = 'flex';
      setTimeout(()=>modal.classList.add('open'), 10);
  },

  downloadContractPDF: () => {
      const node = document.getElementById('contract-paper');
      const tag = document.getElementById('con-tag').innerText;
      const opt = { 
          margin: 10, 
          filename: `Contract_${tag}.pdf`, 
          image: { type: 'jpeg', quality: 0.98 }, 
          html2canvas: { scale: 2 }, 
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      };
      html2pdf().set(opt).from(node).save();
  },
  
  openProfileModal: () => {
      const u = JSON.parse(localStorage.getItem('ensCurrentUser') || '{}');
      document.getElementById('profile-name').value = u.name || '';
      document.getElementById('profile-role').value = u.role || '';
      document.getElementById('profile-office').value = u.office || 'HQ';
      const modal = document.getElementById('profileModal');
      modal.style.display = 'flex';
      setTimeout(()=>modal.classList.add('open'),10);
  },
  
  saveProfile: (e) => {
      e.preventDefault();
      let u = JSON.parse(localStorage.getItem('ensCurrentUser') || '{}');
      const newName = document.getElementById('profile-name').value;
      u.name = newName;
      localStorage.setItem('ensCurrentUser', JSON.stringify(u));
      let users = DataService.get('ensUsers');
      const idx = users.findIndex(user => user.username === u.username);
      if(idx > -1){ users[idx] = u; DataService.set('ensUsers', users); }
      
      UI.updateProfile(u);
      UI.closeModal('profileModal');
      UI.toast('Profile updated successfully', 'success');
  },

  closeModal: (id) => {
    const modal = document.getElementById(id);
    if(!modal) return;
    modal.classList.remove('open');
    setTimeout(()=>modal.style.display='none',250);
  },

  saveAsset: (e) => {
    e.preventDefault();
    const mode = document.getElementById('mod-mode').value;
    const tag = (document.getElementById('mod-tag').value || '').trim();
    if(!tag){ UI.toast('Asset Tag is required', 'error'); return; }
    
    if(mode !== 'edit') {
        const existing = DataService.get('ensInventory').find(i => i.tag === tag);
        if(existing) { UI.toast('Asset Tag already exists!', 'error'); return; }
    }

    const data = {
      type: document.getElementById('mod-type').value,
      model: document.getElementById('mod-model').value,
      status: document.getElementById('mod-status').value,
      user: document.getElementById('mod-user').value,
      notes: document.getElementById('mod-notes').value
    };
    
    DataService.updateInv(tag, data);
    DataService.log(mode==='edit'?'Asset Update':'Asset Create', `Saved details for ${tag}`, JSON.parse(localStorage.getItem('ensCurrentUser')||'{}').name || 'System');
    UI.closeModal('assetModal');
    UI.renderInventory(); UI.renderDashboard();
    UI.toast('Asset saved successfully', 'success');
  },

  deleteAsset: () => {
    const tag = document.getElementById('mod-tag').value;
    if(!confirm(`Are you sure you want to delete ${tag}? This cannot be undone.`)) return;
    let inv = DataService.get('ensInventory');
    inv = inv.filter(i=>i.tag !== tag);
    DataService.set('ensInventory', inv);
    UI.closeModal('assetModal');
    UI.renderInventory(); UI.renderDashboard();
    UI.toast('Asset deleted permanently', 'success');
  }
};


/* ---------- WORKFLOW ---------- */
const Workflow = {
  currentStep: 1,
  ctx: null,
  activeAsset: null,

  initIssuance: () => {
      // Get current user
      const user = JSON.parse(localStorage.getItem('ensCurrentUser') || '{}');
      // Get current date
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      
      // Fill fields
      const issuerField = document.getElementById('iss-by-user');
      const dateField = document.getElementById('iss-date');
      
      if(issuerField) issuerField.value = user.name || 'System Admin';
      if(dateField) dateField.value = date;
  },

  nextStep: (n) => {
    if(n === 2) {
        const name = document.getElementById('iss-name').value;
        const email = document.getElementById('iss-email').value;
        if(!name) {
            UI.toast('Please enter a Full Name', 'error');
            document.getElementById('iss-name').focus();
            return;
        }
        if(!email || !Utils.isValidEmail(email)) {
            UI.toast('Please enter a valid Email Address', 'error');
            document.getElementById('iss-email').focus();
            return;
        }
    }
    
    document.querySelectorAll('[id^="form-step-"]').forEach(el=>el.style.display='none');
    const el = document.getElementById(`form-step-${n}`);
    if(el) {
        el.style.display='block';
        // Small animation
        el.style.opacity = 0; el.style.transform = 'translateY(10px)';
        setTimeout(() => { el.style.transition = '0.3s'; el.style.opacity = 1; el.style.transform = 'translateY(0)'; }, 10);
    }

    document.querySelectorAll('.step').forEach(s=>s.classList.remove('active'));
    const stepEl = document.getElementById(`i-step-${n}`);
    if(stepEl) stepEl.classList.add('active');

    if(n===3) {
        setTimeout(Workflow.initSig, 100); 
        document.getElementById('summary-tag').innerText = document.getElementById('iss-tag').value;
    }
    Workflow.currentStep = n;
  },
  
  lookupAsset: (mode) => {
      const tagField = document.getElementById(mode + '-tag');
      const tag = (tagField.value || '').trim();
      if(!tag) return;
      
      const assets = DataService.get('ensInventory');
      const found = assets.find(a => a.tag.toLowerCase() === tag.toLowerCase());
      Workflow.activeAsset = found;
      
      const display = document.getElementById(mode + '-asset-display');
      const displayNew = document.getElementById(mode + '-new-details') || document.getElementById(mode + '-details');
      const errorMsg = document.getElementById(mode + '-err'); // Need element for text feedback
      
      if(displayNew) displayNew.style.display = 'none';

      if(found) {
          display.style.display = 'block';
          display.style.borderColor = 'var(--border)';
          if(errorMsg) errorMsg.style.display = 'none';

          // Logic Guards
          let warning = '';
          if(mode === 'iss' && found.status === 'Assigned') warning = `Warning: Assigned to ${found.user}`;
          else if (mode === 'mov' && found.status !== 'Assigned') warning = `Error: Asset is ${found.status}. Must be Assigned to transfer.`;
          else if (mode === 'ret' && found.status === 'Available') warning = `Note: Asset is already in stock.`;

          if(warning) {
              display.style.borderColor = warning.includes('Error') ? 'var(--danger)' : 'var(--warning)';
              if(warning.includes('Error')) {
                    UI.toast(warning, 'error');
                    Workflow.activeAsset = null; // Block
                    return;
              } else {
                    UI.toast(warning, 'info');
              }
          } else {
              display.style.borderColor = 'var(--success)';
          }

          // Fill Data
          if(mode === 'iss'){
              document.getElementById('iss-lbl-tag').innerText = found.tag;
              document.getElementById('iss-lbl-model').innerText = found.model;
              document.getElementById('iss-lbl-status').innerText = found.status;
          } else if(mode === 'mov'){
              document.getElementById('mov-lbl-user').innerText = found.user || 'Unassigned';
              document.getElementById('mov-lbl-model').innerText = found.model;
              if(displayNew) displayNew.style.display = 'block';
          } else if(mode === 'ret'){
              document.getElementById('ret-lbl-user').innerText = found.user || 'Unassigned';
              document.getElementById('ret-lbl-model').innerText = found.model;
              if(displayNew) displayNew.style.display = 'block';
          }
      } else {
          display.style.display = 'none';
          UI.toast('Asset Tag Not Found', 'error');
          tagField.classList.add('error');
          setTimeout(()=>tagField.classList.remove('error'), 1000);
      }
  },
  
  validateAndNext: () => {
      const tag = document.getElementById('iss-tag').value;
      if(!tag) { UI.toast('Please scan a tag', 'error'); return; }
      
      if(!Workflow.activeAsset || Workflow.activeAsset.tag !== tag) Workflow.lookupAsset('iss');
      
      setTimeout(() => {
           if(!Workflow.activeAsset) return;
           Workflow.nextStep(3);
      }, 150);
  },

  prevStep: (n) => { 
      if(n === 2) Workflow.clearSig();
      Workflow.nextStep(n); 
  },

  autoFillEmail: () => {
    const name = (document.getElementById('iss-name').value || '').trim();
    const mail = document.getElementById('iss-email');
    if(name && mail && !mail.value) mail.value = name.toLowerCase().replace(/\s+/g, '.') + '@ensafrica.com';
  },

  handleSigUpload: (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const c = document.getElementById('sig-canvas');
        const ctx = c.getContext('2d');
        ctx.clearRect(0,0,c.width,c.height);
        const scale = Math.min(c.width/img.width, c.height/img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (c.width-w)/2, (c.height-h)/2, w,h);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  initSig: () => {
    const canvas = document.getElementById('sig-canvas');
    if(!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if(rect.width === 0) return; 

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    
    Workflow.ctx = canvas.getContext('2d');
    Workflow.ctx.scale(ratio, ratio);
    Workflow.ctx.strokeStyle = "#000000";
    Workflow.ctx.lineWidth = 2.5;
    Workflow.ctx.lineCap = 'round';
    Workflow.ctx.lineJoin = 'round';
    
    let drawing = false;
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      if(e.touches && e.touches[0]) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e) => { if(e.target!==canvas)return; e.preventDefault(); drawing=true; Workflow.ctx.beginPath(); const p=getPos(e); Workflow.ctx.moveTo(p.x,p.y); };
    const move = (e) => { if(!drawing)return; e.preventDefault(); const p=getPos(e); Workflow.ctx.lineTo(p.x,p.y); Workflow.ctx.stroke(); };
    const end = (e) => { drawing = false; };

    canvas.onpointerdown = start; canvas.onpointermove = move; canvas.onpointerup = end; canvas.onpointercancel = end;
    canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
  },

  clearSig: () => {
    const c = document.getElementById('sig-canvas');
    if(!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    document.getElementById('sig-upload').value = '';
  },

  completeIssuance: (event) => {
    const tag = (document.getElementById('iss-tag').value || '').trim();
    const name = (document.getElementById('iss-name').value || '').trim();
    const email = (document.getElementById('iss-email').value || '').trim(); // Capture email
    const init = (document.getElementById('iss-initials').value || '').trim();
    
    // 1. Capture Signature Data URL
    const canvas = document.getElementById('sig-canvas');
    const sigData = canvas.toDataURL(); // This creates a base64 string of the image

    // 2. Capture Issuer Details
    const issuer = document.getElementById('iss-by-user').value;
    const date = document.getElementById('iss-date').value;

    if(!init) { UI.toast('Please enter initials', 'error'); return; }
    
    if(Workflow.activeAsset && Workflow.activeAsset.status === 'Assigned') {
         if(!confirm(`This asset is owned by ${Workflow.activeAsset.user}. Re-assign to ${name}?`)) return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    const step1 = document.getElementById('form-step-1');
    const step2 = document.getElementById('form-step-2');
    const pdfHeader = document.getElementById('pdf-header');
    
    // Temporarily show all steps for PDF
    const s1d = step1.style.display; const s2d = step2.style.display;
    step1.style.display = 'block'; step2.style.display = 'block';
    pdfHeader.style.display = 'block';
    document.getElementById('pdf-ref-code').innerText = `IS-${Date.now().toString().slice(-6)}`;
    
    const btns = document.querySelectorAll('#issuance-card button');
    const prog = document.querySelector('.progress-bar-container');
    btns.forEach(b => b.style.display = 'none');
    if(prog) prog.style.display = 'none';

    const node = document.getElementById('issuance-card');
    const opt = { margin:15, filename:`ENS_Issue_${tag}_${Date.now()}.pdf`, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };

    html2pdf().set(opt).from(node).save().then(()=>{
      if(tag){ 
          // 3. UPDATE INVENTORY WITH CONTRACT DATA
          DataService.updateInv(tag, { 
              user: name, 
              status: 'Assigned',
              // SAVE CONTRACT DATA HERE:
              contract: {
                  issuer: issuer,
                  issueDate: date,
                  recipientEmail: email,
                  initials: init,
                  signature: sigData, // The image string
                  ref: `IS-${Date.now().toString().slice(-6)}`
              }
          }); 
          DataService.log('Issuance', `Issued ${tag} to ${name}`, JSON.parse(localStorage.getItem('ensCurrentUser')||'{}').name || 'System'); 
      }
      UI.toast('Issuance complete. PDF downloaded.', 'success');
      
      step1.style.display = s1d; step2.style.display = s2d;
      pdfHeader.style.display = 'none';
      btns.forEach(b => b.style.display = '');
      if(prog) prog.style.display = 'flex';

      setTimeout(() => {
           UI.switchView('dashboard');
           btn.disabled=false; btn.innerHTML = originalText;
           ['iss-name','iss-email','iss-tag','iss-initials'].forEach(id => document.getElementById(id).value = '');
           document.getElementById('iss-asset-display').style.display='none';
           Workflow.clearSig(); Workflow.nextStep(1);
      }, 1200);
    });
  },

  processTransfer: () => {
      const tag = document.getElementById('mov-tag').value;
      const newUser = document.getElementById('mov-new-user').value;
      if(!tag || !newUser) { UI.toast('All fields are required', 'error'); return; }
      
      if(!Workflow.activeAsset || Workflow.activeAsset.tag !== tag) { UI.toast('Re-scan tag to confirm', 'warning'); return; }
      
      const oldUser = Workflow.activeAsset.user;
      DataService.updateInv(tag, { user: newUser, status: 'Assigned' });
      DataService.log('Transfer', `Transferred ${tag} from ${oldUser} to ${newUser}`, 'Admin');
      
      UI.toast('Asset Transferred Successfully', 'success');
      setTimeout(() => {
           UI.switchView('dashboard');
           ['mov-tag','mov-new-user'].forEach(id=>document.getElementById(id).value='');
           document.getElementById('mov-asset-display').style.display='none';
           document.getElementById('mov-new-details').style.display='none';
      }, 1000);
  },

  processReturn: (e) => {
      const tag = document.getElementById('ret-tag').value;
      const cond = document.getElementById('ret-condition').value;
      if(!tag) { UI.toast('Tag required', 'error'); return; }
      if(!Workflow.activeAsset || Workflow.activeAsset.tag !== tag) { UI.toast('Re-scan tag to confirm', 'warning'); return; }
      
      const currentUser = Workflow.activeAsset.user;
      const btn = e.target;
      const originalText = btn.innerHTML;
      const doPdf = document.getElementById('ret-receipt-check').checked;

      if(doPdf) {
          btn.disabled=true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Receipt...';
          const element = document.getElementById('return-card');
          const btns = element.querySelectorAll('button, input[type=checkbox]');
          btns.forEach(b=>b.style.display='none');
          
          html2pdf().from(element).save(`ENS_Return_${tag}_${Date.now()}.pdf`).then(() => {
              Workflow._finalizeReturn(tag, cond, currentUser);
              btns.forEach(b=>b.style.display='');
              btn.disabled=false; btn.innerHTML = originalText;
          });
      } else {
          Workflow._finalizeReturn(tag, cond, currentUser);
      }
  },
  
  _finalizeReturn: (tag, cond, oldUser) => {
      DataService.updateInv(tag, { user: '', status: cond });
      DataService.log('Return', `Returned ${tag} from ${oldUser} (Condition: ${cond})`, 'Admin');
      UI.toast('Asset Returned to Stock', 'success');
      setTimeout(() => {
           UI.switchView('dashboard');
           document.getElementById('ret-tag').value='';
           document.getElementById('ret-asset-display').style.display='none';
           document.getElementById('ret-details').style.display='none';
      }, 1000);
  }
};

/* ---------- START ---------- */
document.addEventListener('DOMContentLoaded', App.init);
