import { describe, expect, it } from 'vitest';
import {
  BestFit,
  ErrorSimulacion,
  EstadoProceso,
  FirstFit,
  MEMORIA_REFERENCIA,
  QUANTUM_REFERENCIA,
  Simulador,
  WorstFit,
} from '../../src/index';

/** PIDs de una lista de procesos, para comparar colas mas facil. */
function pids(procesos: ReadonlyArray<{ pid: number }>): number[] {
  return procesos.map((proceso) => proceso.pid);
}

/** Avanza `ticks` y devuelve que PID quedo usando CPU en cada tick (null = ociosa). */
function traza(simulador: Simulador, ticks: number): Array<number | null> {
  const resultado: Array<number | null> = [];
  for (let i = 0; i < ticks; i += 1) {
    const antes = new Map(simulador.procesos().map((p) => [p.pid, p.cpuConsumida]));
    simulador.avanzarTick();
    const ejecuto = simulador.procesos().filter((p) => p.cpuConsumida > (antes.get(p.pid) ?? 0));
    expect(ejecuto.length <= 1).toBe(true);
    resultado.push(ejecuto[0]?.pid ?? null);
  }
  return resultado;
}

describe('Simulador - configuracion e inicio (RF01)', () => {
  it('sin parametros usa la configuracion de referencia', () => {
    const simulador = new Simulador();

    expect(simulador.memoriaTotal).toBe(MEMORIA_REFERENCIA);
    expect(simulador.quantum).toBe(QUANTUM_REFERENCIA);
    expect(simulador.memoriaTotal).toBe(1024);
    expect(simulador.quantum).toBe(2);
    expect(simulador.nombrePolitica).toBe('First-Fit');
  });

  it('arranca en tick 0, con un bloque libre, colas vacias y contadores en cero', () => {
    const simulador = new Simulador({ memoriaTotal: 500, quantum: 3 });

    expect(simulador.tickActual).toBe(0);
    expect(simulador.mapaMemoria()).toEqual([{ inicio: 0, tamanio: 500, pid: null, libre: true }]);
    expect(simulador.procesoEnCpu()).toBeNull();
    expect(simulador.listos()).toEqual([]);
    expect(simulador.esperandoMemoria()).toEqual([]);
    expect(simulador.bloqueados()).toEqual([]);
    expect(simulador.terminados()).toEqual([]);
    expect(simulador.procesos()).toEqual([]);
    expect(simulador.metricas()).toEqual({
      ocupacionMemoria: 0,
      utilizacionCpu: 0,
      cambiosDeContexto: 0,
      memoriaLibre: 500,
      mayorBloqueLibre: 500,
      fragmentacionExterna: 0,
    });
  });

  it.each([
    ['First-Fit', new FirstFit()],
    ['Best-Fit', new BestFit()],
    ['Worst-Fit', new WorstFit()],
  ])('permite elegir la politica %s al configurar', (nombre, politica) => {
    expect(new Simulador({ politica }).nombrePolitica).toBe(nombre);
  });

  it.each([
    ['memoria cero', { memoriaTotal: 0 }],
    ['memoria negativa', { memoriaTotal: -1024 }],
    ['memoria decimal', { memoriaTotal: 10.5 }],
    ['quantum cero', { quantum: 0 }],
    ['quantum negativo', { quantum: -2 }],
    ['quantum decimal', { quantum: 1.5 }],
    ['memoria valida con quantum invalido', { memoriaTotal: 1024, quantum: 0 }],
  ])('rechaza %s', (_caso, configuracion) => {
    expect(() => new Simulador(configuracion)).toThrow(ErrorSimulacion);
  });
});

