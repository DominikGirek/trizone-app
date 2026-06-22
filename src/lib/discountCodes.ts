import { brandsById } from '@/lib/brands';
import { athletesById } from '@/mocks/athletes';

/**
 * Discount codes for the "Codes" tab.
 *
 * Model (influencercodes.de principle): codes are submitted/curated, then shown;
 * the community keeps them fresh via a 👍/👎 thumbs vote, and a code is
 * auto-hidden once net down-votes reach CODE_DOWNVOTE_CUTOFF — so nobody has to
 * manually review every report. NOTE: real cross-user vote aggregation + user
 * submissions require the backend (Phase B); until then `thumbsUp/thumbsDown`
 * are server-fed counts (0 here) and a local 👎 hides the code on that device.
 *
 * No real codes ship yet — fill DISCOUNT_CODES with REAL, verified codes
 * (affiliate/brand/athlete). A dead code at checkout burns trust.
 */
/** A code disappears for everyone once net down-votes reach this. */
export const CODE_DOWNVOTE_CUTOFF = 5;
export type CodeCategory = 'bike' | 'wetsuit' | 'run' | 'nutrition' | 'tech' | 'apparel' | 'other';

export const CODE_CATEGORIES: { id: CodeCategory; emoji: string }[] = [
  { id: 'bike', emoji: '🚲' },
  { id: 'wetsuit', emoji: '🥽' },
  { id: 'run', emoji: '👟' },
  { id: 'nutrition', emoji: '🧪' },
  { id: 'tech', emoji: '⌚' },
  { id: 'apparel', emoji: '👕' },
  { id: 'other', emoji: '🎟️' },
];

export interface DiscountCode {
  id: string;
  brandId?: string; // ties to lib/brands.ts → personalization + logo/emoji
  athleteId?: string; // ties to mocks/athletes.ts → "Code von <Athlet:in>" (influencer = athlete)
  brand: string;
  code: string;
  deal: string; // short, e.g. "20 %" / "100 € ab 2.000 €"
  description?: string;
  url: string; // affiliate / shop link
  category: CodeCategory;
  validUntil?: string; // ISO; codes past this are hidden
  checkedAt?: string; // ISO; "geprüft am" freshness signal
  thumbsUp?: number; // server-fed aggregate (backend)
  thumbsDown?: number; // server-fed aggregate (backend)
  verified: boolean; // curated = true
}

