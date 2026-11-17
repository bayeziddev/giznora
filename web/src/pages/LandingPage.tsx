import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api';
import { setDirectBuy, useToast } from '../lib/store';
import { useSeo } from '../lib/seo';

type Section = { title?: string; body?: string; image?: string; alt?: string };
type CampaignContent = {
  eyebrow?: string; headline?: string; summary?: string; heroImage?: string; heroAlt?: string;
  productName?: string; price?: string; oldPrice?: string; benefits?: string[];
  offerEndsAt?: string; ctaLabel?: string; ctaUrl?: string; sections?: Section[];
  productSlug?: string;
};
type Campaign = { slug: string; title: string; content: CampaignContent };
function safeDestination(value?: string) {
  const url = (value || '/checkout').trim();
  return url.startsWith('/') || /^https:\/\//i.test(url) ? url : '/checkout';
}
function useCountdown(target?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target || Date.parse(target) <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  const remaining = target ? Math.max(0, Math.floor((Date.parse(target) - now) / 1000)) : 0;
  return target && remaining > 0 ? {
    days: Math.floor(remaining / 86400), hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60), seconds: remaining % 60,
  } : null;
}
const pad = (value: number) => String(value).padStart(2, '0');

export function LandingPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [failed, setFailed] = useState(false);
  const [ordering, setOrdering] = useState(false);
  useEffect(() => {
    setCampaign(null); setFailed(false); window.scrollTo({ top: 0 });
    api<{ page: Campaign }>(`/api/landing-pages/${encodeURIComponent(slug)}`)
      .then(({ page }) => setCampaign(page))
      .catch(() => setFailed(true));
  }, [slug]);
  useSeo({ title: campaign?.title || 'Campaign', description: campaign?.content.summary || undefined });
  if (failed) return <main className="lp-missing"><span>GIZNORA</span><h1>এই অফারটি পাওয়া যাচ্ছে না</h1><p>পেজটি প্রকাশিত নেই অথবা ঠিকানাটি পরিবর্তিত হয়েছে।</p><a className="lp-cta" href="/">দোকানে ফিরে যান</a></main>;
  if (!campaign) return <main className="lp-loading" aria-label="পেজ লোড হচ্ছে"><span className="lp-loader" /></main>;
  const c = campaign.content;
  const countdown = useCountdown(c.offerEndsAt);
  const destination = safeDestination(c.ctaUrl);
  const label = c.ctaLabel || 'অর্ডার করুন';
  async function orderNow() {
    if (!c.productSlug || ordering) return;
    setOrdering(true);
    try {
      const result = await api<{ product: { id: number; name: string; slug: string; image_url: string; category?: { slug: string } | null; moq: number } }>(`/api/products/${encodeURIComponent(c.productSlug)}`);
      const product = result.product;
      setDirectBuy({ product_id: product.id, qty: product.moq, name: product.name, slug: product.slug, image_url: product.image_url, category: product.category?.slug ?? null });
      navigate('/checkout');
    } catch {
      toast('পণ্যটি এখন অর্ডার করা যাচ্ছে না। পণ্যের পেজে গিয়ে বিস্তারিত দেখুন।', 'error');
      navigate(`/product/${encodeURIComponent(c.productSlug)}`);
    } finally { setOrdering(false); }
  }
  const cta = c.productSlug
    ? <button className="lp-cta" type="button" onClick={() => void orderNow()} disabled={ordering}>{ordering ? 'লোড হচ্ছে…' : label}<span aria-hidden="true"> →</span></button>
    : <a className="lp-cta" href={destination}>{label}<span aria-hidden="true"> →</span></a>;
  return (
    <main className="lp-campaign">
      <div className="lp-announcement">{c.eyebrow || 'বিশেষ অফার'} <span aria-hidden="true">✦</span> আজই অর্ডার করুন</div>
      <header className="lp-brandbar"><a href="/" className="lp-wordmark" aria-label="Giznora হোম">GIZNORA<span>.</span></a><span className="lp-brand-note">বিশ্বস্ত অনলাইন শপ</span></header>
      <article className="lp-content">
        <section className="lp-hero">
          <div className="lp-copy">
            {c.eyebrow && <span className="lp-kicker">{c.eyebrow}</span>}
            <h1>{c.headline || campaign.title}</h1>
            {c.summary && <p className="lp-summary">{c.summary}</p>}
            {c.productName && <p className="lp-product-name">{c.productName}</p>}
            {(c.price || c.oldPrice) && <div className="lp-price-row">{c.price && <strong>৳ {c.price}</strong>}{c.oldPrice && <del>৳ {c.oldPrice}</del>}</div>}
          </div>
          {c.heroImage && <figure className="lp-hero-image"><img src={mediaUrl(c.heroImage)} alt={c.heroAlt || c.productName || campaign.title} width="1200" height="900" fetchPriority="high" decoding="async" /></figure>}
          {countdown && <div className="lp-countdown" role="timer" aria-label="অফার শেষ হতে বাকি সময়"><span className="lp-countdown-label">অফার শেষ হতে বাকি</span><div>{countdown.days > 0 && <strong><b>{countdown.days}</b><small>দিন</small></strong>}<strong><b>{pad(countdown.hours)}</b><small>ঘণ্টা</small></strong><strong><b>{pad(countdown.minutes)}</b><small>মিনিট</small></strong><strong><b>{pad(countdown.seconds)}</b><small>সেকেন্ড</small></strong></div></div>}
          <div className="lp-primary-cta">{cta}</div>
          <p className="lp-reassurance">নিরাপদ অর্ডার · দ্রুত ডেলিভারি · সহায়তা পাবেন</p>
        </section>
        {c.benefits?.some((item) => item.trim()) && <section className="lp-benefits"><h2>কেন এই প্রোডাক্টটি বেছে নেবেন?</h2><ul>{c.benefits.filter((item) => item.trim()).map((item, index) => <li key={`${index}-${item}`}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>}
        {c.sections?.map((section, index) => <section className="lp-detail" key={`${index}-${section.title || ''}`}>{section.image && <img src={mediaUrl(section.image)} alt={section.alt || section.title || campaign.title} loading="lazy" decoding="async" width="1200" height="800" />}<div>{section.title && <h2>{section.title}</h2>}{section.body && <p>{section.body}</p>}</div></section>)}
        <section className="lp-final-offer"><span>GIZNORA EXCLUSIVE</span><h2>{c.productName || campaign.title}</h2>{c.price && <p>আজকের অফার মূল্য <strong>৳ {c.price}</strong>{c.oldPrice && <del>৳ {c.oldPrice}</del>}</p>}{cta}</section>
      </article>
      <footer className="lp-footer"><a href="/" className="lp-wordmark">GIZNORA<span>.</span></a><p>প্রতিটি অর্ডারে পাশে আছি।</p><a href="/">মূল ওয়েবসাইট</a></footer>
      <div className="lp-sticky"><span>{c.price ? <>অফার মূল্য <strong>৳ {c.price}</strong></> : 'আজই অর্ডার করুন'}</span>{cta}</div>
    </main>
  );
}