describe('Simulador - registro de procesos (RF02)', () => {
  it('registra un proceso en estado Nuevo sin asignarle memoria todavia', () => {
    const simulador = new Simulador();

    const registrado = simulador.registrarProceso(1, 300, 4);

    expect(registrado).toEqual({
      pid: 1,
      memoriaRequerida: 300,
      cpuTotal: 4,
      cpuRestante: 4,
      cpuConsumida: 0,
      estado: EstadoProceso.Nuevo,
      quantumConsumido: 0,
      bloqueoRestante: 0,
    });
    expect(simulador.proceso(1)).toEqual(registrado);
    expect(simulador.metricas().memoriaLibre).toBe(1024);
  });

  it('rechaza un PID duplicado', () => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 100, 2);

    expect(() => simulador.registrarProceso(1, 200, 3)).toThrow(ErrorSimulacion);
    expect(simulador.procesos()).toHaveLength(1);
    expect(simulador.proceso(1).memoriaRequerida).toBe(100);
  });

  it('rechaza un proceso que pide mas que la memoria total', () => {
    const simulador = new Simulador({ memoriaTotal: 500 });

    expect(() => simulador.registrarProceso(1, 501, 3)).toThrow(ErrorSimulacion);
    expect(simulador.procesos()).toEqual([]);
  });

  it('acepta un proceso que pide exactamente la memoria total', () => {
    const simulador = new Simulador({ memoriaTotal: 500 });
    simulador.registrarProceso(1, 500, 1);

    simulador.avanzarTick();

    expect(simulador.metricas().ocupacionMemoria).toBe(0);
    expect(pids(simulador.terminados())).toEqual([1]);
  });

  it.each([
    ['PID invalido', 0, 100, 3],
    ['memoria invalida', 1, 0, 3],
    ['CPU invalida', 1, 100, 0],
  ])('rechaza %s', (_caso, pid, memoria, cpu) => {
    const simulador = new Simulador();

    expect(() => simulador.registrarProceso(pid, memoria, cpu)).toThrow(ErrorSimulacion);
    expect(simulador.procesos()).toEqual([]);
  });

  it('rechaza consultar un PID inexistente', () => {
    expect(() => new Simulador().proceso(99)).toThrow(ErrorSimulacion);
  });

  it('las consultas no permiten modificar el estado interno', () => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 100, 3);
    const copia = simulador.proceso(1) as { cpuRestante: number };
    const lista = simulador.procesos() as unknown[];

    expect(() => {
      copia.cpuRestante = 0;
    }).toThrow(TypeError);
    expect(() => lista.pop()).toThrow(TypeError);
    expect(simulador.proceso(1).cpuRestante).toBe(3);
    expect(simulador.procesos()).toHaveLength(1);
  });
});

describe('Simulador - estados y admision (RF03)', () => {
  it('al admitir asigna memoria y el proceso pasa por Listo hasta la CPU', () => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 300, 5);
    simulador.registrarProceso(2, 200, 5);

    simulador.avanzarTick();

    expect(simulador.procesoEnCpu()?.pid).toBe(1);
    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Ejecutando);
    expect(simulador.proceso(2).estado).toBe(EstadoProceso.Listo);
    expect(pids(simulador.listos())).toEqual([2]);
    expect(simulador.mapaMemoria().map((b) => b.pid)).toEqual([1, 2, null]);
  });

  it('si no hay bloque suficiente queda Esperando Memoria', () => {
    const simulador = new Simulador({ memoriaTotal: 1000 });
    simulador.registrarProceso(1, 800, 5);
    simulador.registrarProceso(2, 300, 5);

    simulador.avanzarTick();

    expect(simulador.proceso(2).estado).toBe(EstadoProceso.EsperandoMemoria);
    expect(pids(simulador.esperandoMemoria())).toEqual([2]);
    expect(pids(simulador.listos())).toEqual([]);
  });

  it('un proceso en espera no impide admitir a otro que si cabe', () => {
    const simulador = new Simulador({ memoriaTotal: 1000 });
    simulador.registrarProceso(1, 800, 5);
    simulador.registrarProceso(2, 300, 5);
    simulador.registrarProceso(3, 150, 5);

    simulador.avanzarTick();

    expect(pids(simulador.esperandoMemoria())).toEqual([2]);
    expect(pids(simulador.listos())).toEqual([3]);
  });

  it('reintenta la admision en orden de registro cuando se libera memoria', () => {
    const simulador = new Simulador({ memoriaTotal: 1000, quantum: 2 });
    simulador.registrarProceso(1, 800, 1);
    simulador.registrarProceso(2, 500, 3);
    simulador.registrarProceso(3, 500, 3);
    simulador.registrarProceso(4, 600, 3);

    simulador.avanzarTick();
    expect(pids(simulador.esperandoMemoria())).toEqual([2, 3, 4]);

    simulador.avanzarTick();

    expect(pids(simulador.esperandoMemoria())).toEqual([4]);
    expect(simulador.mapaMemoria().map((b) => b.pid)).toEqual([2, 3]);
  });

  it('una liberacion al final del tick habilita la admision recien en el siguiente', () => {
    const simulador = new Simulador({ memoriaTotal: 1000 });
    simulador.registrarProceso(1, 800, 1);
    simulador.registrarProceso(2, 500, 2);

    simulador.avanzarTick();

    // P1 termino y libero su memoria en el tick 1, pero P2 todavia no fue admitido.
    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Terminado);
    expect(simulador.metricas().memoriaLibre).toBe(1000);
    expect(simulador.proceso(2).estado).toBe(EstadoProceso.EsperandoMemoria);

    simulador.avanzarTick();

    expect(simulador.proceso(2).estado).toBe(EstadoProceso.Ejecutando);
    expect(simulador.proceso(2).cpuConsumida).toBe(1);
  });

  it('un proceso Terminado no vuelve a las colas', () => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 100, 1);

    simulador.avanzarTicks(4);

    expect(pids(simulador.terminados())).toEqual([1]);
    expect(simulador.listos()).toEqual([]);
    expect(simulador.procesoEnCpu()).toBeNull();
    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Terminado);
  });
});

