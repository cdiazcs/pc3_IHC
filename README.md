# 🌱 AgroVoz — PC3 (CC451)

**Curso:** Interacción Humano-Computador  
**Universidad:** Universidad Nacional de Ingeniería  
**Ciclo:** 2026-II  
**Integrantes:** Enoc Rosales, Maurizio Berdiales y Cristian Díaz

## 1. Descripción

AgroVoz es una aplicación web progresiva (PWA) diseñada para pequeños agricultores. Permite gestionar cultivos, realizar consultas agrícolas mediante texto o voz, recibir orientación con inteligencia artificial y compartir alertas en comunidades.

El proyecto aplica principios de usabilidad, accesibilidad, personalización y diseño emocional.

## 2. Objetivo

Desarrollar una aplicación interactiva y accesible que facilite la consulta de información agrícola y la colaboración entre agricultores mediante inteligencia artificial e interfaces no convencionales.

## 3. Funcionalidades

- Registro y visualización de parcelas y cultivos.
- Consultas agrícolas mediante texto y voz.
- Integración de inteligencia artificial local con Ollama.
- Respuestas escritas y reproducción por voz.
- Carga y visualización de fotografías.
- Historial de consultas y preferencias persistentes.
- Salas comunitarias y alertas compartidas mediante PostgreSQL.
- Aplicación PWA adaptable a computadoras y móviles.

**Nota:** La orientación agrícola es informativa y no reemplaza una evaluación profesional. Las sesiones comunitarias son demostrativas.

## 4. Tecnologías

- **Frontend:** HTML5, CSS3 y JavaScript.
- **Backend:** Python y FastAPI.
- **Inteligencia artificial:** Ollama con Llama 3.2 1B.
- **Base de datos:** PostgreSQL y SQLAlchemy.
- **Aplicación web:** PWA y Web Speech API.
- **Control de versiones:** Git y GitHub.

## 5. Arquitectura

AgroVoz utiliza una arquitectura cliente-servidor.

El frontend permite interactuar mediante texto, voz y pantallas accesibles. FastAPI procesa las solicitudes y se comunica con Ollama para generar orientación agrícola y con PostgreSQL para gestionar salas, participantes y alertas.

## 6. Ejecución en Ubuntu

**Instalar dependencias:**

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

**Iniciar Ollama:**

```bash
ollama pull llama3.2:1b
sudo systemctl start ollama
```

**Iniciar el backend:**

```bash
cd backend
uvicorn main:app --reload --port 8000 --env-file .env
```

**Iniciar el frontend** desde otra terminal, en la raíz del proyecto:

```bash
python3 -u -m http.server 8080 --bind 127.0.0.1 --directory AgroVoz-App
```

Abrir: `http://localhost:8080`

**Importante:** configurar previamente `backend/.env` con las conexiones locales de Ollama y PostgreSQL. No publicar contraseñas.

### Iniciar desde VS Code

Abrir la raíz del repositorio, entrar en **Ejecutar y depurar**, seleccionar **AgroVoz: abrir en localhost** y pulsar **F5**. La tarea inicia Python y, cuando el servidor está listo, la configuración abre Chrome automáticamente en `http://localhost:8080`. Requiere Python 3 y Chrome instalados; el depurador JavaScript viene integrado en VS Code.

El servidor escucha solo en `127.0.0.1:8080` (localhost IPv4), compatible con el reenvío de **Ports**. En entornos remotos se puede seguir reenviando el puerto 8080 y utilizar la URL que proporciona VS Code; si usa otro puerto local, abrir esa URL. Micrófono y service worker requieren localhost o HTTPS; el reconocimiento depende también del navegador y de sus permisos.

Para detener el servidor, abrir su terminal de tarea y pulsar **Ctrl+C**. Si el puerto 8080 ya está ocupado, detener el servidor anterior antes de iniciar F5. Como alternativa, ejecutar `npm start` dentro de `AgroVoz-App` y abrir manualmente `http://localhost:8080`. Ollama y FastAPI mantienen sus comandos de inicio independientes.

## 7. Aplicación de conceptos de IHC

- **Usabilidad:** navegación intuitiva y retroalimentación clara.
- **Accesibilidad:** interacción por voz y texto.
- **Personalización:** preferencias e historial persistentes.
- **Diseño emocional:** aplicación de los niveles visceral, conductual y reflexivo de Norman.
- **Interacción social:** comunicación y alertas entre agricultores.

## 8. Aportes del equipo PC3

| Integrante | Responsabilidades |
|---|---|
| **Cristian Díaz** | Integración de Ollama, consultas con IA, interfaz de voz, personalización y pruebas del módulo. |
| **Maurizio Berdiales** | Implementación de PostgreSQL, salas multiusuario, alertas colaborativas, API REST y pruebas de persistencia. |
| **Enoc Rosales** | Documentación del proyecto, historias de usuario, matriz de trazabilidad, usabilidad y evidencias de evaluación. |

El trabajo se desarrolló mediante ramas independientes, integradas posteriormente mediante Git y Pull Requests.

## 9. Estado del proyecto

AgroVoz PC3 cuenta con módulos implementados de consultas mediante inteligencia artificial, interacción por voz, personalización y colaboración multiusuario.

Se verificaron las conexiones del backend con Ollama y las operaciones de salas con PostgreSQL. La validación integral desde dispositivos externos continúa en revisión.

## 10. Repositorio

**GitHub:** https://github.com/cdiazcs/pc3_IHC

---

**AgroVoz PC3 — Universidad Nacional de Ingeniería · 2026-II**
