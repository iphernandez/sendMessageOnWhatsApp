import { TdpWeights } from './tdp.model';

export interface SeasonConfig {
  id: string;
  /** Whether PtsTemporadaAnterior is added into the sum feeding Puntos (confirmed: true). */
  ptsTemporadaAnteriorIncludedInSum: boolean;
  weights: TdpWeights;
}
