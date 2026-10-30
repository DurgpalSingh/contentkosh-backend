import fs from 'fs';
import path from 'path';
import { escapeHtml } from '../utils/parserHtml.utils';

const EMAIL_BRAND = {
  NAME: 'ContentKosh',
} as const;

// Embedded as data URIs (not linked to hosted URLs) so the logo and icons always
// render, even if the frontend/backend that sent the email is later redeployed or
// offline. uploads/assets/logo.png already combines the mark and the wordmark, so
// the header just renders this one image — no separate icon/text pieces.
const LOGO_FILE_PATH = path.resolve(process.cwd(), 'uploads', 'assets', 'logo.png');
const ICONS_DIR = path.resolve(process.cwd(), 'uploads', 'assets', 'icons');

let cachedLogoDataUri: string | null = null;

function getLogoDataUri(): string {
  if (!cachedLogoDataUri) {
    const buffer = fs.readFileSync(LOGO_FILE_PATH);
    cachedLogoDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
  }
  return cachedLogoDataUri;
}

// Small line-icon graphics used in place of emoji (emoji render inconsistently
// across clients/platforms and look out of place in a transactional email).
export type EmailIconName =
  | 'building'
  | 'link'
  | 'person'
  | 'mail'
  | 'calendar'
  | 'document'
  | 'phone'
  | 'check'
  | 'pause'
  | 'cross';

const cachedIconDataUris = new Map<EmailIconName, string>();

function getIconDataUri(name: EmailIconName): string {
  let dataUri = cachedIconDataUris.get(name);
  if (!dataUri) {
    const buffer = fs.readFileSync(path.join(ICONS_DIR, `${name}.png`));
    dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
    cachedIconDataUris.set(name, dataUri);
  }
  return dataUri;
}

const EMAIL_LAYOUT_TEXT = {
  THANKS_LINE_1: 'Thanks,',
  THANKS_LINE_2: `The ${EMAIL_BRAND.NAME} Team`,
  PRIVACY_LABEL: 'Privacy Policy',
  COPYRIGHT: `© ${new Date().getFullYear()} ${EMAIL_BRAND.NAME}. All rights reserved.`,
  FALLBACK_VALUE: '—',
} as const;

export interface EmailInfoRow {
  icon: EmailIconName;
  label: string;
  value: string | null;
}

export interface EmailCta {
  label: string;
  url: string;
}

export type EmailBodySection =
  | { type: 'paragraph'; text: string }
  | { type: 'card'; rows: EmailInfoRow[] }
  | { type: 'cta'; cta: EmailCta };

export interface EmailLayoutOptions {
  documentTitle: string;
  heroIcon: EmailIconName;
  heroBadgeIcon: EmailIconName;
  heroBadgeColor: string;
  headingLines: string[];
  greeting: string;
  sections: EmailBodySection[];
  privacyUrl: string;
}

function buildInfoRow(row: EmailInfoRow): string {
  return [
    '<div class="info-row">',
    `<div class="info-icon"><img src="${getIconDataUri(row.icon)}" alt="" width="22" height="22"></div>`,
    `<div class="info-label">${escapeHtml(row.label)}</div>`,
    `<div class="info-value">${escapeHtml(row.value ?? EMAIL_LAYOUT_TEXT.FALLBACK_VALUE)}</div>`,
    '</div>',
  ].join('');
}

function buildSection(section: EmailBodySection): string {
  switch (section.type) {
    case 'paragraph':
      return `<p class="intro">${escapeHtml(section.text)}</p>`;
    case 'card':
      return `<div class="info-card">${section.rows.map(buildInfoRow).join('')}</div>`;
    case 'cta':
      return [
        '<div class="button-wrap">',
        `<a class="button" href="${escapeHtml(section.cta.url)}">${escapeHtml(section.cta.label)}</a>`,
        '</div>',
      ].join('');
  }
}

/**
 * Shared visual shell for all transactional emails. Content-specific templates
 * (business signup, business status change, ...) supply their own heading,
 * intro/body sections and CTA, but render through this single layout so every
 * email stays on-brand and only needs one place to restyle.
 */
