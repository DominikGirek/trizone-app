import { Linking } from 'react-native';

/**
 * Optional: a free Web3Forms access key (https://web3forms.com) lets the in-app
 * report form deliver fully in-app (the user never leaves TriZone) — Web3Forms
 * e-mails the submission to us. The key is a *public* form key (safe to ship).
 * Until it is set, the form gracefully falls back to a prefilled e-mail draft.
 */
export const WEB3FORMS_ACCESS_KEY = '44b1689f-af55-49de-b304-0d3707d94c42';
const SUPPORT_EMAIL = 'kontakt@trizone.app';

export interface ReportPayload {
  subject: string;
  fields: Record<string, string>;
}

/** Returns true on success (form posted, or the mail draft opened). */
export async function submitReport({ subject, fields }: ReportPayload): Promise<boolean> {
  const lines = Object.entries(fields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`);

  if (WEB3FORMS_ACCESS_KEY) {
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          from_name: 'TriZone App',
          subject,
          message: lines.join('\n'),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Fallback: open a prefilled e-mail in the user's mail app.
  const body = encodeURIComponent(lines.join('\n'));
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`);
    return true;
  } catch {
    return false;
  }
}
