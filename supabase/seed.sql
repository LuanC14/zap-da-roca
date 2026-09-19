-- Seed: Categorias padrão do agronegócio
INSERT INTO categories (name, type, is_default) VALUES
  ('Insumos / Adubos',     'expense', true),
  ('Combustível / Diesel', 'expense', true),
  ('Maquinário',           'expense', true),
  ('Mão de Obra',          'expense', true),
  ('Venda de Safra',       'income',  true)
ON CONFLICT DO NOTHING;
