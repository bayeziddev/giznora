-- Giznora rebrand: update an already-provisioned database in place.
INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES
  ('store_name', 'Giznora', strftime('%s','now')),
  ('legal_name', 'GIZNORA', strftime('%s','now')),
  ('owner_name', 'Giznora', strftime('%s','now')),
  ('store_address', 'কুমিল্লা, বরুড়া, আমড়াতলী', strftime('%s','now')),
  ('support_phone', '01406180501', strftime('%s','now')),
  ('support_phone_2', '', strftime('%s','now')),
  ('whatsapp_number', '01406180501', strftime('%s','now')),
  ('support_whatsapp_url', 'https://wa.me/8801406180501', strftime('%s','now')),
  ('order_whatsapp', '8801406180501', strftime('%s','now')),
  ('support_email', '', strftime('%s','now')),
  ('facebook_url', '', strftime('%s','now')),
  ('credit_author_url', '', strftime('%s','now'));