// Placeholders removed. Add REAL, verified codes here (curated now; community
// submissions arrive with the backend). Format example:
//   { id: 'dc-ryzon', brandId: 'ryzon', athleteId: 'frederic-funk', brand: 'Ryzon',
//     code: 'XXXX', deal: '15 %', description: '…', url: 'https://…', category: 'apparel',
//     validUntil: '2026-12-31', checkedAt: '2026-06-19', verified: true },
export const DISCOUNT_CODES: DiscountCode[] = [
  // Recherchiert aus Podcast-Shownotes (Quelle in description) — vor Verlass bitte
  // final bestätigen; Crowd-👎 + Cutoff ist das Sicherheitsnetz.
  { id: 'dc-incylence-pl', brandId: 'incylence', brand: 'INCYLENCE', code: 'pushinglimits', deal: '15 %', description: 'Auf alles · via Pushing Limits Podcast', url: 'https://www.incylence.com', category: 'apparel', validUntil: '2026-06-21', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-saysky-pl', brandId: 'saysky', brand: 'SAYSKY', code: 'PL15', deal: '15 %', description: 'Reguläre Artikel · via Pushing Limits Podcast', url: 'https://www.saysky.de', category: 'apparel', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-currex-pl', brandId: 'currex', brand: 'currex', code: 'PUSHINGLIMITS10', deal: '10 %', description: 'Einlagen · via Pushing Limits Podcast', url: 'https://www.currex.de', category: 'run', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-reboots-pl', brandId: 'reboots', brand: 'Reboots', code: 'PUSHINGLIMITS15', deal: '15 %', description: 'Recovery Boots · via Pushing Limits Podcast', url: 'https://www.reboots.de', category: 'other', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-blackroll-pl', brandId: 'blackroll', brand: 'BLACKROLL', code: 'LIMITS10', deal: '10 %', description: 'via Pushing Limits Podcast', url: 'https://www.blackroll.com', category: 'other', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-mnstry-pl', brandId: 'mnstry', brand: 'MNSTRY', code: 'ICEPUSH15', deal: '15 %', description: 'ICE Gel · via Pushing Limits Podcast', url: 'https://www.mnstry.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-precision-tth', brandId: 'precision', brand: 'Precision Fuel & Hydration', code: 'TTH26', deal: '15 %', description: 'Erste Bestellung · via The Triathlon Hour', url: 'https://www.precisionhydration.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-precision-tts', brandId: 'precision', brand: 'Precision Fuel & Hydration', code: 'TTS2026', deal: '15 %', description: 'Erste 2026-Bestellung · via That Triathlon Show', url: 'https://www.precisionhydration.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Running-Podcast-Quelle: Achilles Running
  { id: 'dc-shokz-achilles', brandId: 'shokz', brand: 'Shokz', code: 'running20', deal: '20 %', description: 'Kopfhörer · via Achilles Running Podcast', url: 'https://de.shokz.com', category: 'tech', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-blackroll-achilles', brandId: 'blackroll', brand: 'BLACKROLL', code: 'ACHILLES15', deal: '15 %', description: 'via Achilles Running Podcast', url: 'https://www.blackroll.com', category: 'other', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-ancientbrave-achilles', brandId: 'ancientbrave', brand: 'Ancient + Brave', code: 'ACHILLES', deal: '20 %', description: 'Erste Bestellung · via Achilles Running Podcast', url: 'https://ancientandbrave.earth', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Lauf-Podcast: Einer rennt Einer hinterher
  { id: 'dc-incylence-1rennt', brandId: 'incylence', brand: 'INCYLENCE', code: '1RENNT1HINTERHER', deal: '15 %', description: 'Auf alles · via Einer rennt Einer hinterher', url: 'https://www.incylence.com', category: 'apparel', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-3bears-1rennt', brandId: '3bears', brand: '3Bears', code: 'EINERRENNT15', deal: '15 %', description: 'Porridge & Co. · via Einer rennt Einer hinterher', url: 'https://3bears.de', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-danish-1rennt', brandId: 'danishendurance', brand: 'Danish Endurance', code: 'Schmidti10', deal: '10 %', description: 'Auf alles · via Einer rennt Einer hinterher', url: 'https://www.danishendurance.com', category: 'apparel', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-mnstry-1rennt', brandId: 'mnstry', brand: 'MNSTRY', code: 'EINERRENNT50', deal: '50 %', description: 'Probierbox · via Einer rennt Einer hinterher', url: 'https://www.mnstry.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Ausdauer-Podcast: PACE
  { id: 'dc-top4running-pace', brandId: 'top4running', brand: 'top4running', code: 'PACE10', deal: '10 %', description: 'Laufshop · via PACE – der Ausdauerpodcast', url: 'https://www.top4running.de', category: 'run', checkedAt: '2026-06-19', verified: true },
  // Schnellerwerden Laufpodcast
  { id: 'dc-dextro-sw', brandId: 'dextro', brand: 'Dextro Energy', code: 'Schnellerwerden15', deal: '15 %', description: 'via Schnellerwerden Laufpodcast', url: 'https://www.dextro-energy.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Frodeno Going Mental
  { id: 'dc-canyon-frodeno', brandId: 'canyon', athleteId: 'jan-frodeno', brand: 'Canyon', code: 'FRODENO5GRAIL', deal: '5 %', description: 'Canyon Grail · via Frodeno Going Mental', url: 'https://www.canyon.com', category: 'bike', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-pillar-frodeno', brandId: 'pillar', athleteId: 'jan-frodeno', brand: 'PILLAR Performance', code: 'GOINGMENTAL', deal: '15 %', description: 'Erste Bestellung · via Frodeno Going Mental', url: 'https://pillarperformance.shop', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Laufen ist einfach (Jan Fitschen)
  { id: 'dc-cep-jan', brandId: 'cep', brand: 'CEP', code: 'JAN20', deal: '20 %', description: 'Kompression · via Laufen ist einfach', url: 'https://www.cepsports.com', category: 'apparel', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-truemotion-jan', brandId: 'truemotion', brand: 'True Motion', code: 'JAN10', deal: '10 %', description: 'Laufschuhe · via Laufen ist einfach', url: 'https://www.truemotion.run', category: 'run', checkedAt: '2026-06-19', verified: true },
  // Auslaufen
  { id: 'dc-mnstry-auslaufen', brandId: 'mnstry', brand: 'MNSTRY', code: 'AUSLAUFEN50', deal: '50 %', description: 'Probierbox · via Auslaufen', url: 'https://www.mnstry.com', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-feelslike-auslaufen', brandId: 'feelslike', brand: 'feels.like', code: 'auslaufen10', deal: '10 %', description: 'via Auslaufen Laufsport Podcast', url: 'https://feelslike.sport', category: 'other', checkedAt: '2026-06-19', verified: true },
  // beVegt
  { id: 'dc-loewenanteil-bevegt', brandId: 'loewenanteil', brand: 'Löwenanteil', code: 'bevegt', deal: '10 %', description: 'via beVegt Podcast', url: 'https://www.loewenanteil.de', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-koro-bevegt', brandId: 'koro', brand: 'KoRo', code: 'BEVEGT5', deal: '5 %', description: 'via beVegt Podcast', url: 'https://www.korodrogerie.de', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  // Trailrunning Geschwätz
  { id: 'dc-core-trail', brandId: 'core', brand: 'CORE', code: 'trailrunning20', deal: '20 %', description: 'Körpertemperatur-Sensor · via Trailrunning Geschwätz', url: 'https://corebodytemp.com', category: 'tech', checkedAt: '2026-06-19', verified: true },
  // Plattfuß (Triathlon & Radsport)
  { id: 'dc-getbetter-plattfuss', brandId: 'getbetter', brand: 'GET BETTER', code: 'PLATTFUSS15', deal: '15 %', description: 'Kohlenhydrate · via Plattfuß Podcast', url: 'https://getbetter.de', category: 'nutrition', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-greaze-plattfuss', brandId: 'greaze', brand: 'GREAZE', code: 'MATSCH20', deal: '20 %', description: 'Bike-Pflege · via Plattfuß Podcast', url: 'https://greaze.cc', category: 'other', checkedAt: '2026-06-19', verified: true },
  // Rennrad-Podcasts
  { id: 'dc-maurten-besenwagen', brandId: 'maurten', brand: 'Maurten', code: 'BESENWAGEN20', deal: '20 %', description: 'außer Bicarb · via Besenwagen Radsport Podcast', url: 'https://www.maurten.com', category: 'nutrition', validUntil: '2026-12-31', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-keego-sitzfleisch', brandId: 'keego', brand: 'KEEGO', code: 'sitzfleisch', deal: '10 %', description: 'Trinkflaschen · via Sitzfleisch Ultracycling-Podcast', url: 'https://www.keego.at', category: 'bike', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-vekolo-cm', brandId: 'vekolo', brand: 'Vekolo', code: 'CYCLINGMAGAZINE', deal: '25 €', description: 'Jahres-Abo Indoor-Training · via CyclingMagazine', url: 'https://www.vekolo.com', category: 'tech', checkedAt: '2026-06-19', verified: true },
  { id: 'dc-schaltauge-cm', brandId: 'schaltauge', brand: 'Schaltauge24', code: 'CM15', deal: '15 %', description: 'Schaltaugen · via CyclingMagazine Radsport-Podcast', url: 'https://www.schaltauge24.de', category: 'bike', checkedAt: '2026-06-19', verified: true },
];

/** Brand emoji from the registry (fallback to a ticket). */
export function codeEmoji(c: DiscountCode): string {
  return (c.brandId && brandsById[c.brandId]?.emoji) || '🎟️';
}

/** Name of the athlete behind an athlete code (if any). */
export function codeAthleteName(c: DiscountCode): string | undefined {
  return c.athleteId ? athletesById[c.athleteId]?.name : undefined;
}

/** True once the crowd has down-voted a code past the cutoff (server-fed counts). */
export function isHiddenByVotes(c: DiscountCode): boolean {
  return (c.thumbsDown ?? 0) - (c.thumbsUp ?? 0) >= CODE_DOWNVOTE_CUTOFF;
}

/** Codes still valid today (past validUntil, or down-voted out, are dropped). */
export function activeCodes(now = Date.now()): DiscountCode[] {
  return DISCOUNT_CODES.filter(
    (c) => (!c.validUntil || +new Date(c.validUntil) >= now) && !isHiddenByVotes(c),
  );
}

/** Active codes tied to a specific athlete (for the athlete profile). */
export function codesForAthlete(athleteId: string): DiscountCode[] {
  return activeCodes().filter((c) => c.athleteId === athleteId);
}
