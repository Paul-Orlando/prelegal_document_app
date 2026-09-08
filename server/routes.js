import express from 'express';
import {
  addMessage,
  createDocument,
  createSession,
  createUser,
  deleteDocument,
  deleteSession,
  findUserByEmail,
  getDocument,
  getSessionUser,
  listDocuments,
  listMessages,
  updateDocument,
  verifyPassword,
} from './db.js';
import { getSpec, isKnownField, listSpecs, missingRequiredFields } from './documentSpecs.js';
import { documentFilename, renderCoverPage, renderDocument } from './render.js';
import { renderDocxBuffer, renderPdfBuffer } from './exporters.js';
import { activeMode, runTurn } from './ai/index.js';
import { checkRateLimit } from './rateLimit.js';

const NEW_DOCUMENT_LIMIT = 3;
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

function requireAuth(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const user = getSessionUser(token);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.user = user;
  req.sessionToken = token;
  next();
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 14}`,
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

/* -------------------------------------------------------------------- auth */

router.post('/auth/register', (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (String(password).length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'That email is already registered.' });

  const user = createUser({
    email,
    password,
    displayName: displayName || String(email).split('@')[0],
  });
  setSessionCookie(res, createSession(user.id));
  res.status(201).json({ user });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const row = findUserByEmail(email ?? '');
  if (!row || !verifyPassword(row, String(password ?? ''))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  setSessionCookie(res, createSession(row.id));
  res.json({ user: { id: row.id, email: row.email, displayName: row.display_name } });
});

router.post('/auth/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) deleteSession(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  const user = getSessionUser(parseCookies(req.headers.cookie)[COOKIE]);
  res.json({ user: user ?? null, aiMode: activeMode });
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

    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (content.length > 8000) return res.status(400).json({ error: 'Message is too long.' });

    const history = listMessages(doc.id).map((m) => ({ role: m.role, content: m.content }));
    const userMessage = addMessage(doc.id, 'user', content);

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
    });

    const assistantMessage = addMessage(doc.id, 'assistant', text);
    const updated = getDocument(req.user.id, doc.id);

    res.json({
      messages: [userMessage, assistantMessage],
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

  res.json({
    coverPage: renderCoverPage(getSpec(doc.specId), doc.values),
    full: renderDocument(doc.specId, doc.values),
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