describe('Simulador - avance por ticks (RF06, RF07)', () => {
  it('cada invocacion avanza exactamente una unidad', () => {
    const simulador = new Simulador();

    simulador.avanzarTick();
    expect(simulador.tickActual).toBe(1);

    simulador.avanzarTicks(3);
    expect(simulador.tickActual).toBe(4);
  });

  it.each([0, -1, 2.5])('rechaza avanzar una cantidad invalida de ticks (%s)', (cantidad) => {
    const simulador = new Simulador();

    expect(() => simulador.avanzarTicks(cantidad)).toThrow(ErrorSimulacion);
    expect(simulador.tickActual).toBe(0);
  });

  it('caso de la consigna: Q=2, P1 con CPU 3 y P2 con CPU 2', () => {
    const simulador = new Simulador({ quantum: 2 });
    simulador.registrarProceso(1, 100, 3);
    simulador.registrarProceso(2, 100, 2);

    expect(traza(simulador, 5)).toEqual([1, 1, 2, 2, 1]);
    expect(simulador.metricas().cambiosDeContexto).toBe(1);
    expect(pids(simulador.terminados())).toEqual([2, 1]);
    expect(simulador.mapaMemoria()).toEqual([
      { inicio: 0, tamanio: 1024, pid: null, libre: true },
    ]);
  });

  it('es determinista: dos simulaciones iguales dan el mismo resultado', () => {
    const correr = (): unknown => {
      const simulador = new Simulador({ memoriaTotal: 600, quantum: 2, politica: new BestFit() });
      simulador.registrarProceso(1, 300, 4);
      simulador.registrarProceso(2, 200, 3);
      simulador.registrarProceso(3, 400, 2);
      simulador.programarES(1, 1, 2);
      simulador.avanzarTicks(12);
      return [simulador.procesos(), simulador.mapaMemoria(), simulador.metricas()];
    };

    expect(correr()).toEqual(correr());
  });

  it('un unico proceso renueva quantum sin cambios de contexto', () => {
    const simulador = new Simulador({ quantum: 2 });
    simulador.registrarProceso(1, 100, 5);

    expect(traza(simulador, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(simulador.metricas().cambiosDeContexto).toBe(0);
  });

  it('al terminar un proceso libera su memoria en ese mismo tick', () => {
    const simulador = new Simulador({ memoriaTotal: 1000 });
    simulador.registrarProceso(1, 400, 1);

    simulador.avanzarTick();

    expect(simulador.mapaMemoria()).toEqual([{ inicio: 0, tamanio: 1000, pid: null, libre: true }]);
  });

  it('nunca hay procesos duplicados en las colas ni dos en CPU', () => {
    const simulador = new Simulador({ memoriaTotal: 500, quantum: 1 });
    simulador.registrarProceso(1, 200, 3);
    simulador.registrarProceso(2, 200, 3);
    simulador.registrarProceso(3, 300, 2);
    simulador.programarES(2, 1, 2);

    for (let i = 0; i < 12; i += 1) {
      simulador.avanzarTick();
      const enCpu = simulador.procesoEnCpu();
      const ubicados = [
        ...(enCpu === null ? [] : [enCpu.pid]),
        ...pids(simulador.listos()),
        ...pids(simulador.esperandoMemoria()),
        ...pids(simulador.bloqueados()),
        ...pids(simulador.terminados()),
      ];
      expect(new Set(ubicados).size).toBe(ubicados.length);
      expect(ubicados.length).toBe(3);
      const ejecutando = simulador.procesos().filter((p) => p.estado === EstadoProceso.Ejecutando);
      expect(ejecutando.length <= 1).toBe(true);
    }
    expect(pids(simulador.terminados())).toHaveLength(3);
  });
});

describe('Simulador - Entrada/Salida (RF08)', () => {
  it('bloquea, conserva la memoria, no consume CPU y vuelve a Listos', () => {
    const simulador = new Simulador({ quantum: 3 });
    simulador.registrarProceso(1, 300, 4);
    simulador.programarES(1, 2, 2);

    simulador.avanzarTicks(2);

    // Tick 2: P1 llego a 2 ticks de CPU y se bloqueo.
    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Bloqueado);
    expect(simulador.proceso(1).bloqueoRestante).toBe(2);
    expect(pids(simulador.bloqueados())).toEqual([1]);
    expect(simulador.procesoEnCpu()).toBeNull();
    expect(simulador.mapaMemoria()[0]).toEqual({ inicio: 0, tamanio: 300, pid: 1, libre: false });
    expect(simulador.metricas().cambiosDeContexto).toBe(1);

    simulador.avanzarTick();

    // Tick 3: el temporizador baja a 1 y la CPU queda ociosa.
    expect(simulador.proceso(1).bloqueoRestante).toBe(1);
    expect(simulador.proceso(1).cpuConsumida).toBe(2);

    simulador.avanzarTick();

    // Tick 4: el temporizador llega a 0, vuelve a Listos y se despacha en el mismo tick.
    expect(simulador.bloqueados()).toEqual([]);
    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Ejecutando);
    expect(simulador.proceso(1).cpuConsumida).toBe(3);

    simulador.avanzarTick();

    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Terminado);
    expect(simulador.metricas().cambiosDeContexto).toBe(1);
    expect(simulador.metricas().utilizacionCpu).toBe(80);
  });

  it('al desbloquearse va al final de la cola de Listos', () => {
    const simulador = new Simulador({ quantum: 2 });
    simulador.registrarProceso(1, 100, 4);
    simulador.registrarProceso(2, 100, 6);
    simulador.registrarProceso(3, 100, 6);
    simulador.programarES(1, 1, 1);

    // Tick 1: P1 ejecuta y se bloquea. Tick 2: P1 vuelve a Listos detras de P3; ejecuta P2.
    simulador.avanzarTicks(2);

    expect(simulador.procesoEnCpu()?.pid).toBe(2);
    expect(pids(simulador.listos())).toEqual([3, 1]);
  });

  it('el bloqueo tiene prioridad sobre la rotacion por quantum', () => {
    const simulador = new Simulador({ quantum: 2 });
    simulador.registrarProceso(1, 100, 4);
    simulador.registrarProceso(2, 100, 4);
    simulador.programarES(1, 2, 3);

    simulador.avanzarTicks(2);

    expect(simulador.proceso(1).estado).toBe(EstadoProceso.Bloqueado);
    expect(pids(simulador.listos())).toEqual([2]);
    expect(simulador.metricas().cambiosDeContexto).toBe(1);
  });

  it.each([
    ['disparo cero', 1, 0, 2],
    ['duracion cero', 1, 2, 0],
    ['disparo mayor que la CPU total', 1, 5, 2],
    ['PID inexistente', 99, 1, 1],
  ])('rechaza un evento con %s', (_caso, pid, trasCpu, duracion) => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 100, 4);

    expect(() => simulador.programarES(pid, trasCpu, duracion)).toThrow(ErrorSimulacion);

    simulador.avanzarTicks(4);
    expect(simulador.metricas().cambiosDeContexto).toBe(0);
    expect(pids(simulador.terminados())).toEqual([1]);
  });
});

