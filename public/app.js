const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  aiMode: 'mock',
  documents: [],
  current: null,
  messages: [],
  authMode: 'login',
  sending: false,
};

/* ------------------------------------------------------------------- api */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------------------------------------- rendering */

/** Minimal inline markdown: **bold**, _italic_, `code`. Escapes HTML first. */
function formatMessage(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderDocList() {
  const list = $('doc-list');
  list.innerHTML = '';
  if (!state.documents.length) {
    list.innerHTML = '<p style="padding:12px;color:var(--text-soft);font-size:13px">No documents yet.</p>';
    return;
  }
  for (const doc of state.documents) {
    const btn = document.createElement('button');
    btn.className = `doc-item${state.current?.id === doc.id ? ' active' : ''}`;
    const status = doc.status === 'complete' ? 'Complete' : doc.specId ? 'Draft' : 'Not started';
    btn.innerHTML = `<strong>${escapeHtml(doc.title)}</strong><span>${status} · ${new Date(doc.updatedAt).toLocaleDateString()}</span>`;
    btn.onclick = () => openDocument(doc.id);
    list.appendChild(btn);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMessages() {
  const box = $('messages');
  box.innerHTML = '';
  for (const m of state.messages) {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.innerHTML =
      `<div class="who">${m.role === 'user' ? 'You' : 'Prelegal'}</div>` +
      `<div class="bubble">${formatMessage(m.content)}</div>`;
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight;
}

function renderFields() {
  const panel = $('fields-panel');
  const doc = state.current;
  panel.innerHTML = '';

  if (!doc?.specId) {
    panel.innerHTML =
      '<p style="color:var(--text-soft);font-size:14px">Once you pick a document type, the fields will show up here as they get filled in.</p>';
    return;
  }

  for (const field of doc.fields) {
    const value = doc.values[field.key];
    const filled = value !== undefined && value !== null && String(value).trim() !== '';
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML =
      `<div class="field-label">${escapeHtml(field.label)}` +
      `<span class="${field.required ? 'req' : 'opt'}">${field.required ? 'required' : 'optional'}</span></div>` +
      `<div class="field-value${filled ? '' : ' empty'}">${filled ? escapeHtml(value) : 'Not set'}</div>`;
    panel.appendChild(row);
  }
}

function renderWorkspace() {
  const doc = state.current;
  if (!doc) {
    $('workspace').classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    return;
  }
  $('empty-state').classList.add('hidden');
  $('workspace').classList.remove('hidden');

  $('doc-title').textContent = doc.title;

  let status;
  if (!doc.specId) status = 'No document type chosen yet — tell me what you need.';
  else if (doc.isComplete) status = `${doc.specName} · all required fields complete`;
  else status = `${doc.specName} · ${doc.missingRequired.length} required field${doc.missingRequired.length === 1 ? '' : 's'} remaining`;
  $('doc-status').textContent = status;

  $('download').disabled = !doc.specId;
  renderFields();
  renderMessages();
}

async function refreshPreview() {
  const doc = state.current;
  if (!doc?.specId) {
    $('doc-preview').textContent = 'Pick a document type to see a preview.';
    return;
  }
  try {
    const { full } = await api(`/documents/${doc.id}/preview`);
    $('doc-preview').textContent = full;
  } catch (err) {
    $('doc-preview').textContent = `Could not load preview: ${err.message}`;
  }
}

/* --------------------------------------------------------------- actions */

async function loadDocuments() {
  const { documents } = await api('/documents');
  state.documents = documents;
  renderDocList();
}

async function openDocument(id) {
  const { document: doc, messages } = await api(`/documents/${id}`);
  state.current = doc;
  state.messages = messages;
  renderDocList();
  renderWorkspace();
  if (!$('doc-panel').classList.contains('hidden')) refreshPreview();
}

async function newDocument() {
  const errorEl = $('new-doc-error');
  errorEl.classList.add('hidden');
  try {
    const { document: doc } = await api('/documents', { method: 'POST', body: {} });
    await loadDocuments();
    state.current = doc;
    state.messages = [];
    renderDocList();
    renderWorkspace();

    // Kick the conversation off so the user sees a prompt rather than a blank box.
    await sendMessage('I need to create a document.', { silent: true });
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function sendMessage(content, { silent = false } = {}) {
  if (!state.current || state.sending) return;
  state.sending = true;
  $('send').disabled = true;

  if (!silent) {
    state.messages.push({ role: 'user', content });
    renderMessages();
  }

  const thinking = { role: 'assistant', content: '…' };
  state.messages.push(thinking);
  renderMessages();

  try {
    const res = await api(`/documents/${state.current.id}/messages`, {
      method: 'POST',
      body: { content },
    });
    state.messages.pop();
    if (silent) state.messages.pop();
    state.messages.push(...res.messages.filter((m) => !(silent && m.role === 'user')));
    state.current = res.document;
    await loadDocuments();
    renderWorkspace();
    if (!$('doc-panel').classList.contains('hidden')) refreshPreview();
  } catch (err) {
    state.messages.pop();
    state.messages.push({ role: 'assistant', content: `Something went wrong: ${err.message}` });
    renderMessages();
  } finally {
    state.sending = false;
    $('send').disabled = false;
  }
}

async function loadCatalog() {
  const { documentTypes } = await api('/catalog');
  $('catalog-list').innerHTML = documentTypes
    .map((t) => `<li><b>${escapeHtml(t.name)}</b><span>${escapeHtml(t.description)}</span></li>`)
    .join('');
}

/* ------------------------------------------------------------------ auth */

async function showApp(user, aiMode) {
  state.user = user;
  state.aiMode = aiMode ?? state.aiMode;
  $('auth-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-name').textContent = user.displayName || user.email;
  $('ai-badge').textContent = state.aiMode === 'openrouter' ? 'AI chat: OpenRouter' : 'AI chat: scripted (no API key)';
  await Promise.all([loadDocuments(), loadCatalog()]);
  renderWorkspace();
}

function setAuthMode(mode) {
  state.authMode = mode;
  $('tab-login').classList.toggle('active', mode === 'login');
  $('tab-register').classList.toggle('active', mode === 'register');
  $('name-label').classList.toggle('hidden', mode !== 'register');
  $('auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  $('password').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  $('auth-error').classList.add('hidden');
}

/* -------------------------------------------------------------- bindings */

$('tab-login').onclick = () => setAuthMode('login');
$('tab-register').onclick = () => setAuthMode('register');

$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = $('auth-error');
  err.classList.add('hidden');
  try {
    const body = { email: $('email').value, password: $('password').value };
    if (state.authMode === 'register') body.displayName = $('displayName').value;
    const { user } = await api(`/auth/${state.authMode}`, { method: 'POST', body });
    await showApp(user);
  } catch (e2) {
    err.textContent = e2.message;
    err.classList.remove('hidden');
  }
};

$('logout').onclick = async () => {
  await api('/auth/logout', { method: 'POST' });
  location.reload();
};

$('new-doc').onclick = newDocument;
$('empty-new-doc').onclick = newDocument;

$('delete-doc').onclick = async () => {
  if (!state.current) return;
  await api(`/documents/${state.current.id}`, { method: 'DELETE' });
  state.current = null;
  state.messages = [];
  await loadDocuments();
  renderWorkspace();
};

$('download').onclick = () => {
  if (!state.current) return;
  const format = $('download-format').value;
  window.location.href = `/api/documents/${state.current.id}/download?format=${format}`;
};

$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  sendMessage(content);
};

$('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('chat-form').requestSubmit();
  }
});

$('tab-fields').onclick = () => {
  $('tab-fields').classList.add('active');
  $('tab-doc').classList.remove('active');
  $('fields-panel').classList.remove('hidden');
  $('doc-panel').classList.add('hidden');
};

$('tab-doc').onclick = () => {
  $('tab-doc').classList.add('active');
  $('tab-fields').classList.remove('active');
  $('doc-panel').classList.remove('hidden');
  $('fields-panel').classList.add('hidden');
  refreshPreview();
};

$('toggle-preview').onclick = () => {
  $('side-panel').classList.toggle('mobile-open');
  $('tab-doc').click();
};

/* ----------------------------------------------------------------- start */

(async () => {
  setAuthMode('login');
  try {
    const { user, aiMode } = await api('/auth/me');
    state.aiMode = aiMode;
    if (user) await showApp(user, aiMode);
  } catch {
    /* not signed in — the auth screen is already showing */
  }
})();
