import { describe, expect, it } from 'vitest';
import { BestFit, EstadoProceso, FirstFit, Simulador, WorstFit } from '../../src/index';
import type { PoliticaAsignacion } from '../../src/index';

/**
 * Mismo escenario para las tres politicas (memoria 1000 KB, quantum 1):
 * quedan huecos de 300 KB (direccion 0) y 100 KB (direccion 500).
 * Despues llega P5 (80 KB) y, un tick mas tarde, P6 (250 KB).
 */
function correr(politica: PoliticaAsignacion): Simulador {
  const simulador = new Simulador({ memoriaTotal: 1000, quantum: 1, politica });
  simulador.registrarProceso(1, 300, 1);
  simulador.registrarProceso(2, 200, 9);
  simulador.registrarProceso(3, 100, 1);
  simulador.registrarProceso(4, 400, 9);
  simulador.avanzarTicks(3);
  simulador.registrarProceso(5, 80, 9);
  simulador.avanzarTick();
  simulador.registrarProceso(6, 250, 9);
  simulador.avanzarTick();
  return simulador;
}

describe('Comparacion de politicas con el mismo escenario (RF04, RF09)', () => {
  it.each([
    ['First-Fit', new FirstFit()],
    ['Worst-Fit', new WorstFit()],
  ])('%s parte el hueco grande y P6 queda Esperando Memoria', (_nombre, politica) => {
    const simulador = correr(politica);

    expect(simulador.mapaMemoria().map((b) => [b.inicio, b.tamanio, b.pid])).toEqual([
      [0, 80, 5],
      [80, 220, null],
      [300, 200, 2],
      [500, 100, null],
      [600, 400, 4],
    ]);
    expect(simulador.proceso(6).estado).toBe(EstadoProceso.EsperandoMemoria);
    expect(simulador.metricas().memoriaLibre).toBe(320);
    expect(simulador.metricas().mayorBloqueLibre).toBe(220);
    expect(simulador.metricas().fragmentacionExterna).toBe(31.25);
  });

  it('Best-Fit conserva el hueco grande y P6 puede ser admitido', () => {
    const simulador = correr(new BestFit());

    expect(simulador.mapaMemoria().map((b) => [b.inicio, b.tamanio, b.pid])).toEqual([
      [0, 250, 6],
      [250, 50, null],
      [300, 200, 2],
      [500, 80, 5],
      [580, 20, null],
      [600, 400, 4],
    ]);
    expect(simulador.proceso(6).estado).not.toBe(EstadoProceso.EsperandoMemoria);
    expect(simulador.metricas().memoriaLibre).toBe(70);
  });
});