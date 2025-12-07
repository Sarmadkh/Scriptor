let store = {
    sites: [],     // Array of { id, name, pattern, rules: [] }
    redirects: []  // Array of { id, name, from, to, enabled }
};

let activeView = { type: null, id: null };
let currentEditingSiteId = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderSidebar();
    
    // Select first item
    if (store.sites.length > 0) {
        selectSite(store.sites[0].id);
    } else {
        selectRedirects();
    }
    
    // Setup Header Inline Editing
    setupHeaderEditing();
});

const loadData = async () => {
    const data = await chrome.storage.local.get(['sites', 'redirects']);
    store.sites = data.sites || [];
    store.redirects = data.redirects || [];
};

const saveData = async () => {
    try {
        await chrome.storage.local.set(store);
        try { await chrome.runtime.sendMessage({ type: 'UPDATE_RULES' }); } catch (e) {}
        return true; 
    } catch (error) {
        console.error('Save Data Error:', error);
        if (error.message.includes('QUOTA_BYTES')) {
            alert("❌ Error: Storage Quota Exceeded. Please delete some rules or split the import.");
        } else {
            alert(`❌ Error saving data: ${error.message}`);
        }
        return false;
    }
};

// --- Sidebar Logic ---
const renderSidebar = () => {
    const list = document.getElementById('siteList');
    list.innerHTML = '';
    
    // Sort sites alphabetically by name or pattern
    const sortedSites = [...store.sites].sort((a, b) => {
        const nameA = a.name || a.pattern;
        const nameB = b.name || b.pattern;
        return nameA.localeCompare(nameB);
    });

    sortedSites.forEach(site => {
        const el = document.createElement('div');
        const displayName = site.name ? site.name : site.pattern;
        
        el.className = `nav-item ${activeView.type === 'site' && activeView.id === site.id ? 'active' : ''}`;
        
        // Inner HTML with Delete Button (hidden by CSS until hover)
        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1; overflow:hidden;">
                <i class="fas fa-globe"></i> 
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
            </div>
            <i class="fas fa-trash nav-delete-btn" title="Delete Site"></i>
        `;
        el.title = site.pattern;

        // Click to select site
        el.onclick = () => selectSite(site.id);

        // Click to delete site (Stop propagation!)
        const deleteBtn = el.querySelector('.nav-delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSite(site.id);
        };

        list.appendChild(el);
    });

    const redirectNav = document.getElementById('nav-redirects');
    if (activeView.type === 'redirect') redirectNav.classList.add('active');
    else redirectNav.classList.remove('active');
    redirectNav.onclick = () => selectRedirects();
};

const deleteSite = (siteId) => {
    const site = store.sites.find(s => s.id === siteId);
    if(confirm(`Delete site "${site.name || site.pattern}" and all ${site.rules.length} rule(s)?`)) {
        store.sites = store.sites.filter(s => s.id !== siteId);
        saveData().then(() => {
            renderSidebar();
            // If we deleted the active site, switch view
            if (activeView.type === 'site' && activeView.id === siteId) {
                if (store.sites.length > 0) selectSite(store.sites[0].id);
                else selectRedirects();
            }
        });
    }
};

// --- Navigation & View Management ---
const selectSite = (id, updateSidebar = true) => {
    const site = store.sites.find(s => s.id === id);
    if (!site) return;

    activeView = { type: 'site', id: id };
    if(updateSidebar) renderSidebar();
    
    // Toggle Header Elements
    document.getElementById('viewTitleInput').style.display = 'block';
    document.getElementById('viewSubtitleInput').style.display = 'block';
    document.getElementById('redirectTitle').style.display = 'none';
    document.getElementById('redirectSubtitle').style.display = 'none';

    // Set Input Values
    document.getElementById('viewTitleInput').value = site.name || '';
    document.getElementById('viewSubtitleInput').value = site.pattern;
    
    // Show correct action panel
    document.getElementById('siteActions').style.display = 'flex';
    document.getElementById('redirectActions').style.display = 'none';

    // Enable Add Rule button
    document.getElementById('addRuleBtn').disabled = false;

    renderRulesGrid(site.rules);
};

const selectRedirects = (updateSidebar = true) => {
    activeView = { type: 'redirect', id: null };
    if(updateSidebar) renderSidebar();

    // Toggle Header Elements
    document.getElementById('viewTitleInput').style.display = 'none';
    document.getElementById('viewSubtitleInput').style.display = 'none';
    document.getElementById('redirectTitle').style.display = 'block';
    document.getElementById('redirectSubtitle').style.display = 'block';
    
    // Show correct action panel
    document.getElementById('siteActions').style.display = 'none';
    document.getElementById('redirectActions').style.display = 'flex';

    renderRulesGrid(store.redirects, true);
};

// --- Inline Header Editing Logic ---
const setupHeaderEditing = () => {
    const titleInput = document.getElementById('viewTitleInput');
    const patternInput = document.getElementById('viewSubtitleInput');

    const saveHeaderChanges = () => {
        if (activeView.type !== 'site') return;
        const site = store.sites.find(s => s.id === activeView.id);
        if (!site) return;

        const newName = titleInput.value.trim();
        const newPattern = patternInput.value.trim();

        // Only save if changed
        if (site.name !== newName || site.pattern !== newPattern) {
            site.name = newName;
            if (newPattern) site.pattern = newPattern; // Prevent empty pattern
            else patternInput.value = site.pattern; // Revert if empty

            saveData().then(() => {
                renderSidebar(); // Update sidebar name
            });
        }
    };

    titleInput.addEventListener('blur', saveHeaderChanges);
    patternInput.addEventListener('blur', saveHeaderChanges);
    
    // Optional: Save on Enter key
    const handleEnter = (e) => { if(e.key === 'Enter') e.target.blur(); };
    titleInput.addEventListener('keydown', handleEnter);
    patternInput.addEventListener('keydown', handleEnter);
};

// --- Rule Grid Rendering ---
const renderRulesGrid = (rules, isRedirect = false) => {
    const grid = document.getElementById('rulesGrid');
    grid.innerHTML = '';

    if (rules.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);margin-top:40px;">No rules found. Click 'Add' to create one.</div>`;
        return;
    }

    rules.forEach(rule => {
        const card = document.createElement('div');
        card.className = `card ${rule.enabled ? '' : 'disabled'}`;
        
        let icon = isRedirect ? 'fa-exchange-alt' : (rule.type === 'Auto' ? 'fa-bolt' : 'fa-mouse-pointer');
        let cardDetail = isRedirect ? `${rule.from} → ${rule.to}` : 
                         (rule.js && rule.css ? 'JS & CSS' : (rule.js ? 'JavaScript' : 'CSS'));
        
        card.innerHTML = `
            <div class="card-top">
                <div class="card-title"><i class="fas ${icon}" style="margin-right:8px; color:var(--accent)"></i> ${rule.name}</div>
                <div class="card-badge">${isRedirect ? 'REDIRECT' : rule.type.toUpperCase()}</div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:8px; height: 36px; overflow: hidden; pointer-events: none;">
                ${cardDetail}
            </div>
            <div class="card-actions">
                <label class="switch">
                    <input type="checkbox" ${rule.enabled ? 'checked' : ''} class="rule-toggle">
                    <span class="slider"></span>
                </label>
                <button class="icon-btn delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;

        // Click Card to Edit (Main Requirement)
        card.onclick = (e) => {
            // Check if user clicked specific controls, if so, don't open modal
            // Note: The switch is inside a label, clicking label triggers input change usually, 
            // but we stop propagation on the specific elements.
            openRuleModal(rule);
        };

        // Stop propagation for Toggle Switch
        const toggleSwitch = card.querySelector('.switch');
        toggleSwitch.onclick = (e) => e.stopPropagation();
        card.querySelector('.rule-toggle').onchange = (e) => {
            toggleRule(rule.id, e.target.checked);
        };

        // Stop propagation for Delete Button
        const delBtn = card.querySelector('.delete-btn');
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteRule(rule.id);
        };

        grid.appendChild(card);
    });
};

// --- Data Operations (Toggle/Delete Rule) ---
const toggleRule = (ruleId, enabled) => {
    if (activeView.type === 'site') {
        const site = store.sites.find(s => s.id === activeView.id);
        const rule = site.rules.find(r => r.id === ruleId);
        if (rule) rule.enabled = enabled;
    } else {
        const rule = store.redirects.find(r => r.id === ruleId);
        if (rule) rule.enabled = enabled;
    }
    saveData();
};

const deleteRule = (ruleId) => {
    if(!confirm("Are you sure you want to delete this rule?")) return;
    
    if (activeView.type === 'site') {
        const site = store.sites.find(s => s.id === activeView.id);
        site.rules = site.rules.filter(r => r.id !== ruleId);
    } else {
        store.redirects = store.redirects.filter(r => r.id !== ruleId);
    }
    saveData();
    // Re-render immediately to reflect deletion
    if (activeView.type === 'site') {
        const site = store.sites.find(s => s.id === activeView.id);
        renderRulesGrid(site.rules);
    } else {
        renderRulesGrid(store.redirects, true);
    }
};

// --- Site Management Modal (Only for NEW sites now) ---
const siteModal = document.getElementById('siteModal');
const siteNameInput = document.getElementById('siteNameInput');
const sitePatternInput = document.getElementById('sitePatternInput');
const siteForm = document.getElementById('siteForm');

// Open "Add Site"
document.getElementById('addSiteBtn').onclick = () => {
    siteForm.reset();
    siteModal.classList.add('active');
};

// Save New Site
siteForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = siteNameInput.value.trim() || null;
    const pattern = sitePatternInput.value.trim();
    
    if(!pattern) return;

    // Create new site
    const newSite = {
        id: Date.now().toString(),
        name: name,
        pattern: pattern,
        rules: []
    };
    store.sites.push(newSite);

    closeModals();
    await saveData();
    // Select the new site
    selectSite(newSite.id);
};

// --- Rule Modal Logic ---
let currentEditingRule = null;

document.getElementById('addRuleBtn').onclick = () => openRuleModal(null);
document.getElementById('addRedirectBtn').onclick = () => openRuleModal(null);

const openRuleModal = (rule) => {
    const isRedirectView = activeView.type === 'redirect';
    currentEditingRule = rule;
    const modal = document.getElementById('ruleModal');
    const form = document.getElementById('ruleForm');
    
    form.reset();
    
    // UI Adjustments
    const codeEditors = document.getElementById('injectionEditors');
    const redirectInputs = document.getElementById('redirectInputs');
    const typeGroup = document.getElementById('ruleTypeGroup');

    if (isRedirectView) {
        document.getElementById('ruleModalTitle').textContent = rule ? 'Edit Redirect' : 'New Redirect';
        codeEditors.style.display = 'none';
        document.getElementById('editorToggles').style.display = 'none';
        redirectInputs.style.display = 'block';
        typeGroup.style.display = 'none'; 
    } else {
        document.getElementById('ruleModalTitle').textContent = rule ? 'Edit Rule' : 'New Rule';
        codeEditors.style.display = 'flex';
        document.getElementById('editorToggles').style.display = 'flex';
        redirectInputs.style.display = 'none';
        typeGroup.style.display = 'block';
    }

    // Fill Data
    if (rule) {
        document.getElementById('ruleName').value = rule.name;
        if(isRedirectView) {
            document.getElementById('redirectFrom').value = rule.from;
            document.getElementById('redirectTo').value = rule.to;
        } else {
            document.getElementById('ruleType').value = rule.type;
            document.getElementById('jsCode').value = rule.js || '';
            document.getElementById('cssCode').value = rule.css || '';
        }
    } else {
        document.getElementById('js-editor').classList.remove('hidden');
        document.getElementById('css-editor').classList.remove('hidden');
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.add('active'));
    }

    modal.classList.add('active');
};

document.getElementById('ruleForm').onsubmit = async (e) => {
    e.preventDefault();
    const isRedirectView = activeView.type === 'redirect';
    
    const ruleData = {
        id: currentEditingRule ? currentEditingRule.id : Date.now().toString(),
        name: document.getElementById('ruleName').value,
        enabled: currentEditingRule ? currentEditingRule.enabled : true
    };

    if (isRedirectView) {
        ruleData.from = document.getElementById('redirectFrom').value;
        ruleData.to = document.getElementById('redirectTo').value;
        
        if (currentEditingRule) {
            const idx = store.redirects.findIndex(r => r.id === currentEditingRule.id);
            store.redirects[idx] = { ...store.redirects[idx], ...ruleData };
        } else {
            store.redirects.push(ruleData);
        }
    } else {
        ruleData.type = document.getElementById('ruleType').value;
        ruleData.js = document.getElementById('jsCode').value;
        ruleData.css = document.getElementById('cssCode').value;

        const site = store.sites.find(s => s.id === activeView.id);
        if (currentEditingRule) {
            const idx = site.rules.findIndex(r => r.id === currentEditingRule.id);
            site.rules[idx] = { ...site.rules[idx], ...ruleData };
        } else {
            site.rules.push(ruleData);
        }
    }

    closeModals();
    await saveData();
    // Update view
    if(activeView.type === 'site') selectSite(activeView.id, false);
    else selectRedirects(false);
};

// --- Import / Export Logic ---
const exportData = () => {
    const dataToExport = {
        scriptor_version: '3.0',
        sites: store.sites,
        redirects: store.redirects
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scriptor_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const importData = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const originalSites = [...store.sites];
        const originalRedirects = [...store.redirects];
        try {
            const data = JSON.parse(e.target.result);
            if (!data.sites || !Array.isArray(data.sites) || !data.redirects || !Array.isArray(data.redirects)) {
                alert('❌ Invalid file format.');
                return;
            }
            if(confirm('This will overwrite all existing rules. Continue?')) {
                store.sites = data.sites;
                store.redirects = data.redirects;
                const success = await saveData(); 
                if (success) {
                    alert('✅ Rules imported!');
                    if (store.sites.length > 0) selectSite(store.sites[0].id);
                    else selectRedirects();
                } else {
                    store.sites = originalSites;
                    store.redirects = originalRedirects;
                    await loadData();
                    renderSidebar();
                }
            }
        } catch (err) {
            alert('❌ Error parsing file.');
        }
    };
    reader.readAsText(file);
};

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = (e) => {
    if (e.target.files.length > 0) importData(e.target.files[0]);
};

// --- Utility Functions ---
window.closeModals = () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
};

document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = () => {
        btn.classList.toggle('active');
        const targetId = btn.dataset.target;
        const el = document.getElementById(targetId);
        if (btn.classList.contains('active')) el.classList.remove('hidden');
        else el.classList.add('hidden');
    };
});

// --- Event Listener Attachment ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cancel-btn').forEach(button => {
        button.addEventListener('click', closeModals);
    });
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
});