describe('Simulador - metricas (RF09)', () => {
  it('huecos no contiguos de 100 y 300 KB: libre 400, mayor 300, fragmentacion 25%', () => {
    const simulador = new Simulador({ memoriaTotal: 1000, quantum: 1 });
    simulador.registrarProceso(1, 100, 1);
    simulador.registrarProceso(2, 200, 9);
    simulador.registrarProceso(3, 300, 1);
    simulador.registrarProceso(4, 400, 9);

    // Con Q=1 ejecutan P1, P2, P3: al tick 3 ya terminaron P1 y P3.
    simulador.avanzarTicks(3);

    expect(simulador.mapaMemoria().map((b) => [b.tamanio, b.pid])).toEqual([
      [100, null],
      [200, 2],
      [300, null],
      [400, 4],
    ]);
    const metricas = simulador.metricas();
    expect(metricas.memoriaLibre).toBe(400);
    expect(metricas.mayorBloqueLibre).toBe(300);
    expect(metricas.fragmentacionExterna).toBe(25);
    expect(metricas.ocupacionMemoria).toBe(60);
    expect(metricas.utilizacionCpu).toBe(100);
  });

  it('con la memoria llena: libre 0, mayor bloque 0 y fragmentacion 0%', () => {
    const simulador = new Simulador({ memoriaTotal: 500 });
    simulador.registrarProceso(1, 500, 5);

    simulador.avanzarTick();

    expect(simulador.metricas()).toEqual({
      ocupacionMemoria: 100,
      utilizacionCpu: 100,
      cambiosDeContexto: 0,
      memoriaLibre: 0,
      mayorBloqueLibre: 0,
      fragmentacionExterna: 0,
    });
  });

  it('la utilizacion de CPU baja cuando hay ticks ociosos', () => {
    const simulador = new Simulador();
    simulador.registrarProceso(1, 100, 1);

    simulador.avanzarTicks(4);

    expect(simulador.metricas().utilizacionCpu).toBe(25);
  });

  it('las metricas se recalculan al finalizar cada tick, no al registrar', () => {
    const simulador = new Simulador();
    const iniciales = simulador.metricas();

    simulador.registrarProceso(1, 512, 3);
    expect(simulador.metricas()).toEqual(iniciales);

    simulador.avanzarTick();
    expect(simulador.metricas().ocupacionMemoria).toBe(50);
  });

  it('cuenta expulsiones por quantum y bloqueos, pero no despachos ni finalizaciones', () => {
    const simulador = new Simulador({ quantum: 1 });
    simulador.registrarProceso(1, 100, 2);
    simulador.registrarProceso(2, 100, 2);

    // P1, P2, P1, P2: dos expulsiones (ticks 1 y 2); los ticks 3 y 4 son finalizaciones.
    expect(traza(simulador, 4)).toEqual([1, 2, 1, 2]);
    expect(simulador.metricas().cambiosDeContexto).toBe(2);
  });
});

describe('Simulador - comparacion de politicas (RF04)', () => {
  /** Deja huecos de 100 y 300 KB y despues pide 80 KB con la politica indicada. */
  function ubicacionDe80Kb(politica: FirstFit | BestFit | WorstFit): number | undefined {
    const simulador = new Simulador({ memoriaTotal: 1000, quantum: 1, politica });
    simulador.registrarProceso(1, 300, 1);
    simulador.registrarProceso(2, 200, 9);
    simulador.registrarProceso(3, 100, 1);
    simulador.registrarProceso(4, 400, 9);
    simulador.avanzarTicks(3);
    simulador.registrarProceso(5, 80, 9);
    simulador.avanzarTick();
    return simulador.mapaMemoria().find((bloque) => bloque.pid === 5)?.inicio;
  }

  it('First-Fit usa el primer hueco (direccion 0)', () => {
    expect(ubicacionDe80Kb(new FirstFit())).toBe(0);
  });

  it('Best-Fit usa el hueco mas chico (direccion 500)', () => {
    expect(ubicacionDe80Kb(new BestFit())).toBe(500);
  });

  it('Worst-Fit usa el hueco mas grande (direccion 0)', () => {
    expect(ubicacionDe80Kb(new WorstFit())).toBe(0);
  });
});