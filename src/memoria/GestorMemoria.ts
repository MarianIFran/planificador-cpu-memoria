import { ErrorSimulacion, exigirEnteroPositivo } from '../errores';
import type { AdministradorMemoria } from './AdministradorMemoria';
import type { BloqueLectura } from './BloqueLectura';
import { BloqueMemoria } from './BloqueMemoria';
import { SIN_BLOQUE, type PoliticaAsignacion } from './PoliticaAsignacion';

/**
 * Memoria principal con asignacion contigua.
 * Mantiene una lista de bloques ordenada por direccion, sin huecos ni solapamientos,
 * cuya suma de tamanios siempre es igual a la memoria total.
 */
export class GestorMemoria implements AdministradorMemoria {
  readonly #memoriaTotal: number;
  readonly #politica: PoliticaAsignacion;
  #bloques: BloqueMemoria[];

  constructor(memoriaTotal: number, politica: PoliticaAsignacion) {
    exigirEnteroPositivo(memoriaTotal, 'La memoria total');
    this.#memoriaTotal = memoriaTotal;
    this.#politica = politica;
    this.#bloques = [new BloqueMemoria(0, memoriaTotal)];
  }

  get memoriaTotal(): number {
    return this.#memoriaTotal;
  }

  get nombrePolitica(): string {
    return this.#politica.nombre;
  }

  get memoriaLibre(): number {
    return this.#bloquesLibres().reduce((suma, bloque) => suma + bloque.tamanio, 0);
  }

  get memoriaOcupada(): number {
    return this.#memoriaTotal - this.memoriaLibre;
  }

  get mayorBloqueLibre(): number {
    return this.#bloquesLibres().reduce((mayor, bloque) => Math.max(mayor, bloque.tamanio), 0);
  }

  asignar(pid: number, tamanio: number): boolean {
    exigirEnteroPositivo(pid, 'El PID');
    exigirEnteroPositivo(tamanio, 'El tamanio pedido');
    if (this.tieneAsignado(pid)) {
      throw new ErrorSimulacion(`El proceso ${pid} ya tiene memoria asignada`);
    }

    const indice = this.#politica.elegir(this.mapa(), tamanio);
    if (indice === SIN_BLOQUE) {
      return false;
    }
    const elegido = this.#bloques[indice];
    if (elegido === undefined || !elegido.libre || elegido.tamanio < tamanio) {
      throw new ErrorSimulacion(`La politica ${this.#politica.nombre} eligio un bloque invalido`);
    }

    // El bloque elegido se reemplaza por el ocupado y, si sobra espacio, por el resto libre.
    const reemplazo = [new BloqueMemoria(elegido.inicio, tamanio, pid)];
    const sobrante = elegido.tamanio - tamanio;
    if (sobrante > 0) {
      reemplazo.push(new BloqueMemoria(elegido.inicio + tamanio, sobrante));
    }
    this.#bloques.splice(indice, 1, ...reemplazo);
    return true;
  }

  tieneAsignado(pid: number): boolean {
    return this.#bloques.some((bloque) => bloque.pid === pid);
  }

  mapa(): readonly BloqueLectura[] {
    return Object.freeze(this.#bloques.map((bloque) => bloque.instantanea()));
  }

  #bloquesLibres(): BloqueMemoria[] {
    return this.#bloques.filter((bloque) => bloque.libre);
  }
}