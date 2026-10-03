import { describe, expect, it } from 'vitest';
import { BestFit } from '../../src/memoria/BestFit';
import type { BloqueLectura } from '../../src/memoria/BloqueLectura';
import { FirstFit } from '../../src/memoria/FirstFit';
import { SIN_BLOQUE, type PoliticaAsignacion } from '../../src/memoria/PoliticaAsignacion';
import { WorstFit } from '../../src/memoria/WorstFit';

/** Arma un mapa a partir de [tamanio, pid o null], calculando las direcciones. */
function mapa(...definicion: Array<[number, number | null]>): BloqueLectura[] {
  let inicio = 0;
  return definicion.map(([tamanio, pid]) => {
    const bloque = { inicio, tamanio, pid, libre: pid === null };
    inicio += tamanio;
    return bloque;
  });
}

// Huecos libres: indice 0 (300 KB), indice 2 (100 KB), indice 4 (500 KB).
const conTresHuecos = mapa([300, null], [50, 1], [100, null], [50, 2], [500, null]);

describe('Politicas de asignacion (RF04)', () => {
  it('First-Fit elige el primer hueco suficiente por direccion', () => {
    expect(new FirstFit().elegir(conTresHuecos, 80)).toBe(0);
    expect(new FirstFit().elegir(conTresHuecos, 400)).toBe(4);
  });

  it('Best-Fit elige el hueco suficiente mas chico', () => {
    expect(new BestFit().elegir(conTresHuecos, 80)).toBe(2);
    expect(new BestFit().elegir(conTresHuecos, 200)).toBe(0);
  });

  it('Worst-Fit elige el hueco suficiente mas grande', () => {
    expect(new WorstFit().elegir(conTresHuecos, 80)).toBe(4);
  });

  it('las tres politicas dan resultados distintos para el mismo pedido', () => {
    const politicas: PoliticaAsignacion[] = [new FirstFit(), new BestFit(), new WorstFit()];

    // Polimorfismo: el mismo mensaje, tres comportamientos.
    const elegidos = politicas.map((politica) => politica.elegir(conTresHuecos, 80));

    expect(elegidos).toEqual([0, 2, 4]);
  });

  const todas: Array<[string, PoliticaAsignacion]> = [
    ['First-Fit', new FirstFit()],
    ['Best-Fit', new BestFit()],
    ['Worst-Fit', new WorstFit()],
  ];

  it.each(todas)('%s informa su nombre', (nombre, politica) => {
    expect(politica.nombre).toBe(nombre);
  });

  it.each(todas)('%s ante un empate elige la menor direccion', (_nombre, politica) => {
    const empate = mapa([200, null], [50, 1], [200, null]);

    expect(politica.elegir(empate, 100)).toBe(0);
  });

  it.each(todas)('%s acepta un ajuste exacto', (_nombre, politica) => {
    const unHueco = mapa([50, 1], [100, null], [50, 2]);

    expect(politica.elegir(unHueco, 100)).toBe(1);
  });

  it.each(todas)('%s nunca elige un bloque ocupado', (_nombre, politica) => {
    const ocupadoGrande = mapa([900, 1], [100, null]);

    expect(politica.elegir(ocupadoGrande, 100)).toBe(1);
  });

  it.each(todas)('%s devuelve SIN_BLOQUE si ningun hueco alcanza', (_nombre, politica) => {
    // Hay 900 KB libres en total, pero ningun hueco contiguo de 600.
    expect(politica.elegir(conTresHuecos, 600)).toBe(SIN_BLOQUE);
  });

  it.each(todas)('%s devuelve SIN_BLOQUE con la memoria llena', (_nombre, politica) => {
    expect(politica.elegir(mapa([1024, 1]), 1)).toBe(SIN_BLOQUE);
  });
});