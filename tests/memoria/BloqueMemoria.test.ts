import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import { BloqueMemoria } from '../../src/memoria/BloqueMemoria';

describe('BloqueMemoria (RF04)', () => {
  it('sin PID es un bloque libre', () => {
    const bloque = new BloqueMemoria(0, 1024);

    expect(bloque.inicio).toBe(0);
    expect(bloque.tamanio).toBe(1024);
    expect(bloque.pid).toBeNull();
    expect(bloque.libre).toBe(true);
    expect(bloque.fin).toBe(1024);
  });

  it('con PID es un bloque ocupado', () => {
    const bloque = new BloqueMemoria(100, 200, 7);

    expect(bloque.pid).toBe(7);
    expect(bloque.libre).toBe(false);
    expect(bloque.fin).toBe(300);
  });

  it.each([
    ['inicio negativo', -1, 100, null],
    ['inicio decimal', 0.5, 100, null],
    ['tamanio cero', 0, 0, null],
    ['tamanio negativo', 0, -10, null],
    ['PID cero', 0, 100, 0],
    ['PID decimal', 0, 100, 1.5],
  ])('rechaza %s', (_caso, inicio, tamanio, pid) => {
    expect(() => new BloqueMemoria(inicio, tamanio, pid)).toThrow(ErrorSimulacion);
  });

  it('la instantanea es una copia que no se puede modificar', () => {
    const copia = new BloqueMemoria(0, 100, 3).instantanea();

    expect(copia).toEqual({ inicio: 0, tamanio: 100, pid: 3, libre: false });
    expect(() => {
      (copia as { tamanio: number }).tamanio = 999;
    }).toThrow(TypeError);
  });
});