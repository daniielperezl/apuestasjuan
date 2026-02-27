-- =============================================
-- SPORTBETS AI - Seed Data (MySQL)
-- =============================================

INSERT INTO equipos (id, nombre, nombre_corto, deporte, pais, logo_url, liga_principal) VALUES
('fc-barcelona', 'FC Barcelona', 'BAR', 'football', 'Spain', 'https://api.sofascore.app/api/v1/team/2817/image', 'La Liga'),
('real-madrid', 'Real Madrid', 'RMA', 'football', 'Spain', 'https://api.sofascore.app/api/v1/team/2829/image', 'La Liga'),
('manchester-city', 'Manchester City', 'MCI', 'football', 'England', 'https://api.sofascore.app/api/v1/team/17/image', 'Premier League'),
('manchester-united', 'Manchester United', 'MNU', 'football', 'England', 'https://api.sofascore.app/api/v1/team/35/image', 'Premier League'),
('paris-sg', 'Paris Saint-Germain', 'PSG', 'football', 'France', 'https://api.sofascore.app/api/v1/team/1644/image', 'Ligue 1'),
('chelsea', 'Chelsea', 'CHE', 'football', 'England', 'https://api.sofascore.app/api/v1/team/38/image', 'Premier League'),
('arsenal', 'Arsenal', 'ARS', 'football', 'England', 'https://api.sofascore.app/api/v1/team/42/image', 'Premier League'),
('liverpool', 'Liverpool', 'LIV', 'football', 'England', 'https://api.sofascore.app/api/v1/team/44/image', 'Premier League'),
('juventus', 'Juventus', 'JUV', 'football', 'Italy', 'https://api.sofascore.app/api/v1/team/2687/image', 'Serie A'),
('inter-milan', 'Inter Milan', 'INT', 'football', 'Italy', 'https://api.sofascore.app/api/v1/team/2697/image', 'Serie A'),
('lakers', 'Los Angeles Lakers', 'LAL', 'basketball', 'USA', '', 'NBA'),
('warriors', 'Golden State Warriors', 'GSW', 'basketball', 'USA', '', 'NBA'),
('heat', 'Miami Heat', 'MIA', 'basketball', 'USA', '', 'NBA'),
('celtics', 'Boston Celtics', 'BOS', 'basketball', 'USA', '', 'NBA')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO config_sistema (clave, valor, tipo) VALUES
('version', '1.0.0', 'string'),
('installed_at', NOW(), 'datetime')
ON DUPLICATE KEY UPDATE valor=VALUES(valor);
