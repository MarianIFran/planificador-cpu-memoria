import { ErrorSimulacion, exigirEnteroPositivo } from '../errores';
import type { BloqueLectura } from './BloqueLectura';

/**
 * Bloque contiguo de memoria. Es inmutable: para dividir o fusionar,
 * el gestor crea bloques nuevos en lugar de modificar los existentes.
 */
export class BloqueMemoria implements BloqueLectura {
  readonly #inicio: number;
  readonly #tamanio: number;
  readonly #pid: number | null;

  constructor(inicio: number, tamanio: number, pid: number | null = null) {
    if (!Number.isInteger(inicio) || inicio < 0) {
      throw new ErrorSimulacion(`El inicio del bloque debe ser un entero >= 0 (recibido: ${inicio})`);
    }
    exigirEnteroPositivo(tamanio, 'El tamanio del bloque');
    if (pid !== null) {
      exigirEnteroPositivo(pid, 'El PID del bloque');
    }
    this.#inicio = inicio;
    this.#tamanio = tamanio;
    this.#pid = pid;
  }

  get inicio(): number {
    return this.#inicio;
  }

  get tamanio(): number {
    return this.#tamanio;
  }

  get pid(): number | null {
    return this.#pid;
  }

  get libre(): boolean {
    return this.#pid === null;
  }

  /** Primera direccion despues del bloque. */
  get fin(): number {
    return this.#inicio + this.#tamanio;
  }

  /** Copia congelada, segura para entregar hacia afuera. */
  instantanea(): BloqueLectura {
    return Object.freeze({
      inicio: this.#inicio,
      tamanio: this.#tamanio,
      pid: this.#pid,
      libre: this.libre,
    });
  }
}