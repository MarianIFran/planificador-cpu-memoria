import { describe, expect, it } from 'vitest';
import {
  CalculadorMetricasEstandar,
  type DatosMetricas,
} from '../../src/metricas/CalculadorMetricas';

const base: DatosMetricas = {
  memoriaTotal: 1000,
  memoriaLibre: 400,
  mayorBloqueLibre: 300,
  ticksTranscurridos: 8,
  ticksCpuOcupada: 6,
  cambiosDeContexto: 3,
};

describe('CalculadorMetricasEstandar (RF09)', () => {
  const calculador = new CalculadorMetricasEstandar();

  it('aplica las formulas de la consigna', () => {
    expect(calculador.calcular(base)).toEqual({
      ocupacionMemoria: 60,
      utilizacionCpu: 75,
      cambiosDeContexto: 3,
      memoriaLibre: 400,
      mayorBloqueLibre: 300,
      fragmentacionExterna: 25,
    });
  });

  it('huecos de 100 y 300 KB dan 25% de fragmentacion externa', () => {
    const metricas = calculador.calcular({ ...base, memoriaLibre: 400, mayorBloqueLibre: 300 });

    expect(metricas.fragmentacionExterna).toBe(25);
  });

  it('un unico hueco libre no tiene fragmentacion', () => {
    const metricas = calculador.calcular({ ...base, memoriaLibre: 400, mayorBloqueLibre: 400 });

    expect(metricas.fragmentacionExterna).toBe(0);
  });

  it('con la memoria llena la fragmentacion es 0 y la ocupacion 100', () => {
    const metricas = calculador.calcular({ ...base, memoriaLibre: 0, mayorBloqueLibre: 0 });

    expect(metricas.fragmentacionExterna).toBe(0);
    expect(metricas.ocupacionMemoria).toBe(100);
    expect(metricas.memoriaLibre).toBe(0);
    expect(metricas.mayorBloqueLibre).toBe(0);
  });

  it('en el tick 0 la utilizacion de CPU es 0', () => {
    const metricas = calculador.calcular({ ...base, ticksTranscurridos: 0, ticksCpuOcupada: 0 });

    expect(metricas.utilizacionCpu).toBe(0);
  });

  it('el resultado no se puede modificar', () => {
    const metricas = calculador.calcular(base) as { cambiosDeContexto: number };

    expect(() => {
      metricas.cambiosDeContexto = 0;
    }).toThrow(TypeError);
  });
});