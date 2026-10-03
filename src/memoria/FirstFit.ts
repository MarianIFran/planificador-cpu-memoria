import type { BloqueLectura } from './BloqueLectura';
import type { PoliticaAsignacion } from './PoliticaAsignacion';

/** Primer ajuste: el primer bloque libre suficiente, recorriendo por direccion. */
export class FirstFit implements PoliticaAsignacion {
  readonly nombre = 'First-Fit';

  elegir(bloques: readonly BloqueLectura[], tamanio: number): number {
    return bloques.findIndex((bloque) => bloque.libre && bloque.tamanio >= tamanio);
  }
}