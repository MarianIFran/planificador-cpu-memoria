import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import { EstadoProceso } from '../../src/proceso/EstadoProceso';
import { Proceso } from '../../src/proceso/Proceso';

/** Devuelve un proceso que ya esta usando la CPU. */
function procesoEjecutando(cpuTotal = 3): Proceso {
  const proceso = new Proceso(1, 100, cpuTotal);
  proceso.admitir();
  proceso.despachar();
  return proceso;
}

describe('Proceso - creacion (RF02)', () => {
  it('arranca en Nuevo con los contadores iniciales', () => {
    const proceso = new Proceso(7, 200, 5);

    expect(proceso.pid).toBe(7);
    expect(proceso.memoriaRequerida).toBe(200);
    expect(proceso.cpuTotal).toBe(5);
    expect(proceso.cpuRestante).toBe(5);
    expect(proceso.cpuConsumida).toBe(0);
    expect(proceso.estado).toBe(EstadoProceso.Nuevo);
    expect(proceso.quantumConsumido).toBe(0);
    expect(proceso.bloqueoRestante).toBe(0);
  });

  it.each([
    ['PID cero', 0, 100, 5],
    ['PID negativo', -1, 100, 5],
    ['PID decimal', 1.5, 100, 5],
    ['memoria cero', 1, 0, 5],
    ['memoria decimal', 1, 10.5, 5],
    ['CPU cero', 1, 100, 0],
    ['CPU negativa', 1, 100, -3],
    ['CPU no numerica', 1, 100, Number.NaN],
  ])('rechaza %s', (_caso, pid, memoria, cpu) => {
    expect(() => new Proceso(pid, memoria, cpu)).toThrow(ErrorSimulacion);
  });
});

describe('Proceso - transiciones de estado (RF03)', () => {
  it('pasa de Nuevo a Listo al ser admitido', () => {
    const proceso = new Proceso(1, 100, 3);
    proceso.admitir();
    expect(proceso.estado).toBe(EstadoProceso.Listo);
  });

  it('pasa por Esperando Memoria y despues puede ser admitido', () => {
    const proceso = new Proceso(1, 100, 3);
    proceso.esperarMemoria();
    expect(proceso.estado).toBe(EstadoProceso.EsperandoMemoria);

    proceso.admitir();
    expect(proceso.estado).toBe(EstadoProceso.Listo);
  });

  it('al despachar pasa a Ejecutando y reinicia el quantum', () => {
    const proceso = procesoEjecutando();
    proceso.ejecutarTick();
    proceso.expulsar();
    expect(proceso.estado).toBe(EstadoProceso.Listo);
    expect(proceso.quantumConsumido).toBe(1);

    proceso.despachar();
    expect(proceso.estado).toBe(EstadoProceso.Ejecutando);
    expect(proceso.quantumConsumido).toBe(0);
  });

  it('cada tick ejecutado baja la CPU restante y sube el quantum', () => {
    const proceso = procesoEjecutando(3);
    proceso.ejecutarTick();
    proceso.ejecutarTick();

    expect(proceso.cpuRestante).toBe(1);
    expect(proceso.cpuConsumida).toBe(2);
    expect(proceso.quantumConsumido).toBe(2);
  });

  it('renovar el quantum lo deja en cero sin salir de la CPU', () => {
    const proceso = procesoEjecutando(3);
    proceso.ejecutarTick();
    proceso.renovarQuantum();

    expect(proceso.quantumConsumido).toBe(0);
    expect(proceso.estado).toBe(EstadoProceso.Ejecutando);
  });

  it('termina cuando consumio toda su CPU', () => {
    const proceso = procesoEjecutando(1);
    proceso.ejecutarTick();
    proceso.terminar();

    expect(proceso.estado).toBe(EstadoProceso.Terminado);
    expect(proceso.cpuRestante).toBe(0);
  });

  it('no puede terminar si le queda CPU pendiente', () => {
    const proceso = procesoEjecutando(2);
    proceso.ejecutarTick();

    expect(() => proceso.terminar()).toThrow(ErrorSimulacion);
    expect(proceso.estado).toBe(EstadoProceso.Ejecutando);
  });

  it('no puede ejecutar mas CPU de la que pidio', () => {
    const proceso = procesoEjecutando(1);
    proceso.ejecutarTick();

    expect(() => proceso.ejecutarTick()).toThrow(ErrorSimulacion);
    expect(proceso.cpuRestante).toBe(0);
  });

  it('un proceso Terminado no vuelve a las colas', () => {
    const proceso = procesoEjecutando(1);
    proceso.ejecutarTick();
    proceso.terminar();

    expect(() => proceso.admitir()).toThrow(ErrorSimulacion);
    expect(() => proceso.despachar()).toThrow(ErrorSimulacion);
    expect(proceso.estado).toBe(EstadoProceso.Terminado);
  });

  it.each([
    ['despachar', (p: Proceso) => p.despachar()],
    ['ejecutar', (p: Proceso) => p.ejecutarTick()],
    ['renovar quantum', (p: Proceso) => p.renovarQuantum()],
    ['expulsar', (p: Proceso) => p.expulsar()],
    ['bloquear', (p: Proceso) => p.bloquear(2)],
    ['avanzar bloqueo', (p: Proceso) => p.avanzarBloqueo()],
    ['terminar', (p: Proceso) => p.terminar()],
  ])('rechaza %s sobre un proceso Nuevo', (_accion, accion) => {
    const proceso = new Proceso(1, 100, 3);

    expect(() => accion(proceso)).toThrow(ErrorSimulacion);
    expect(proceso.estado).toBe(EstadoProceso.Nuevo);
  });

  it('rechaza esperar memoria o admitir dos veces', () => {
    const proceso = new Proceso(1, 100, 3);
    proceso.admitir();

    expect(() => proceso.admitir()).toThrow(ErrorSimulacion);
    expect(() => proceso.esperarMemoria()).toThrow(ErrorSimulacion);
  });
});

