import express from 'express';
import {
  addMessage,
  createDocument,
  createSession,
  createUser,
  deleteDocument,
  createSupportTicket,
  getDocument,
  getSessionUser,
  listDocuments,
  listMessages,
  updateDocument,
} from './db.js';
import { getSpec, isKnownField, listSpecs, missingRequiredFields } from './documentSpecs.js';
import { documentFilename, renderCoverPage, renderDocument } from './render.js';
import { renderDocxBuffer, renderPdfBuffer } from './exporters.js';
import { activeMode, runTurn } from './ai/index.js';
import { checkRateLimit } from './rateLimit.js';
import { supportReply } from './ai/support.js';
import { FIRM } from './firm.js';
import crypto from 'node:crypto';
import MarkdownIt from 'markdown-it';

// Preview renderer: raw HTML disabled so user-entered values can't inject markup.
const previewMd = new MarkdownIt({ html: false, linkify: false });
const stripTags = (text) => text.replace(/<\/?[a-zA-Z][^>]*>/g, '');

const NEW_DOCUMENT_LIMIT = 30;
const NEW_DOCUMENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const router = express.Router();

const COOKIE = 'prelegal_session';

/* ----------------------------------------------------------------- helpers */

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const eq = c.indexOf('=');
        return eq === -1 ? [c, ''] : [c.slice(0, eq), decodeURIComponent(c.slice(eq + 1))];
      }),
  );
}

/**
 * Demo mode: no sign-in. Each browser gets its own guest user the first time
 * it calls the API, tracked by a long-lived session cookie, so drafts stay
 * private to that browser without anyone creating an account.
 */
