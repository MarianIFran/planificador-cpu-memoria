import { ErrorSimulacion, exigirEnteroPositivo } from '../errores';
import type { AdministradorMemoria } from '../memoria/AdministradorMemoria';
import type { BloqueLectura } from '../memoria/BloqueLectura';
import { FirstFit } from '../memoria/FirstFit';
import { GestorMemoria } from '../memoria/GestorMemoria';
import { CalculadorMetricasEstandar, type CalculadorMetricas } from '../metricas/CalculadorMetricas';
import type { MetricasLectura } from '../metricas/MetricasLectura';
import { ResultadoCpu, type PlanificadorCpu } from '../planificacion/PlanificadorCpu';
import { PlanificadorRoundRobin } from '../planificacion/PlanificadorRoundRobin';
import { EstadoProceso } from '../proceso/EstadoProceso';
import { EventoES } from '../proceso/EventoES';
import { Proceso } from '../proceso/Proceso';
import type { ProcesoLectura } from '../proceso/ProcesoLectura';
import {
  MEMORIA_REFERENCIA,
  QUANTUM_REFERENCIA,
  type ConfiguracionSimulacion,
} from './ConfiguracionSimulacion';

/**
 * Coordina la simulacion: no asigna memoria ni planifica por su cuenta,
 * sino que le pide cada tarea al objeto responsable y ordena las fases del tick.
 */
export class Simulador {
  readonly #memoria: AdministradorMemoria;
  readonly #planificador: PlanificadorCpu;
  readonly #calculador: CalculadorMetricas = new CalculadorMetricasEstandar();
  /** Todos los procesos, en orden de registro. */
  readonly #procesos = new Map<number, Proceso>();
  readonly #bloqueados: Proceso[] = [];
  readonly #terminados: Proceso[] = [];
  #tick = 0;
  #ticksCpuOcupada = 0;
  #metricas: MetricasLectura;

  constructor(configuracion: ConfiguracionSimulacion = {}) {
    const {
      memoriaTotal = MEMORIA_REFERENCIA,
      quantum = QUANTUM_REFERENCIA,
      politica = new FirstFit(),
    } = configuracion;
    // Se valida todo antes de crear cualquier objeto: no quedan estados a medias.
    exigirEnteroPositivo(memoriaTotal, 'La memoria total');
    exigirEnteroPositivo(quantum, 'El quantum');

    this.#memoria = new GestorMemoria(memoriaTotal, politica);
    this.#planificador = new PlanificadorRoundRobin(quantum);
    this.#metricas = this.#calcularMetricas();
  }

  // ---------- Configuracion y registro (RF01, RF02, RF08) ----------

  get memoriaTotal(): number {
    return this.#memoria.memoriaTotal;
  }

  get quantum(): number {
    return this.#planificador.quantum;
  }

  get nombrePolitica(): string {
    return this.#memoria.nombrePolitica;
  }

  /** Registra un proceso en estado Nuevo. Se intenta admitir al inicio del proximo tick. */
  registrarProceso(pid: number, memoriaRequerida: number, cpuTotal: number): ProcesoLectura {
    const proceso = new Proceso(pid, memoriaRequerida, cpuTotal);
    if (this.#procesos.has(pid)) {
      throw new ErrorSimulacion(`Ya existe un proceso con PID ${pid}`);
    }
    if (memoriaRequerida > this.#memoria.memoriaTotal) {
      throw new ErrorSimulacion(
        `El proceso ${pid} pide ${memoriaRequerida} KB y la memoria total es de ${this.#memoria.memoriaTotal} KB`,
      );
    }
    this.#procesos.set(pid, proceso);
    return proceso.instantanea();
  }

  /**
   * Define un evento de E/S: cuando el proceso lleve `trasCpu` ticks de CPU
   * consumidos, se bloquea durante `duracion` ticks.
   */
  programarES(pid: number, trasCpu: number, duracion: number): void {
    this.#buscar(pid).programarES(new EventoES(trasCpu, duracion));
  }

  // ---------- Avance de la simulacion (RF06) ----------

  /** Avanza exactamente un tick, siempre con las mismas cuatro fases. */
  avanzarTick(): void {
    this.#admitirProcesos();
    this.#actualizarBloqueados();
    this.#ejecutarCpu();
    this.#tick += 1;
    this.#metricas = this.#calcularMetricas();
  }

