CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_start INT NOT NULL,
  year_end INT NOT NULL,
  prediction_json JSONB NOT NULL,
  model_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year_start, year_end)
);
