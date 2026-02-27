# SportBets AI - Instalador Web para cPanel

## 🚀 Instalación en 5 Minutos

Este instalador **web automático** genera todas las contraseñas y configura todo por ti. No necesitas tocar línea de código.

---

## Paso 1: Preparar en cPanel

### 1.1 Crear Base de Datos MySQL

En **cPanel → MySQL Databases:**

1. **Nueva base de datos:**
   - Nombre: `usuario_sportbets` (tu usuario de cPanel + nombre)
   - Crear BD

2. **Nuevo usuario MySQL:**
   - Usuario: `usuario_sportdb`
   - Contraseña: (generar contraseña fuerte)
   - Crear usuario

3. **Asignar privilegios:**
   - Usuario: `usuario_sportdb`
   - Base de datos: `usuario_sportbets`
   - ✓ Marcar todos los privilegios (ALL)
   - Crear usuario

**Guarda estos datos — los necesitarás en el instalador:**
```
Host: localhost
Usuario: usuario_sportdb
Contraseña: (la que generaste)
BD: usuario_sportbets
```

### 1.2 Habilitar Node.js

En **cPanel → Setup Node.js App:**
- Solo verifica que esté disponible
- El instalador creará la app automáticamente

### 1.3 Obtener APIs (5 minutos)

