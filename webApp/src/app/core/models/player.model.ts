export interface Player {
  id: string;
  galactico: string;
  bullying: string;
  wanombre: string;
  wanumber: string;
  posicion: number;
  activo: boolean;
  /** Foreign-player quota flag (legend "Cupo ExPat" in the original spreadsheet). */
  cupoExPat: boolean;
  /** Hosted the field in the previous season -> seeds PtsTemporadaAnterior. */
  sedeTemporadaAnterior: boolean;
  /** Single lifetime flag (not per-year, unlike the other TDP categories) - contributes TdpWeights.socioFundador once. */
  socioFundador: boolean;
}
