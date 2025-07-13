# Sistema de Notificaciones - GunBound Rank API

## 📋 Tipos de Notificaciones Disponibles

### 1. 🔔 Notificaciones Manuales
**Endpoint:** `POST /api/send-notification`

Envío manual de notificaciones push a usuarios específicos.

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Título de la notificación",
  "body": "Cuerpo de la notificación"
}
```

### 2. 🏆 Notificaciones de Cambios en Ranking
**Automáticas** - Se ejecutan cada 30 minutos

Detecta y notifica:
- **Subidas de rango** en el top 10
- **Nuevos jugadores** que entran al top 10
- **Cambios significativos** en las posiciones

**Ejemplo de notificación:**
```
Título: "🏆 Cambios en el Ranking de GunBound"
Cuerpo: "¡3 jugador(es) han subido en el ranking!"
```

### 3. 📰 Notificaciones de Nuevas Noticias
**Automáticas** - Se ejecutan cada 15 minutos

Detecta y notifica cuando hay nuevas noticias en el sitio oficial de GunBound.

**Ejemplo de notificación:**
```
Título: "📰 Nuevas Noticias de GunBound"
Cuerpo: "¡2 nueva(s) noticia(s) disponible(s)!"
```

### 4. 📝 Sistema de Suscripciones
**Endpoint:** `POST /api/subscribe`

Permite a los usuarios suscribirse a diferentes tipos de notificaciones.

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "notifications": ["ranking", "news", "events"]
}
```

**Tipos de notificaciones disponibles:**
- `ranking` - Cambios en el ranking
- `news` - Nuevas noticias
- `events` - Eventos especiales (futuro)

## 🔧 Endpoints de Control

### Estado del Sistema
**GET** `/api/status`
```json
{
  "status": "running",
  "lastRankingCheck": "completed",
  "lastNewsCheck": "completed",
  "rankingPlayers": 1500,
  "newsCount": 25,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Verificación Manual
**POST** `/api/check-updates`
Ejecuta inmediatamente todas las verificaciones automáticas.

### Información de Notificaciones
**GET** `/api/test-notification`
Proporciona información sobre cómo usar el sistema de notificaciones.

## ⏰ Programación Automática

- **Ranking:** Verificación cada 30 minutos
- **Noticias:** Verificación cada 15 minutos
- **Verificación inicial:** 5 segundos después del inicio del servidor

## 🚀 Cómo Usar

### 1. Iniciar el servidor
```bash
npm start
```

### 2. Suscribir usuarios
```bash
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "ExponentPushToken[tu-token]",
    "notifications": ["ranking", "news"]
  }'
```

### 3. Verificar estado
```bash
curl http://localhost:3000/api/status
```

### 4. Ejecutar verificación manual
```bash
curl -X POST http://localhost:3000/api/check-updates
```

## 📱 Requisitos para Notificaciones Push

1. **Token de Expo válido** con formato: `ExponentPushToken[...]`
2. **App móvil configurada** para recibir notificaciones push
3. **Permisos de notificaciones** habilitados en el dispositivo

## 🔮 Próximas Funcionalidades

- [ ] Notificaciones de eventos especiales
- [ ] Notificaciones personalizadas por usuario
- [ ] Sistema de prioridades de notificaciones
- [ ] Almacenamiento persistente de suscripciones
- [ ] Estadísticas de entrega de notificaciones
- [ ] Notificaciones de mantenimiento del servidor

## ⚠️ Notas Importantes

- Las notificaciones automáticas requieren usuarios suscritos para funcionar
- El sistema actual usa almacenamiento en memoria (se reinicia al reiniciar el servidor)
- Para producción, se recomienda implementar una base de datos para las suscripciones
- Los tokens de Expo pueden expirar, se recomienda validación periódica 