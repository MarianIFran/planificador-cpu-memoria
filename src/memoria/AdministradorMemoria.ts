import type { BloqueLectura } from './BloqueLectura';

/**
 * Contrato de la gestion de memoria principal (RF04, RF05).
 * El simulador depende de esta interfaz y no de una clase concreta.
 */
export interface AdministradorMemoria {
  readonly memoriaTotal: number;
  readonly memoriaLibre: number;
  readonly memoriaOcupada: number;
  /** Tamanio del mayor hueco contiguo; 0 si no hay bloques libres. */
  readonly mayorBloqueLibre: number;
  readonly nombrePolitica: string;

  /** @returns true si se asigno; false si no hay un hueco contiguo suficiente. */
  asignar(pid: number, tamanio: number): boolean;

  /** Libera el bloque del proceso y fusiona los huecos vecinos (coalescencia). */
  liberar(pid: number): void;

  tieneAsignado(pid: number): boolean;

  /** Copia de solo lectura del mapa de memoria, ordenado por direccion. */
  mapa(): readonly BloqueLectura[];
}