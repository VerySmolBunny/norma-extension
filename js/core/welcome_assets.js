/**
 * Assets y plantilla visual oficial de Bienvenida Buk Asistencia
 * Soporte modular para banners dinámicos alojados en Google Drive o URLs web.
 */

export const DEFAULT_HEADER_BANNER_HTML = `
  <div style="padding: 28px 20px; background: #1b3d8b; color: #ffffff; text-align: center;">
    <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px;">¡Bienvenid@ a Buk! 💙</div>
    <div style="font-size: 24px; font-weight: 800; margin: 4px 0 6px 0; letter-spacing: -0.5px;">¡Bienvenid@ al módulo de Asistencia!</div>
    <div style="font-size: 14px; color: #f59e0b; font-weight: 600;">Comencemos este nuevo desafío ;)</div>
  </div>
`.trim();

export const DEFAULT_FOOTER_BANNER_HTML = `
  <div style="background: #ffffff; color: #1e3a8a; padding: 18px 20px; text-align: center; font-size: 13px; border-top: 1px solid #e2e8f0;">
    <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1e3a8a;">🚀 Súmate a la experiencia Buk</div>
    <div style="opacity: 0.85; font-size: 12px; color: #64748b;">Descubre Buk &bull; Crea un lugar de trabajo más feliz</div>
  </div>
`.trim();

export const DEFAULT_WELCOME_TEMPLATE_HTML = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff; color: #334155; line-height: 1.6;">
  <!-- Banner Superior Buk Asistencia -->
  <div id="welcome-header-container" style="text-align: center; background-color: #1b3d8b; line-height: 0;">
    {{header_banner}}
  </div>

  <div style="padding: 32px 28px;">
    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700; margin-bottom: 20px;">
      ¡Hola equipo {{empresa}}! 😊
    </h2>

    <p style="margin-bottom: 16px;">
      Mi nombre es <strong>{{mi_nombre}}</strong> y seré quién les acompañe en esta etapa de implementación de nuestro módulo <strong>Control de Asistencia</strong>.
    </p>

    <p style="margin-bottom: 20px;">
      Como primer paso, realizaremos nuestra reunión <strong>"kick off"</strong>, la cual consiste en una instancia virtual para conocernos y revisar los puntos necesarios para comenzar el proceso de implementación.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{{agenda_url}}" target="_blank" style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 15px; text-decoration: underline; padding: 12px 24px; border-radius: 8px; border: 1px solid #bfdbfe;">
        👉 Puedes hacer click aqui para agendar tu primera sesión.
      </a>
    </div>

    <p style="margin-bottom: 16px;">
      En caso de que no puedas asistir a la reunión programada, coméntamelo y así podremos agendar una nueva fecha.
    </p>

    <p style="margin-bottom: 24px;">
      Quedo atenta y disponible para ayudarte.
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
      <p style="margin: 0 0 4px 0; color: #64748b;">Saludos,</p>
      <p style="margin: 0; font-size: 15px; font-weight: 800; color: #1e3a8a;">Tu experiencia con Buk</p>
    </div>
  </div>

  <!-- Banner Inferior Experiencia Buk -->
  <div id="welcome-footer-container" style="text-align: center; background-color: #ffffff; line-height: 0;">
    {{footer_banner}}
  </div>
</div>
`.trim();