#### ✅ API de IA (Claude - RECOMENDADO)
1. Ir a [console.anthropic.com](https://console.anthropic.com)
2. Crear cuenta
3. Copiar tu **API Key** (comienza con `sk-`)
4. El plan gratuito incluye $5/mes crédito

#### ✅ API de Deportes (RapidAPI)
1. Ir a [rapidapi.com](https://rapidapi.com)
2. Buscar: "API-Football"
3. Suscribirse al plan **BASIC** (gratuito)
4. Copiar tu **X-RapidAPI-Key**

**Costo:** Gratis (100 requests/día es suficiente)

---

## Paso 2: Descargar el Instalador

### Opción A: Vía SSH (recomendado)

```bash
# Conectarse por SSH
ssh usuario@tudominio.com

# Ir al home
cd ~

# Descargar proyecto
git clone https://github.com/tu-usuario/apuestasjuan.git
# O si no tienes git:
wget https://link-del-proyecto/sportbets.zip
unzip sportbets.zip
```

### Opción B: Vía Administrador de Archivos

1. Descargar el proyecto en ZIP
2. En cPanel → File Manager
3. Navegar a `/home/usuario/`
4. Subir `sportbets.zip`
5. Click derecho → Extract

---

## Paso 3: Ejecutar el Instalador Web

### Por SSH:

```bash
cd ~/sportbets/installer

# Instalar dependencias del instalador
npm install

# Ejecutar
node installer-web.js
```

**Verás:**
```
🚀 SportBets Installer disponible en http://localhost:3001
📍 En tu cPanel accede a tu dominio en la ruta: /installer
```

### En el navegador:

Abre: **`http://tudominio.com:3001`** (o el puerto que te indique)

O si tienes cPanel configurado, accede vía SSH tunnel:
```bash
ssh -L 3001:localhost:3001 usuario@tudominio.com
# Luego abre http://localhost:3001
```

---

## Paso 4: Completar el Wizard

### Pantalla 1: Verificar Requisitos

Ingresa tus credenciales MySQL:
- Host: `localhost`
- Usuario: `usuario_sportdb`
- Contraseña: (la que creaste)
- Base de datos: `usuario_sportbets`

Haz clic **"Verificar Requisitos"**

### Pantalla 2: Configuración del Sistema

- **Dominio:** `tudominio.com` (sin https://)
- **Email Admin:** `admin@tudominio.com`

**Proveedor IA:** Selecciona Claude (recomendado)
- **API Key Claude:** Pega tu `sk-...`

**API Deportes:**
- **API Key RapidAPI:** Pega tu key

**Email (SMTP):**
- Host: `smtp.gmail.com`
- Usuario: `tu@gmail.com`
- Contraseña: (si es Gmail, usa contraseña de app)

Haz clic **"Generar Configuración"**

### Pantalla 3: Crear Base de Datos

Se crearán automáticamente todas las tablas.

Haz clic **"Crear Base de Datos"**

### Pantalla 4: Admin e Instalar

Ingresa una **contraseña fuerte** para el admin:
- Mínimo 12 caracteres
- Mayúsculas, números, símbolos

Haz clic **"Crear Admin e Instalar"**

(Esto toma 2-3 minutos)

### Pantalla 5: ¡Completado!

Se muestra tu URL de acceso y se **elimina automáticamente** el instalador.

---

## Paso 5: Configurar en cPanel

### Crear Node.js App

En **cPanel → Setup Node.js App:**

1. **Create Application:**
   - Node.js version: **20.x**
   - Application root: `/home/usuario/sportbets/backend`
   - Application URL: `tudominio.com` (o subdominio)
   - Startup file: `server.js`
   - Modo: Production

2. Click **"Create"**

3. Click **"Run NPM Install"** (espera a que termine)

### Crear subdominio para el frontend (opcional)

En **cPanel → Addon Domains o Subdomains:**

- Subdominio: `app`
- Document Root: `/home/usuario/sportbets/frontend/build`

Luego crear archivo `.htaccess` en esa carpeta:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
</IfModule>
```

---

## Paso 6: SSL y DNS

### SSL (Automático)

En **cPanel → SSL/TLS:**
- AutoSSL se encarga automáticamente

### DNS (si es necesario)

En **cPanel → Zone Editor:**
```
Subdominio  Tipo   Apunta a
app         CNAME  tudominio.com
```

---

## ✅ Verificar que Funciona

```bash
# Por SSH
curl https://tudominio.com/api/v1/health

# En el navegador
https://tudominio.com/api/v1/health
```

Debe responder:
```json
{"status":"OK","bogotaTime":"..."}
```

---

## 📍 Acceso del Usuario

| Ruta | URL |
|------|-----|
| **Portal Principal** | `https://tudominio.com` |
| **API Backend** | `https://tudominio.com/api/v1` |
| **WebSocket** | `wss://tudominio.com/socket.io` |
| **Admin Panel** | `https://tudominio.com/admin` |

**Credenciales:**
- Email: El que ingresaste en el instalador
- Contraseña: La que creaste

---

## ❌ Solucionar Problemas

### Error "Base de Datos no accesible"

```bash
# Verificar credenciales
mysql -h localhost -u usuario_sportdb -p -e "SELECT 1;" usuario_sportbets
```

### App Node.js no inicia

En **cPanel → Setup Node.js App → tu app:**
- Click en **"Restart"**
- Ver logs: Click en **"Logs"**

### Instalador no se ve

```bash
# Verificar que instalador está corriendo
ps aux | grep node

# Reiniciar manualmente
cd ~/sportbets/installer && node installer-web.js
```

---

## 🔄 Mantenimiento

### Ver logs

```bash
# Por SSH
tail -f ~/sportbets/backend/logs/combined.log
```

O en cPanel → Setup Node.js App → Logs

### Actualizar código

```bash
cd ~/sportbets
git pull origin main
cd backend && npm install --production
cd ../frontend && npm run build
```

Luego en cPanel → Setup Node.js App → **Restart**

### Backup manual

```bash
# Base de datos
mysqldump -u usuario_sportdb -p usuario_sportbets > backup-$(date +%Y%m%d).sql

# Archivos
tar -czf sportbets-backup-$(date +%Y%m%d).tar.gz ~/sportbets
```

---

## 📞 Soporte

**Error común: "Port already in use"**
```bash
# Cambiar puerto en .env
PORT=3000  # Cambiar a otro número si está en uso
```

**MySQL dice "Too many connections"**
- Reiniciar MySQL en cPanel
- O aumentar límite en configuración MySQL de cPanel

---

¡Tu SportBets AI Portal está listo! 🎉

Accede a `https://tudominio.com` e inicia sesión.