export function buildEmailLayout(options: EmailLayoutOptions): string {
  const heading = options.headingLines.map(escapeHtml).join('<br>');
  const body = options.sections.map(buildSection).join('');
  const logoUrl = getLogoDataUri();
  const heroIconUrl = getIconDataUri(options.heroIcon);
  const heroBadgeUrl = getIconDataUri(options.heroBadgeIcon);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- This email is deliberately light-themed; opt out of client auto dark-mode
       remapping so pale backgrounds (info card, hero circle) don't get inverted
       while accent colors stay put, which looks broken. -->
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(options.documentTitle)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      color: #111111;
    }

    .email-wrapper {
      width: 100%;
      background: #ffffff;
      padding: 30px 0;
    }

    .email-container {
      width: 100%;
      max-width: 730px;
      margin: 0 auto;
      padding: 0 28px;
      box-sizing: border-box;
    }

    .header {
      margin-bottom: 55px;
    }

    .logo-img {
      display: block;
      height: 56px;
      width: auto;
    }

    .hero-icon {
      width: 118px;
      height: 118px;
      margin: 0 auto 48px;
      border-radius: 50%;
      background: #edf4ff;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .hero-icon .building img {
      display: block;
      width: 52px;
      height: 52px;
    }

    .hero-icon .badge {
      position: absolute;
      right: -4px;
      bottom: -2px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-icon .badge img {
      display: block;
      width: 20px;
      height: 20px;
    }

    h1 {
      font-size: 42px;
      line-height: 1.18;
      margin: 0 0 48px;
      font-weight: 700;
      letter-spacing: -1px;
    }

    .greeting {
      font-size: 23px;
      font-weight: 700;
      margin: 0 0 22px;
    }

    .intro {
      font-size: 20px;
      line-height: 1.55;
      color: #303030;
      margin: 0 0 30px;
    }

    .info-card {
      background: #eef5ff;
      border-radius: 12px;
      padding: 25px 22px;
      margin: 26px 0 38px;
    }

    .info-row {
      display: flex;
      align-items: center;
      margin: 0 0 20px;
      min-height: 30px;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-icon {
      width: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 18px;
    }

    .info-label {
      width: 155px;
      font-size: 19px;
      color: #333333;
    }

    .info-value {
      flex: 1;
      font-size: 19px;
      color: #222222;
      font-weight: 500;
      word-break: break-word;
    }

    .button-wrap {
      text-align: center;
      margin: 0 0 34px;
    }

    .button {
      display: block;
      background: #356dcc;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 23px;
      font-weight: 500;
      border-radius: 10px;
      padding: 18px 20px;
      text-align: center;
    }

    .divider {
      border: 0;
      border-top: 2px solid #9ab1d8;
      margin: 0 0 50px;
    }

    .thanks {
      font-size: 20px;
      line-height: 1.5;
      font-weight: 700;
      margin-bottom: 60px;
    }

    .footer {
      font-size: 17px;
      line-height: 1.8;
      color: #222222;
      padding-bottom: 25px;
    }

    .footer a {
      color: #356dcc;
      text-decoration: none;
      font-weight: 600;
    }

    @media only screen and (max-width: 600px) {
      .email-container {
        padding: 0 20px;
      }

      .header {
        margin-bottom: 40px;
      }

      .logo-img {
        height: 42px;
      }

      .hero-icon {
        margin-bottom: 35px;
      }

      h1 {
        font-size: 34px;
        margin-bottom: 35px;
      }

      .greeting {
        font-size: 20px;
      }

      .intro {
        font-size: 18px;
      }

      .info-row {
        align-items: flex-start;
      }

      .info-label {
        width: 105px;
        font-size: 16px;
      }

      .info-value {
        font-size: 16px;
      }

      .info-icon {
        width: 28px;
        margin-right: 10px;
      }

      .info-icon img {
        width: 18px;
        height: 18px;
      }

      .button {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <div class="header">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(EMAIL_BRAND.NAME)}" class="logo-img">
      </div>

      <h1>${heading}</h1>

      <p class="greeting">${escapeHtml(options.greeting)}</p>

      ${body}

      <hr class="divider">

      <div class="thanks">
        ${EMAIL_LAYOUT_TEXT.THANKS_LINE_1}<br>
        ${EMAIL_LAYOUT_TEXT.THANKS_LINE_2}
      </div>

      <div class="footer">
        <a href="${escapeHtml(options.privacyUrl)}">${EMAIL_LAYOUT_TEXT.PRIVACY_LABEL}</a>
        <br>
        ${EMAIL_LAYOUT_TEXT.COPYRIGHT}
      </div>

    </div>
  </div>
</body>
</html>`;
}
