const loadSnippets = async () => {
  const response = await chrome.storage.local.get('snippets');
  if (!response.snippets) {
    const defaultResponse = await fetch(chrome.runtime.getURL('snippets.json'));
    const data = await defaultResponse.json();
    await chrome.storage.local.set({ snippets: data.snippets });
    return data.snippets;
  }
  return response.snippets;
};

const saveSnippets = async (snippets) => {
  await chrome.storage.local.set({ snippets });
  try {
    await chrome.runtime.sendMessage({ type: 'RELOAD_SNIPPETS' });
  } catch (error) {
    console.log('Background script not ready, snippets saved locally');
  }
  await renderSnippets();
};

const exportSnippets = async () => {
  const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets);
  const blob = new Blob([JSON.stringify({ snippets }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'snippets_backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importSnippets = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.snippets && Array.isArray(data.snippets)) {
          await saveSnippets(data.snippets);
          await renderSnippets();
          resolve();
        } else {
          reject(new Error('Invalid snippets file format'));
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
};

const snippetList = document.getElementById('snippetList');
const snippetModal = document.getElementById('snippetModal');
const snippetForm = document.getElementById('snippetForm');
const addSnippetBtn = document.getElementById('addSnippet');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const codeContainer = document.getElementById('codeContainer');
const redirectContainer = document.getElementById('redirectContainer');

let editingSnippetIndex = null;

document.getElementById('typeInput').addEventListener('change', (e) => {
  const type = e.target.value;
  if (type === 'Redirect') {
    codeContainer.style.display = 'none';
    redirectContainer.style.display = 'block';
  } else {
    codeContainer.style.display = 'block';
    redirectContainer.style.display = 'none';
  }
});

exportBtn.addEventListener('click', exportSnippets);

importBtn.addEventListener('click', () => {
  const isConfirmed = confirm("Importing new snippets will overwrite your existing ones. Do you want to proceed?");
  if (isConfirmed) {
    fileInput.click();
  }
});

fileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    try {
      await importSnippets(e.target.files[0]);
      alert('Snippets imported successfully!');
    } catch (error) {
      alert('Error importing snippets: ' + error.message);
    }
    fileInput.value = ''; 
  }
});

addSnippetBtn.addEventListener('click', () => {
  modalTitle.textContent = 'Add Snippet';
  snippetForm.reset();
  editingSnippetIndex = null;
  snippetModal.classList.add('active');

  const type = document.getElementById('typeInput').value;
  codeContainer.style.display = type === 'Redirect' ? 'none' : 'block';
  redirectContainer.style.display = type === 'Redirect' ? 'block' : 'none';
});

cancelBtn.addEventListener('click', () => {
  snippetModal.classList.remove('active');
});

snippetList.addEventListener('click', async (e) => {
  const target = e.target;

  if (target.matches('.edit-btn')) {
    const index = parseInt(target.dataset.index);
    const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets);
    const snippet = snippets[index];

    document.getElementById('nameInput').value = snippet.name;
    document.getElementById('typeInput').value = snippet.type;
    document.getElementById('sitesInput').value = snippet.sites.join('\n');

    if (snippet.type === 'Redirect') {
      document.getElementById('fromPatternInput').value = snippet.fromPattern;
      document.getElementById('toPatternInput').value = snippet.toPattern;
      codeContainer.style.display = 'none';
      redirectContainer.style.display = 'block';
    } else {
      document.getElementById('jsCodeInput').value = snippet.jsCode || '';
      document.getElementById('cssCodeInput').value = snippet.cssCode || '';
      codeContainer.style.display = 'block';
      redirectContainer.style.display = 'none';
    }

    modalTitle.textContent = 'Edit Snippet';
    editingSnippetIndex = index;
    snippetModal.classList.add('active');
  }

  if (target.matches('.delete-btn')) {
    const index = parseInt(target.dataset.index);
    const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets);
    const snippet = snippets[index];
    const snippetName = snippet.name;
    
    if (confirm(`Are you sure you want to delete the snippet: "${snippetName}"?`)) {
      snippets.splice(index, 1);
      await saveSnippets(snippets);
    }
  }
  
});

snippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets || []);

  const type = document.getElementById('typeInput').value;
  const newSnippet = {
    name: document.getElementById('nameInput').value,
    type: type,
    sites: document.getElementById('sitesInput').value.split('\n').filter(site => site.trim()),
    enabled: true  // Add this line
  };

  if (type === 'Redirect') {
    newSnippet.fromPattern = document.getElementById('fromPatternInput').value;
    newSnippet.toPattern = document.getElementById('toPatternInput').value;
  } else {
    newSnippet.jsCode = document.getElementById('jsCodeInput').value;
    newSnippet.cssCode = document.getElementById('cssCodeInput').value;
  }

  if (editingSnippetIndex !== null) {
    snippets[editingSnippetIndex] = newSnippet;
  } else {
    snippets.push(newSnippet);
  }

  await saveSnippets(snippets);
  snippetModal.classList.remove('active');
});

const renderSnippet = (snippet, index) => {
  const div = document.createElement('div');
  div.className = `snippet-card ${snippet.enabled !== false ? '' : 'disabled-snippet'}`;

  let codeDisplay = '';
  if (snippet.type === 'Redirect') {
    codeDisplay = `
      <div class="code-section">
        <div class="code-label">From Pattern:</div>
        <code>${snippet.fromPattern}</code>
        <div class="code-label">To Pattern:</div>
        <code>${snippet.toPattern}</code>
      </div>
    `;
  } else {
    codeDisplay = `
      <div class="code-section">
        ${snippet.jsCode ? `
          <div class="code-label">JavaScript:</div>
          <code>${snippet.jsCode}</code>
        ` : ''}
        ${snippet.cssCode ? `
          <div class="code-label">CSS:</div>
          <code>${snippet.cssCode}</code>
        ` : ''}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="snippet-header">
      <div class="snippet-title-container">
        <span class="snippet-title">${snippet.name}</span>
      </div>
      <div class="snippet-actions">
        <button class="btn edit-btn" data-index="${index}">Edit</button>
        <button class="btn btn-danger delete-btn" data-index="${index}">Delete</button>
      </div>
    </div>
    <div class="snippet-metadata">
      <span class="type-badge">${snippet.type}</span>
      <span class="snippet-sites">${snippet.sites.join(', ')}</span>
      <label class="toggle-switch">
        <input type="checkbox" class="snippet-toggle" data-index="${index}" 
          ${snippet.enabled !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    ${codeDisplay}
  `;

  // Add toggle event listener
  const toggle = div.querySelector('.snippet-toggle');
  toggle.addEventListener('change', async (e) => {
    const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets);
    snippets[index].enabled = e.target.checked;
    await saveSnippets(snippets);
    div.classList.toggle('disabled-snippet', !e.target.checked);
  });

  return div;
};

const renderSnippets = async () => {
  const snippets = await chrome.storage.local.get('snippets').then(data => data.snippets);
  snippetList.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    snippetList.innerHTML = `
      <div class="empty-state">
        <h3>No snippets yet</h3>
        <p>Click the "Add Snippet" button to create your first snippet.</p>
      </div>
    `;
    return;
  }

  snippets.forEach((snippet, index) => {
    snippetList.appendChild(renderSnippet(snippet, index));
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  await renderSnippets();
});
