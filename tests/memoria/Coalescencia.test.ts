import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import { BestFit } from '../../src/memoria/BestFit';
import { FirstFit } from '../../src/memoria/FirstFit';
import { GestorMemoria } from '../../src/memoria/GestorMemoria';
import type { PoliticaAsignacion } from '../../src/memoria/PoliticaAsignacion';
import { WorstFit } from '../../src/memoria/WorstFit';

/** Memoria de 1000 KB llena con cuatro procesos: P1=100, P2=200, P3=300, P4=400. */
function memoriaLlena(politica: PoliticaAsignacion = new FirstFit()): GestorMemoria {
  const memoria = new GestorMemoria(1000, politica);
  memoria.asignar(1, 100);
  memoria.asignar(2, 200);
  memoria.asignar(3, 300);
  memoria.asignar(4, 400);
  return memoria;
}

/** Resume el mapa como [inicio, tamanio, pid] para comparar mas facil. */
function resumen(memoria: GestorMemoria): Array<[number, number, number | null]> {
  return memoria.mapa().map((bloque) => [bloque.inicio, bloque.tamanio, bloque.pid]);
}

describe('GestorMemoria - liberacion (RF05)', () => {
  it('libera el bloque del proceso sin mover los ocupados', () => {
    const memoria = memoriaLlena();

    memoria.liberar(2);

    expect(resumen(memoria)).toEqual([
      [0, 100, 1],
      [100, 200, null],
      [300, 300, 3],
      [600, 400, 4],
    ]);
    expect(memoria.tieneAsignado(2)).toBe(false);
    expect(memoria.memoriaLibre).toBe(200);
  });

  it('rechaza liberar un proceso sin memoria asignada', () => {
    const memoria = memoriaLlena();
    const antes = memoria.mapa();

    expect(() => memoria.liberar(99)).toThrow(ErrorSimulacion);
    expect(memoria.mapa()).toEqual(antes);
  });

  it('rechaza liberar dos veces el mismo proceso', () => {
    const memoria = memoriaLlena();
    memoria.liberar(2);

    expect(() => memoria.liberar(2)).toThrow(ErrorSimulacion);
  });

  it('el hueco liberado se puede volver a asignar', () => {
    const memoria = memoriaLlena();
    expect(memoria.asignar(5, 150)).toBe(false);

    memoria.liberar(2);

    expect(memoria.asignar(5, 150)).toBe(true);
    expect(resumen(memoria)).toEqual([
      [0, 100, 1],
      [100, 150, 5],
      [250, 50, null],
      [300, 300, 3],
      [600, 400, 4],
    ]);
  });
});

