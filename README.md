# AgroVoz · PC2 (CC451)

**Curso:** Interacción Humano-Computador  
**Ciclo:** 2026-II  
**Integrantes:** [Enoc Rosales], [Maurizio Berdiales], [Cristian Diaz]

## 1. Descripción del proyecto

AgroVoz es un proyecto académico que busca facilitar el acceso a información agrícola para pequeños agricultores mediante una aplicación sencilla e interactiva.

La idea es que los agricultores puedan registrar sus cultivos, realizar consultas mediante texto o voz, adjuntar fotografías de sus plantas y revisar sus consultas anteriores.

Buscamos aplicar lo aprendido en el curso de Interacción Humano-Computador, especialmente los principios de usabilidad, accesibilidad, diseño centrado en el usuario e interfaces no convencionales.

## 2. Objetivo

Desarrollar un prototipo interactivo que permita a pequeños agricultores consultar información sobre sus cultivos de manera sencilla y accesible.

## 3. Funcionalidades

- Registro y visualización de parcelas y cultivos.
- Consultas mediante texto y voz.
- Carga y visualización de fotografías.
- Respuestas agrícolas demostrativas.
- Historial de consultas.
- Alertas comunitarias simuladas.
- Personalización de preferencias.
- Funciones locales y soporte PWA.

**Nota:** La orientación agrícola es demostrativa y no constituye un diagnóstico. Las cuentas y comunidades son ficticias. La integración completa con un modelo de IA y un backend de producción es parte del desarrollo futuro.

## 4. Tecnologías utilizadas

- **HTML:** estructura de las pantallas.
- **CSS:** diseño visual y adaptación a distintos dispositivos.
- **JavaScript:** navegación y funcionalidades interactivas.
- **Python:** ejecución del servidor local.
- **FastAPI:** estructura de backend opcional.
- **PWA:** manifiesto y almacenamiento de recursos para uso local.

## 5. Estructura del proyecto

El proyecto está organizado en las siguientes carpetas:

- **AgroVoz-App:** contiene la aplicación web.
- **backend:** contiene los archivos del servidor Python.
- **docs:** contiene diagramas y documentación del proyecto.
- **tests:** contiene scripts y resultados de pruebas.
- **README.md:** contiene la descripción e instrucciones de ejecución.

## 6. Ejecución del proyecto

Para ejecutar AgroVoz necesitamos tener Python 3 instalado.

Abrimos el proyecto desde Visual Studio Code e ingresamos a la terminal.

Ejecutamos los siguientes comandos:

`cd AgroVoz-App`

`py -3 -m http.server 8080`

Luego abrimos el navegador e ingresamos a:

**http://localhost:8080**

Con esto podemos utilizar el prototipo de AgroVoz.

## 7. Aplicación de conceptos de IHC

Durante el desarrollo buscamos aplicar los principales conceptos estudiados en clase:

- **Usabilidad:** navegación sencilla y acciones fáciles de comprender.
- **Accesibilidad:** diferentes maneras de interactuar con la aplicación.
- **Aspectos cognitivos:** botones reconocibles y reducción de información innecesaria.
- **Interacción social:** funcionalidades para compartir alertas.
- **Diseño emocional:** mensajes claros y retroalimentación durante las acciones.
- **Diseño centrado en el usuario:** consideración de las necesidades de los pequeños agricultores.

## 8. Estado del proyecto

Actualmente AgroVoz cuenta con un prototipo navegable que permite demostrar sus principales interacciones.

En las siguientes etapas buscamos integrar un modelo de lenguaje real, mejorar el procesamiento de fotografías y desarrollar la gestión segura de usuarios y la sincronización de datos.

## 9. Equipo de desarrollo

- **Enoc Rosales:** análisis de usuarios, PACT y planificación.
- **Maurizio Berdiales:** requerimientos, historias de usuario y matriz de trazabilidad.
- **Cristian Diaz:** prototipo, integración, diagramas y documentación técnica.

Las responsabilidades se ajustarán a los aportes realizados por cada integrante.

## Link de github:

https://github.com/cdiazcs/AgroVozApp

