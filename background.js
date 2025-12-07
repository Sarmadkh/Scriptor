let store = { sites: [], redirects: [] };

// Initial Load
chrome.storage.local.get(['sites', 'redirects'], (result) => {
    store.sites = result.sites || [];
    store.redirects = result.redirects || [];
});

// Update Listener
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_RULES') {
        chrome.storage.local.get(['sites', 'redirects'], (result) => {
            store.sites = result.sites || [];
            store.redirects = result.redirects || [];
        });
    }
});

// Helper: Match URL Pattern
function urlMatches(pattern, url) {
    if (pattern === '*') return true;
    // Basic Wildcard Match
    const regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${regexStr}$`); // Strict match for redirects usually
    // For sites, we might want partial match? 
    // Usually user puts "google.com", we assume "contains" or specific logic?
    // Let's stick to: if pattern has *, use regex. If not, check includes.
    if(pattern.includes('*')) {
        return new RegExp(pattern.replace(/\*/g, '.*')).test(url);
    }
    return url.includes(pattern);
}

// 1. Redirects
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    
    store.redirects.forEach(rule => {
        if (!rule.enabled) return;
        
        // Convert wildcard to capture group regex for redirects
        // e.g. "old.com/*" -> "old\.com/(.*)"
        const pattern = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '(.*)');
        const regex = new RegExp(`^${pattern}$`);
        const match = details.url.match(regex);

        if (match) {
            let newUrl = rule.to;
            // Replace $1, $2 with captured groups
            for (let i = 1; i < match.length; i++) {
                newUrl = newUrl.replace(`$${i}`, match[i]);
            }
            if (newUrl !== details.url) {
                chrome.tabs.update(details.tabId, { url: newUrl });
            }
        }
    });
}, { url: [{ urlMatches: 'http://*/*' }, { urlMatches: 'https://*/*' }] });


// 2. Tab Updates (Context Menu & Auto Injection)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        processTab(tab);
    }
});

function processTab(tab) {
    // 1. Find all matching Sites
    const matchingSites = store.sites.filter(site => urlMatches(site.pattern, tab.url));
    
    // 2. Collect Context Menu Rules
    const contextRules = [];
    
    matchingSites.forEach(site => {
        site.rules.forEach(rule => {
            if (!rule.enabled) return;

            // Auto Inject
            if (rule.type === 'Auto') {
                injectCode(tab.id, rule.js, rule.css);
            } 
            // Collect Context Items
            else if (rule.type === 'Context') {
                contextRules.push(rule);
            }
        });
    });

    updateContextMenu(contextRules);
}

function updateContextMenu(rules) {
    chrome.contextMenus.removeAll(() => {
        if (rules.length === 0) return;

        chrome.contextMenus.create({
            id: "scriptor-root",
            title: "Scriptor",
            contexts: ["page"]
        });

        rules.forEach(rule => {
            chrome.contextMenus.create({
                parentId: "scriptor-root",
                id: `run-${rule.id}`,
                title: rule.name,
                contexts: ["page"]
            });
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('run-')) {
        const ruleId = info.menuItemId.replace('run-', '');
        // Find rule across all sites (slightly inefficient but safe)
        for (const site of store.sites) {
            const rule = site.rules.find(r => r.id === ruleId);
            if (rule) {
                injectCode(tab.id, rule.js, rule.css);
                break;
            }
        }
    }
});

function injectCode(tabId, js, css) {
    if (css && css.trim()) {
        chrome.scripting.insertCSS({
            target: { tabId },
            css: css
        }).catch(() => {});
    }
    if (js && js.trim()) {
        chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (code) => {
                const s = document.createElement('script');
                s.textContent = code;
                document.body.appendChild(s);
                s.remove();
            },
            args: [js]
        }).catch(() => {});
    }
}

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'index.html' });
});
