import type { EstadoProceso } from './EstadoProceso';

/**
 * Vista de solo lectura de un proceso (RF02, RF10).
 * Es lo unico que se muestra hacia afuera: no tiene metodos que cambien el estado.
 */
export interface ProcesoLectura {
  readonly pid: number;
  readonly memoriaRequerida: number;
  readonly cpuTotal: number;
  readonly cpuRestante: number;
  readonly cpuConsumida: number;
  readonly estado: EstadoProceso;
  readonly quantumConsumido: number;
  readonly bloqueoRestante: number;
}