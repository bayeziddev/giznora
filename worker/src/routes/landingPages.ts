import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { notFound } from '../lib/http';

/** Public campaign pages expose only live records. */
export const landingPages = new Hono<{ Bindings: Env; Variables: Variables }>();

landingPages.get('/landing-pages/:slug', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT slug, title, content_json, updated_at FROM landing_pages
      WHERE slug = ? AND published = 1 LIMIT 1`,
  ).bind(c.req.param('slug')).first<{ slug: string; title: string; content_json: string; updated_at: number }>();
  if (!row) notFound('Landing page not found');
  let content: unknown;
  try {
    content = JSON.parse(row.content_json);
  } catch {
    notFound('Landing page content is unavailable');
  }
  return c.json({ page: { slug: row.slug, title: row.title, content, updated_at: row.updated_at } });
});
