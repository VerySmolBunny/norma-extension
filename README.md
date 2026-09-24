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

Una vez instalada la extensión, abre el Dashboard o Sidepanel y haz clic en el ícono de **Ajustes (⚙️)**:

1. **Token de API de Monday.com:**
   - En Monday.com: Haz clic en tu foto de perfil > *Desarrolladores (Developers)* > *Mi Token de API*.
   - Pega tu token en el campo correspondiente.
2. **ID de Tablero de Monday.com:**
   - Ingresa el ID numérico del tablero de clientes (visible en la URL de Monday).
3. **API Key de Gemini (Google AI Studio):**
   - Obtén una clave gratuita en [Google AI Studio](https://aistudio.google.com/).
   - Pégala en el campo de Gemini para habilitar el asistente conversacional y la generación automática de minutas con IA.
4. **Google Apps Script Web App (Opcional):**
   - Si cuentas con el script de automatización para Google Calendar y Drive, ingresa su URL de despliegue Web App.

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
