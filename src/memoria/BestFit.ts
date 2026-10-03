import type { BloqueLectura } from './BloqueLectura';
import { SIN_BLOQUE, type PoliticaAsignacion } from './PoliticaAsignacion';

/** Mejor ajuste: el bloque libre suficiente mas chico. En empate, el de menor direccion. */
export class BestFit implements PoliticaAsignacion {
  readonly nombre = 'Best-Fit';

  elegir(bloques: readonly BloqueLectura[], tamanio: number): number {
    let elegido = SIN_BLOQUE;
    bloques.forEach((bloque, indice) => {
      if (!bloque.libre || bloque.tamanio < tamanio) {
        return;
      }
      // Comparacion estricta: ante un empate se queda el primero (menor direccion).
      if (elegido === SIN_BLOQUE || bloque.tamanio < bloques[elegido].tamanio) {
        elegido = indice;
      }
    });
    return elegido;
  }
}