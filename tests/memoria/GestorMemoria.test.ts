import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import type { BloqueLectura } from '../../src/memoria/BloqueLectura';
import { FirstFit } from '../../src/memoria/FirstFit';
import { GestorMemoria } from '../../src/memoria/GestorMemoria';
import type { PoliticaAsignacion } from '../../src/memoria/PoliticaAsignacion';

describe('GestorMemoria - estado inicial (RF01)', () => {
  it('arranca con un unico bloque libre que abarca toda la memoria', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());

    expect(memoria.mapa()).toEqual([{ inicio: 0, tamanio: 1024, pid: null, libre: true }]);
    expect(memoria.memoriaTotal).toBe(1024);
    expect(memoria.memoriaLibre).toBe(1024);
    expect(memoria.memoriaOcupada).toBe(0);
    expect(memoria.mayorBloqueLibre).toBe(1024);
    expect(memoria.nombrePolitica).toBe('First-Fit');
  });

  it.each([0, -1024, 10.5, Number.NaN])('rechaza una memoria total invalida (%s)', (total) => {
    expect(() => new GestorMemoria(total, new FirstFit())).toThrow(ErrorSimulacion);
  });
});

describe('GestorMemoria - asignacion (RF04)', () => {
  it('divide el bloque cuando sobra espacio', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());

    expect(memoria.asignar(1, 300)).toBe(true);

    expect(memoria.mapa()).toEqual([
      { inicio: 0, tamanio: 300, pid: 1, libre: false },
      { inicio: 300, tamanio: 724, pid: null, libre: true },
    ]);
    expect(memoria.memoriaOcupada).toBe(300);
    expect(memoria.memoriaLibre).toBe(724);
    expect(memoria.tieneAsignado(1)).toBe(true);
  });

  it('un ajuste exacto no genera bloques de tamanio cero', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());

    expect(memoria.asignar(1, 1024)).toBe(true);

    expect(memoria.mapa()).toEqual([{ inicio: 0, tamanio: 1024, pid: 1, libre: false }]);
    expect(memoria.memoriaLibre).toBe(0);
    expect(memoria.mayorBloqueLibre).toBe(0);
  });

  it('mantiene los bloques ordenados, contiguos y sin solapamientos', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());
    memoria.asignar(1, 100);
    memoria.asignar(2, 200);
    memoria.asignar(3, 300);

    const bloques = memoria.mapa();
    let esperado = 0;
    for (const bloque of bloques) {
      expect(bloque.inicio).toBe(esperado);
      esperado += bloque.tamanio;
    }
    expect(esperado).toBe(1024);
    expect(bloques.map((bloque) => bloque.pid)).toEqual([1, 2, 3, null]);
  });

  it('si no hay hueco suficiente falla sin modificar los bloques', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());
    memoria.asignar(1, 800);
    const antes = memoria.mapa();

    expect(memoria.asignar(2, 300)).toBe(false);

    expect(memoria.mapa()).toEqual(antes);
    expect(memoria.tieneAsignado(2)).toBe(false);
  });

  it('rechaza darle un segundo bloque al mismo proceso', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());
    memoria.asignar(1, 100);

    expect(() => memoria.asignar(1, 50)).toThrow(ErrorSimulacion);
    expect(memoria.memoriaOcupada).toBe(100);
  });

  it.each([
    ['PID cero', 0, 100],
    ['PID decimal', 1.5, 100],
    ['tamanio cero', 1, 0],
    ['tamanio negativo', 1, -5],
  ])('rechaza %s', (_caso, pid, tamanio) => {
    const memoria = new GestorMemoria(1024, new FirstFit());

    expect(() => memoria.asignar(pid, tamanio)).toThrow(ErrorSimulacion);
    expect(memoria.memoriaLibre).toBe(1024);
  });

  it('usa cualquier politica que cumpla la interfaz (polimorfismo)', () => {
    // Politica de prueba: siempre responde con el ultimo bloque del mapa.
    const ultimoBloque: PoliticaAsignacion = {
      nombre: 'Ultimo',
      elegir: (bloques: readonly BloqueLectura[]) => bloques.length - 1,
    };
    const memoria = new GestorMemoria(1024, ultimoBloque);

    expect(memoria.asignar(1, 100)).toBe(true);
    expect(memoria.asignar(2, 100)).toBe(true);
    expect(memoria.mapa().map((bloque) => bloque.pid)).toEqual([1, 2, null]);
    expect(memoria.nombrePolitica).toBe('Ultimo');
  });

  it.each([
    ['un bloque ocupado', 0],
    ['un indice inexistente', 99],
  ])('se protege de una politica que elige %s', (_caso, indice) => {
    // La primera vez responde bien (indice 0); despues devuelve un indice invalido.
    let llamadas = 0;
    const politicaRota: PoliticaAsignacion = {
      nombre: 'Rota',
      elegir: () => (llamadas++ === 0 ? 0 : indice),
    };
    const memoria = new GestorMemoria(1024, politicaRota);
    memoria.asignar(1, 100);
    const antes = memoria.mapa();

    expect(() => memoria.asignar(2, 100)).toThrow(ErrorSimulacion);
    expect(memoria.mapa()).toEqual(antes);
  });

  it('se protege de una politica que elige un bloque demasiado chico', () => {
    const politicaRota: PoliticaAsignacion = { nombre: 'Rota', elegir: () => 0 };
    const memoria = new GestorMemoria(100, politicaRota);

    expect(() => memoria.asignar(1, 500)).toThrow(ErrorSimulacion);
    expect(memoria.memoriaLibre).toBe(100);
  });
});

describe('GestorMemoria - mapa protegido (RF10)', () => {
  it('el mapa devuelto no permite modificar la memoria real', () => {
    const memoria = new GestorMemoria(1024, new FirstFit());
    const copia = memoria.mapa() as BloqueLectura[];

    expect(() => copia.push({ inicio: 0, tamanio: 1, pid: 9, libre: false })).toThrow(TypeError);
    expect(() => {
      (copia[0] as { tamanio: number }).tamanio = 1;
    }).toThrow(TypeError);
    expect(memoria.mapa()).toEqual([{ inicio: 0, tamanio: 1024, pid: null, libre: true }]);
  });
});