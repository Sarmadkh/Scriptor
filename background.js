let store = { sites: [], redirects: [] };

chrome.storage.local.get(['sites', 'redirects'], (result) => {
    store.sites = result.sites || [];
    store.redirects = result.redirects || [];
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_RULES') {
        chrome.storage.local.get(['sites', 'redirects'], (result) => {
            store.sites = result.sites || [];
            store.redirects = result.redirects || [];
        });
    }
});

function urlMatches(pattern, url) {
    if (!url) return false;
    if (pattern === '*') return true;
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
        const pattern = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '(.*)');
        const regex = new RegExp(`^${pattern}$`);
        const match = details.url.match(regex);

        if (match) {
            let newUrl = rule.to;
            for (let i = 1; i < match.length; i++) {
                newUrl = newUrl.replace(`$${i}`, match[i]);
            }

            if (newUrl === details.url) return;
            if (details.url.endsWith('/edit') && newUrl.endsWith('/edit/edit')) {
                console.warn("Scriptor: Redirect loop detected and blocked.");
                return;
            }
            chrome.tabs.update(details.tabId, { url: newUrl });
        }
    });
}, { url: [{ urlMatches: 'http://*/*' }, { urlMatches: 'https://*/*' }] });


chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;

    store.sites.forEach(site => {
        if (urlMatches(site.pattern, details.url)) {
            site.rules.forEach(rule => {
                if (rule.enabled && rule.type === 'Auto' && rule.css && rule.css.trim()) {
                    chrome.scripting.insertCSS({
                        target: { tabId: details.tabId },
                        css: rule.css
                    }).catch(() => {});
                }
            });
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        processTabComplete(tab);
    }
});

function processTabComplete(tab) {
    const matchingSites = store.sites.filter(site => urlMatches(site.pattern, tab.url));
    const contextRules = [];
    matchingSites.forEach(site => {
        site.rules.forEach(rule => {
            if (!rule.enabled) return;
            if (rule.type === 'Auto') {
                injectJS(tab.id, rule.js);
                injectHTML(tab.id, rule.html);
            } else if (rule.type === 'Context') {
                contextRules.push(rule);
            }
        });
    });
    updateContextMenu(contextRules);
}

function injectJS(tabId, js) {
    if (!js || !js.trim()) return;
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

function injectHTML(tabId, html) {
    if (!html || !html.trim()) return;
    chrome.scripting.executeScript({
        target: { tabId },
        func: (htmlContent) => {
            if (document.body) {
                document.body.insertAdjacentHTML('beforeend', htmlContent);
            }
        },
        args: [html]
    }).catch(() => {});
}

function injectCode(tabId, js, css, html) {
    if (css && css.trim()) { chrome.scripting.insertCSS({ target: { tabId }, css: css }).catch(() => {}); }
    injectHTML(tabId, html);
    injectJS(tabId, js);
}

function updateContextMenu(rules) {
    chrome.contextMenus.removeAll(() => {
        if (rules.length === 0) return;
        chrome.contextMenus.create({ id: "scriptor-root", title: "Scriptor", contexts: ["page"] });
        rules.forEach(rule => {
            chrome.contextMenus.create({ parentId: "scriptor-root", id: `run-${rule.id}`, title: rule.name, contexts: ["page"] });
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('run-')) {
        const ruleId = info.menuItemId.replace('run-', '');
        for (const site of store.sites) {
            const rule = site.rules.find(r => r.id === ruleId);
            if (rule) {
                injectCode(tab.id, rule.js, rule.css, rule.html);
                break;
            }
        }
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'index.html' });
});
