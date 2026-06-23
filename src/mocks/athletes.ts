import type { Athlete } from '@/types';

/**
 * Top ~100 real triathletes a German fan / age-grouper would follow.
 * Ordered German-first, then international stars (the Following hub uses this
 * order for its suggestions). Names/countries/series are real public facts;
 * `series` tags the circuits each athlete is best known for. No fabricated data.
 *
 * T100 membership is verified against the official 2024 & 2025 T100 World Tour
 * rosters (only confirmed starters carry `t100`; never guessed). `pto` is
 * retired here — the PTO Tour was rebranded T100. From 2026 T100 has no fixed
 * contracts (per-event invites), so the long-term truth source is the live
 * start lists (PTO/World Triathlon) — to be wired in the data pipeline (Pi).
 */
export const athletes: Athlete[] = [
  // — Deutsche Stars: Langdistanz —
  { id: 'patrick-lange', name: 'Patrick Lange', country: 'DE', gender: 'men', series: ['ironman', 'ironman703'], bio: 'Mehrfacher Ironman-Weltmeister (Kona).', achievements: ['Ironman-Weltmeister 2017, 2018 & 2024 (Kona)', 'Ironman-WM-Streckenrekord 2018'] },
  { id: 'frederic-funk', name: 'Frederic Funk', country: 'DE', gender: 'men', series: ['t100', 'ironman703', 'ironman'], bio: 'T100- und Mitteldistanz-Star.' },
  { id: 'jan-frodeno', name: 'Jan Frodeno', country: 'DE', gender: 'men', series: ['ironman'], bio: 'Triathlon-Legende, 3× Ironman-Weltmeister & Olympiasieger.', achievements: ['Olympiasieger 2008', 'Ironman-Weltmeister 2015, 2016 & 2019', '70.3-Weltmeister 2015 & 2018'] },
  { id: 'sebastian-kienle', name: 'Sebastian Kienle', country: 'DE', gender: 'men', series: ['ironman', 'ironman703'], bio: 'Ironman-Weltmeister 2014.', achievements: ['Ironman-Weltmeister 2014', '70.3-Weltmeister 2012'] },
  { id: 'florian-angert', name: 'Florian Angert', country: 'DE', gender: 'men', series: ['ironman', 'ironman703'] },
  { id: 'andreas-dreitz', name: 'Andreas Dreitz', country: 'DE', gender: 'men', series: ['ironman', 'ironman703'] },
  { id: 'mika-noodt', name: 'Mika Noodt', country: 'DE', gender: 'men', series: ['ironman', 'ironman703', 't100'] },
  { id: 'jonas-hoffmann', name: 'Jonas Hoffmann', country: 'DE', gender: 'men', series: ['ironman703', 'ironman'] },
  { id: 'maurice-clavel', name: 'Maurice Clavel', country: 'DE', gender: 'men', series: ['ironman'] },
  { id: 'franz-loeschke', name: 'Franz Löschke', country: 'DE', gender: 'men', series: ['ironman703'] },
  { id: 'marc-dubrick', name: 'Marc Dubrick', country: 'DE', gender: 'men', series: ['ironman703'] },
  // — Deutsche Stars: Kurzdistanz (WTCS) —
  { id: 'tim-hellwig', name: 'Tim Hellwig', country: 'DE', gender: 'men', series: ['wtcs'] },
  { id: 'jonas-schomburg', name: 'Jonas Schomburg', country: 'DE', gender: 'men', series: ['ironman', 'ironman703'], bio: 'Langdistanz-Shootingstar (2. bei der Challenge Roth 2025), zuvor Kurzdistanz.' },
  { id: 'rico-bogen', name: 'Rico Bogen', country: 'DE', gender: 'men', series: ['ironman703', 't100', 'ironman'], bio: 'IRONMAN-70.3-Weltmeister 2023 – damals jüngster Weltmeister der 70.3-Geschichte.' },
  { id: 'lasse-luehrs', name: 'Lasse Lührs', country: 'DE', gender: 'men', series: ['wtcs'] },
  { id: 'lasse-nygaard-priester', name: 'Lasse Nygaard-Priester', country: 'DE', gender: 'men', series: ['ironman703'], bio: 'Mitteldistanz-Spezialist (Ironman 70.3), Wechsel von der Kurzdistanz.' },
  { id: 'simon-henseleit', name: 'Simon Henseleit', country: 'DE', gender: 'men', series: ['wtcs'] },
  { id: 'justus-nieschlag', name: 'Justus Nieschlag', country: 'DE', gender: 'men', series: ['wtcs', 't100'] },
  // — Deutsche Frauen: Langdistanz —
  { id: 'anne-haug', name: 'Anne Haug', country: 'DE', gender: 'women', series: ['ironman', 'ironman703', 't100'], bio: 'Ironman-Weltmeisterin 2019; 2025 zurückgetreten.', achievements: ['Ironman-Weltmeisterin 2019 (Kona)'] },
  { id: 'laura-philipp', name: 'Laura Philipp', country: 'DE', gender: 'women', series: ['ironman', 'ironman703', 't100'], bio: 'Ironman-Weltmeisterin 2024.', achievements: ['Ironman-Weltmeisterin 2024'] },
  { id: 'daniela-bleymehl', name: 'Daniela Bleymehl', country: 'DE', gender: 'women', series: ['ironman'] },
  { id: 'svenja-thoes', name: 'Svenja Thoes', country: 'DE', gender: 'women', series: ['ironman703'] },
  // — Deutsche Frauen: Kurzdistanz —
  { id: 'laura-lindemann', name: 'Laura Lindemann', country: 'DE', gender: 'women', series: ['wtcs'], bio: 'Deutschlands Topstar auf der Kurzdistanz.' },
  { id: 'lisa-tertsch', name: 'Lisa Tertsch', country: 'DE', gender: 'women', series: ['wtcs'], bio: 'Kurzdistanz-Weltmeisterin 2025.' },
  { id: 'nina-eim', name: 'Nina Eim', country: 'DE', gender: 'women', series: ['wtcs'] },
  { id: 'annika-koch', name: 'Annika Koch', country: 'DE', gender: 'women', series: ['wtcs'] },
  { id: 'lena-meissner', name: 'Lena Meißner', country: 'DE', gender: 'women', series: ['wtcs'] },

  // — International: Kurzdistanz Männer —
  { id: 'alex-yee', name: 'Alex Yee', country: 'GB', gender: 'men', series: ['wtcs'], bio: 'Olympiasieger 2024.' },
  { id: 'hayden-wilde', name: 'Hayden Wilde', country: 'NZ', gender: 'men', series: ['wtcs', 't100'] },
  { id: 'leo-bergere', name: 'Léo Bergère', country: 'FR', gender: 'men', series: ['wtcs', 't100'] },
  { id: 'dorian-coninx', name: 'Dorian Coninx', country: 'FR', gender: 'men', series: ['wtcs'], bio: 'Weltmeister 2023.' },
  { id: 'vincent-luis', name: 'Vincent Luis', country: 'FR', gender: 'men', series: ['wtcs', 't100'] },
  { id: 'pierre-le-corre', name: 'Pierre Le Corre', country: 'FR', gender: 'men', series: ['wtcs'] },
  { id: 'matthew-hauser', name: 'Matthew Hauser', country: 'AU', gender: 'men', series: ['wtcs'] },
  { id: 'jelle-geens', name: 'Jelle Geens', country: 'BE', gender: 'men', series: ['wtcs', 'ironman703', 't100'] },
  { id: 'vasco-vilaca', name: 'Vasco Vilaça', country: 'PT', gender: 'men', series: ['wtcs'] },
  { id: 'marten-van-riel', name: 'Marten Van Riel', country: 'BE', gender: 'men', series: ['wtcs', 't100'], bio: 'T100-Champion 2024.' },
  { id: 'csongor-lehmann', name: 'Csongor Lehmann', country: 'HU', gender: 'men', series: ['wtcs'] },
  { id: 'bence-bicsak', name: 'Bence Bicsák', country: 'HU', gender: 'men', series: ['wtcs'] },
  { id: 'manoel-messias', name: 'Manoel Messias', country: 'BR', gender: 'men', series: ['wtcs'] },
  { id: 'miguel-hidalgo', name: 'Miguel Hidalgo', country: 'BR', gender: 'men', series: ['wtcs'] },
  // — Legenden Kurzdistanz —
  { id: 'alistair-brownlee', name: 'Alistair Brownlee', country: 'GB', gender: 'men', series: ['wtcs', 'ironman703', 't100'], bio: '2× Olympiasieger.' },
  { id: 'jonathan-brownlee', name: 'Jonathan Brownlee', country: 'GB', gender: 'men', series: ['wtcs'] },
  { id: 'javier-gomez', name: 'Javier Gómez', country: 'ES', gender: 'men', series: ['wtcs', 'ironman703', 't100'], bio: '5× Weltmeister.' },
  { id: 'mario-mola', name: 'Mario Mola', country: 'ES', gender: 'men', series: ['wtcs'] },

  // — International: Langdistanz / T100 Männer —
  { id: 'kristian-blummenfelt', name: 'Kristian Blummenfelt', country: 'NO', gender: 'men', series: ['ironman', 'ironman703', 'wtcs'], bio: 'Olympiasieger & Ironman-Weltmeister.' },
  { id: 'gustav-iden', name: 'Gustav Iden', country: 'NO', gender: 'men', series: ['ironman', 'ironman703'] },
  { id: 'sam-laidlow', name: 'Sam Laidlow', country: 'FR', gender: 'men', series: ['ironman', 't100'], bio: 'Ironman-Weltmeister 2023.' },
  { id: 'magnus-ditlev', name: 'Magnus Ditlev', country: 'DK', gender: 'men', series: ['ironman', 't100'] },
  { id: 'lionel-sanders', name: 'Lionel Sanders', country: 'CA', gender: 'men', series: ['ironman', 'ironman703', 't100'] },
  { id: 'leon-chevalier', name: 'Leon Chevalier', country: 'FR', gender: 'men', series: ['ironman', 't100'] },
  { id: 'daniel-baekkegard', name: 'Daniel Bækkegård', country: 'DK', gender: 'men', series: ['ironman', 't100'] },
  { id: 'rudy-von-berg', name: 'Rudy Von Berg', country: 'US', gender: 'men', series: ['ironman703', 't100'] },
  { id: 'sam-long', name: 'Sam Long', country: 'US', gender: 'men', series: ['ironman', 'ironman703', 't100'] },
  { id: 'ben-kanute', name: 'Ben Kanute', country: 'US', gender: 'men', series: ['ironman703', 't100'] },
  { id: 'jason-west', name: 'Jason West', country: 'US', gender: 'men', series: ['ironman703', 't100'] },
  { id: 'trevor-foley', name: 'Trevor Foley', country: 'US', gender: 'men', series: ['ironman'] },
  { id: 'kyle-smith', name: 'Kyle Smith', country: 'NZ', gender: 'men', series: ['ironman703', 't100'] },
  { id: 'braden-currie', name: 'Braden Currie', country: 'NZ', gender: 'men', series: ['ironman'] },
  { id: 'cameron-wurf', name: 'Cameron Wurf', country: 'AU', gender: 'men', series: ['ironman'] },
  { id: 'matt-hanson', name: 'Matt Hanson', country: 'US', gender: 'men', series: ['ironman'] },
  { id: 'patrik-nilsson', name: 'Patrik Nilsson', country: 'SE', gender: 'men', series: ['ironman'] },
  { id: 'joe-skipper', name: 'Joe Skipper', country: 'GB', gender: 'men', series: ['ironman'] },
  { id: 'pieter-heemeryck', name: 'Pieter Heemeryck', country: 'BE', gender: 'men', series: ['ironman', 't100'] },
  { id: 'denis-chevrot', name: 'Denis Chevrot', country: 'FR', gender: 'men', series: ['ironman'] },
  { id: 'youri-keulen', name: 'Youri Keulen', country: 'NL', gender: 'men', series: ['t100'] },
  { id: 'mathis-margirier', name: 'Mathis Margirier', country: 'FR', gender: 'men', series: ['ironman703', 't100'] },

  // — International: Kurzdistanz Frauen —
  { id: 'cassandre-beaugrand', name: 'Cassandre Beaugrand', country: 'FR', gender: 'women', series: ['wtcs'], bio: 'Olympiasiegerin 2024.' },
  { id: 'beth-potter', name: 'Beth Potter', country: 'GB', gender: 'women', series: ['wtcs'], bio: 'Weltmeisterin 2023.' },
  { id: 'georgia-taylor-brown', name: 'Georgia Taylor-Brown', country: 'GB', gender: 'women', series: ['wtcs'] },
  { id: 'flora-duffy', name: 'Flora Duffy', country: 'BM', gender: 'women', series: ['wtcs', 't100'], bio: 'Olympiasiegerin 2021.' },
  { id: 'taylor-knibb', name: 'Taylor Knibb', country: 'US', gender: 'women', series: ['wtcs', 'ironman703', 't100'] },
  { id: 'emma-lombardi', name: 'Emma Lombardi', country: 'FR', gender: 'women', series: ['wtcs'] },
  { id: 'julie-derron', name: 'Julie Derron', country: 'CH', gender: 'women', series: ['wtcs', 't100'], bio: 'Olympia-Silber 2024.' },
  { id: 'maya-kingma', name: 'Maya Kingma', country: 'NL', gender: 'women', series: ['wtcs'] },
  { id: 'sophie-coldwell', name: 'Sophie Coldwell', country: 'GB', gender: 'women', series: ['wtcs'] },
  { id: 'kate-waugh', name: 'Kate Waugh', country: 'GB', gender: 'women', series: ['wtcs', 't100'] },
  { id: 'bianca-seregni', name: 'Bianca Seregni', country: 'IT', gender: 'women', series: ['wtcs'] },
  { id: 'leonie-periault', name: 'Léonie Périault', country: 'FR', gender: 'women', series: ['wtcs'] },
  { id: 'lisa-perterer', name: 'Lisa Perterer', country: 'AT', gender: 'women', series: ['wtcs'] },
  { id: 'jeanne-lehair', name: 'Jeanne Lehair', country: 'LU', gender: 'women', series: ['wtcs'] },
  { id: 'nicola-spirig', name: 'Nicola Spirig', country: 'CH', gender: 'women', series: ['wtcs'], bio: 'Olympiasiegerin 2012.' },
  { id: 'gwen-jorgensen', name: 'Gwen Jorgensen', country: 'US', gender: 'women', series: ['wtcs'], bio: 'Olympiasiegerin 2016.' },

  // — International: Langdistanz / T100 Frauen —
  { id: 'lucy-charles-barclay', name: 'Lucy Charles-Barclay', country: 'GB', gender: 'women', series: ['ironman', 'ironman703', 't100'], bio: 'Ironman-Weltmeisterin 2023.' },
  { id: 'kat-matthews', name: 'Kat Matthews', country: 'GB', gender: 'women', series: ['ironman', 't100'] },
  { id: 'chelsea-sodaro', name: 'Chelsea Sodaro', country: 'US', gender: 'women', series: ['ironman', 't100'], bio: 'Ironman-Weltmeisterin 2022.' },
  { id: 'ashleigh-gentle', name: 'Ashleigh Gentle', country: 'AU', gender: 'women', series: ['t100', 'ironman703'] },
  { id: 'daniela-ryf', name: 'Daniela Ryf', country: 'CH', gender: 'women', series: ['ironman', 'ironman703', 't100'], bio: '5× Ironman-Weltmeisterin.' },
  { id: 'paula-findlay', name: 'Paula Findlay', country: 'CA', gender: 'women', series: ['t100'] },
  { id: 'holly-lawrence', name: 'Holly Lawrence', country: 'GB', gender: 'women', series: ['ironman703', 't100'] },
  { id: 'imogen-simmonds', name: 'Imogen Simmonds', country: 'CH', gender: 'women', series: ['t100', 'ironman703'] },
  { id: 'india-lee', name: 'India Lee', country: 'GB', gender: 'women', series: ['t100'] },
  { id: 'fenella-langridge', name: 'Fenella Langridge', country: 'GB', gender: 'women', series: ['ironman', 't100'] },
  { id: 'grace-thek', name: 'Grace Thek', country: 'US', gender: 'women', series: ['t100'] },
  { id: 'tamara-jewett', name: 'Tamara Jewett', country: 'CA', gender: 'women', series: ['t100', 'ironman703'] },
  { id: 'penny-slater', name: 'Penny Slater', country: 'AU', gender: 'women', series: ['t100'] },
  { id: 'els-visser', name: 'Els Visser', country: 'NL', gender: 'women', series: ['ironman', 't100'] },
  { id: 'laura-siddall', name: 'Laura Siddall', country: 'GB', gender: 'women', series: ['ironman'] },
  { id: 'marjolaine-pierre', name: 'Marjolaine Pierré', country: 'FR', gender: 'women', series: ['t100'] },
  { id: 'hanne-de-vet', name: 'Hanne De Vet', country: 'BE', gender: 'women', series: ['t100'] },
  { id: 'rebecca-clarke', name: 'Rebecca Clarke', country: 'NZ', gender: 'women', series: ['ironman703'] },
];

export const athletesById: Record<string, Athlete> = Object.fromEntries(
  athletes.map((a) => [a.id, a]),
);