function requireAuth(req, res, next) {
  let token = parseCookies(req.headers.cookie)[COOKIE];
  let user = getSessionUser(token);
  if (!user) {
    user = createUser({
      email: `guest-${crypto.randomUUID()}@guest.prelegal.local`,
      displayName: 'Guest',
      password: crypto.randomBytes(24).toString('hex'),
    });
    token = createSession(user.id);
    setSessionCookie(res, token);
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 180}`,
  );
}

/** Public view of a document, including derived completion state. */
function documentView(doc) {
  const spec = doc.specId ? getSpec(doc.specId) : null;
  const missing = spec ? missingRequiredFields(spec, doc.values) : null;
  return {
    id: doc.id,
    title: doc.title,
    specId: doc.specId,
    specName: spec ? spec.name : null,
    values: doc.values,
    status: doc.status,
    fields: spec ? spec.fields : [],
    missingRequired: missing,
    isComplete: spec ? missing.length === 0 : false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ------------------------------------------------------------------ session */

router.get('/session', requireAuth, (req, res) => {
  res.json({ user: req.user, aiMode: activeMode });
});

/* ----------------------------------------------------------------- catalog */

router.get('/catalog', (_req, res) => {
  res.json({ documentTypes: listSpecs() });
});

/* --------------------------------------------------------------- documents */

router.get('/documents', requireAuth, (req, res) => {
  res.json({ documents: listDocuments(req.user.id).map(documentView) });
});

router.post('/documents', requireAuth, (req, res) => {
  const limit = checkRateLimit(req.ip, NEW_DOCUMENT_LIMIT, NEW_DOCUMENT_WINDOW_MS);
  if (!limit.allowed) {
    return res.status(429).json({
      error: `This demo allows ${NEW_DOCUMENT_LIMIT} new documents per hour. Try again in about ${limit.retryAfterMinutes} minute${limit.retryAfterMinutes === 1 ? '' : 's'}.`,
    });
  }

  const { specId = null, title } = req.body ?? {};
  if (specId && !getSpec(specId)) return res.status(400).json({ error: 'Unknown document type.' });

  const spec = specId ? getSpec(specId) : null;
  const doc = createDocument(req.user.id, {
    specId,
    title: title || (spec ? `New ${spec.name}` : 'New document'),
  });
  res.status(201).json({ document: documentView(doc) });
});

router.get('/documents/:id', requireAuth, (req, res) => {
  const doc = getDocument(req.user.id, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  res.json({ document: documentView(doc), messages: listMessages(doc.id) });
});

router.patch('/documents/:id', requireAuth, (req, res) => {
  const doc = getDocument(req.user.id, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  const patch = {};
  if (req.body?.title !== undefined) patch.title = String(req.body.title).slice(0, 200);
  if (req.body?.specId !== undefined) {
    if (req.body.specId && !getSpec(req.body.specId))
      return res.status(400).json({ error: 'Unknown document type.' });
    patch.specId = req.body.specId;
    patch.values = {};
  }
  if (req.body?.values !== undefined) {
    const specId = patch.specId !== undefined ? patch.specId : doc.specId;
    if (!specId) return res.status(400).json({ error: 'Choose a document type first.' });
    const next = { ...(patch.values ?? doc.values) };
    for (const [key, value] of Object.entries(req.body.values)) {
      if (isKnownField(specId, key)) next[key] = String(value ?? '');
    }
    patch.values = next;
  }

  res.json({ document: documentView(updateDocument(req.user.id, doc.id, patch)) });
});

router.delete('/documents/:id', requireAuth, (req, res) => {
  if (!deleteDocument(req.user.id, req.params.id))
    return res.status(404).json({ error: 'Document not found.' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- chat */

router.post('/documents/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const doc = getDocument(req.user.id, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    // kickoff: the user just picked a document type from the menu — ask the
    // first question without recording a user message.
    const kickoff = Boolean(req.body?.kickoff);
    let content = String(req.body?.content ?? '').trim();
    if (kickoff) {
      if (!doc.specId) return res.status(400).json({ error: 'Choose a document type first.' });
      content = `(The user just chose "${getSpec(doc.specId).name}" from the document menu. Do not call set_document_type. Welcome them in one short sentence and ask the first question.)`;
    }
    if (!content) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (content.length > 8000) return res.status(400).json({ error: 'Message is too long.' });

    const history = listMessages(doc.id).map((m) => ({ role: m.role, content: m.content }));
    const userMessage = kickoff ? null : addMessage(doc.id, 'user', content);

    // Tool calls mutate the document; each action is persisted immediately so
    // the next model round sees current state.
    let state = { specId: doc.specId, values: doc.values };
    const applyAction = (action) => {
      if (action.type === 'set_document_type') {
        const spec = getSpec(action.documentTypeId);
        if (!spec) throw new Error(`Unknown document type: ${action.documentTypeId}`);
        // Switching type invalidates values collected for the old one.
        state = { specId: spec.id, values: state.specId === spec.id ? state.values : {} };
        updateDocument(req.user.id, doc.id, {
          specId: spec.id,
          values: state.values,
          title: `${spec.name}`,
        });
      } else if (action.type === 'set_fields') {
        if (!state.specId) throw new Error('No document type chosen yet.');
        const next = { ...state.values };
        for (const [key, value] of Object.entries(action.fields)) {
          if (isKnownField(state.specId, key)) next[key] = String(value ?? '');
        }
        state = { ...state, values: next };
        updateDocument(req.user.id, doc.id, { values: next });
      } else if (action.type === 'mark_complete') {
        const spec = getSpec(state.specId);
        if (!spec) throw new Error('No document type chosen yet.');
        const missing = missingRequiredFields(spec, state.values);
        if (missing.length) throw new Error(`Still missing required fields: ${missing.join(', ')}`);
        updateDocument(req.user.id, doc.id, { status: 'complete' });
      }
      return state;
    };

    const { text, degraded } = await runTurn({
      specId: doc.specId,
      values: doc.values,
      history,
      userMessage: content,
      applyAction,
      kickoff,
    });

    const assistantMessage = addMessage(doc.id, 'assistant', text);
    const updated = getDocument(req.user.id, doc.id);

    res.json({
      messages: userMessage ? [userMessage, assistantMessage] : [assistantMessage],
      document: documentView(updated),
      degraded: Boolean(degraded),
    });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------- preview */

router.get('/documents/:id/preview', requireAuth, (req, res) => {
  const doc = getDocument(req.user.id, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (!doc.specId) return res.status(400).json({ error: 'No document type chosen yet.' });

  const full = renderDocument(doc.specId, doc.values);
  res.json({
    coverPage: renderCoverPage(getSpec(doc.specId), doc.values),
    full,
    html: previewMd.render(stripTags(full)),
  });
});

const DOWNLOAD_FORMATS = {
  md: {
    contentType: 'text/markdown; charset=utf-8',
    render: async (specId, values) => renderDocument(specId, values),
  },
  pdf: {
    contentType: 'application/pdf',
    render: renderPdfBuffer,
  },
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    render: renderDocxBuffer,
  },
};

router.get('/documents/:id/download', requireAuth, async (req, res, next) => {
  try {
    const doc = getDocument(req.user.id, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    if (!doc.specId) return res.status(400).json({ error: 'No document type chosen yet.' });

    const format = String(req.query.format || 'md').toLowerCase();
    const handler = DOWNLOAD_FORMATS[format];
    if (!handler) {
      return res.status(400).json({ error: 'Unsupported format. Use md, pdf, or docx.' });
    }

    const spec = getSpec(doc.specId);
    const body = await handler.render(doc.specId, doc.values);
    const filename = documentFilename(spec, doc.values, format);

    res.setHeader('Content-Type', handler.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------- help & support */

router.get('/support/firm', (_req, res) => {
  res.json({ firm: FIRM });
});

router.post('/support/chat', async (req, res, next) => {
  try {
    const limit = checkRateLimit(`support:${req.ip}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many questions for now. Call the help desk at ${FIRM.helpDesk.display} instead.`,
      });
    }
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const messages = raw
      .slice(-12)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 2000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Ask a question first.' });
    }
    // Optional: what the user is drafting and the question on screen.
    const ctx = req.body?.context;
    const context =
      ctx && typeof ctx === 'object'
        ? {
            documentType: String(ctx.documentType ?? '').slice(0, 120),
            question: String(ctx.question ?? '').slice(0, 800),
          }
        : null;
    res.json(await supportReply(messages, context));
  } catch (err) {
    next(err);
  }
});

router.post('/support/tickets', requireAuth, (req, res) => {
  const { name, phone, email, topic, message } = req.body ?? {};
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Add your name so we know who to ask for.' });
  if (!String(phone ?? '').trim() && !String(email ?? '').trim())
    return res.status(400).json({ error: 'Add a phone number or email so the help desk can reach you.' });
  const ticket = createSupportTicket(req.user.id, {
    name: String(name).slice(0, 200),
    phone: String(phone ?? '').slice(0, 50),
    email: String(email ?? '').slice(0, 200),
    topic: String(topic ?? 'General question').slice(0, 100),
    message: String(message ?? '').slice(0, 4000),
  });
  res.status(201).json({ ticket, helpDesk: FIRM.helpDesk });
});
