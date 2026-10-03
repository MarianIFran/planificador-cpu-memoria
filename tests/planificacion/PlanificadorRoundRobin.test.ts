import { describe, expect, it } from 'vitest';
import { ErrorSimulacion } from '../../src/errores';
import { ResultadoCpu } from '../../src/planificacion/PlanificadorCpu';
import { PlanificadorRoundRobin } from '../../src/planificacion/PlanificadorRoundRobin';
import { EstadoProceso } from '../../src/proceso/EstadoProceso';
import { EventoES } from '../../src/proceso/EventoES';
import { Proceso } from '../../src/proceso/Proceso';

/** Crea un proceso ya admitido (Listo). */
function listo(pid: number, cpu: number): Proceso {
  const proceso = new Proceso(pid, 100, cpu);
  proceso.admitir();
  return proceso;
}

/** Ejecuta `ticks` veces y devuelve el PID que uso la CPU en cada uno (null = ociosa). */
function ejecutar(planificador: PlanificadorRoundRobin, ticks: number): Array<number | null> {
  const pids: Array<number | null> = [];
  for (let i = 0; i < ticks; i += 1) {
    pids.push(planificador.ejecutarTick().proceso?.pid ?? null);
  }
  return pids;
}

describe('PlanificadorRoundRobin - configuracion (RF01)', () => {
  it('arranca con la CPU libre, la cola vacia y sin cambios de contexto', () => {
    const planificador = new PlanificadorRoundRobin(2);

    expect(planificador.quantum).toBe(2);
    expect(planificador.enEjecucion).toBeNull();
    expect(planificador.listos()).toEqual([]);
    expect(planificador.cambiosDeContexto).toBe(0);
  });

  it.each([0, -2, 1.5, Number.NaN])('rechaza un quantum invalido (%s)', (quantum) => {
    expect(() => new PlanificadorRoundRobin(quantum)).toThrow(ErrorSimulacion);
  });
});

describe('PlanificadorRoundRobin - cola de Listos (RF07)', () => {
  it('atiende en orden FIFO', () => {
    const planificador = new PlanificadorRoundRobin(2);
    planificador.encolar(listo(1, 5));
    planificador.encolar(listo(2, 5));
    planificador.encolar(listo(3, 5));

    expect(planificador.listos().map((p) => p.pid)).toEqual([1, 2, 3]);
  });

  it('solo acepta procesos en estado Listo', () => {
    const planificador = new PlanificadorRoundRobin(2);

    expect(() => planificador.encolar(new Proceso(1, 100, 3))).toThrow(ErrorSimulacion);
    expect(planificador.listos()).toEqual([]);
  });

  it('no acepta procesos duplicados en la cola', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const proceso = listo(1, 3);
    planificador.encolar(proceso);

    expect(() => planificador.encolar(proceso)).toThrow(ErrorSimulacion);
    expect(planificador.listos()).toHaveLength(1);
  });

  it('las consultas devuelven copias que no afectan al planificador', () => {
    const planificador = new PlanificadorRoundRobin(2);
    planificador.encolar(listo(1, 3));
    const copia = planificador.listos() as unknown[];

    expect(() => copia.pop()).toThrow(TypeError);
    expect(planificador.listos()).toHaveLength(1);
  });
});