  /** Avanza varios ticks seguidos. */
  avanzarTicks(cantidad: number): void {
    exigirEnteroPositivo(cantidad, 'La cantidad de ticks');
    for (let i = 0; i < cantidad; i += 1) {
      this.avanzarTick();
    }
  }

  /** Fase 1: intenta asignar memoria a Nuevos y en espera, en orden de registro (RF03). */
  #admitirProcesos(): void {
    for (const proceso of this.#procesos.values()) {
      const pendiente =
        proceso.estado === EstadoProceso.Nuevo ||
        proceso.estado === EstadoProceso.EsperandoMemoria;
      if (!pendiente) {
        continue;
      }
      if (this.#memoria.asignar(proceso.pid, proceso.memoriaRequerida)) {
        proceso.admitir();
        this.#planificador.encolar(proceso);
      } else if (proceso.estado === EstadoProceso.Nuevo) {
        proceso.esperarMemoria();
      }
    }
  }

  /** Fase 2: descuenta los temporizadores de E/S; los que vencen vuelven a Listos (RF08). */
  #actualizarBloqueados(): void {
    for (const proceso of [...this.#bloqueados]) {
      if (proceso.avanzarBloqueo()) {
        this.#bloqueados.splice(this.#bloqueados.indexOf(proceso), 1);
        this.#planificador.encolar(proceso);
      }
    }
  }

  /** Fase 3: despacho y ejecucion Round-Robin (RF07). */
  #ejecutarCpu(): void {
    const { resultado, proceso } = this.#planificador.ejecutarTick();
    if (proceso === null) {
      return;
    }
    this.#ticksCpuOcupada += 1;
    if (resultado === ResultadoCpu.Termino) {
      this.#memoria.liberar(proceso.pid);
      this.#terminados.push(proceso);
    } else if (resultado === ResultadoCpu.Bloqueo) {
      this.#bloqueados.push(proceso);
    }
  }

  // ---------- Consultas de solo lectura (RF09, RF10) ----------

  get tickActual(): number {
    return this.#tick;
  }

  /** Metricas calculadas al final del ultimo tick. */
  metricas(): MetricasLectura {
    return this.#metricas;
  }

  procesoEnCpu(): ProcesoLectura | null {
    return this.#planificador.enEjecucion;
  }

  listos(): readonly ProcesoLectura[] {
    return this.#planificador.listos();
  }

  esperandoMemoria(): readonly ProcesoLectura[] {
    return this.#copias(
      [...this.#procesos.values()].filter((p) => p.estado === EstadoProceso.EsperandoMemoria),
    );
  }

  bloqueados(): readonly ProcesoLectura[] {
    return this.#copias(this.#bloqueados);
  }

  terminados(): readonly ProcesoLectura[] {
    return this.#copias(this.#terminados);
  }

  /** Todos los procesos registrados, en orden de registro. */
  procesos(): readonly ProcesoLectura[] {
    return this.#copias([...this.#procesos.values()]);
  }

  proceso(pid: number): ProcesoLectura {
    return this.#buscar(pid).instantanea();
  }

  mapaMemoria(): readonly BloqueLectura[] {
    return this.#memoria.mapa();
  }

  // ---------- Auxiliares ----------

  #buscar(pid: number): Proceso {
    const proceso = this.#procesos.get(pid);
    if (proceso === undefined) {
      throw new ErrorSimulacion(`No existe un proceso con PID ${pid}`);
    }
    return proceso;
  }

  #copias(procesos: readonly Proceso[]): readonly ProcesoLectura[] {
    return Object.freeze(procesos.map((proceso) => proceso.instantanea()));
  }

  #calcularMetricas(): MetricasLectura {
    return this.#calculador.calcular({
      memoriaTotal: this.#memoria.memoriaTotal,
      memoriaLibre: this.#memoria.memoriaLibre,
      mayorBloqueLibre: this.#memoria.mayorBloqueLibre,
      ticksTranscurridos: this.#tick,
      ticksCpuOcupada: this.#ticksCpuOcupada,
      cambiosDeContexto: this.#planificador.cambiosDeContexto,
    });
  }
}