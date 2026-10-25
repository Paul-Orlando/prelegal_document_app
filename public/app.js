const $ = (id) => document.getElementById(id);

const state = {
  aiMode: 'mock',
  catalog: [],
  firm: null,
  documents: [],
  current: null,
  sending: false,
  support: [],
  supportBusy: false,
};

/* -------------------------------------------------------------------- api */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

/* ---------------------------------------------------------------- helpers */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown: **bold**, _italic_ / *italic*, `code`. Input must already be escaped. */
function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Turn an assistant reply into blocks: paragraphs, lists, and asides. */
function renderReply(text) {
  const blocks = String(text).trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const isOl = lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l));
      const isUl = lines.length > 1 && lines.every((l) => /^[-•*]\s/.test(l));
      if (isOl || isUl) {
        const tag = isOl ? 'ol' : 'ul';
        const items = lines.map((l) => `<li>${inline(escapeHtml(l.replace(/^(\d+[.)]|[-•*])\s+/, '')))}</li>`);
        return `<${tag}>${items.join('')}</${tag}>`;
      }
      const joined = lines.join(' ');
      // Parenthetical notes like "_(Running without an API key…)_" render small.
      const aside = /^_?\(.*\)_?$/.test(joined);
      return `<p${aside ? ' class="aside"' : ''}>${inline(escapeHtml(aside ? joined.replace(/^_|_$/g, '') : joined))}</p>`;
    })
    .join('');
}

/**
 * Split off a short leading confirmation ("Recorded Party name: Acme") so it
 * shows as a chip above the question rather than competing with it.
 */
function splitConfirmation(text) {
  const parts = String(text).trim().split(/\n{2,}/);
  if (parts.length < 2) return { confirmation: null, question: text };
  const first = parts[0].trim();
  if (first.length <= 160 && /^(recorded|got it|great|thanks|thank you|noted|perfect|done|okay|ok)\b/i.test(first)) {
    return { confirmation: first.replace(/\*\*/g, ''), question: parts.slice(1).join('\n\n') };
  }
  return { confirmation: null, question: text };
}

function toast(message, ms = 2600) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('toast--long', message.length > 60);
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}

const specById = (id) => state.catalog.find((s) => s.id === id);

/* --------------------------------------------------------------- catalog */

function renderCatalog() {
  const options = state.catalog
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
    .join('');
  $('doc-select').innerHTML = `<option value="">Choose an agreement…</option>${options}`;
  $('hero-select').innerHTML = `<option value="">Choose an agreement…</option>${options}`;

  $('agreement-list').innerHTML = state.catalog
    .map(
      (t) =>
        `<li><button data-spec="${escapeHtml(t.id)}">` +
        `<strong>${escapeHtml(t.name)}</strong>` +
        `<span class="desc">${escapeHtml(t.description)}</span>` +
        `<span class="go">Start</span></button></li>`,
    )
    .join('');
  for (const btn of $('agreement-list').querySelectorAll('button')) {
    btn.onclick = () => startDocument(btn.dataset.spec);
  }
}

/* ---------------------------------------------------------------- drafts */

function renderDrafts() {
  const drafts = state.documents.filter((d) => d.specId);
  const count = $('drafts-count');
  count.textContent = drafts.length;
  count.classList.toggle('hidden', drafts.length === 0);

  const menu = $('drafts-menu');
  if (!drafts.length) {
    menu.innerHTML = '<p class="menu-empty">No drafts yet. Pick an agreement to start one.</p>';
    return;
  }
  menu.innerHTML = drafts
    .map((d) => {
      const filled = d.fields.filter((f) => f.required).length - d.missingRequired.length;
      const total = d.fields.filter((f) => f.required).length;
      const status = d.status === 'complete' ? 'Finished' : d.isComplete ? 'Ready to download' : `${filled} of ${total} details`;
      const when = new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return (
        `<button class="menu-item${state.current?.id === d.id ? ' active' : ''}" role="menuitem" data-id="${escapeHtml(d.id)}">` +
        `<strong>${escapeHtml(d.specName || d.title)}</strong><span>${status}, edited ${when}</span></button>`
      );
    })
    .join('');
  for (const btn of menu.querySelectorAll('.menu-item')) {
    btn.onclick = () => {
      closeDrafts();
      openDocument(btn.dataset.id);
    };
  }
}

