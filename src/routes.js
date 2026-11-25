import { Router } from 'express';
import { detectLanguage, makeTitle } from './text.js';

const isValidText = (value, max = 100_000) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const badRequest = (res, error) => res.status(400).json({ error });
const notFound = (res) => res.status(404).json({ error: 'Not found' });
const sendOrNotFound = (res, item) => (item ? res.json(item) : notFound(res));

function validate({ title, text }, res) {
  if (title !== undefined && !isValidText(title, 200)) return badRequest(res, 'Title must be 1-200 characters');
  if (text !== undefined && !isValidText(text)) return badRequest(res, 'Text must not be empty');
  return null;
}

export function transcriptionRoutes(db) {
  const router = Router();

  router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : badRequest(res, 'Invalid id')));

  router.get('/', async (req, res) => {
    res.json(await db.list(String(req.query.q ?? '').trim()));
  });

  router.get('/:id', async (req, res) => {
    sendOrNotFound(res, await db.get(req.params.id));
  });

  router.post('/', async (req, res) => {
    const { title, text } = req.body ?? {};
    if (text === undefined) return badRequest(res, 'Text is required');
    if (validate({ title, text }, res)) return;

    const item = await db.create({
      title: title?.trim() || makeTitle(text),
      text: text.trim(),
      language: detectLanguage(text),
    });
    res.status(201).json(item);
  });

  router.patch('/:id', async (req, res) => {
    const { title, text } = req.body ?? {};
    if (title === undefined && text === undefined) return badRequest(res, 'Nothing to update');
    if (validate({ title, text }, res)) return;

    const item = await db.update(req.params.id, {
      title: title?.trim(),
      text: text?.trim(),
      language: text && detectLanguage(text),
    });
    sendOrNotFound(res, item);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await db.remove(req.params.id);
    removed ? res.status(204).end() : notFound(res);
  });

  return router;
}
