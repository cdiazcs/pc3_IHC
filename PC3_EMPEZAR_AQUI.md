# AgroVoz — base MAIN para PC3 (CC451)

**Base:** archivos funcionales del avance PC2, sin cambiar la lógica existente. Las capacidades nuevas de PC3 **aún no están implementadas por este ZIP**. Es una base común de trabajo, no el entregable final.

## Preparación (una sola persona: coordinador)

1. Descomprime el ZIP y entra en `AgroVoz_PC3_MAIN_BASE`.
2. Si el repositorio de GitHub YA contiene PC2, **no crees un repositorio remoto nuevo ni hagas un push forzado**. Crea una rama `pc3/base` desde `main`, copia/integra los archivos de este ZIP en el repositorio ya clonado, revisa `git diff`, haz commit y abre un PR hacia `main`.
3. Si se va a crear un repositorio nuevo y vacío, ejecuta:

```bash
git init -b main
git add .
git commit -m "chore(pc3): base comun desde PC2"
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

> No hay carpeta `.git` en el ZIP por seguridad: cada integrante clona el repositorio compartido. **Nunca subas claves de API ni archivos `.env`.**

## Cada integrante (después de publicar `main`)

```bash
git clone URL_DEL_REPOSITORIO
cd NOMBRE_DEL_REPOSITORIO
git switch main
git pull origin main
# Cada integrante crea SOLO su propia rama:
git switch -c feature/llm-voz           # integrante 1
# git switch -c feature/salas-comunidad # integrante 2
# git switch -c docs/pc3-calidad        # integrante 3
# Trabajar, probar y publicar:
git add .
git commit -m "feat: avance modulo asignado"
git push -u origin NOMBRE_DE_MI_RAMA
```

Luego abrir un Pull Request hacia `main`. Otro integrante revisa el PR y lo fusiona **después** de ejecutar pruebas.

## Arranque local

**Terminal 1** — aplicación PWA:
```bash
cd AgroVoz-App
python3 -m http.server 8080
```
Abrir `http://localhost:8080`. No abrir directamente `index.html` como `file://` para probar Service Worker.

**Terminal 2** — backend opcional (Python 3):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn main:app --app-dir backend --reload --port 8000
```
Comprobar `http://localhost:8000/health`. El proveedor remoto es opcional y requiere variables de entorno documentadas en `backend/.env.example`. No presentar respuestas simuladas como salidas reales de LLM.

## Pruebas iniciales
```bash
node --check AgroVoz-App/app.js
node --test tests/smoke.test.cjs
python3 -m pip install -r backend/requirements.txt
python3 -m pip install pytest
python3 tests/backend_smoke.py
```

## Ramas, responsables y contratos
Lee `docs/PC3_RAMAS_Y_CONTRATOS.md` para evitar conflictos. Lee `docs/PC3_CHECKLIST_RUBRICA.md` antes de grabar evidencias.

## Integración final

1. Verificar pruebas y abrir PR por cada responsable.
2. Fusionar un PR a la vez, actualizando las ramas con `git fetch origin && git rebase origin/main` **solo si no se comparten commits sin coordinación**; alternativa segura: `git merge origin/main`.
3. Probar LLM real, multiusuario real en dos sesiones, PWA y accesibilidad.
4. Actualizar documentación y capturas verdaderas de la app ejecutándose.
5. Agregar informe, archivo de aporte personal, URL del repositorio, LICENSE y video grupal.
6. Crear el ZIP final con el nombre solicitado por el profesor.

**Fecha indicada por rúbrica:** 11 de noviembre de 2026 a las 14:30 (hora local). Video: máximo 9 minutos si son 3 estudiantes, 3 minutos cada uno.
