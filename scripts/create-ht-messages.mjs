import fs from "node:fs";

const fr = JSON.parse(fs.readFileSync("./messages/fr.json", "utf-8"));

// Clone and translate key customer-facing sections to Haitian Creole (Kreyòl Ayisyen)
const ht = JSON.parse(JSON.stringify(fr));

ht.meta.description = "SPORTSBOOK PRO — Paryaj espò, Kazino ak Bòlèt (New York, Florida, Georgia) an mòd Demo pou Ayiti ak Meksik.";

ht.nav = {
  ...ht.nav,
  sports: "Espò",
  lottery: "Bòlèt",
  casino: "Kazino",
  admin: "Admin",
  wallet: "Pòtmonnen",
  myBets: "Paryaj mwen",
  account: "Kont",
  logout: "Dekonekte",
  login: "Konekte",
  register: "Kreye kont",
  home: "Akèy",
  betsShort: "Paryaj",
  myService: "Sèvis mwen",
  myServiceShort: "Sèvis",
  agent: "Espas Vandè",
  agentShort: "Vandè",
};

ht.footer.responsible = "SPORTSBOOK PRO fonksyone sèlman ak kredi demo pou amizman. Pa gen paryaj lajan reyèl. Rezève pou moun 18 an oswa plis. Jwe avèk responsabilite.";

ht.home = {
  ...ht.home,
  kicker: "Espò · Kazino · Bòlèt",
  title: "Parye sou sa w renmen, <accent>an mòd Demo san risk.</accent>",
  subtitle: "Kòt foutbòl entènasyonal, jwèt kazino an dirèk ak bòlèt New York, Florida ak Georgia.",
  ctaSports: "Gade match jodi a",
  ctaRegister: "Eseye Kazino a",
  payments: "Kredi Demo gratis · Faucet disponib.",
  sportsTitle: "Paryaj Espò",
  sportsBody: "Paryaj senp ak konbine sou match foutbòl, baskètbòl ak gwo lig mondyal yo.",
  lotteryTitle: "Bòlèt & Loto",
  lotteryBody: "Chwazi nimewo w: bòlèt 3 lo, loto 3 chif ak maryaj sou tiraj ofisyèl.",
  casinoTitle: "Kazino Pro",
  casinoBody: "Woulèt, Aviator Crash, Blackjack ak Machin a sou ak algorithm transparan.",
  upcoming: "Match k ap vini yo",
  seeAll: "Gade tout",
  noEvents: "Pa gen match pwograme pou kounye a.",
  nextDraw: "Pwochen tiraj",
  closes: "Fèmen",
  drawPitch: "Bòlèt peye jiska 50× sou premye lo a, loto 3 peye 500×.",
  noDraw: "Pa gen tiraj louvri kounye a.",
  heroLive: "An Dirèk · Espò · Kazino · Bòlèt",
  trustPayments: "Kredi Demo Sekirize",
  trustFair: "Rezilta Verifyab",
  trustAge: "18+ Jwèt Responsab",
  heroLastNumbers: "Dènye nimewo yo ·",
};

ht.sports = {
  ...ht.sports,
  title: "Paryaj Espò",
  allLeagues: "Tout lig yo",
  allSports: "Tout espò yo",
  live: "An dirèk",
  upcoming: "K ap vini",
  today: "Jodi a",
  slipTitle: "Fich Paryaj",
  slipEmpty: "Chwazi omwen yon seleksyon pou kòmanse.",
  stake: "Miz (Demo)",
  totalOdds: "Kòt total",
  potentialWin: "Posiblite genyen",
  placeBet: "Valide Paryaj la",
  clearSlip: "Efase fich la",
  single: "Senp",
  combo: "Konbine",
};

ht.lottery = {
  ...ht.lottery,
  title: "Bòlèt & Loto",
  subtitle: "Tiraj ofisyèl New York, Florida ak Georgia",
  quickPick: "Chwa rapid",
  add: "Ajoute",
  ticket: "Fich ou",
  ticketEmpty: "Ajoute omwen yon liy nan fich la.",
  total: "Total",
  buy: "Valide fich la",
  payoutTable: "Tablo Peman",
  results: "Dènye rezilta yo",
};

fs.writeFileSync("./messages/ht.json", JSON.stringify(ht, null, 2), "utf-8");
console.log("Created messages/ht.json successfully!");

