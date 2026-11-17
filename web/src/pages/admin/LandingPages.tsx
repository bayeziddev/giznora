import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, mediaUrl, uploadImage } from '../../lib/api';
import { useToast } from '../../lib/store';
import { Empty, Spinner } from '../../components/ui';
import type { Product } from '../../lib/types';

type CampaignSection = { title: string; body: string; image: string; alt: string };
type CampaignContent = {
  eyebrow: string; headline: string; summary: string; heroImage: string; heroAlt: string;
  productName: string; price: string; oldPrice: string; benefits: string[];
  offerEndsAt: string; ctaLabel: string; ctaUrl: string; sections: CampaignSection[];
  productSlug: string;
};
type LandingPageRow = { id: number; slug: string; title: string; published: number; created_at: number; updated_at: number };
type LandingPage = LandingPageRow & { content: CampaignContent };
const blankContent = (): CampaignContent => ({
  eyebrow: 'বিশেষ অফার', headline: '', summary: '', heroImage: '', heroAlt: '', productName: '',
  price: '', oldPrice: '', benefits: [''], offerEndsAt: '', ctaLabel: 'অর্ডার করুন', ctaUrl: '/checkout', sections: [], productSlug: '',
});
const slugify = (value: string) => value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Shrink large camera images before sending them to the existing 5 MB R2 upload endpoint. */
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size < 700_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }) : file;
  } catch { return file; }
}