function closeDrafts() {
  $('drafts-menu').classList.add('hidden');
  $('drafts-btn').setAttribute('aria-expanded', 'false');
}

async function loadDocuments() {
  const { documents } = await api('/documents');
  state.documents = documents;
  renderDrafts();
}

/* ------------------------------------------------------------- workspace */

function showHome() {
  state.current = null;
  $('home').classList.remove('hidden');
  $('workspace').classList.add('hidden');
  $('pricing').classList.add('hidden');
  $('pricing-btn').removeAttribute('aria-current');
  document.body.classList.remove('in-workspace');
  $('doc-select').value = '';
  if (location.hash) history.replaceState(null, '', location.pathname);
  renderDrafts();
}

function showWorkspace() {
  $('home').classList.add('hidden');
  $('pricing').classList.add('hidden');
  $('pricing-btn').removeAttribute('aria-current');
  $('workspace').classList.remove('hidden');
  document.body.classList.add('in-workspace');
}

function renderProgress() {
  const doc = state.current;
  const required = doc.fields.filter((f) => f.required);
  const filled = required.length - doc.missingRequired.length;
  const pct = required.length ? Math.round((filled / required.length) * 100) : 0;

  $('seal-fill').style.strokeDashoffset = String(125.66 * (1 - pct / 100));
  $('seal-pct').textContent = `${pct}%`;
  $('stage-doc').textContent = doc.specName;
  $('stage-progress').textContent =
    doc.status === 'complete'
      ? 'Finished and ready to download'
      : doc.isComplete
        ? 'All required details in — add optional ones or finish'
        : `${filled} of ${required.length} required details`;

  $('doc-title').textContent = doc.specName;
  $('doc-status').textContent = doc.isComplete
    ? 'Ready to download'
    : `${doc.missingRequired.length} required detail${doc.missingRequired.length === 1 ? '' : 's'} to go`;
  $('download').disabled = !doc.specId;
  $('finish-btn').classList.toggle('hidden', !(doc.isComplete && doc.status !== 'complete'));
  renderPriceNote(doc);
  $('doc-select').value = doc.specId || '';
}

