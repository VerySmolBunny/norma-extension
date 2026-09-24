# 🤖 Norma - Buk PM Assistant (Edición Pública)

Extensión de navegador (Manifest V3) diseñada para optimizar los flujos operativos de **Project Managers y Consultores de Implementación en Buk**, conectando la gestión en **Monday.com**, **Google Workspace** (Calendar, Meet, Drive, Gmail) y modelos de inteligencia artificial de última generación (**Google Gemini**).

---

## ✨ Módulos y Funcionalidades Incluidas

1. **🚀 Onboarding & Coordinación de Kick Off:**
   - Detección automática de nuevos clientes asignados en el tablero de Monday.com.
   - Generación de correos de bienvenida personalizados listos para enviar por Gmail.
   - Apertura automatizada de carpetas en Google Drive y plantillas de presentación de Kick Off.

2. **🔄 Sincronización Inteligente de Reuniones:**
   - Lectura de eventos agendados y transcripciones de Google Meet.
   - Procesamiento con IA para estructurar minutas ejecutivas con acuerdos, compromisos y tareas.
   - Publicación directa de notas y actualizaciones en el cliente correspondiente de Monday.com.

3. **🤖 Consultor Inteligente de Cartera (Norma AI):**
   - Asistente de lenguaje natural conectado en tiempo real al tablero de clientes.
   - Consultas instantáneas: clientes sin reunión agendada, seguimiento de plazos, semáforos de salud y métricas de atraso.

4. **🏁 Resumen y Minuta de Cierre:**
   - Análisis consolidado de notas y reuniones previas con el cliente.
   - Estructuración automática del reporte oficial de cierre de implementación para Monday.com y correo al cliente.

5. **📁 Gestor de Carpetas en Google Drive:**
   - Búsqueda, creación y vinculación rápida de carpetas de clientes en Google Drive.

6. **✉️ Plantillas y Biblioteca de Correos:**
   - Editor de plantillas corporativas enriquecidas para Gmail con soporte de variables dinámicas (`{{empresa}}`, `{{agenda_url}}`, etc.).

---

## 🔒 Privacidad y Seguridad

- **Sin Servidores Intermedios:** La extensión opera de manera 100% descentralizada desde tu navegador.
- **Almacenamiento Local Seguro:** Tus claves de API (Monday.com, Google Gemini, Apps Script) se guardan exclusivamente en el almacenamiento local seguro de tu navegador (`chrome.storage.local`).
- **Control Total:** Ningún dato confidencial, token o información de clientes se comparte ni se transmite a servidores externos no autorizados.

---

## 📦 Instalación Rápida

### Opción 1: Desde la carpeta del repositorio
1. Clona este repositorio o descarga el código como archivo ZIP y descomprímelo:
   ```bash
   git clone <URL_DEL_REPOSITORIO>.git
   ```
2. Abre tu navegador (Google Chrome, Brave, Microsoft Edge u otro basado en Chromium).
3. Dirígete a `chrome://extensions/` (o la sección de Extensiones en la configuración de tu navegador).
4. Activa el interruptor de **Modo de desarrollador** (esquina superior derecha).
5. Haz clic en **Cargar descomprimida** (*Load unpacked*).
6. Selecciona la carpeta donde descargaste este repositorio.
7. ¡Listo! Verás el ícono de **Norma** en tu barra de herramientas.

---

## ⚙️ Configuración Inicial (Primeros Pasos)

Una vez instalada la extensión, abre el Dashboard o Sidepanel y haz clic en el ícono de **Ajustes (⚙️)** (o pulsa "🔓 Desbloquear" para editar):

1. **Tu Nombre en Monday.com (Consultor / COE Asignado):**
   - Escribe tu nombre tal cual como figura asignado en la columna **"Persona / COE"** en el tablero de Monday.com (ej: `Juan Pérez`).
   - La extensión usará este dato para filtrar y mostrar **únicamente tus clientes, tus reuniones y tus métricas**.

2. **Token de API de Monday.com:**
   - En Monday.com: Haz clic en tu foto de perfil > *Desarrolladores (Developers)* > *Mi Token de API*.
   - Pega tu token personal en el campo correspondiente.

3. **ID de Tablero de Monday.com:**
   - Ingresa el ID numérico del tablero Master de Clientes (por defecto viene preconfigurado con el tablero general).

4. **API Key de Gemini (Google AI Studio):**
   - Obtén una clave gratuita en [Google AI Studio](https://aistudio.google.com/).
   - Pégala para habilitar el asistente conversacional (Norma AI) y la redacción automática de minutas ejecutivas.

5. **Carpetas de Google Drive:**
   - **Carpeta Raíz de Clientes:** Pega el link o ID de la carpeta en Google Drive donde guardas o gestionas las subcarpetas de tus clientes.
   - **Carpetas de Grabaciones de Google Meet:** Pega el link o ID de tu carpeta de grabaciones de Meet.

6. **Web App de Google Apps Script (Sincronización de Calendar y Drive):**
   - Cada consultor debe tener su propia instancia de Apps Script para que Calendar y Drive lean sus propios eventos y archivos:
     1. Entra a [script.google.com](https://script.google.com) con tu cuenta corporativa de Google.
     2. Crea un nuevo proyecto y pega el contenido de `google_apps_script/Code.gs`.
     3. Haz clic en **Implementar** > **Nueva implementación**.
     4. Selecciona tipo **Aplicación web**:
        - *Ejecutar como:* **Yo** (tu cuenta).
        - *Quién tiene acceso:* **Cualquiera** (o cualquiera dentro de la organización).
     5. Copia la URL terminada en `/exec` y pégala en los Ajustes de la extensión.
     6. Haz clic en **"🔑 Autorizar Permisos en Google"** en la extensión para conceder permisos a Calendar y Drive en tu cuenta.

---

## 🛠️ Tecnologías

- **JavaScript ES6+ Modules**
- **Chrome Extensions Manifest V3**
- **Monday.com GraphQL API v2**
- **Google Gemini API (Gemini 2.5 / 3.7 Flash & Pro)**
- **Google Apps Script REST Web App**
- **SunEditor WYSIWYG** (para edición de plantillas)

---

## 📄 Licencia

Uso interno y colaborativo. Todos los derechos reservados.
