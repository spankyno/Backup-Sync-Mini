# Exponer la API con TLS vía Cloudflare Tunnel

La API (`apps/api`) sigue corriendo en tu Docker/VPS, pero necesita ser
alcanzable con HTTPS/WSS para que la Web desplegada en Cloudflare
Workers pueda hablarle (un Worker no puede llamar a `http://localhost`
ni a una IP privada). Cloudflare Tunnel resuelve esto sin abrir
puertos en el servidor ni gestionar certificados a mano.

## 1. Requisitos

- Un dominio gestionado por Cloudflare (el nameserver del dominio
  apuntando a Cloudflare). Si no tienes uno, puedes usar un subdominio
  gratuito de prueba, pero para producción se recomienda dominio propio.
- Acceso al [dashboard de Cloudflare](https://dash.cloudflare.com) →
  **Zero Trust** → **Networks** → **Tunnels**.

## 2. Crear el túnel (dashboard)

1. Zero Trust → Networks → Tunnels → **Create a tunnel**.
2. Elige **Cloudflared** como conector.
3. Nombra el túnel, por ejemplo `backuphub-api`.
4. Cloudflare te da un **token** (una cadena larga). Cópialo.
5. En la sección **Public Hostname** del propio asistente, añade:
   - **Subdomain**: `api` (o el que prefieras)
   - **Domain**: tu dominio, p.ej. `backuphub.example.com`
   - **Service**: `HTTP` → `api:4000`

   (`api:4000` funciona porque `cloudflared` corre en la misma red de
   Docker Compose que el contenedor `api`, y Docker resuelve `api` por
   nombre de servicio.)
6. Guarda. Cloudflare emite automáticamente el certificado TLS para
   `api.backuphub.example.com` — no hay que tocar Let's Encrypt ni nada.

## 3. Conectar el túnel desde Docker Compose

En tu `.env`:

```bash
TUNNEL_TOKEN="el-token-que-copiaste-en-el-paso-2"
ALLOWED_ORIGINS="https://backuphub-web.<tu-subdominio>.workers.dev,https://api.backuphub.example.com"
```

Levanta el túnel (es un perfil opcional, no arranca con `docker compose up` a secas):

```bash
docker compose --profile tunnel up -d
```

Verifica en el dashboard (Zero Trust → Networks → Tunnels) que el
túnel aparece como **Healthy**.

## 4. Probar

```bash
curl https://api.backuphub.example.com/health
# {"status":"ok","service":"backuphub-api",...}
```

Y en Swagger: `https://api.backuphub.example.com/api/docs`.

## 5. Apuntar la Web a la API real

En `apps/web/wrangler.jsonc`, actualiza:

```jsonc
"vars": {
  "NEXT_PUBLIC_API_URL": "https://api.backuphub.example.com",
  "NEXT_PUBLIC_WS_URL": "wss://api.backuphub.example.com"
}
```

Y vuelve a desplegar la web: `pnpm web:cf:deploy`.

## Alternativa sin dominio propio / sin dashboard

Para desarrollo rápido sin crear un túnel nombrado, puede usarse un
túnel efímero de `cloudflared` (URL aleatoria `*.trycloudflare.com`,
válida mientras el proceso esté vivo — no apta para producción):

```bash
docker run --rm --network backuphub_default cloudflare/cloudflared:latest \
  tunnel --url http://api:4000
```

Esto imprime en el log una URL `https://algo-al-azar.trycloudflare.com`
que ya sirve TLS y reenvía a la API. Útil para probar la Web desplegada
en Cloudflare contra tu API local antes de comprometerte a un dominio.

## Notas de seguridad

- `ALLOWED_ORIGINS` en la API ya no acepta cualquier origen (`cors: true`
  se cambió a una lista explícita) — asegúrate de incluir ahí el dominio
  final de la Web cada vez que cambie.
- El túnel es solo transporte (TLS + red); la autenticación de la API
  (JWT) sigue aplicándose igual, con o sin túnel.
- Si más adelante quieres exponer también el Backup Agent de un equipo
  concreto vía túnel (modo servidor con agentes remotos), se crea un
  túnel independiente por agente — no reutilices el de la API para eso.
