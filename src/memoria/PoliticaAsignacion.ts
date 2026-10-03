import type { BloqueLectura } from './BloqueLectura';

/** Valor que devuelve una politica cuando ningun bloque sirve. */
export const SIN_BLOQUE = -1;

/**
 * Contrato comun de las politicas de asignacion contigua (RF04).
 * El gestor de memoria solo conoce esta interfaz, no las clases concretas.
 */
export interface PoliticaAsignacion {
  readonly nombre: string;

  /**
   * Elige en que bloque libre ubicar un pedido.
   * @param bloques mapa de memoria ordenado por direccion.
   * @param tamanio KB pedidos.
   * @returns indice del bloque elegido, o SIN_BLOQUE si ninguno alcanza.
   */
  elegir(bloques: readonly BloqueLectura[], tamanio: number): number;
}