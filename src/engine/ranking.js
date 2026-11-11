// Cálculo del Ranking. Función pura: ordena los Tanques elegibles por puntos
// descendente y, en empate, por joinSeq ascendente. Devuelve la estructura de
// Tablas_Ranking (por ahora solo la tabla "tanques").

/**
 * @param {Array<{id:number,nick:string,score:number,isBot:boolean,joinSeq:number}>} tanks
 * @param {{ botsInRanking: boolean }} opts
 * @returns {{ tables: Array<{ name: string, entries: Array }> }}
 */
export function computeRanking(tanks, { botsInRanking }) {
  const eligible = tanks.filter((t) => !t.isBot || botsInRanking);
  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinSeq - b.joinSeq;
  });
  const entries = eligible.map((t, i) => ({
    position: i + 1,
    id: t.id,
    nick: t.nick,
    score: t.score,
    isBot: t.isBot,
  }));
  return { tables: [{ name: "tanques", entries }] };
}
