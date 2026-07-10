-- Categorias
insert into categorias (id, nombre, descripcion, orden) values
  ('creatinas', 'Creatinas', 'Fuerza explosiva y recuperación muscular.', 0),
  ('proteinas', 'Proteínas', 'Construye y repara músculo de calidad.', 1),
  ('preentrenos', 'Pre-entrenos', 'Energía y enfoque para cada sesión.', 2)
on conflict (id) do nothing;

-- Productos (migrados de data.json)
insert into productos (nombre, descripcion, precio, precio_anterior, categoria_id, imagen_url, destacado, en_ofertas, orden) values
  ('Creatine Monohydrate Nutrex', 'Creatina monohidratada pura y micronizada. 300 g · 60 servicios. Fuerza y rendimiento.', 650, 790, 'creatinas', 'assets/creatina-nutrex.jpg', true, true, 0),
  ('Micronized Creatine Optimum Nutrition', 'La creatina #1 de USA. 100% monohidrato, 5 g por servicio. 300 g · 60 servicios.', 950, 1100, 'creatinas', 'assets/creatina-on.jpg', true, true, 1),
  ('Gold Standard 100% Whey', 'Optimum Nutrition. 24 g de proteína por servicio. Double Rich Chocolate · 5 lb · 74 servicios.', 1950, 2200, 'proteinas', 'assets/proteina-on.jpg', false, true, 2),
  ('100% Whey Protein Nutrex', 'Lean Muscle Shake sabor chocolate. Recuperación y crecimiento. 2 lb · 26 servicios.', 1397, null, 'proteinas', 'assets/proteina-nutrex.jpg', true, false, 3),
  ('Outrage Ultra Stim Pre-Workout', 'Nutrex. Energía intensa, bombeo y enfoque. Sabor Fruit Punch · 30 servicios.', 999, 1100, 'preentrenos', 'assets/preentreno-outrage.jpg', true, true, 4),
  ('Creatina Nutrex 200 Servings', 'Creatina que rinde, mas de 6 meses de producto de calidad!', 1450, 1600, 'creatinas', 'assets/creatina-nutrex-200-serv.jpg', false, true, 5),
  ('Pre-entreno Total War', 'Obten ese boost que tanto buscas, disponible en muchos sabores!', 1099, 1200, 'preentrenos', 'assets/total-war-tiger-blood.jpg', false, true, 6),
  ('Creatina Nutrex Pink lemonade', 'Desarrolla músculo magro y tonificado
Promueve una piel, cabello y uñas más saludables
Mejora la fuerza y ​​el rendimiento en el entrenamiento
Favorece la función cognitiva', 1267, 1399, 'creatinas', 'assets/creatina-women-pink-lemonade.jpg', false, true, 7),
  ('Creatina Nutrex Peach Mango', 'Desarrolla músculo magro y tonificado
Promueve una piel, cabello y uñas más saludables
Mejora la fuerza y ​​el rendimiento en el entrenamiento
Favorece la función cognitiva', 1267, 1399, 'creatinas', 'assets/creatina-women-peach-mango.jpg', false, true, 8),
  ('Creatina Sabor Ponche', '¿Te cuesta tomarte tu proteina? Esta creatina es la solución, con un sabor increíble y fácil de tomar.', 850, 900, 'creatinas', 'assets/creatina-nutrex-300g-sabor.jpg', false, true, 9);
