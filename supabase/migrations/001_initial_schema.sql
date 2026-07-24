-- Munafa / AI Vendor Profit Coach — initial schema
-- Run once in Supabase SQL Editor or via: supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT,
  language      TEXT DEFAULT 'hi',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID REFERENCES vendors(id),
  name          TEXT NOT NULL,
  aliases       TEXT[],
  category      TEXT,
  default_unit  TEXT DEFAULT 'kg',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID REFERENCES vendors(id) NOT NULL,
  name          TEXT NOT NULL,
  aliases       TEXT[],
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES vendors(id) NOT NULL,
  entry_type      TEXT NOT NULL,
  item_id         UUID REFERENCES items(id),
  item_name_raw   TEXT,
  quantity        NUMERIC,
  unit            TEXT,
  unit_price      NUMERIC,
  total_amount    NUMERIC NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id),
  raw_voice_text  TEXT,
  confidence      NUMERIC,
  is_resolved     BOOLEAN DEFAULT TRUE,
  logged_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES vendors(id) NOT NULL,
  date            DATE NOT NULL,
  total_expense   NUMERIC DEFAULT 0,
  total_revenue   NUMERIC DEFAULT 0,
  net_profit      NUMERIC DEFAULT 0,
  spoilage_loss   NUMERIC DEFAULT 0,
  margin_pct      NUMERIC DEFAULT 0,
  summary_text_hi TEXT,
  sent_at         TIMESTAMP,
  UNIQUE(vendor_id, date)
);

CREATE TABLE IF NOT EXISTS price_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID REFERENCES vendors(id) NOT NULL,
  item_id        UUID REFERENCES items(id) NOT NULL,
  supplier_id    UUID REFERENCES suppliers(id),
  date           DATE NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  unit           TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Seed: 30 common street vendor items (global catalogue, vendor_id = NULL)
-- ---------------------------------------------------------------------------

INSERT INTO items (vendor_id, name, aliases, category, default_unit)
SELECT NULL, v.name, v.aliases, v.category, v.default_unit
FROM (VALUES
  ('aloo',       ARRAY['aaloo', 'potato', 'batata'],              'raw_material', 'kg'),
  ('pyaaz',      ARRAY['pyaz', 'onion', 'kanda'],                 'raw_material', 'kg'),
  ('tamatar',    ARRAY['tomato'],                                 'raw_material', 'kg'),
  ('adrak',      ARRAY['ginger'],                                 'raw_material', 'kg'),
  ('lahsun',     ARRAY['garlic', 'lehsun'],                       'raw_material', 'kg'),
  ('hari mirch', ARRAY['mirch', 'green chilli'],                  'raw_material', 'kg'),
  ('tel',        ARRAY['oil', 'refined oil'],                     'raw_material', 'litre'),
  ('namak',      ARRAY['salt'],                                   'raw_material', 'kg'),
  ('jeera',      ARRAY['cumin'],                                  'raw_material', 'kg'),
  ('dhaniya',    ARRAY['coriander'],                              'raw_material', 'kg'),
  ('imli',       ARRAY['tamarind'],                               'raw_material', 'kg'),
  ('besan',      ARRAY['gram flour'],                             'raw_material', 'kg'),
  ('maida',      ARRAY['flour', 'refined flour'],                 'raw_material', 'kg'),
  ('chawal',     ARRAY['rice'],                                   'raw_material', 'kg'),
  ('dal',        ARRAY['lentil', 'daal'],                         'raw_material', 'kg'),
  ('doodh',      ARRAY['milk'],                                     'raw_material', 'litre'),
  ('chai patti', ARRAY['tea', 'tea leaves'],                      'raw_material', 'kg'),
  ('cheeni',     ARRAY['sugar', 'shakkar'],                       'raw_material', 'kg'),
  ('bread',      ARRAY['pav', 'double roti'],                     'raw_material', 'piece'),
  ('anda',       ARRAY['egg', 'eggs'],                            'raw_material', 'piece'),
  ('paneer',     ARRAY['cottage cheese'],                         'raw_material', 'kg'),
  ('ghee',       ARRAY['clarified butter'],                       'raw_material', 'kg'),
  ('lemon',      ARRAY['nimbu', 'lime'],                          'raw_material', 'piece'),
  ('pudina',     ARRAY['mint'],                                   'raw_material', 'bundle'),
  ('saunf',      ARRAY['fennel'],                                 'raw_material', 'kg'),
  ('kala namak', ARRAY['black salt'],                             'raw_material', 'kg'),
  ('amchur',     ARRAY['mango powder'],                           'raw_material', 'kg'),
  ('haldi',      ARRAY['turmeric'],                               'raw_material', 'kg'),
  ('lal mirch',  ARRAY['red chilli', 'mirch powder'],             'raw_material', 'kg'),
  ('pav',        ARRAY['bread', 'pav bun'],                       'raw_material', 'piece')
) AS v(name, aliases, category, default_unit)
WHERE NOT EXISTS (
  SELECT 1 FROM items WHERE vendor_id IS NULL AND name = v.name
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Vendor id is linked to auth.uid() on signup (Layer 2).
-- ---------------------------------------------------------------------------

ALTER TABLE vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history   ENABLE ROW LEVEL SECURITY;

-- vendors
CREATE POLICY "vendors_select_own"
  ON vendors FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "vendors_insert_own"
  ON vendors FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "vendors_update_own"
  ON vendors FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- items (global catalogue readable by all authenticated users)
CREATE POLICY "items_select_global_and_own"
  ON items FOR SELECT TO authenticated
  USING (vendor_id IS NULL OR vendor_id = auth.uid());

CREATE POLICY "items_insert_own"
  ON items FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "items_update_own"
  ON items FOR UPDATE TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- suppliers
CREATE POLICY "suppliers_all_own"
  ON suppliers FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- transactions
CREATE POLICY "transactions_all_own"
  ON transactions FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- daily_summaries
CREATE POLICY "daily_summaries_all_own"
  ON daily_summaries FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- price_history
CREATE POLICY "price_history_all_own"
  ON price_history FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());
