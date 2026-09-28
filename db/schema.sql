CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  source VARCHAR(10) NOT NULL CHECK (source IN ('BPK','ITJEN')),
  category VARCHAR(100) NOT NULL,
  lha_number VARCHAR(150) NOT NULL,
  lha_date DATE NOT NULL,
  recommendation_count INTEGER NOT NULL DEFAULT 1 CHECK (recommendation_count > 0),
  follow_up_status VARCHAR(30) NOT NULL CHECK (follow_up_status IN ('BELUM_TL','BELUM_TUNTAS','SUDAH_TUNTAS')),
  saldo_status VARCHAR(30) NOT NULL CHECK (saldo_status IN ('MASUK_SALDO','BELUM_SALDO','TIDAK_RELEVAN')),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recommendations_source ON recommendations(source);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(follow_up_status);
