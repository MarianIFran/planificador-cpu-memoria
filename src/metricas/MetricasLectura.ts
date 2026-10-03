/** Metricas de la simulacion, calculadas al finalizar cada tick (RF09). */
export interface MetricasLectura {
  /** 100 x memoria ocupada / memoria total. */
  readonly ocupacionMemoria: number;
  /** 100 x ticks con CPU ocupada / ticks transcurridos. En el tick 0 vale 0. */
  readonly utilizacionCpu: number;
  /** Expulsiones por quantum con otros Listos + bloqueos por E/S. */
  readonly cambiosDeContexto: number;
  /** Suma de los tamanios de todos los bloques libres, en KB. */
  readonly memoriaLibre: number;
  /** Tamanio del mayor bloque libre, en KB; 0 si no hay. */
  readonly mayorBloqueLibre: number;
  /** 100 x (1 - mayor bloque libre / memoria libre). Si no hay memoria libre vale 0. */
  readonly fragmentacionExterna: number;
}