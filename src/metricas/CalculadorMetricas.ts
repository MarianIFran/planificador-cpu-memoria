import type { MetricasLectura } from './MetricasLectura';

/** Datos crudos que necesita el calculo de metricas. */
export interface DatosMetricas {
  readonly memoriaTotal: number;
  readonly memoriaLibre: number;
  readonly mayorBloqueLibre: number;
  readonly ticksTranscurridos: number;
  readonly ticksCpuOcupada: number;
  readonly cambiosDeContexto: number;
}

/** Contrato para calcular las metricas a partir de los datos crudos. */
export interface CalculadorMetricas {
  calcular(datos: DatosMetricas): MetricasLectura;
}

/** Implementa las formulas de la consigna (RF09). No guarda estado. */
export class CalculadorMetricasEstandar implements CalculadorMetricas {
  calcular(datos: DatosMetricas): MetricasLectura {
    const ocupada = datos.memoriaTotal - datos.memoriaLibre;
    return Object.freeze({
      ocupacionMemoria: this.#porcentaje(ocupada, datos.memoriaTotal),
      utilizacionCpu: this.#porcentaje(datos.ticksCpuOcupada, datos.ticksTranscurridos),
      cambiosDeContexto: datos.cambiosDeContexto,
      memoriaLibre: datos.memoriaLibre,
      mayorBloqueLibre: datos.mayorBloqueLibre,
      fragmentacionExterna:
        datos.memoriaLibre === 0 ? 0 : 100 * (1 - datos.mayorBloqueLibre / datos.memoriaLibre),
    });
  }

  /** 100 x parte / total; si el total es 0 devuelve 0 para no dividir por cero. */
  #porcentaje(parte: number, total: number): number {
    return total === 0 ? 0 : (100 * parte) / total;
  }
}