/** The note above Download: what this agreement costs, and that it's free (and a sample) in the demo. */
function renderPriceNote(doc) {
  const note = $('paper-price');
  if (!doc.price || !state.pricing) {
    note.classList.add('hidden');
    return;
  }
  const first = state.pricing.plans[0];
  const price = `$${doc.price.price}`;
  const ent = state.entitlements;
  let html;
  if (!state.paymentsEnabled) {
    html =
      `<strong>Free in this demo.</strong> In the live service, this ${escapeHtml(doc.price.tierName)} agreement is ${price}, ` +
      `or included in a plan from $${first.price}. <button class="text-btn" data-show-pricing>See pricing</button>` +
      (state.demoMode ? '<br>Downloads are watermarked samples and are not for use.' : '');
  } else if (ent?.plan) {
    const until = new Date(ent.plan.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    html = `<strong>Included in your plan</strong> until ${escapeHtml(until)}.`;
  } else if (ent?.documents.includes(doc.id)) {
    html = '<strong>Purchased.</strong> Download it as often as you like.';
  } else {
    html =
      `${price} to download this ${escapeHtml(doc.price.tierName)} agreement, or included in a plan from $${first.price}. ` +
      `<button class="text-btn" data-show-pricing>See pricing</button>`;
  }
  note.innerHTML = html;
  note.querySelector('[data-show-pricing]')?.addEventListener('click', showPricing);
  note.classList.remove('hidden');
}

function renderFields() {
  const doc = state.current;
  const panel = $('fields-panel');
  panel.innerHTML = '';
  const fields = [...doc.fields].sort((a, b) => Number(b.required) - Number(a.required));
  for (const field of fields) {
    const value = doc.values[field.key];
    const filled = value !== undefined && value !== null && String(value).trim() !== '';
    const row = document.createElement('div');
    row.className = `field-row${filled ? ' filled' : ''}`;
    row.innerHTML =
      `<span class="field-dot" aria-hidden="true"></span>` +
      `<div class="field-label">${escapeHtml(field.label)}${field.required ? '' : '<small>optional</small>'}</div>` +
      `<div class="field-value">${filled ? escapeHtml(value) : 'Not answered yet'}</div>`;
    panel.appendChild(row);
  }
}

function showQuestion(text, { animate = true } = {}) {
  const { confirmation, question } = splitConfirmation(text);
  const rec = $('recorded');
  if (confirmation) {
    rec.innerHTML = `<span>${escapeHtml(confirmation)}</span>`;
    rec.classList.remove('hidden');
  } else {
    rec.classList.add('hidden');
  }
  $('question-text').innerHTML = renderReply(question);
  const q = document.querySelector('.question');
  q.classList.remove('enter');
  if (animate) {
    void q.offsetWidth;
    q.classList.add('enter');
  }
}

function setThinking(on) {
  $('thinking').classList.toggle('hidden', !on);
  $('question-text').classList.toggle('hidden', on);
  if (on) $('recorded').classList.add('hidden');
  $('answer-submit').disabled = on;
  $('answer-input').disabled = on;
}

async function refreshPreview() {
  const doc = state.current;
  if (!doc?.specId) return;
  try {
    const { html } = await api(`/documents/${doc.id}/preview`);
    $('doc-preview').innerHTML = html;
  } catch (err) {
    $('doc-preview').textContent = `Couldn't load the preview: ${err.message}`;
  }
}

function renderDocument() {
  renderProgress();
  renderFields();
  if (!$('doc-panel').classList.contains('hidden')) refreshPreview();
}

/* --------------------------------------------------------------- actions */

async function openDocument(id) {
  try {
    const { document: doc, messages } = await api(`/documents/${id}`);
    if (!doc.specId) {
      showHome();
      return;
    }
    state.current = doc;
    history.replaceState(null, '', `#doc/${doc.id}`);
    showWorkspace();
    renderDocument();
    renderDrafts();
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (last) {
      showQuestion(last.content, { animate: false });
      $('answer-input').focus();
    } else {
      await kickoff();
    }
  } catch (err) {
    toast(err.message);
    showHome();
  }
}

/** Start a new document of the chosen type and ask its first question. */
async function startDocument(specId) {
  if (!specId) return;
  if (state.current?.specId === specId) {
    showWorkspace();
    return;
  }
  if (state.sending) return;
  $('home-error').classList.add('hidden');

  try {
    const prev = state.current;
    const { document: doc } = await api('/documents', { method: 'POST', body: { specId } });

    // Only once the new one exists: throw away an untouched draft instead of
    // leaving it in the Drafts menu.
    if (prev && !Object.values(prev.values).some((v) => String(v ?? '').trim())) {
      await api(`/documents/${prev.id}`, { method: 'DELETE' }).catch(() => {});
    }
    state.current = doc;
    history.replaceState(null, '', `#doc/${doc.id}`);
    showWorkspace();
    renderDocument();
    $('answer-input').value = '';
    await kickoff();
    await loadDocuments();
  } catch (err) {
    const onHome = !$('home').classList.contains('hidden');
    if (onHome) {
      $('home-error').textContent = err.message;
      $('home-error').classList.remove('hidden');
    } else {
      toast(err.message, err.data?.limit ? 9000 : 4000);
    }
    $('doc-select').value = state.current?.specId || '';
  }
}

async function kickoff() {
  await send({ kickoff: true });
}

async function send({ content = '', kickoff = false } = {}) {
  if (!state.current || state.sending) return;
  state.sending = true;
  setThinking(true);
  try {
    const res = await api(`/documents/${state.current.id}/messages`, {
      method: 'POST',
      body: kickoff ? { kickoff: true } : { content },
    });
    state.current = res.document;
    const reply = res.messages.filter((m) => m.role === 'assistant').pop();
    setThinking(false);
    showQuestion(reply?.content ?? 'Recorded. What would you like to add next?');
    renderDocument();
    loadDocuments();
  } catch (err) {
    setThinking(false);
    showQuestion(err.data?.limit ? err.message : `That didn't go through: ${err.message}\n\nTry sending your answer again.`);
    if (content) $('answer-input').value = content;
  } finally {
    state.sending = false;
    $('answer-input').focus();
  }
}

/* --------------------------------------------------------- help & support */

let helpReturnFocus = null;

function openHelp() {
  helpReturnFocus = document.activeElement;
  closeDrafts();
  $('help').hidden = false;
  $('help-scrim').classList.remove('hidden');
  $('help-btn').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('help-close').focus();
}

function closeHelp() {
  $('help').hidden = true;
  $('help-scrim').classList.add('hidden');
  $('help-btn').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  helpReturnFocus?.focus?.();
}

function renderFirm() {
  const f = state.firm;
  if (!f) return;
  const addr = `${f.address.line1}, ${f.address.city}, ${f.address.region} ${f.address.postal}`;

  for (const id of ['home-phone', 'foot-phone']) {
    $(id).href = `tel:${f.phone.tel}`;
    $(id).textContent = f.phone.display;
  }
  $('foot-address').textContent = addr;
  $('foot-email').href = `mailto:${f.email}`;
  $('foot-email').textContent = f.email;

  $('call-firm').href = `tel:${f.phone.tel}`;
  $('call-firm-number').textContent = f.phone.display;
  $('call-firm-hours').textContent = f.officeHours;
  $('call-desk').href = `tel:${f.helpDesk.tel}`;
  $('call-desk-number').textContent = f.helpDesk.display;
  $('call-desk-hours').textContent = f.helpDesk.hours;
  $('esc-phone').href = `tel:${f.helpDesk.tel}`;
  $('esc-phone').textContent = f.helpDesk.display;
  $('esc-email').href = `mailto:${f.helpDesk.email}`;
  $('esc-email').textContent = f.helpDesk.email;
  $('chatbot-call').href = `tel:${f.helpDesk.tel}`;
  $('chatbot-call').textContent = `Call ${f.helpDesk.display}`;

  $('help-address').innerHTML =
    `${escapeHtml(f.name)}<br>${escapeHtml(f.address.line1)}<br>` +
    `${escapeHtml(f.address.city)}, ${escapeHtml(f.address.region)} ${escapeHtml(f.address.postal)}`;
  $('help-email').href = `mailto:${f.email}`;
  $('help-email').textContent = f.email;

  $('team-list').innerHTML = f.partners
    .map((p) => {
      const initials = p.name.split(' ').filter((w) => /^[A-Z]/.test(w) && !w.endsWith('.')).map((w) => w[0]).join('');
      const tel = p.phone.replace(/[^\d]/g, '');
      return (
        `<li><span class="avatar ${p.seniority}" aria-hidden="true">${escapeHtml(initials)}</span>` +
        `<div><p class="team-name">${escapeHtml(p.name)}</p>` +
        `<p class="team-role">${escapeHtml(p.role)}</p>` +
        `<p class="team-focus">${escapeHtml(p.focus)}</p>` +
        `<a class="team-phone" href="tel:+1${tel}">${escapeHtml(p.phone)}</a></div></li>`
      );
    })
    .join('');
}

/* ---------------------------------------------------------------- pricing */

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

function renderPricing() {
  const p = state.pricing;
  if (!p) return;
  const [ess, com] = p.tiers;

  const single =
    `<article class="plan">` +
    `<p class="plan-name">One agreement</p>` +
    `<p class="plan-price">${money(ess.price)}<small>or ${money(com.price)}</small></p>` +
    `<p class="plan-sub">Pay once per agreement: ${escapeHtml(ess.name)} or ${escapeHtml(com.name)}.</p>` +
    `<ul>${p.singleIncludes.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` +
    `<button class="btn btn--quiet" data-start-agreement>Start an agreement</button></article>`;

  const plans = p.plans
    .map((plan) => {
      const featured = Boolean(plan.badge);
      return (
        `<article class="plan${featured ? ' plan--featured' : ''}">` +
        (plan.badge ? `<span class="plan-badge">${escapeHtml(plan.badge)}</span>` : '') +
        `<p class="plan-name">${escapeHtml(plan.name)}</p>` +
        `<p class="plan-price">${money(plan.price)}<small>for ${plan.months} months</small></p>` +
        `<p class="plan-sub">About ${money(plan.perMonth)} a month, paid upfront. Unlimited agreements.</p>` +
        `<ul>${plan.includes.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` +
        `<p class="plan-break">Costs the same as ${plan.breakEven.commercial} Commercial agreements bought one at a time</p>` +
        `<button class="btn ${featured ? 'btn--primary' : 'btn--quiet'}" data-plan-request="Start the ${escapeHtml(plan.name)}">Choose the ${escapeHtml(plan.name)}</button>` +
        `</article>`
      );
    })
    .join('');
  $('plan-grid').innerHTML = single + plans;

  $('tier-tables').innerHTML = p.tiers
    .map(
      (t) =>
        `<div class="tier"><div class="tier-head"><strong>${escapeHtml(t.name)}</strong>` +
        `<span class="tier-price">${money(t.price)} <small>each</small></span></div>` +
        `<p class="tier-blurb">${escapeHtml(t.blurb)}</p>` +
        `<ul>${t.agreements.map((a) => `<li><button data-spec="${escapeHtml(a.id)}">${escapeHtml(a.name)}</button></li>`).join('')}</ul></div>`,
    )
    .join('');

  const r = p.attorneyReview;
  $('review-price').innerHTML = `${money(r.price)} <small>per agreement, ${money(r.memberPrice)} for plan members</small>`;
  $('review-detail').textContent = r.detail;
  $('plan-terms').textContent = p.planTerms;
  $('price-comparison').textContent = p.comparison;
  $('demo-note').textContent = p.demoNote;

  for (const btn of document.querySelectorAll('#pricing [data-spec]')) btn.onclick = () => startDocument(btn.dataset.spec);
  for (const btn of document.querySelectorAll('#pricing [data-start-agreement]')) {
    btn.onclick = () => {
      showHome();
      $('hero-select').focus();
    };
  }
  for (const btn of document.querySelectorAll('#pricing [data-plan-request]')) btn.onclick = () => requestPlan(btn.dataset.planRequest);
}

function showPricing() {
  closeDrafts();
  $('home').classList.add('hidden');
  $('workspace').classList.add('hidden');
  document.body.classList.remove('in-workspace');
  $('pricing').classList.remove('hidden');
  $('pricing-btn').setAttribute('aria-current', 'page');
  if (location.hash !== '#pricing') history.replaceState(null, '', '#pricing');
  window.scrollTo({ top: 0 });
  if (window.matchMedia('(max-width: 860px)').matches && !$('chatbot').hidden) closeChat();
}

/** Plans are signed up for through a help desk callback; open the form with the topic chosen. */
function requestPlan(topic) {
  if (!$('chatbot').hidden) closeChat();
  openHelp();
  const select = $('cb-topic');
  const option = [...select.options].find((o) => o.textContent === topic);
  if (option) select.value = option.value;
  $('callback-done').classList.add('hidden');
  $('callback-form').classList.remove('hidden');
  if (!$('cb-message').value) $('cb-message').value = topic.startsWith('Start') ? `I'd like to start the ${topic.replace('Start the ', '')}.` : '';
  $('callback-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('cb-name').focus();
}

const GREETING =
  "Hi, I'm the Prelegal assistant. Ask me which agreement fits your deal, what a question means, how pricing and plans work, or how to download your document. If I can't help, I'll put you in touch with our help desk.";

/** The support conversation is shared by the chat widget and the Help & support panel. */
function renderSupport() {
  const html = state.support
    .map(
      (m) =>
        `<div class="s-msg ${m.role}">${inline(escapeHtml(m.content))}</div>` +
        (m.showPricing ? '<div class="s-actions"><button class="chip" data-show-pricing>View plans and prices</button></div>' : ''),
    )
    .join('');
  const typing = state.supportBusy ? '<div class="s-msg assistant typing">Looking into it…</div>' : '';

  const panelLog = $('support-log');
  panelLog.innerHTML = html + typing;
  $('support-suggest').classList.toggle('hidden', state.support.length > 0);

  const botLog = $('chatbot-log');
  botLog.innerHTML = `<div class="s-msg assistant">${escapeHtml(GREETING)}</div>` + html + typing;
  for (const btn of document.querySelectorAll('#chatbot-log [data-show-pricing], #support-log [data-show-pricing]')) {
    btn.onclick = () => {
      if (!$('help').hidden) closeHelp();
      showPricing();
    };
  }
  $('chatbot-suggest').classList.toggle('hidden', state.support.length > 0);
  botLog.scrollTop = botLog.scrollHeight;
  panelLog.lastElementChild?.scrollIntoView({ block: 'nearest' });
}

function showEscalation() {
  $('escalate').classList.remove('hidden');
  $('chatbot-escalate').classList.remove('hidden');
  requestAnimationFrame(() => {
    if (!$('help').hidden) $('escalate').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

/** What the user is looking at, so the assistant can explain the current question. */
function supportContext() {
  if (!state.current || $('workspace').classList.contains('hidden')) return undefined;
  return {
    documentType: state.current.specName,
    question: $('question-text').innerText.trim().slice(0, 800),
  };
}

async function askSupport(question) {
  if (!question || state.supportBusy) return;
  state.support.push({ role: 'user', content: question });
  state.supportBusy = true;
  renderSupport();
  try {
    const res = await api('/support/chat', {
      method: 'POST',
      body: { messages: state.support, context: supportContext() },
    });
    state.support.push({ role: 'assistant', content: res.text, showPricing: Boolean(res.showPricing) });
    if (res.escalate) showEscalation();
  } catch (err) {
    state.support.push({ role: 'assistant', content: err.message });
    showEscalation();
  } finally {
    state.supportBusy = false;
    renderSupport();
  }
}

/* ------------------------------------------------------------ chat widget */

function openChat() {
  if (!$('help').hidden) closeHelp();
  $('chip-explain').classList.toggle('hidden', !supportContext());
  $('chatbot').hidden = false;
  $('chat-launcher').classList.add('hidden');
  $('chat-launcher').setAttribute('aria-expanded', 'true');
  renderSupport();
  $('chatbot-input').focus();
}

function closeChat() {
  $('chatbot').hidden = true;
  $('chat-launcher').classList.remove('hidden');
  $('chat-launcher').setAttribute('aria-expanded', 'false');
  $('chat-launcher').focus();
}

/* ------------------------------------------------------------ day / night */

function applyTheme(theme) {
  const dark = theme === 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const btn = $('theme-btn');
  btn.setAttribute('aria-label', dark ? 'Switch to day mode' : 'Switch to night mode');
  btn.title = dark ? 'Switch to day mode' : 'Switch to night mode';
  $('theme-label').textContent = dark ? 'Day mode' : 'Night mode';
  try {
    localStorage.setItem('prelegal-theme', dark ? 'dark' : 'light');
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

/* -------------------------------------------------------------- bindings */

$('brand-home').onclick = (e) => {
  e.preventDefault();
  showHome();
};

$('doc-select').onchange = (e) => startDocument(e.target.value);
$('hero-select').onchange = (e) => ($('hero-start').disabled = !e.target.value);
$('hero-start').onclick = () => startDocument($('hero-select').value);

$('drafts-btn').onclick = (e) => {
  e.stopPropagation();
  const menu = $('drafts-menu');
  const open = menu.classList.toggle('hidden') === false;
  $('drafts-btn').setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('.menu-item')?.focus();
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeDrafts();
});

$('answer-form').onsubmit = (e) => {
  e.preventDefault();
  const input = $('answer-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  send({ content });
};
$('answer-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('answer-form').requestSubmit();
  }
});
$('finish-btn').onclick = () => send({ content: "That's everything — I'm done." });

$('tab-fields').onclick = () => {
  $('tab-fields').classList.add('active');
  $('tab-doc').classList.remove('active');
  $('tab-fields').setAttribute('aria-selected', 'true');
  $('tab-doc').setAttribute('aria-selected', 'false');
  $('fields-panel').classList.remove('hidden');
  $('doc-panel').classList.add('hidden');
};
$('tab-doc').onclick = () => {
  $('tab-doc').classList.add('active');
  $('tab-fields').classList.remove('active');
  $('tab-doc').setAttribute('aria-selected', 'true');
  $('tab-fields').setAttribute('aria-selected', 'false');
  $('doc-panel').classList.remove('hidden');
  $('fields-panel').classList.add('hidden');
  refreshPreview();
};

const downloadUrl = () => `/api/documents/${state.current.id}/download?format=${$('download-format').value}`;

$('download').onclick = async () => {
  if (!state.current) return;
  if (!state.paymentsEnabled) {
    window.location.href = downloadUrl();
    return;
  }
  // Paywall on: check first, so a 402 opens the purchase dialog instead of a blank page.
  const res = await fetch(downloadUrl(), { credentials: 'same-origin' });
  if (res.status === 402) {
    openBuy((await res.json()).options);
    return;
  }
  if (!res.ok) {
    toast((await res.json().catch(() => ({}))).error || 'The download failed. Please try again.');
    return;
  }
  const blob = await res.blob();
  const name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'agreement';
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

function openBuy(options) {
  const opts = [
    { kind: 'document', label: options.single.label, sub: 'Pay once for this agreement', price: options.single.price },
    ...options.plans.map((p) => ({
      kind: 'plan',
      planId: p.id,
      label: p.name,
      sub: `Unlimited agreements for ${p.months} months`,
      price: p.price,
    })),
  ];
  $('buy-options').innerHTML = opts
    .map(
      (o, i) =>
        `<button class="buy-option" data-i="${i}"><strong>${escapeHtml(o.label)}</strong>` +
        `<span>${escapeHtml(o.sub)}</span><em>$${o.price}</em></button>`,
    )
    .join('');
  $('buy-error').classList.add('hidden');
  for (const btn of $('buy-options').querySelectorAll('.buy-option')) {
    btn.onclick = async () => {
      const o = opts[Number(btn.dataset.i)];
      try {
        const res = await api('/checkout', {
          method: 'POST',
          body: o.kind === 'plan' ? { kind: 'plan', planId: o.planId } : { kind: 'document', documentId: state.current.id },
        });
        state.entitlements = res.entitlements;
        closeBuy();
        renderPriceNote(state.current);
        toast('Payment complete');
        $('download').click();
      } catch (err) {
        $('buy-error').textContent = err.message;
        $('buy-error').classList.remove('hidden');
      }
    };
  }
  $('buy-scrim').classList.remove('hidden');
  $('buy-options').querySelector('.buy-option')?.focus();
}

function closeBuy() {
  $('buy-scrim').classList.add('hidden');
  $('download').focus();
}

$('buy-cancel').onclick = closeBuy;
$('buy-scrim').onclick = (e) => {
  if (e.target === $('buy-scrim')) closeBuy();
};

/* ------------------------------------------------- demo notice and consent */

const ACK_KEY = 'prelegal-demo-ack';

function openAck() {
  $('ack-scrim').classList.remove('hidden');
  $('ack-ok').focus();
}

$('ack-ok').onclick = () => {
  try {
    localStorage.setItem(ACK_KEY, '1');
  } catch {
    /* storage unavailable: they'll see it again next visit */
  }
  $('ack-scrim').classList.add('hidden');
};
$('demo-strip-more').onclick = openAck;

$('delete-doc').onclick = async () => {
  if (!state.current) return;
  if (!confirm(`Delete this ${state.current.specName} draft? This can't be undone.`)) return;
  try {
    await api(`/documents/${state.current.id}`, { method: 'DELETE' });
    await loadDocuments();
    showHome();
    toast('Draft deleted');
  } catch (err) {
    toast(err.message);
  }
};

$('help-btn').onclick = () => {
  if (!$('chatbot').hidden) closeChat();
  openHelp();
};
$('theme-btn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

$('pricing-btn').onclick = showPricing;
$('chat-launcher').onclick = openChat;
for (const el of document.querySelectorAll('[data-open-chat]')) {
  el.onclick = () => {
    openChat();
    if (el.dataset.chatQ) askSupport(el.dataset.chatQ);
  };
}
$('chatbot-close').onclick = closeChat;
$('chatbot-clear').onclick = () => {
  state.support = [];
  $('chatbot-escalate').classList.add('hidden');
  $('escalate').classList.add('hidden');
  renderSupport();
  $('chatbot-input').focus();
};
$('chatbot-form').onsubmit = (e) => {
  e.preventDefault();
  const q = $('chatbot-input').value.trim();
  $('chatbot-input').value = '';
  askSupport(q);
};
for (const chip of document.querySelectorAll('#chatbot-suggest .chip')) {
  chip.onclick = () => askSupport(chip.dataset.q);
}
$('chatbot-callback').onclick = () => {
  closeChat();
  openHelp();
  $('callback-form').classList.remove('hidden');
  $('callback-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('cb-name').focus();
};
$('help-close').onclick = closeHelp;
$('help-scrim').onclick = closeHelp;
for (const el of document.querySelectorAll('[data-open-help]')) el.onclick = openHelp;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('buy-scrim').classList.contains('hidden')) closeBuy();
    else if (!$('help').hidden) closeHelp();
    else if (!$('chatbot').hidden) closeChat();
    else closeDrafts();
  }
});

$('support-form').onsubmit = (e) => {
  e.preventDefault();
  const q = $('support-input').value.trim();
  $('support-input').value = '';
  askSupport(q);
};
for (const chip of document.querySelectorAll('#support-suggest .chip')) {
  chip.onclick = () => askSupport(chip.dataset.q);
}

$('callback-toggle').onclick = () => {
  $('callback-form').classList.toggle('hidden');
  $('cb-name').focus();
};
$('callback-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = $('cb-error');
  err.classList.add('hidden');
  try {
    const { ticket, helpDesk } = await api('/support/tickets', {
      method: 'POST',
      body: {
        name: $('cb-name').value,
        phone: $('cb-phone').value,
        email: $('cb-email').value,
        topic: $('cb-topic').value,
        message: $('cb-message').value,
      },
    });
    $('callback-form').classList.add('hidden');
    $('escalate').classList.add('hidden');
    const done = $('callback-done');
    done.innerHTML =
      `<strong>Callback requested — reference ${escapeHtml(ticket.id)}.</strong><br>` +
      `The help desk will contact you during business hours (${escapeHtml(helpDesk.hours)}). ` +
      `Need it sooner? Call <a href="tel:${escapeHtml(helpDesk.tel)}">${escapeHtml(helpDesk.display)}</a>.`;
    done.classList.remove('hidden');
  } catch (e2) {
    err.textContent = e2.message;
    err.classList.remove('hidden');
  }
};

/* ----------------------------------------------------------------- start */

(async () => {
  try {
    const session = await api('/session');
    state.aiMode = session.aiMode;
    state.demoMode = session.demoMode;
    state.paymentsEnabled = session.paymentsEnabled;
    if (state.demoMode) {
      $('demo-strip').classList.remove('hidden');
      // Keep the pinned top bar and document panel clear of the strip, whatever its height.
      const setStrip = () =>
        document.documentElement.style.setProperty('--strip-h', `${$('demo-strip').offsetHeight}px`);
      setStrip();
      window.addEventListener('resize', setStrip);
      let acknowledged = false;
      try {
        acknowledged = localStorage.getItem(ACK_KEY) === '1';
      } catch {
        /* storage unavailable */
      }
      if (!acknowledged) openAck();
    } else {
      $('foot-demo').remove();
    }
    if (state.paymentsEnabled) state.entitlements = await api('/entitlements');
    $('ai-badge').textContent = state.aiMode === 'openrouter' ? 'AI assistant on' : 'Scripted demo mode';

    const [{ documentTypes }, { firm }, { pricing }] = await Promise.all([
      api('/catalog'),
      api('/support/firm'),
      api('/pricing'),
    ]);
    state.catalog = documentTypes;
    state.firm = firm;
    state.pricing = pricing;
    renderCatalog();
    renderFirm();
    renderPricing();
    await loadDocuments();

    const match = location.hash.match(/^#doc\/(.+)$/);
    if (match) await openDocument(match[1]);
    else if (location.hash === '#pricing') showPricing();
  } catch (err) {
    $('home-error').textContent = `Couldn't reach the server: ${err.message}`;
    $('home-error').classList.remove('hidden');
  }
})();