describe('GestorMemoria - coalescencia (RF05)', () => {
  it('fusiona con el vecino izquierdo', () => {
    const memoria = memoriaLlena();
    memoria.liberar(2);

    memoria.liberar(3);

    expect(resumen(memoria)).toEqual([
      [0, 100, 1],
      [100, 500, null],
      [600, 400, 4],
    ]);
  });

  it('fusiona con el vecino derecho', () => {
    const memoria = memoriaLlena();
    memoria.liberar(3);

    memoria.liberar(2);

    expect(resumen(memoria)).toEqual([
      [0, 100, 1],
      [100, 500, null],
      [600, 400, 4],
    ]);
  });

  it('fusiona con ambos vecinos a la vez', () => {
    const memoria = memoriaLlena();
    memoria.liberar(1);
    memoria.liberar(3);

    memoria.liberar(2);

    expect(resumen(memoria)).toEqual([
      [0, 600, null],
      [600, 400, 4],
    ]);
    expect(memoria.mayorBloqueLibre).toBe(600);
  });

  it('no fusiona huecos separados por un bloque ocupado', () => {
    const memoria = memoriaLlena();

    memoria.liberar(1);
    memoria.liberar(3);

    expect(resumen(memoria)).toEqual([
      [0, 100, null],
      [100, 200, 2],
      [300, 300, null],
      [600, 400, 4],
    ]);
    // Fragmentacion externa: hay 400 KB libres pero el mayor hueco es de 300.
    expect(memoria.memoriaLibre).toBe(400);
    expect(memoria.mayorBloqueLibre).toBe(300);
    expect(memoria.asignar(5, 400)).toBe(false);
  });

  it('funciona en los bordes de la memoria', () => {
    const memoria = memoriaLlena();

    memoria.liberar(4);
    memoria.liberar(1);

    expect(resumen(memoria)).toEqual([
      [0, 100, null],
      [100, 200, 2],
      [300, 300, 3],
      [600, 400, null],
    ]);
  });

  it.each([
    ['en orden', [1, 2, 3, 4]],
    ['en orden inverso', [4, 3, 2, 1]],
    ['salteado', [2, 4, 1, 3]],
  ])('al liberar todos (%s) queda un unico bloque libre del tamanio total', (_caso, orden) => {
    const memoria = memoriaLlena();

    orden.forEach((pid) => memoria.liberar(pid));

    expect(resumen(memoria)).toEqual([[0, 1000, null]]);
    expect(memoria.memoriaLibre).toBe(1000);
    expect(memoria.mayorBloqueLibre).toBe(1000);
  });

  it('conserva el tamanio total y la continuidad despues de varias operaciones', () => {
    const memoria = memoriaLlena();
    memoria.liberar(2);
    memoria.asignar(5, 50);
    memoria.liberar(4);
    memoria.asignar(6, 120);
    memoria.liberar(1);

    let esperado = 0;
    for (const bloque of memoria.mapa()) {
      expect(bloque.inicio).toBe(esperado);
      expect(bloque.tamanio).toBeGreaterThan(0);
      esperado += bloque.tamanio;
    }
    expect(esperado).toBe(1000);
    expect(memoria.memoriaLibre + memoria.memoriaOcupada).toBe(1000);
  });
});

describe('GestorMemoria - seleccion segun politica (RF04)', () => {
  /** Deja tres huecos: 100 KB en 0, 300 KB en 300 y 250 KB en 750 (quedan ocupados P2 y P4). */
  function conHuecos(politica: PoliticaAsignacion): GestorMemoria {
    const memoria = new GestorMemoria(1000, politica);
    memoria.asignar(1, 100);
    memoria.asignar(2, 200);
    memoria.asignar(3, 300);
    memoria.asignar(4, 150);
    memoria.asignar(5, 250);
    memoria.liberar(1);
    memoria.liberar(3);
    memoria.liberar(5);
    return memoria;
  }

  it.each([
    ['First-Fit', new FirstFit(), 0],
    ['Best-Fit', new BestFit(), 0],
    ['Worst-Fit', new WorstFit(), 300],
  ])('%s ubica un pedido de 80 KB donde corresponde', (_nombre, politica, inicioEsperado) => {
    const memoria = conHuecos(politica);

    expect(memoria.asignar(9, 80)).toBe(true);

    const bloque = memoria.mapa().find((b) => b.pid === 9);
    expect(bloque?.inicio).toBe(inicioEsperado);
  });

  it.each([
    ['First-Fit', new FirstFit(), 300],
    ['Best-Fit', new BestFit(), 750],
    ['Worst-Fit', new WorstFit(), 300],
  ])('%s ubica un pedido de 200 KB donde corresponde', (_nombre, politica, inicioEsperado) => {
    const memoria = conHuecos(politica);

    expect(memoria.asignar(9, 200)).toBe(true);

    const bloque = memoria.mapa().find((b) => b.pid === 9);
    expect(bloque?.inicio).toBe(inicioEsperado);
  });

  it.each([
    ['First-Fit', new FirstFit()],
    ['Best-Fit', new BestFit()],
    ['Worst-Fit', new WorstFit()],
  ])('%s falla sin modificar aunque la suma de memoria libre alcance', (_nombre, politica) => {
    const memoria = conHuecos(politica);
    const antes = memoria.mapa();

    // Hay 650 KB libres en total, pero el mayor hueco contiguo es de 300.
    expect(memoria.memoriaLibre).toBe(650);
    expect(memoria.asignar(9, 400)).toBe(false);
    expect(memoria.mapa()).toEqual(antes);
  });
});