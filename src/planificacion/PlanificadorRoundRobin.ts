import { ErrorSimulacion, exigirEnteroPositivo } from '../errores';
import { EstadoProceso } from '../proceso/EstadoProceso';
import type { Proceso } from '../proceso/Proceso';
import type { ProcesoLectura } from '../proceso/ProcesoLectura';
import { ResultadoCpu, type PlanificadorCpu, type ResultadoTick } from './PlanificadorCpu';

/**
 * Planificador Round-Robin: una sola CPU y una cola FIFO de Listos.
 * Cuenta un cambio de contexto por expulsion con otros Listos y por bloqueo de E/S.
 */
export class PlanificadorRoundRobin implements PlanificadorCpu {
  readonly #quantum: number;
  readonly #cola: Proceso[] = [];
  #enCpu: Proceso | null = null;
  #cambiosDeContexto = 0;

  constructor(quantum: number) {
    exigirEnteroPositivo(quantum, 'El quantum');
    this.#quantum = quantum;
  }

  get quantum(): number {
    return this.#quantum;
  }

  get cambiosDeContexto(): number {
    return this.#cambiosDeContexto;
  }

  get enEjecucion(): ProcesoLectura | null {
    return this.#enCpu === null ? null : this.#enCpu.instantanea();
  }

  listos(): readonly ProcesoLectura[] {
    return Object.freeze(this.#cola.map((proceso) => proceso.instantanea()));
  }

  encolar(proceso: Proceso): void {
    if (proceso.estado !== EstadoProceso.Listo) {
      throw new ErrorSimulacion(
        `Solo se encolan procesos Listos (el proceso ${proceso.pid} esta ${proceso.estado})`,
      );
    }
    if (this.#cola.includes(proceso)) {
      throw new ErrorSimulacion(`El proceso ${proceso.pid} ya esta en la cola de Listos`);
    }
    this.#cola.push(proceso);
  }

  ejecutarTick(): ResultadoTick {
    const proceso = this.#enCpu ?? this.#despachar();
    if (proceso === null) {
      return { resultado: ResultadoCpu.Ociosa, proceso: null };
    }

    proceso.ejecutarTick();
    return { resultado: this.#resolver(proceso), proceso };
  }

  /** Saca al primero de la cola y le entrega la CPU con un quantum nuevo. */
  #despachar(): Proceso | null {
    const siguiente = this.#cola.shift() ?? null;
    if (siguiente !== null) {
      siguiente.despachar();
      this.#enCpu = siguiente;
    }
    return siguiente;
  }

  /**
   * Decide que pasa con el proceso despues de ejecutar.
   * Prioridades: finalizacion, despues bloqueo por E/S, despues quantum.
   */
  #resolver(proceso: Proceso): ResultadoCpu {
    if (proceso.cpuRestante === 0) {
      proceso.terminar();
      this.#enCpu = null;
      return ResultadoCpu.Termino;
    }

    const evento = proceso.eventoES;
    if (evento !== null && proceso.debeBloquearse()) {
      proceso.bloquear(evento.duracion);
      this.#enCpu = null;
      this.#cambiosDeContexto += 1;
      return ResultadoCpu.Bloqueo;
    }

    if (proceso.quantumConsumido < this.#quantum) {
      return ResultadoCpu.Continua;
    }

    if (this.#cola.length === 0) {
      proceso.renovarQuantum();
      return ResultadoCpu.RenovoQuantum;
    }

    proceso.expulsar();
    this.#cola.push(proceso);
    this.#enCpu = null;
    this.#cambiosDeContexto += 1;
    return ResultadoCpu.Expulsion;
  }
}