let snippets = [];

chrome.storage.local.get('snippets', (result) => {
  if (result.snippets) {
    snippets = result.snippets;
  } else {

    fetch(chrome.runtime.getURL('snippets.json'))
      .then(response => response.json())
      .then(data => {
        snippets = data.snippets;
        chrome.storage.local.set({ snippets: data.snippets });
      });
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.snippets) {
    snippets = changes.snippets.newValue;
    updateContextMenus();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RELOAD_SNIPPETS') {
    chrome.storage.local.get('snippets', (result) => {
      if (result.snippets) {
        snippets = result.snippets;
        updateContextMenus();
        sendResponse({ success: true });
      }
    });
    return true; 
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  const tab = details;
  snippets.filter(snippet => snippet.type === 'Redirect').forEach(snippet => {
    if (snippet.sites.some(url => tab.url.includes(url))) {
      let newUrl = tab.url;

      if (newUrl.includes("#redirected")) {
        return;
      }

      const fromPattern = snippet.fromPattern;
      const toPattern = snippet.toPattern;
      const wildcardRegex = new RegExp(fromPattern.replace('*', '(.*?)'));

      const match = tab.url.match(wildcardRegex);
      if (match) {
        newUrl = tab.url.replace(wildcardRegex, toPattern.replace(/\$(\d+)/g, (_, index) => match[index] || ''));
      }

      if (newUrl !== tab.url) {
        chrome.tabs.update(tab.tabId, { url: newUrl + "#redirected" });
      }
    }
  });
}, { url: [{ urlMatches: 'http://*/*' }, { urlMatches: 'https://*/*' }] });

function updateContextMenus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      updateContextMenu(tabs[0]);
    }
  });
}

function updateContextMenu(tab) {
  chrome.contextMenus.removeAll(() => {
    const relevantSnippets = snippets.filter(snippet => 
      snippet.type === 'Context' && 
      snippet.sites.some(url => tab.url.includes(url))
    );

    if (relevantSnippets.length > 0) {
      chrome.contextMenus.create({ 
        id: "codeSnippetInjector", 
        title: "Scriptor", 
        contexts: ["page"] 
      });

      relevantSnippets.forEach(snippet => {
        chrome.contextMenus.create({
          id: snippet.name.replace(/\s/g, '-').toLowerCase(),
          parentId: "codeSnippetInjector",
          title: snippet.name,
          contexts: ["page"]
        });
      });
    }
  });
}

function injectCode(tabId, jsCode, cssCode) {

  if (jsCode && jsCode.trim()) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [jsCode],
      func: (codeString) => {
        const script = document.createElement('script');
        script.textContent = codeString;
        document.documentElement.appendChild(script);
        script.remove();
      }
    });
  }

  if (cssCode && cssCode.trim()) {
    chrome.scripting.executeScript({
      target: { tabId },
      func: (cssString) => {
        const style = document.createElement('style');
        style.textContent = cssString;
        document.head.appendChild(style);
      },
      args: [cssCode]
    });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    chrome.storage.local.remove([`autoSnippetRan-${tab.url}`]);
  }
  if (changeInfo.status === "complete") {
    updateContextMenu(tab);
    runAutoInjection(tab);
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateContextMenu(tab);
    runAutoInjection(tab);
  });
});

function runAutoInjection(tab) {
  snippets.filter(snippet => 
    snippet.type === 'Auto' && 
    snippet.sites.some(url => tab.url.includes(url))
  ).forEach(snippet => {
    const storageKey = `autoSnippetRan-${tab.url}`;
    chrome.storage.local.get([storageKey], (result) => {
      if (!result[storageKey]) {
        injectCode(tab.id, snippet.jsCode, snippet.cssCode);
        chrome.storage.local.set({ [storageKey]: true });
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const snippet = snippets.find(s => 
    s.name.replace(/\s/g, '-').toLowerCase() === info.menuItemId
  );
  if (snippet && snippet.type === 'Context') {
    injectCode(tab.id, snippet.jsCode, snippet.cssCode);
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});