export function LandingPages() {
  const toast = useToast();
  const [pages, setPages] = useState<LandingPageRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api<{ pages: LandingPageRow[] }>('/api/admin/landing-pages', { auth: true })
      .then((result) => { setPages(result.pages); setError(''); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ products: Product[] }>('/api/products?limit=100')
      .then((result) => setProducts(result.products))
      .catch(() => setProducts([]));
  }, []);

  function createPage() {
    setEditing({ id: 0, slug: '', title: '', published: 0, created_at: 0, updated_at: 0, content: blankContent() });
  }
  async function editPage(id: number) {
    try {
      const result = await api<{ page: LandingPage }>(`/api/admin/landing-pages/${id}`, { auth: true });
      const content = { ...blankContent(), ...result.page.content };
      setEditing({ ...result.page, content });
    } catch (err) { toast(err instanceof ApiError ? err.message : 'পৃষ্ঠা খোলা যায়নি', 'error'); }
  }
  function update<K extends keyof CampaignContent>(key: K, value: CampaignContent[K]) {
    setEditing((current) => current ? { ...current, content: { ...current.content, [key]: value } } : current);
  }
  async function imageChanged(event: ChangeEvent<HTMLInputElement>, key: 'heroImage' | 'section') {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editing) return;
    const token = key === 'heroImage' ? 'hero' : 'section';
    setUploading(token);
    try {
      const optimized = await optimizeImage(file);
      const uploaded = await uploadImage(optimized);
      if (key === 'heroImage') update('heroImage', uploaded.url);
      else update('sections', [...editing.content.sections, { title: '', body: '', image: uploaded.url, alt: file.name.replace(/\.[^.]+$/, '') }]);
      toast('ছবি আপলোড হয়েছে', 'success');
    } catch (err) { toast(err instanceof ApiError ? err.message : 'ছবি আপলোড হয়নি', 'error'); }
    finally { setUploading(''); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const payload = { title: editing.title.trim(), slug: editing.slug || slugify(editing.title), published: Boolean(editing.published), content: editing.content };
    if (!payload.title || !payload.slug) { toast('শিরোনাম ও URL slug দিন', 'error'); return; }
    setSaving(true);
    try {
      const result = editing.id
        ? await api<{ ok: boolean }>(`/api/admin/landing-pages/${editing.id}`, { method: 'PATCH', auth: true, body: payload })
        : await api<{ id: number; slug: string }>('/api/admin/landing-pages', { method: 'POST', auth: true, body: payload });
      toast(editing.id ? 'পরিবর্তন সেভ হয়েছে' : 'নতুন landing page তৈরি হয়েছে', 'success');
      setEditing(null);
      load();
      void result;
    } catch (err) { toast(err instanceof ApiError ? err.message : 'সেভ করা যায়নি', 'error'); }
    finally { setSaving(false); }
  }
  async function togglePublish(page: LandingPageRow) {
    try {
      await api(`/api/admin/landing-pages/${page.id}`, { method: 'PATCH', auth: true, body: { published: !page.published } });
      toast(page.published ? 'Draft করা হয়েছে' : 'Landing page প্রকাশিত হয়েছে', 'success');
      load();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'স্ট্যাটাস বদলানো যায়নি', 'error'); }
  }
  async function deletePage(page: LandingPageRow) {
    if (!window.confirm(`“${page.title}” স্থায়ীভাবে মুছে ফেলবেন?`)) return;
    try {
      await api(`/api/admin/landing-pages/${page.id}`, { method: 'DELETE', auth: true });
      toast('Landing page মুছে ফেলা হয়েছে', 'success'); load();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'মুছতে পারেনি', 'error'); }
  }

  if (loading && !pages.length && !editing) return <Spinner />;
  return (
    <main className="page admin-landing-pages">
      <header className="page-header landing-admin-heading">
        <div><p className="eyebrow">CAMPAIGN STUDIO</p><h1>Landing pages</h1><p className="muted">বিজ্ঞাপন থেকে সরাসরি অর্ডারের জন্য দ্রুত, মোবাইল-ফার্স্ট পেজ তৈরি করুন।</p></div>
        {!editing && <button className="btn primary" onClick={createPage}>＋ নতুন পেজ</button>}
      </header>
      {error && <div className="alert error">{error}</div>}
      {editing ? (
        <form className="lp-editor" onSubmit={save}>
          <div className="lp-editor-top"><div><p className="eyebrow">{editing.id ? 'EDIT CAMPAIGN' : 'NEW CAMPAIGN'}</p><h2>{editing.id ? 'পেজ সম্পাদনা' : 'নতুন landing page'}</h2></div><button type="button" className="btn ghost" onClick={() => setEditing(null)}>বন্ধ করুন</button></div>
          <section className="panel lp-form-card"><div className="panel-body stack gap-16">
            <h3>১. পেজ পরিচিতি</h3>
            <label className="field"><span>পেজের নাম</span><input className="input" required maxLength={160} value={editing.title} onChange={(e) => { const title = e.target.value; setEditing((p) => p ? { ...p, title, slug: p.slug || slugify(title) || `campaign-${Date.now().toString(36)}` } : p); }} placeholder="যেমন: Eid Special Offer" /></label>
            <label className="field"><span>শেয়ার করার URL</span><div className="lp-slug-field"><span>/lp/</span><input className="input" required maxLength={80} value={editing.slug} onChange={(e) => setEditing((p) => p ? { ...p, slug: slugify(e.target.value) } : p)} placeholder="eid-special-offer" /></div></label>
            <label className="field"><span>ক্যাম্পেইন ব্যাজ</span><input className="input" value={editing.content.eyebrow} onChange={(e) => update('eyebrow', e.target.value)} placeholder="সীমিত সময়ের অফার" /></label>
            <label className="field"><span>প্রধান শিরোনাম</span><input className="input" maxLength={180} value={editing.content.headline} onChange={(e) => update('headline', e.target.value)} placeholder="আপনার পণ্যের সবচেয়ে গুরুত্বপূর্ণ সুবিধা" /></label>
            <label className="field"><span>সংক্ষিপ্ত বর্ণনা</span><textarea className="textarea" rows={3} maxLength={1200} value={editing.content.summary} onChange={(e) => update('summary', e.target.value)} placeholder="পণ্যটি কেন কাজে লাগবে—সংক্ষেপে লিখুন" /></label>
          </div></section>
          <section className="panel lp-form-card"><div className="panel-body stack gap-16">
            <h3>২. প্রোডাক্ট ও দ্রুত লোড হওয়া ছবি</h3>
            <label className="field"><span>দোকানের প্রোডাক্ট (অর্ডার বাটনে সরাসরি checkout)</span><select className="input" value={editing.content.productSlug} onChange={(e) => { const product = products.find((item) => item.slug === e.target.value); update('productSlug', e.target.value); if (product) { if (!editing.content.productName) update('productName', product.name); if (!editing.content.heroImage) { update('heroImage', product.image_url); update('heroAlt', product.name); } if (!editing.content.price) update('price', String(product.price / 100)); } }}><option value="">পণ্য নির্বাচন না করে নিজস্ব URL ব্যবহার করুন</option>{products.map((product) => <option key={product.id} value={product.slug} disabled={!product.in_stock}>{product.name}{product.in_stock ? '' : ' — স্টক নেই'}</option>)}</select><small className="muted">পণ্য বাছলে CTA-তে ক্লিক করলে সেই পণ্য সরাসরি Giznora checkout-এ যাবে। পণ্য না বাছলে নিচের CTA URL ব্যবহার হবে।</small></label>
            <label className="field"><span>প্রোডাক্টের নাম</span><input className="input" maxLength={160} value={editing.content.productName} onChange={(e) => update('productName', e.target.value)} /></label>
            <div className="lp-two-fields"><label className="field"><span>অফার মূল্য (৳)</span><input className="input" inputMode="decimal" value={editing.content.price} onChange={(e) => update('price', e.target.value)} placeholder="1,490" /></label><label className="field"><span>আগের মূল্য (ঐচ্ছিক)</span><input className="input" inputMode="decimal" value={editing.content.oldPrice} onChange={(e) => update('oldPrice', e.target.value)} placeholder="1,990" /></label></div>
            <label className="field"><span>প্রধান প্রোডাক্ট ছবি</span><input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(uploading)} onChange={(e) => void imageChanged(e, 'heroImage')} /><small className="muted">ছবি ১,৮০০px-এর মধ্যে WebP-তে কম্প্রেস হয়, দ্রুত দেখানোর জন্য। {uploading === 'hero' ? 'আপলোড হচ্ছে…' : ''}</small></label>
            <label className="field"><span>অথবা ছবির URL দিন</span><input className="input" type="url" value={editing.content.heroImage} onChange={(e) => update('heroImage', e.target.value)} placeholder="https://... অথবা /files/..." /></label>
            <label className="field"><span>ছবির বর্ণনা (alt text)</span><input className="input" value={editing.content.heroAlt} onChange={(e) => update('heroAlt', e.target.value)} placeholder="প্রোডাক্টের ছবি" /></label>
            {editing.content.heroImage && <img className="lp-upload-preview" src={mediaUrl(editing.content.heroImage)} alt={editing.content.heroAlt || editing.content.productName || 'প্রোডাক্ট প্রিভিউ'} />}
            <label className="field"><span>মূল সুবিধাগুলো — প্রতি লাইনে একটি</span><textarea className="textarea" rows={4} value={editing.content.benefits.join('\n')} onChange={(e) => update('benefits', e.target.value.split('\n').slice(0, 12))} placeholder={'দ্রুত ব্যবহার করা যায়\nগুণগত মানে নিশ্চিন্ত\nসারা দেশে ডেলিভারি'} /></label>
          </div></section>
          <section className="panel lp-form-card"><div className="panel-body stack gap-16">
            <h3>৩. অফার টাইমিং ও অর্ডার বাটন</h3>
            <label className="field"><span>অফারের শেষ সময় (ঐচ্ছিক)</span><input className="input" type="datetime-local" value={editing.content.offerEndsAt ? editing.content.offerEndsAt.slice(0, 16) : ''} onChange={(e) => update('offerEndsAt', e.target.value ? new Date(e.target.value).toISOString() : '')} /><small className="muted">কাউন্টডাউন প্রকৃত শেষ সময়ে থামবে; সময় না দিলে কাউন্টডাউন দেখানো হবে না।</small></label>
            <label className="field"><span>বাটনের লেখা</span><select className="input" value={editing.content.ctaLabel} onChange={(e) => update('ctaLabel', e.target.value)}><option>অর্ডার করুন</option><option>এখনই অর্ডার করুন</option><option>Order now</option><option>Shop now</option><option>এখনই কিনুন</option></select></label>
            <label className="field"><span>বাটনে ক্লিক করলে যেখানে যাবে</span><input className="input" value={editing.content.ctaUrl} onChange={(e) => update('ctaUrl', e.target.value)} placeholder="/checkout, /cart বা product URL" /><small className="muted">দোকানের ভেতরের URL (যেমন /checkout) অথবা সম্পূর্ণ https:// URL দিন।</small></label>
          </div></section>
          <section className="panel lp-form-card"><div className="panel-body stack gap-16">
            <div className="lp-editor-top"><h3>৪. অতিরিক্ত ছবি ও বিবরণ</h3><div className="row gap-8 wrap-row"><button type="button" className="btn ghost sm" onClick={() => update('sections', [...editing.content.sections, { title: '', body: '', image: '', alt: '' }])}>＋ লেখা যোগ করুন</button><button type="button" className="btn ghost sm" disabled={Boolean(uploading)} onClick={() => document.getElementById('lp-extra-image')?.click()}>＋ ছবি যোগ করুন</button></div></div>
            <input id="lp-extra-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => void imageChanged(e, 'section')} />
            {!editing.content.sections.length && <p className="muted">কাস্টমারকে পণ্যের বিস্তারিত বোঝাতে আরও ছবি ও বিবরণের ব্লক যোগ করতে পারেন।</p>}
            {editing.content.sections.map((section, index) => <div className="lp-section-editor" key={`${section.image}-${index}`}>
              {section.image && <img src={mediaUrl(section.image)} alt={section.alt || ''} loading="lazy" />}
              <label className="field"><span>ছবির URL (ঐচ্ছিক)</span><input className="input" type="url" value={section.image} onChange={(e) => update('sections', editing.content.sections.map((item, i) => i === index ? { ...item, image: e.target.value } : item))} placeholder="https://... অথবা /files/..." /></label>
              <label className="field"><span>ব্লকের শিরোনাম</span><input className="input" value={section.title} onChange={(e) => update('sections', editing.content.sections.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="পণ্যের বিশেষত্ব" /></label>
              <label className="field"><span>বিস্তারিত</span><textarea className="textarea" rows={3} value={section.body} onChange={(e) => update('sections', editing.content.sections.map((item, i) => i === index ? { ...item, body: e.target.value } : item))} /></label>
              <label className="field"><span>ছবির বর্ণনা</span><input className="input" value={section.alt} onChange={(e) => update('sections', editing.content.sections.map((item, i) => i === index ? { ...item, alt: e.target.value } : item))} /></label>
              <button type="button" className="btn ghost sm" onClick={() => update('sections', editing.content.sections.filter((_, i) => i !== index))}>এই ব্লক সরান</button>
            </div>)}
            {uploading === 'section' && <p className="muted">ছবি আপলোড হচ্ছে…</p>}
          </div></section>
          <section className="panel lp-form-card"><div className="panel-body stack gap-12">
            <label className="lp-publish-toggle"><input type="checkbox" checked={Boolean(editing.published)} onChange={(e) => setEditing((p) => p ? { ...p, published: e.target.checked ? 1 : 0 } : p)} /><span><strong>প্রকাশ করুন</strong><small>Draft থাকলে পেজটি ক্রেতারা দেখতে পারবেন না।</small></span></label>
            <div className="row gap-10 wrap-row"><button className="btn primary" type="submit" disabled={saving || Boolean(uploading)}>{saving ? 'সেভ হচ্ছে…' : editing.id ? 'পরিবর্তন সেভ করুন' : 'পেজ তৈরি করুন'}</button><button className="btn ghost" type="button" onClick={() => setEditing(null)}>বাতিল</button>{editing.id > 0 && editing.published === 1 && <a className="btn ghost" href={`/lp/${editing.slug}`} target="_blank" rel="noreferrer">পেজ দেখুন ↗</a>}</div>
          </div></section>
        </form>
      ) : loading ? <Spinner /> : pages.length === 0 ? <Empty icon="📣" title="এখনও কোনো landing page নেই" hint="নতুন পেজ তৈরি করে প্রোডাক্টের ছবি, অফার ও অর্ডার বাটন সাজিয়ে নিন।" /> : (
        <div className="lp-page-list">{pages.map((page) => <article className="panel lp-page-row" key={page.id}><div className="lp-page-info"><div className="row gap-8 wrap-row"><h2>{page.title}</h2><span className={`lp-status ${page.published ? 'is-live' : ''}`}>{page.published ? 'প্রকাশিত' : 'Draft'}</span></div><a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">/lp/{page.slug} ↗</a></div><div className="row gap-8 wrap-row"><button className="btn ghost sm" onClick={() => void editPage(page.id)}>সম্পাদনা</button><button className="btn ghost sm" onClick={() => void togglePublish(page)}>{page.published ? 'Draft করুন' : 'প্রকাশ করুন'}</button><button className="btn ghost sm" onClick={() => void deletePage(page)}>মুছুন</button></div></article>)}</div>
      )}
    </main>
  );
}