describe('PlanificadorRoundRobin - ejecucion (RF07)', () => {
  it('con la cola vacia la CPU queda ociosa', () => {
    const planificador = new PlanificadorRoundRobin(2);

    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Ociosa);
    expect(resultado.proceso).toBeNull();
  });

  it('al despachar saca al proceso de la cola y reinicia su quantum', () => {
    const planificador = new PlanificadorRoundRobin(3);
    planificador.encolar(listo(1, 5));

    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Continua);
    expect(planificador.listos()).toEqual([]);
    expect(planificador.enEjecucion?.pid).toBe(1);
    expect(planificador.enEjecucion?.estado).toBe(EstadoProceso.Ejecutando);
    expect(planificador.enEjecucion?.quantumConsumido).toBe(1);
    expect(planificador.enEjecucion?.cpuRestante).toBe(4);
  });

  it('caso de la consigna: Q=2, P1 con CPU 3 y P2 con CPU 2', () => {
    const planificador = new PlanificadorRoundRobin(2);
    planificador.encolar(listo(1, 3));
    planificador.encolar(listo(2, 2));

    expect(ejecutar(planificador, 5)).toEqual([1, 1, 2, 2, 1]);
    expect(planificador.cambiosDeContexto).toBe(1);
    expect(planificador.enEjecucion).toBeNull();
    expect(planificador.listos()).toEqual([]);
  });

  it('al agotar el quantum con otros Listos va al final de la cola', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const p1 = listo(1, 5);
    planificador.encolar(p1);
    planificador.encolar(listo(2, 5));
    planificador.encolar(listo(3, 5));

    planificador.ejecutarTick();
    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Expulsion);
    expect(p1.estado).toBe(EstadoProceso.Listo);
    expect(planificador.enEjecucion).toBeNull();
    expect(planificador.listos().map((p) => p.pid)).toEqual([2, 3, 1]);
    expect(planificador.cambiosDeContexto).toBe(1);
  });

  it('un unico proceso renueva su quantum sin cambio de contexto', () => {
    const planificador = new PlanificadorRoundRobin(2);
    planificador.encolar(listo(1, 5));

    planificador.ejecutarTick();
    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.RenovoQuantum);
    expect(planificador.enEjecucion?.pid).toBe(1);
    expect(planificador.enEjecucion?.quantumConsumido).toBe(0);
    expect(planificador.cambiosDeContexto).toBe(0);
    expect(ejecutar(planificador, 3)).toEqual([1, 1, 1]);
    expect(planificador.cambiosDeContexto).toBe(0);
  });

  it('terminar justo en el limite del quantum no reencola ni cuenta cambio de contexto', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const p1 = listo(1, 2);
    planificador.encolar(p1);
    planificador.encolar(listo(2, 2));

    planificador.ejecutarTick();
    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Termino);
    expect(resultado.proceso).toBe(p1);
    expect(p1.estado).toBe(EstadoProceso.Terminado);
    expect(planificador.listos().map((p) => p.pid)).toEqual([2]);
    expect(planificador.cambiosDeContexto).toBe(0);
  });

  it('despues de una finalizacion, el siguiente ejecuta recien en el tick siguiente', () => {
    const planificador = new PlanificadorRoundRobin(2);
    planificador.encolar(listo(1, 1));
    const p2 = listo(2, 2);
    planificador.encolar(p2);

    planificador.ejecutarTick();

    expect(planificador.enEjecucion).toBeNull();
    expect(p2.cpuRestante).toBe(2);
    expect(ejecutar(planificador, 1)).toEqual([2]);
  });

  it('nunca ejecuta mas de un proceso por tick', () => {
    const planificador = new PlanificadorRoundRobin(1);
    const procesos = [listo(1, 2), listo(2, 2), listo(3, 2)];
    procesos.forEach((proceso) => planificador.encolar(proceso));

    for (let tick = 1; tick <= 6; tick += 1) {
      planificador.ejecutarTick();
      const consumida = procesos.reduce((suma, proceso) => suma + proceso.cpuConsumida, 0);
      expect(consumida).toBe(tick);
    }
  });
});

describe('PlanificadorRoundRobin - bloqueo por E/S (RF08)', () => {
  it('bloquea al proceso, libera la CPU y cuenta un cambio de contexto', () => {
    const planificador = new PlanificadorRoundRobin(3);
    const p1 = listo(1, 4);
    p1.programarES(new EventoES(1, 2));
    planificador.encolar(p1);

    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Bloqueo);
    expect(p1.estado).toBe(EstadoProceso.Bloqueado);
    expect(p1.bloqueoRestante).toBe(2);
    expect(planificador.enEjecucion).toBeNull();
    expect(planificador.listos()).toEqual([]);
    expect(planificador.cambiosDeContexto).toBe(1);
  });

  it('el bloqueo tiene prioridad sobre la rotacion por quantum', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const p1 = listo(1, 4);
    p1.programarES(new EventoES(2, 1));
    planificador.encolar(p1);
    planificador.encolar(listo(2, 4));

    planificador.ejecutarTick();
    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Bloqueo);
    expect(planificador.listos().map((p) => p.pid)).toEqual([2]);
    expect(planificador.cambiosDeContexto).toBe(1);
  });

  it('la finalizacion tiene prioridad sobre el bloqueo', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const p1 = listo(1, 1);
    p1.programarES(new EventoES(1, 3));
    planificador.encolar(p1);

    const resultado = planificador.ejecutarTick();

    expect(resultado.resultado).toBe(ResultadoCpu.Termino);
    expect(planificador.cambiosDeContexto).toBe(0);
  });

  it('mientras esta bloqueado no consume CPU y al volver se encola al final', () => {
    const planificador = new PlanificadorRoundRobin(2);
    const p1 = listo(1, 3);
    p1.programarES(new EventoES(1, 1));
    planificador.encolar(p1);
    planificador.encolar(listo(2, 4));
    planificador.ejecutarTick();

    expect(ejecutar(planificador, 1)).toEqual([2]);
    expect(p1.cpuRestante).toBe(2);

    p1.avanzarBloqueo();
    planificador.encolar(p1);

    expect(planificador.listos().map((p) => p.pid)).toEqual([1]);
    expect(ejecutar(planificador, 2)).toEqual([2, 1]);
  });
});