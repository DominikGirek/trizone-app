import { eventStatusFromDate } from '@/lib/format';
import type { LocalEvent } from '@/types';

// Curated, verified marquee mass-participation races (Ironman / Challenge /
// T100) for the broad age-group audience. Dates confirmed against official
// sources; status is always derived from the date (never hard-coded). No clean
// public API exists for these series, so this is a maintained real-data set —
// each event deep-links to its official registration page.

const IRONMAN = { swim: 3.8, bike: 180, run: 42.2 };
const HALF = { swim: 1.9, bike: 90, run: 21.1 };
const T100D = { swim: 2, bike: 80, run: 18 };

interface Seed extends Omit<LocalEvent, 'status'> {}

const seed: Seed[] = [
  // IRONMAN (DACH)
  {
    id: 'se-im703-kraichgau', name: 'IRONMAN 70.3 Kraichgau', series: 'IRONMAN 70.3',
    town: 'Ubstadt-Weiher', region: 'Baden-Württemberg', country: 'DE', lat: 49.159, lon: 8.627,
    date: '2026-05-31T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }],
    organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-kraichgau',
  },
  {
    id: 'se-im-hamburg', name: 'IRONMAN Hamburg', series: 'IRONMAN',
    town: 'Hamburg', region: 'Hamburg', country: 'DE', lat: 53.5511, lon: 9.9937,
    date: '2026-06-07T06:30:00', distances: [{ label: 'Langdistanz', ...IRONMAN }],
    organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-hamburg',
  },
  {
    id: 'se-im-frankfurt', name: 'IRONMAN European Championship Frankfurt', series: 'IRONMAN',
    town: 'Frankfurt am Main', region: 'Hessen', country: 'DE', lat: 50.1109, lon: 8.6821,
    date: '2026-06-28T06:30:00', distances: [{ label: 'Langdistanz', ...IRONMAN }],
    organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-frankfurt',
  },
  // IRONMAN full-distance — Europe (dates verified via sportpress.international / IRONMAN)
  { id: 'se-im-lanzarote', name: 'IRONMAN Lanzarote', series: 'IRONMAN', town: 'Lanzarote', region: 'Spanien', country: 'ES', lat: 28.92, lon: -13.66, date: '2026-05-23T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-lanzarote' },
  { id: 'se-im-klagenfurt', name: 'IRONMAN Austria Kärnten', series: 'IRONMAN', town: 'Klagenfurt', region: 'Österreich', country: 'AT', lat: 46.624, lon: 14.308, date: '2026-06-14T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-austria' },
  { id: 'se-im-tours', name: 'IRONMAN Tours Loire Valley', series: 'IRONMAN', town: 'Tours', region: 'Frankreich', country: 'FR', lat: 47.394, lon: 0.685, date: '2026-06-14T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-tours' },
  { id: 'se-im-nice', name: 'IRONMAN France Nice', series: 'IRONMAN', town: 'Nizza', region: 'Frankreich', country: 'FR', lat: 43.696, lon: 7.266, date: '2026-06-28T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-france' },
  { id: 'se-im-thun', name: 'IRONMAN Switzerland Thun', series: 'IRONMAN', town: 'Thun', region: 'Schweiz', country: 'CH', lat: 46.758, lon: 7.628, date: '2026-07-05T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-switzerland' },
  { id: 'se-im-vichy', name: 'IRONMAN Vichy', series: 'IRONMAN', town: 'Vichy', region: 'Frankreich', country: 'FR', lat: 46.128, lon: 3.426, date: '2026-08-23T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-vichy' },
  { id: 'se-im-wales', name: 'IRONMAN Wales', series: 'IRONMAN', town: 'Tenby', region: 'Großbritannien', country: 'GB', lat: 51.673, lon: -4.702, date: '2026-09-13T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-wales' },
  { id: 'se-im-emilia', name: 'IRONMAN Italy Emilia-Romagna', series: 'IRONMAN', town: 'Cervia', region: 'Italien', country: 'IT', lat: 44.262, lon: 12.354, date: '2026-09-19T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-emilia-romagna' },
  { id: 'se-im-cascais', name: 'IRONMAN Portugal Cascais', series: 'IRONMAN', town: 'Cascais', region: 'Portugal', country: 'PT', lat: 38.697, lon: -9.421, date: '2026-10-17T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-cascais' },
  // The big one — IRONMAN World Championship returns to Kona (men + women, one day, 10 Oct 2026)
  { id: 'se-im-worlds-kona', name: 'IRONMAN World Championship Hawaii', series: 'IRONMAN', town: 'Kailua-Kona', region: 'Hawaii, USA', country: 'US', lat: 19.639, lon: -155.997, date: '2026-10-10T06:25:00', distances: [{ label: 'Weltmeisterschaft · Langdistanz', ...IRONMAN }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im-world-championship-kona' },
  // IRONMAN 70.3 — Europe
  { id: 'se-im703-valencia', name: 'IRONMAN 70.3 Valencia', series: 'IRONMAN 70.3', town: 'Valencia', region: 'Spanien', country: 'ES', lat: 39.469, lon: -0.376, date: '2026-04-19T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-valencia' },
  { id: 'se-im703-mallorca', name: 'IRONMAN 70.3 Alcúdia-Mallorca', series: 'IRONMAN 70.3', town: 'Alcúdia', region: 'Spanien', country: 'ES', lat: 39.853, lon: 3.121, date: '2026-05-09T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-mallorca' },
  { id: 'se-im703-aix', name: 'IRONMAN 70.3 Aix-en-Provence', series: 'IRONMAN 70.3', town: 'Aix-en-Provence', region: 'Frankreich', country: 'FR', lat: 43.529, lon: 5.448, date: '2026-05-17T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-aix-en-provence' },
  { id: 'se-im703-rapperswil', name: 'IRONMAN 70.3 Switzerland Rapperswil', series: 'IRONMAN 70.3', town: 'Rapperswil-Jona', region: 'Schweiz', country: 'CH', lat: 47.226, lon: 8.818, date: '2026-06-07T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-switzerland' },
  { id: 'se-im703-nice', name: 'IRONMAN 70.3 Nice', series: 'IRONMAN 70.3', town: 'Nizza', region: 'Frankreich', country: 'FR', lat: 43.696, lon: 7.266, date: '2026-06-28T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-nice' },
  { id: 'se-im703-lessables', name: 'IRONMAN 70.3 Les Sables d’Olonne', series: 'IRONMAN 70.3', town: 'Les Sables-d’Olonne', region: 'Frankreich', country: 'FR', lat: 46.497, lon: -1.783, date: '2026-07-05T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-les-sables-dolonne' },
  { id: 'se-im703-vitoria', name: 'IRONMAN 70.3 Vitoria-Gasteiz', series: 'IRONMAN 70.3', town: 'Vitoria-Gasteiz', region: 'Spanien', country: 'ES', lat: 42.846, lon: -2.672, date: '2026-07-12T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-vitoria' },
  { id: 'se-im703-duisburg', name: 'IRONMAN 70.3 Duisburg', series: 'IRONMAN 70.3', town: 'Duisburg', region: 'Nordrhein-Westfalen', country: 'DE', lat: 51.435, lon: 6.762, date: '2026-08-16T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-duisburg' },
  { id: 'se-im703-leipzig', name: 'IRONMAN 70.3 Leipzig', series: 'IRONMAN 70.3', town: 'Leipzig', region: 'Sachsen', country: 'DE', lat: 51.34, lon: 12.375, date: '2026-08-23T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-leipzig' },
  { id: 'se-im703-vichy', name: 'IRONMAN 70.3 Vichy', series: 'IRONMAN 70.3', town: 'Vichy', region: 'Frankreich', country: 'FR', lat: 46.128, lon: 3.426, date: '2026-08-23T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-vichy' },
  { id: 'se-im703-zellamsee', name: 'IRONMAN 70.3 Zell am See-Kaprun', series: 'IRONMAN 70.3', town: 'Zell am See', region: 'Österreich', country: 'AT', lat: 47.323, lon: 12.798, date: '2026-08-30T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-zell-am-see' },
  { id: 'se-im703-wc-nice', name: 'IRONMAN 70.3 Weltmeisterschaft', series: 'IRONMAN 70.3', town: 'Nizza', region: 'Frankreich', country: 'FR', lat: 43.696, lon: 7.266, date: '2026-09-12T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-world-championships' },
  { id: 'se-im703-erkner', name: 'IRONMAN 70.3 Erkner (Berlin)', series: 'IRONMAN 70.3', town: 'Erkner', region: 'Brandenburg', country: 'DE', lat: 52.425, lon: 13.752, date: '2026-09-13T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-erkner' },
  { id: 'se-im703-malaga', name: 'IRONMAN 70.3 Málaga', series: 'IRONMAN 70.3', town: 'Málaga', region: 'Spanien', country: 'ES', lat: 36.721, lon: -4.421, date: '2026-10-18T08:00:00', distances: [{ label: 'Mitteldistanz (70.3)', ...HALF }], organizer: 'IRONMAN', websiteUrl: 'https://www.ironman.com/races/im703-malaga' },
  // Challenge Family
  {
    id: 'se-ch-roth', name: 'DATEV Challenge Roth', series: 'Challenge',
    town: 'Roth', region: 'Bayern', country: 'DE', lat: 49.2456, lon: 11.091,
    date: '2026-07-05T06:30:00', distances: [{ label: 'Langdistanz', ...IRONMAN }],
    organizer: 'Challenge Family', websiteUrl: 'https://www.challenge-roth.com/',
  },
  {
    id: 'se-ch-championship', name: 'The Championship', series: 'Challenge',
    town: 'Šamorín', region: 'SK', country: 'SK', lat: 48.029, lon: 17.307,
    date: '2026-05-24T08:00:00', distances: [{ label: 'Mitteldistanz', ...HALF }],
    organizer: 'Challenge Family', websiteUrl: 'https://thechampionship.sk/',
  },
  {
    id: 'se-ch-gdansk', name: 'Challenge Gdańsk', series: 'Challenge',
    town: 'Gdańsk', region: 'PL', country: 'PL', lat: 54.352, lon: 18.6466,
    date: '2026-06-21T08:00:00', distances: [{ label: 'Mitteldistanz', ...HALF }],
    organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/',
  },
  {
    id: 'se-ch-almere', name: 'Challenge Almere-Amsterdam', series: 'Challenge',
    town: 'Almere', region: 'NL', country: 'NL', lat: 52.3508, lon: 5.2647,
    date: '2026-09-12T07:00:00', distances: [{ label: 'Langdistanz', ...IRONMAN }],
    organizer: 'Challenge Family', websiteUrl: 'https://www.challenge-almere.com/',
  },
  {
    id: 'se-ch-barcelona', name: 'Challenge Barcelona', series: 'Challenge',
    town: 'Barcelona', region: 'ES', country: 'ES', lat: 41.3874, lon: 2.1686,
    date: '2026-10-25T08:00:00', distances: [{ label: 'Mitteldistanz', ...HALF }],
    organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-barcelona/',
  },
  // Challenge Family — full season from challengefamily.com/races (date verified per race page)
  { id: 'se-ch-walchsee', name: 'Challenge Walchsee-Kaiserwinkl', series: 'Challenge', town: 'Walchsee', region: 'Österreich', country: 'AT', lat: 47.65, lon: 12.31, date: '2026-06-28T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-kaiserwinkl-walchsee/' },
  { id: 'se-ch-quebec', name: 'Challenge Québec', series: 'Challenge', town: 'Québec', region: 'Kanada', country: 'CA', lat: 46.81, lon: -71.21, date: '2026-06-28T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-quebec/' },
  { id: 'se-ch-sandefjord', name: 'Challenge Sandefjord', series: 'Challenge', town: 'Sandefjord', region: 'Norwegen', country: 'NO', lat: 59.13, lon: 10.22, date: '2026-06-28T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-sandefjord/' },
  { id: 'se-ch-gunsan', name: 'Challenge Gunsan-Saemangeum', series: 'Challenge', town: 'Gunsan', region: 'Südkorea', country: 'KR', lat: 35.97, lon: 126.74, date: '2026-07-12T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-gunsan-saemangeum/' },
  { id: 'se-ch-turku', name: 'Challenge Turku', series: 'Challenge', town: 'Turku', region: 'Finnland', country: 'FI', lat: 60.45, lon: 22.27, date: '2026-07-26T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-turku/' },
  { id: 'se-ch-fortaleza', name: 'Challenge Fortaleza', series: 'Challenge', town: 'Fortaleza', region: 'Brasilien', country: 'BR', lat: -3.73, lon: -38.52, date: '2026-08-30T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-fortaleza/' },
  { id: 'se-ch-samarkand', name: 'Challenge Samarkand', series: 'Challenge', town: 'Samarkand', region: 'Usbekistan', country: 'UZ', lat: 39.65, lon: 66.96, date: '2026-09-13T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-samarkand/' },
  { id: 'se-ch-sanremo', name: 'Challenge Sanremo', series: 'Challenge', town: 'Sanremo', region: 'Italien', country: 'IT', lat: 43.82, lon: 7.78, date: '2026-10-04T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-sanremo/' },
  { id: 'se-ch-vieuxboucau', name: 'Challenge Vieux-Boucau', series: 'Challenge', town: 'Vieux-Boucau', region: 'Frankreich', country: 'FR', lat: 43.79, lon: -1.4, date: '2026-10-10T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-vieux-boucau/' },
  { id: 'se-ch-peguera', name: 'Challenge Peguera-Mallorca', series: 'Challenge', town: 'Peguera', region: 'Spanien', country: 'ES', lat: 39.53, lon: 2.45, date: '2026-10-17T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-peguera-mallorca/' },
  { id: 'se-ch-malaysia', name: 'Challenge Malaysia', series: 'Challenge', town: 'Desaru Coast', region: 'Malaysia', country: 'MY', lat: 1.59, lon: 104.27, date: '2026-10-18T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-malaysia/' },
  { id: 'se-ch-shanghai', name: 'Challenge Shanghai', series: 'Challenge', town: 'Shanghai', region: 'China', country: 'CN', lat: 31.23, lon: 121.47, date: '2026-10-24T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-shanghai/' },
  { id: 'se-ch-fortevillage', name: 'Challenge Forte Village (Sardinien)', series: 'Challenge', town: 'Pula', region: 'Italien', country: 'IT', lat: 38.97, lon: 8.92, date: '2026-10-25T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-forte-village/' },
  { id: 'se-ch-xiamen', name: 'Challenge Xiamen', series: 'Challenge', town: 'Xiamen', region: 'China', country: 'CN', lat: 24.48, lon: 118.09, date: '2026-11-07T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-xiamen/' },
  { id: 'se-ch-canberra', name: 'Challenge Canberra', series: 'Challenge', town: 'Canberra', region: 'Australien', country: 'AU', lat: -35.28, lon: 149.13, date: '2026-11-22T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-canberra/' },
  { id: 'se-ch-floripa-nov', name: 'Challenge Florianópolis', series: 'Challenge', town: 'Florianópolis', region: 'Brasilien', country: 'BR', lat: -27.59, lon: -48.55, date: '2026-11-29T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-florianopolis-november/' },
  { id: 'se-ch-israman', name: 'Challenge Israman', series: 'Challenge', town: 'Eilat', region: 'Israel', country: 'IL', lat: 29.56, lon: 34.95, date: '2027-01-29T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-israman/' },
  { id: 'se-ch-sirbaniyas', name: 'Challenge Sir Bani Yas', series: 'Challenge', town: 'Sir Bani Yas', region: 'VAE', country: 'AE', lat: 24.31, lon: 52.59, date: '2027-01-30T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-sir-bani-yas/' },
  { id: 'se-ch-wanaka', name: 'Challenge Wānaka', series: 'Challenge', town: 'Wānaka', region: 'Neuseeland', country: 'NZ', lat: -44.7, lon: 169.14, date: '2027-02-20T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-wanaka/' },
  { id: 'se-ch-mogan', name: 'Challenge Mogán-Gran Canaria', series: 'Challenge', town: 'Mogán', region: 'Spanien', country: 'ES', lat: 27.81, lon: -15.76, date: '2027-04-17T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-mogan-gran-canaria/' },
  { id: 'se-ch-taiwan', name: 'Challenge Taiwan', series: 'Challenge', town: 'Taitung', region: 'Taiwan', country: 'TW', lat: 22.79, lon: 121.14, date: '2027-04-24T07:00:00', distances: [], organizer: 'Challenge Family', websiteUrl: 'https://challengefamily.com/races/challenge-taiwan/' },
  // T100 Triathlon World Tour
  {
    id: 'se-t100-goldcoast', name: 'T100 Gold Coast', series: 'T100',
    town: 'Gold Coast', region: 'AU', country: 'AU', lat: -28.0023, lon: 153.4145,
    date: '2026-03-21T07:00:00', distances: [{ label: 'T100 (100 km)', ...T100D }],
    organizer: 'PTO', websiteUrl: 'https://t100triathlon.com/',
  },
  {
    id: 'se-t100-singapore', name: 'T100 Singapore', series: 'T100',
    town: 'Singapur', region: 'SG', country: 'SG', lat: 1.2897, lon: 103.8501,
    date: '2026-04-25T07:00:00', distances: [{ label: 'T100 (100 km)', ...T100D }],
    organizer: 'PTO', websiteUrl: 'https://t100triathlon.com/',
  },
  {
    id: 'se-t100-vancouver', name: 'T100 Vancouver', series: 'T100',
    town: 'Vancouver', region: 'CA', country: 'CA', lat: 49.2827, lon: -123.1207,
    date: '2026-08-15T07:00:00', distances: [{ label: 'T100 (100 km)', ...T100D }],
    organizer: 'PTO', websiteUrl: 'https://t100triathlon.com/',
  },
];

export const seriesEvents: LocalEvent[] = seed.map((e) => ({
  ...e,
  provider: 'other',
  status: eventStatusFromDate(e.date),
}));

export const seriesEventsById: Record<string, LocalEvent> = Object.fromEntries(
  seriesEvents.map((e) => [e.id, e]),
);
