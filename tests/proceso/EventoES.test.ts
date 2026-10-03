import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import { EstadoProceso } from '../../src/proceso/EstadoProceso';
import { EventoES } from '../../src/proceso/EventoES';
import { Proceso } from '../../src/proceso/Proceso';

/** Devuelve un proceso que ya esta usando la CPU. */
function procesoEjecutando(cpuTotal = 4): Proceso {
  const proceso = new Proceso(1, 100, cpuTotal);
  proceso.admitir();
  proceso.despachar();
  return proceso;
}

describe('EventoES (RF08)', () => {
  it('guarda el disparo y la duracion', () => {
    const evento = new EventoES(2, 3);

    expect(evento.trasCpu).toBe(2);
    expect(evento.duracion).toBe(3);
  });

  it.each([
    ['disparo cero', 0, 3],
    ['disparo negativo', -1, 3],
    ['disparo decimal', 1.5, 3],
    ['duracion cero', 2, 0],
    ['duracion negativa', 2, -4],
    ['duracion decimal', 2, 0.5],
  ])('rechaza %s', (_caso, trasCpu, duracion) => {
    expect(() => new EventoES(trasCpu, duracion)).toThrow(ErrorSimulacion);
  });
});

describe('Proceso - evento de E/S (RF08)', () => {
  it('sin evento nunca debe bloquearse', () => {
    const proceso = procesoEjecutando();
    proceso.ejecutarTick();

    expect(proceso.eventoES).toBeNull();
    expect(proceso.debeBloquearse()).toBe(false);
  });

  it('debe bloquearse justo cuando alcanza el disparo', () => {
    const proceso = procesoEjecutando(4);
    proceso.programarES(new EventoES(2, 3));

    proceso.ejecutarTick();
    expect(proceso.debeBloquearse()).toBe(false);

    proceso.ejecutarTick();
    expect(proceso.debeBloquearse()).toBe(true);
  });

  it('no vuelve a bloquearse por el mismo evento al regresar a la CPU', () => {
    const proceso = procesoEjecutando(4);
    proceso.programarES(new EventoES(1, 1));
    proceso.ejecutarTick();
    proceso.bloquear(1);
    proceso.avanzarBloqueo();
    expect(proceso.debeBloquearse()).toBe(false);

    proceso.despachar();
    proceso.ejecutarTick();

    expect(proceso.debeBloquearse()).toBe(false);
  });

  it('si el disparo coincide con el final, el proceso termina y no se bloquea', () => {
    const proceso = procesoEjecutando(2);
    proceso.programarES(new EventoES(2, 5));
    proceso.ejecutarTick();
    proceso.ejecutarTick();

    expect(proceso.debeBloquearse()).toBe(false);
  });

  it('rechaza un segundo evento para el mismo proceso', () => {
    const proceso = new Proceso(1, 100, 4);
    proceso.programarES(new EventoES(1, 1));

    expect(() => proceso.programarES(new EventoES(2, 1))).toThrow(ErrorSimulacion);
    expect(proceso.eventoES?.trasCpu).toBe(1);
  });

  it('rechaza un disparo mayor que la CPU total', () => {
    const proceso = new Proceso(1, 100, 4);

    expect(() => proceso.programarES(new EventoES(5, 1))).toThrow(ErrorSimulacion);
    expect(proceso.eventoES).toBeNull();
  });

  it('rechaza un disparo que ya quedo en el pasado', () => {
    const proceso = procesoEjecutando(4);
    proceso.ejecutarTick();
    proceso.ejecutarTick();

    expect(() => proceso.programarES(new EventoES(2, 1))).toThrow(ErrorSimulacion);
    expect(proceso.eventoES).toBeNull();
  });

  it('rechaza programar E/S en un proceso Terminado', () => {
    const proceso = procesoEjecutando(1);
    proceso.ejecutarTick();
    proceso.terminar();

    expect(() => proceso.programarES(new EventoES(1, 1))).toThrow(ErrorSimulacion);
    expect(proceso.estado).toBe(EstadoProceso.Terminado);
  });
});