describe('Proceso - bloqueo por Entrada/Salida (RF08)', () => {
  it('se bloquea con la duracion indicada', () => {
    const proceso = procesoEjecutando();
    proceso.ejecutarTick();
    proceso.bloquear(2);

    expect(proceso.estado).toBe(EstadoProceso.Bloqueado);
    expect(proceso.bloqueoRestante).toBe(2);
  });

  it('vuelve a Listo cuando el temporizador llega a cero', () => {
    const proceso = procesoEjecutando();
    proceso.bloquear(2);

    expect(proceso.avanzarBloqueo()).toBe(false);
    expect(proceso.estado).toBe(EstadoProceso.Bloqueado);
    expect(proceso.bloqueoRestante).toBe(1);

    expect(proceso.avanzarBloqueo()).toBe(true);
    expect(proceso.estado).toBe(EstadoProceso.Listo);
    expect(proceso.bloqueoRestante).toBe(0);
  });

  it('no consume CPU mientras esta bloqueado', () => {
    const proceso = procesoEjecutando(3);
    proceso.ejecutarTick();
    proceso.bloquear(3);

    expect(() => proceso.ejecutarTick()).toThrow(ErrorSimulacion);
    expect(proceso.cpuRestante).toBe(2);
  });

  it.each([0, -1, 1.5])('rechaza una duracion invalida (%s)', (duracion) => {
    const proceso = procesoEjecutando();

    expect(() => proceso.bloquear(duracion)).toThrow(ErrorSimulacion);
    expect(proceso.estado).toBe(EstadoProceso.Ejecutando);
  });
});

describe('Proceso - consulta protegida (RF02, RF10)', () => {
  it('la instantanea copia los datos actuales', () => {
    const proceso = procesoEjecutando(3);
    proceso.ejecutarTick();

    expect(proceso.instantanea()).toEqual({
      pid: 1,
      memoriaRequerida: 100,
      cpuTotal: 3,
      cpuRestante: 2,
      cpuConsumida: 1,
      estado: EstadoProceso.Ejecutando,
      quantumConsumido: 1,
      bloqueoRestante: 0,
    });
  });

  it('la instantanea no se puede modificar ni cambia al proceso real', () => {
    const proceso = new Proceso(1, 100, 3);
    const copia = proceso.instantanea() as { cpuRestante: number };

    expect(() => {
      copia.cpuRestante = 0;
    }).toThrow(TypeError);
    expect(proceso.cpuRestante).toBe(3);
  });

  it('la instantanea no se actualiza sola', () => {
    const proceso = new Proceso(1, 100, 3);
    const copia = proceso.instantanea();
    proceso.admitir();

    expect(copia.estado).toBe(EstadoProceso.Nuevo);
    expect(proceso.estado).toBe(EstadoProceso.Listo);
  });
});