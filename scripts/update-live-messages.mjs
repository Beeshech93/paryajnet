import fs from "node:fs";

const files = {
  es: {
    navLive: "En Vivo",
    live: {
      title: "SPORTSBOOK PRO · En Vivo",
      subtitle: "Acción en tiempo real: partidos en juego minuto a minuto y salas de casino en vivo.",
      sportsTab: "Deportes En Vivo",
      casinoTab: "Casino En Vivo",
      inPlayMatches: "Partidos en Juego",
      liveDealers: "Mesas en Vivo",
      activePlayers: "Jugadores conectados",
      recentBets: "Apuestas en vivo de jugadores",
      roundStatus: "Estado de la mesa",
      bettingOpen: "Hagan sus apuestas",
      spinning: "Girando ruleta en vivo...",
      dealing: "Repartiendo cartas...",
      pitchTracker: "Radar de Partido en Vivo",
      possession: "Posesión",
      attacks: "Ataques peligrosos",
    }
  },
  ht: {
    navLive: "An Dirèk",
    live: {
      title: "SPORTSBOOK PRO · An Dirèk",
      subtitle: "Aksyon an tan reyèl: match k ap jwe minit pa minit ak tab kazino an dirèk.",
      sportsTab: "Espò An Dirèk",
      casinoTab: "Kazino An Dirèk",
      inPlayMatches: "Match k ap jwe kounye a",
      liveDealers: "Tab An Dirèk",
      activePlayers: "Jwè ki konekte",
      recentBets: "Paryaj lòt jwè an dirèk",
      roundStatus: "Eta tab la",
      bettingOpen: "Mete miz ou yo",
      spinning: "Woulèt la ap vire an dirèk...",
      dealing: "Koutye a ap bay kat yo...",
      pitchTracker: "Siveyans Match An Dirèk",
      possession: "Posesyon",
      attacks: "Atak danjere",
    }
  },
  fr: {
    navLive: "En Direct",
    live: {
      title: "SPORTSBOOK PRO · En Direct",
      subtitle: "Action en temps réel : matchs en direct et tables de casino avec croupier en direct.",
      sportsTab: "Sports En Direct",
      casinoTab: "Casino En Direct",
      inPlayMatches: "Matchs en cours",
      liveDealers: "Tables En Direct",
      activePlayers: "Joueurs en ligne",
      recentBets: "Paris récents en direct",
      roundStatus: "État de la table",
      bettingOpen: "Faites vos jeux",
      spinning: "Tirage en direct...",
      dealing: "Distribution des cartes...",
      pitchTracker: "Radar de Match En Direct",
      possession: "Possession",
      attacks: "Attaques dangereuses",
    }
  },
  en: {
    navLive: "Live",
    live: {
      title: "SPORTSBOOK PRO · Live Arena",
      subtitle: "Real-time action: in-play match tracker, live odds, and live casino dealer tables.",
      sportsTab: "Live Sports",
      casinoTab: "Live Casino",
      inPlayMatches: "In-Play Matches",
      liveDealers: "Live Dealer Tables",
      activePlayers: "Players Online",
      recentBets: "Live Multiplayer Bets",
      roundStatus: "Round Status",
      bettingOpen: "Place your bets",
      spinning: "Wheel spinning live...",
      dealing: "Dealing cards...",
      pitchTracker: "Live Match Tracker",
      possession: "Possession",
      attacks: "Dangerous Attacks",
    }
  },
  pt: {
    navLive: "Ao Vivo",
    live: {
      title: "SPORTSBOOK PRO · Ao Vivo",
      subtitle: "Ação em tempo real: jogos em andamento e mesas de cassino ao vivo.",
      sportsTab: "Esportes Ao Vivo",
      casinoTab: "Cassino Ao Vivo",
      inPlayMatches: "Jogos em Andamento",
      liveDealers: "Mesas Ao Vivo",
      activePlayers: "Jogadores Online",
      recentBets: "Apostas em tempo real",
      roundStatus: "Status da mesa",
      bettingOpen: "Façam suas apostas",
      spinning: "Girando a roleta...",
      dealing: "Distribuindo cartas...",
      pitchTracker: "Radar do Jogo",
      possession: "Posse de bola",
      attacks: "Ataques perigosos",
    }
  }
};

for (const [lang, data] of Object.entries(files)) {
  const filePath = `./messages/${lang}.json`;
  if (fs.existsSync(filePath)) {
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    json.nav = json.nav || {};
    json.nav.live = data.navLive;
    json.live = data.live;
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf-8");
    console.log(`Updated ${filePath}`);
  }
}
