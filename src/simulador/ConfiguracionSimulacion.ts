import type { PoliticaAsignacion } from '../memoria/PoliticaAsignacion';

/** Memoria de referencia de la consigna, en KB. */
export const MEMORIA_REFERENCIA = 1024;
/** Quantum de referencia de la consigna, en ticks. */
export const QUANTUM_REFERENCIA = 2;

/** Parametros de la simulacion (RF01). Lo que no se indica toma el valor de referencia. */
export interface ConfiguracionSimulacion {
  /** Memoria principal en KB. Por defecto 1024. */
  readonly memoriaTotal?: number;
  /** Ticks de CPU por turno. Por defecto 2. */
  readonly quantum?: number;
  /** Politica de asignacion contigua. Por defecto First-Fit. */
  readonly politica?: PoliticaAsignacion;
}