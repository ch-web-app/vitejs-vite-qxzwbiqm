import { RANKS, RankValue } from '../types';

const STORAGE_KEY = 'cutego_player_elo';
const DEFAULT_ELO = 1200;

export const getStoredElo = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_ELO;
  } catch {
    return DEFAULT_ELO;
  }
};

export const saveElo = (elo: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, elo.toString());
  } catch (e) {
    console.error("Failed to save ELO", e);
  }
};

// Calculate Expected Score based on ELO difference
// E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
const getExpectedScore = (playerElo: number, opponentElo: number): number => {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
};

export const calculateRatingChange = (playerElo: number, aiRankValue: RankValue, result: 'win' | 'loss'): number => {
  const aiRank = RANKS.find(r => r.value === aiRankValue);
  const aiElo = aiRank ? aiRank.elo : 1500;
  
  const kFactor = 32; // Standard K-factor for amateur play
  const actualScore = result === 'win' ? 1 : 0;
  const expectedScore = getExpectedScore(playerElo, aiElo);
  
  const change = Math.round(kFactor * (actualScore - expectedScore));
  return change;
};

export const getRankLabelFromElo = (elo: number): string => {
  // Find the closest rank
  let closest: typeof RANKS[number] = RANKS[0];
  let minDiff = Math.abs(elo - RANKS[0].elo);

  for (const rank of RANKS) {
    const diff = Math.abs(elo - rank.elo);
    if (diff < minDiff) {
      minDiff = diff;
      closest = rank;
    }
  }
  return closest.value;
};