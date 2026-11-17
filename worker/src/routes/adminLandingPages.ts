import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { audit, badRequest, conflict, notFound, optionalString, readJson, requireString, slugify } from '../lib/http';

/** Mounted inside the already authenticated admin router. */
export const adminLandingPages = new Hono<{ Bindings: Env; Variables: Variables }>();

function contentString(value: unknown): string {
  if (value === undefined || value === null) return '{}';
  if (typeof value !== 'object' || Array.isArray(value)) badRequest('content must be a JSON object');
  const text = JSON.stringify(value);
  if (text.length > 100_000) badRequest('Landing page content must be under 100 KB');
  return text;
}
function makeSlug(raw: unknown, title: string): string {
  const slug = slugify(optionalString(raw, '', 120) || title).slice(0, 120).replace(/-+$/g, '');
  if (!slug) badRequest('Add a URL slug using English letters and numbers');
  return slug;
}
function handleUnique(err: unknown): never {
  if (/UNIQUE/i.test(err instanceof Error ? err.message : '')) conflict('That landing page URL is already in use');
  throw err;
}

adminLandingPages.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, title, published, created_at, updated_at
       FROM landing_pages ORDER BY updated_at DESC, id DESC`,
  ).all();
  return c.json({ pages: results ?? [] });
});

adminLandingPages.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) notFound('Landing page not found');
  const row = await c.env.DB.prepare('SELECT * FROM landing_pages WHERE id = ?').bind(id).first<{
    id: number; slug: string; title: string; content_json: string; published: number;
    created_at: number; updated_at: number;
  }>();
  if (!row) notFound('Landing page not found');
  let content: unknown;
  try { content = JSON.parse(row.content_json); } catch { content = {}; }
  return c.json({ page: { id: row.id, slug: row.slug, title: row.title, content, published: row.published, created_at: row.created_at, updated_at: row.updated_at } });
});

adminLandingPages.post('/', async (c) => {
  const body = await readJson(c);
  const title = requireString(body.title, 'title', 160);
  const slug = makeSlug(body.slug, title);
  const content = contentString(body.content);
  const published = body.published === true || body.published === 1 ? 1 : 0;
  try {
    const row = await c.env.DB.prepare(
      `INSERT INTO landing_pages (slug, title, content_json, published)
       VALUES (?, ?, ?, ?) RETURNING id`,
    ).bind(slug, title, content, published).first<{ id: number }>();
    await audit(c.env, c.get('admin').username, 'landing_page.create', 'landing_page', row!.id, title);
    return c.json({ ok: true, id: row!.id, slug }, 201);
  } catch (err) { handleUnique(err); }
});

adminLandingPages.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) notFound('Landing page not found');
  const body = await readJson(c);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (body.title !== undefined) { sets.push('title = ?'); binds.push(requireString(body.title, 'title', 160)); }
  if (body.slug !== undefined) {
    const title = typeof body.title === 'string' ? body.title : (await c.env.DB.prepare('SELECT title FROM landing_pages WHERE id = ?').bind(id).first<{ title: string }>())?.title;
    if (!title) notFound('Landing page not found');
    sets.push('slug = ?'); binds.push(makeSlug(body.slug, title));
  }
  if (body.content !== undefined) { sets.push('content_json = ?'); binds.push(contentString(body.content)); }
  if (body.published !== undefined) { sets.push('published = ?'); binds.push(body.published === true || body.published === 1 ? 1 : 0); }
  if (!sets.length) badRequest('Nothing to update');
  sets.push("updated_at = strftime('%s','now')");
  try {
    const result = await c.env.DB.prepare(`UPDATE landing_pages SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run();
    if (!result.meta.changes) notFound('Landing page not found');
  } catch (err) { handleUnique(err); }
  await audit(c.env, c.get('admin').username, 'landing_page.update', 'landing_page', id);
  return c.json({ ok: true });
});

adminLandingPages.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) notFound('Landing page not found');
  const result = await c.env.DB.prepare('DELETE FROM landing_pages WHERE id = ?').bind(id).run();
  if (!result.meta.changes) notFound('Landing page not found');
  await audit(c.env, c.get('admin').username, 'landing_page.delete', 'landing_page', id);
  return c.json({ ok: true });
});
