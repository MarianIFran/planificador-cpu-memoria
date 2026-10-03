import { ErrorSimulacion, exigirEnteroPositivo } from '../errores';
import { EstadoProceso } from './EstadoProceso';
import type { EventoES } from './EventoES';
import type { ProcesoLectura } from './ProcesoLectura';

/**
 * Proceso simulado. Protege sus contadores y sus cambios de estado:
 * los atributos son privados y solo cambian con metodos que validan la transicion.
 */
export class Proceso implements ProcesoLectura {
  readonly #pid: number;
  readonly #memoriaRequerida: number;
  readonly #cpuTotal: number;
  #cpuRestante: number;
  #estado: EstadoProceso = EstadoProceso.Nuevo;
  #quantumConsumido = 0;
  #bloqueoRestante = 0;
  #eventoES: EventoES | null = null;

  constructor(pid: number, memoriaRequerida: number, cpuTotal: number) {
    exigirEnteroPositivo(pid, 'El PID');
    exigirEnteroPositivo(memoriaRequerida, 'La memoria requerida');
    exigirEnteroPositivo(cpuTotal, 'El tiempo de CPU');
    this.#pid = pid;
    this.#memoriaRequerida = memoriaRequerida;
    this.#cpuTotal = cpuTotal;
    this.#cpuRestante = cpuTotal;
  }

  get pid(): number {
    return this.#pid;
  }

  get memoriaRequerida(): number {
    return this.#memoriaRequerida;
  }

  get cpuTotal(): number {
    return this.#cpuTotal;
  }

  get cpuRestante(): number {
    return this.#cpuRestante;
  }

  get cpuConsumida(): number {
    return this.#cpuTotal - this.#cpuRestante;
  }

  get estado(): EstadoProceso {
    return this.#estado;
  }

  get quantumConsumido(): number {
    return this.#quantumConsumido;
  }

  get bloqueoRestante(): number {
    return this.#bloqueoRestante;
  }

  get eventoES(): EventoES | null {
    return this.#eventoES;
  }

  /**
   * Asocia un evento de E/S al proceso (RF08). Reglas de validacion:
   * - un proceso admite un solo evento;
   * - el proceso no puede estar Terminado;
   * - el disparo no puede superar la CPU total (nunca ocurriria);
   * - el disparo debe ser posterior a la CPU ya consumida.
   */
  programarES(evento: EventoES): void {
    if (this.#eventoES !== null) {
      throw new ErrorSimulacion(`El proceso ${this.#pid} ya tiene un evento de E/S`);
    }
    if (this.#estado === EstadoProceso.Terminado) {
      throw new ErrorSimulacion(`El proceso ${this.#pid} ya termino`);
    }
    if (evento.trasCpu > this.#cpuTotal) {
      throw new ErrorSimulacion(
        `El evento de E/S se dispara tras ${evento.trasCpu} ticks, pero el proceso ${this.#pid} solo usa ${this.#cpuTotal}`,
      );
    }
    if (evento.trasCpu <= this.cpuConsumida) {
      throw new ErrorSimulacion(
        `El proceso ${this.#pid} ya consumio ${this.cpuConsumida} ticks: el evento de E/S quedo en el pasado`,
      );
    }
    this.#eventoES = evento;
  }

  /**
   * Indica si justo ahora corresponde bloquearse por E/S:
   * esta en CPU, alcanzo el disparo del evento y todavia no termino.
   */
  debeBloquearse(): boolean {
    return (
      this.#estado === EstadoProceso.Ejecutando &&
      this.#eventoES !== null &&
      this.cpuConsumida === this.#eventoES.trasCpu &&
      this.#cpuRestante > 0
    );
  }

  /** Nuevo -> Esperando Memoria: no habia un hueco suficiente. */
  esperarMemoria(): void {
    this.#exigirEstado('esperar memoria', EstadoProceso.Nuevo);
    this.#estado = EstadoProceso.EsperandoMemoria;
  }

  /** Nuevo o Esperando Memoria -> Listo: ya tiene memoria asignada. */
  admitir(): void {
    this.#exigirEstado('admitir', EstadoProceso.Nuevo, EstadoProceso.EsperandoMemoria);
    this.#estado = EstadoProceso.Listo;
  }

  /** Listo -> Ejecutando: toma la CPU y arranca un quantum nuevo. */
  despachar(): void {
    this.#exigirEstado('despachar', EstadoProceso.Listo);
    this.#estado = EstadoProceso.Ejecutando;
    this.#quantumConsumido = 0;
  }

  /** Consume una unidad de CPU y una unidad de quantum. */
  ejecutarTick(): void {
    this.#exigirEstado('ejecutar', EstadoProceso.Ejecutando);
    if (this.#cpuRestante === 0) {
      throw new ErrorSimulacion(`El proceso ${this.#pid} ya no tiene CPU pendiente`);
    }
    this.#cpuRestante -= 1;
    this.#quantumConsumido += 1;
  }

  /** Sigue en CPU con un quantum nuevo (no habia otros Listos). */
  renovarQuantum(): void {
    this.#exigirEstado('renovar el quantum', EstadoProceso.Ejecutando);
    this.#quantumConsumido = 0;
  }

  /** Ejecutando -> Listo: agoto su quantum y deja la CPU. */
  expulsar(): void {
    this.#exigirEstado('expulsar', EstadoProceso.Ejecutando);
    this.#estado = EstadoProceso.Listo;
  }

  /** Ejecutando -> Bloqueado: empieza una Entrada/Salida de la duracion indicada. */
  bloquear(duracion: number): void {
    this.#exigirEstado('bloquear', EstadoProceso.Ejecutando);
    exigirEnteroPositivo(duracion, 'La duracion del bloqueo');
    this.#estado = EstadoProceso.Bloqueado;
    this.#bloqueoRestante = duracion;
  }

  /**
   * Descuenta un tick de bloqueo. Cuando llega a cero el proceso pasa a Listo.
   * @returns true si el proceso se desbloqueo en esta llamada.
   */
  avanzarBloqueo(): boolean {
    this.#exigirEstado('avanzar el bloqueo', EstadoProceso.Bloqueado);
    this.#bloqueoRestante -= 1;
    if (this.#bloqueoRestante > 0) {
      return false;
    }
    this.#estado = EstadoProceso.Listo;
    return true;
  }

  /** Ejecutando -> Terminado: solo cuando ya consumio toda su CPU. */
  terminar(): void {
    this.#exigirEstado('terminar', EstadoProceso.Ejecutando);
    if (this.#cpuRestante > 0) {
      throw new ErrorSimulacion(`El proceso ${this.#pid} todavia tiene CPU pendiente`);
    }
    this.#estado = EstadoProceso.Terminado;
  }

  /** Copia congelada con los datos actuales, segura para entregar hacia afuera. */
  instantanea(): ProcesoLectura {
    return Object.freeze({
      pid: this.#pid,
      memoriaRequerida: this.#memoriaRequerida,
      cpuTotal: this.#cpuTotal,
      cpuRestante: this.#cpuRestante,
      cpuConsumida: this.cpuConsumida,
      estado: this.#estado,
      quantumConsumido: this.#quantumConsumido,
      bloqueoRestante: this.#bloqueoRestante,
    });
  }

  #exigirEstado(accion: string, ...permitidos: EstadoProceso[]): void {
    if (!permitidos.includes(this.#estado)) {
      throw new ErrorSimulacion(
        `No se puede ${accion} el proceso ${this.#pid} en estado ${this.#estado}`,
      );
    }
  }
}