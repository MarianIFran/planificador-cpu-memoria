import type { Proceso } from '../proceso/Proceso';
import type { ProcesoLectura } from '../proceso/ProcesoLectura';

/** Que paso en la CPU durante un tick. */
export enum ResultadoCpu {
  /** No habia ningun proceso para ejecutar. */
  Ociosa = 'OCIOSA',
  /** El proceso ejecuto y sigue en CPU con quantum disponible. */
  Continua = 'CONTINUA',
  /** El proceso ejecuto y consumio toda su CPU. */
  Termino = 'TERMINO',
  /** El proceso ejecuto y se bloqueo por Entrada/Salida. */
  Bloqueo = 'BLOQUEO',
  /** El proceso agoto su quantum y volvio al final de la cola de Listos. */
  Expulsion = 'EXPULSION',
  /** El proceso agoto su quantum pero no habia otros Listos: sigue en CPU. */
  RenovoQuantum = 'RENOVO_QUANTUM',
}

export interface ResultadoTick {
  readonly resultado: ResultadoCpu;
  /** Proceso que uso la CPU en este tick, o null si estuvo ociosa. */
  readonly proceso: Proceso | null;
}

/**
 * Contrato de la planificacion de CPU (RF07).
 * El simulador depende de esta interfaz, no de Round-Robin en particular.
 */
export interface PlanificadorCpu {
  readonly quantum: number;
  readonly cambiosDeContexto: number;
  /** Copia de solo lectura del proceso en CPU, o null si esta libre. */
  readonly enEjecucion: ProcesoLectura | null;

  /** Copia de solo lectura de la cola de Listos, en orden de atencion. */
  listos(): readonly ProcesoLectura[];

  /** Agrega un proceso Listo al final de la cola. */
  encolar(proceso: Proceso): void;

  /** Despacha si la CPU esta libre y ejecuta como maximo una unidad de CPU. */
  ejecutarTick(): ResultadoTick;
}