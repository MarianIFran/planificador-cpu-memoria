import { exigirEnteroPositivo } from '../errores';

/**
 * Evento determinista de Entrada/Salida (RF08).
 * Se dispara cuando el proceso lleva consumidos `trasCpu` ticks de CPU
 * y lo deja bloqueado durante `duracion` ticks. Es inmutable.
 */
export class EventoES {
  readonly #trasCpu: number;
  readonly #duracion: number;

  constructor(trasCpu: number, duracion: number) {
    exigirEnteroPositivo(trasCpu, 'El disparo del evento de E/S');
    exigirEnteroPositivo(duracion, 'La duracion del evento de E/S');
    this.#trasCpu = trasCpu;
    this.#duracion = duracion;
  }

  get trasCpu(): number {
    return this.#trasCpu;
  }

  get duracion(): number {
    return this.#duracion;
  }
}