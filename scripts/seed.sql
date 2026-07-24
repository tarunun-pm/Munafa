-- Munafa — Database Schema
-- Run this in your Supabase SQL editor.
-- RLS is intentionally disabled for demo. Enable before production.

-- ===================
-- TABLE 1: vendors
-- ===================
CREATE TABLE IF NOT EXISTS vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT,
  gender        TEXT CHECK (gender IN ('male','female','other')),
  dob           DATE,
  language      TEXT DEFAULT 'en' CHECK (language IN ('en','hi')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===================
-- TABLE 2: items
-- ===================
CREATE TABLE IF NOT EXISTS items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  aliases       TEXT[],
  category      TEXT DEFAULT 'raw_material',
  default_unit  TEXT DEFAULT 'kg',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===================
-- TABLE 3: suppliers
-- ===================
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  aliases       TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===================
-- TABLE 4: transactions
-- ===================
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('expense','sale','spoilage')),
  item_id         UUID REFERENCES items(id),
  item_name_raw   TEXT,
  quantity        NUMERIC,
  unit            TEXT,
  unit_price      NUMERIC,
  total_amount    NUMERIC NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id),
  raw_voice_text  TEXT,
  confidence      NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  is_resolved     BOOLEAN DEFAULT TRUE,
  logged_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ===================
-- TABLE 5: daily_summaries
-- ===================
CREATE TABLE IF NOT EXISTS daily_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  date            DATE NOT NULL,
  total_expense   NUMERIC DEFAULT 0,
  total_revenue   NUMERIC DEFAULT 0,
  net_profit      NUMERIC DEFAULT 0,
  spoilage_loss   NUMERIC DEFAULT 0,
  margin_pct      NUMERIC DEFAULT 0,
  summary_text_hi TEXT,
  sent_at         TIMESTAMPTZ,
  UNIQUE(vendor_id, date)
);

-- ===================
-- TABLE 6: price_history
-- ===================
CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  item_id         UUID REFERENCES items(id) NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id),
  date            DATE NOT NULL,
  price_per_unit  NUMERIC NOT NULL,
  unit            TEXT NOT NULL
);

-- ===================
-- SEED: 30 common street vendor items (vendor_id = NULL = global)
-- ===================
INSERT INTO items (vendor_id, name, aliases, category, default_unit) VALUES
  (NULL, 'aloo',       ARRAY['aaloo','potato','batata'],          'raw_material', 'kg'),
  (NULL, 'pyaaz',      ARRAY['pyaz','onion','dungri'],            'raw_material', 'kg'),
  (NULL, 'tamatar',    ARRAY['tamaatar','tomato'],                'raw_material', 'kg'),
  (NULL, 'adrak',      ARRAY['ginger','adrakh'],                  'raw_material', 'kg'),
  (NULL, 'lahsun',     ARRAY['lahasun','garlic'],                 'raw_material', 'kg'),
  (NULL, 'hari mirch', ARRAY['green chilli','mirchi'],            'raw_material', 'kg'),
  (NULL, 'tel',        ARRAY['oil','khana tel','cooking oil'],    'raw_material', 'litre'),
  (NULL, 'namak',      ARRAY['salt'],                            'raw_material', 'kg'),
  (NULL, 'jeera',      ARRAY['cumin','zeera'],                    'raw_material', 'kg'),
  (NULL, 'dhaniya',    ARRAY['coriander','dhania'],               'raw_material', 'kg'),
  (NULL, 'imli',       ARRAY['tamarind'],                        'raw_material', 'kg'),
  (NULL, 'besan',      ARRAY['gram flour','chana atta'],          'raw_material', 'kg'),
  (NULL, 'maida',      ARRAY['refined flour','white flour'],      'raw_material', 'kg'),
  (NULL, 'chawal',     ARRAY['rice','chaawal'],                   'raw_material', 'kg'),
  (NULL, 'dal',        ARRAY['lentil','daal'],                    'raw_material', 'kg'),
  (NULL, 'doodh',      ARRAY['milk','dudh'],                      'raw_material', 'litre'),
  (NULL, 'chai patti', ARRAY['tea','chai','tea leaves'],          'raw_material', 'kg'),
  (NULL, 'cheeni',     ARRAY['sugar','shakkar'],                  'raw_material', 'kg'),
  (NULL, 'bread',      ARRAY['pav bread','sliced bread'],         'raw_material', 'piece'),
  (NULL, 'anda',       ARRAY['egg','anday'],                      'raw_material', 'piece'),
  (NULL, 'paneer',     ARRAY['cottage cheese'],                   'raw_material', 'kg'),
  (NULL, 'ghee',       ARRAY['clarified butter','desi ghee'],     'raw_material', 'kg'),
  (NULL, 'lemon',      ARRAY['nimbu','nimboo'],                   'raw_material', 'piece'),
  (NULL, 'pudina',     ARRAY['mint','mint leaves'],               'raw_material', 'bundle'),
  (NULL, 'saunf',      ARRAY['fennel','anise'],                   'raw_material', 'kg'),
  (NULL, 'kala namak', ARRAY['black salt','rock salt'],           'raw_material', 'kg'),
  (NULL, 'amchur',     ARRAY['mango powder','dry mango'],         'raw_material', 'kg'),
  (NULL, 'haldi',      ARRAY['turmeric','turmeric powder'],       'raw_material', 'kg'),
  (NULL, 'lal mirch',  ARRAY['red chilli','red pepper'],          'raw_material', 'kg'),
  (NULL, 'pav',        ARRAY['bun','dinner roll'],                'raw_material', 'piece')
ON CONFLICT DO NOTHING;
