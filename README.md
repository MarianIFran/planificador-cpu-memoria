# Planificador de CPU y memoria

[![tests](https://github.com/MarianIFran/planificador-cpu-memoria/actions/workflows/tests.yml/badge.svg)](https://github.com/MarianIFran/planificador-cpu-memoria/actions/workflows/tests.yml)

Biblioteca de clases en TypeScript que simula cómo varios procesos comparten una
memoria limitada y una única CPU. Es la Actividad de Evaluación 2 (AE2) intercátedra de
**Paradigmas y Lenguajes de Programación II** y **Sistemas Operativos** (ISI, UCP, 2026).

La simulación avanza por *ticks* discretos, sin reloj real, hilos ni azar. Incluye:

- asignación contigua de memoria con **First-Fit**, **Best-Fit** y **Worst-Fit**;
- liberación de memoria con **coalescencia** de huecos vecinos;
- planificación de CPU **Round-Robin** con quantum configurable;
- los estados Nuevo, Esperando Memoria, Listo, Ejecutando, Bloqueado y Terminado;
- bloqueo por **Entrada/Salida** con eventos definidos de antemano;
- métricas de memoria, CPU, cambios de contexto y fragmentación externa.

Es una biblioteca: no tiene interfaz gráfica, menú de consola ni `main`. Su
funcionamiento se demuestra con los tests automatizados.

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior (incluye `npm`).
- Git.

## Instalación

```bash
git clone https://github.com/MarianIFran/planificador-cpu-memoria.git
cd planificador-cpu-memoria
npm ci
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Corre todos los tests una vez. |
| `npm run coverage` | Corre los tests y mide la cobertura. Falla si las líneas cubiertas no superan el 90%. |
| `npm run typecheck` | Revisa los tipos de TypeScript sin generar archivos. |

## Cobertura

- **Herramienta:** Vitest con el proveedor `@vitest/coverage-v8`.
- **Comando:** `npm run coverage`
- **Alcance medido:** todos los archivos de `src/**/*.ts`, incluso los que ningún test importe
  (configurado en `vitest.config.ts`).
- **Umbral:** el comando falla si la cobertura de líneas es menor a 91%.
- **Reporte:** se muestra en la terminal y además se genera en HTML en `coverage/index.html`.

Los archivos que solo contienen interfaces (`ProcesoLectura.ts`, `BloqueLectura.ts`,
`AdministradorMemoria.ts`, `MetricasLectura.ts`) figuran con 0 porque no tienen líneas
ejecutables: TypeScript las elimina al compilar y no afectan el total.

GitHub Actions corre `npm run typecheck` y `npm run coverage` en cada push
(ver `.github/workflows/tests.yml`).

## Ejemplo de uso

```ts
import { BestFit, Simulador } from './src/index';

const simulador = new Simulador({ memoriaTotal: 1024, quantum: 2, politica: new BestFit() });

simulador.registrarProceso(1, 300, 3); // PID, memoria en KB, ticks de CPU
simulador.registrarProceso(2, 200, 2);
simulador.programarES(1, 1, 2);        // P1 se bloquea 2 ticks tras 1 tick de CPU

simulador.avanzarTicks(4);

simulador.tickActual;      // 4
simulador.procesoEnCpu();  // proceso en CPU, o null
simulador.listos();        // cola de Listos, en orden
simulador.mapaMemoria();   // bloques libres y ocupados
simulador.metricas();      // ocupación, uso de CPU, fragmentación, etc.
```

Todas las consultas devuelven copias de solo lectura: modificarlas no cambia el estado interno.

## Estructura

```
src/
  errores.ts                 Error del dominio y validación de enteros positivos
  index.ts                   Lo que expone la biblioteca
  proceso/                   Proceso, sus estados y el evento de E/S
  memoria/                   Bloques, gestor de memoria y las tres políticas
  planificacion/             Planificador Round-Robin
  metricas/                  Cálculo de métricas
  simulador/                 Simulador (coordina las fases del tick) y su configuración
tests/                       Un archivo de tests por cada parte, con la misma organización
docs/diagramas/              Diagramas UML (imagen PNG y fuente editable Mermaid)
.github/workflows/tests.yml  Integración continua
```

## Cómo funciona un tick

Cada llamada a `avanzarTick()` hace siempre lo mismo, en este orden:

1. **Admisión:** intenta asignar memoria a los procesos Nuevos y en espera, en orden de registro.
2. **Bloqueados:** descuenta los temporizadores de E/S; los que llegan a cero vuelven a Listos.
3. **CPU:** el planificador despacha si la CPU está libre y ejecuta una unidad de CPU.
4. **Reloj y métricas:** suma un tick y recalcula las métricas.

Después de ejecutar, el planificador decide con esta prioridad: finalización, bloqueo por
E/S, agotamiento del quantum.

## Requerimientos, clases y tests

| RF | Qué pide | Clases y métodos | Tests |
|---|---|---|---|
| RF01 | Configurar e iniciar | `Simulador` (constructor), `ConfiguracionSimulacion` | `Simulador.test.ts` (configuración e inicio), `GestorMemoria.test.ts` (estado inicial), `PlanificadorRoundRobin.test.ts` (configuración) |
| RF02 | Registrar y consultar procesos | `Simulador.registrarProceso`, `Simulador.proceso`, `Proceso`, `ProcesoLectura` | `Simulador.test.ts` (registro), `Proceso.test.ts` (creación, consulta protegida) |
| RF03 | Estados y admisión | `EstadoProceso`, `Proceso` (transiciones), `Simulador.#admitirProcesos` | `Proceso.test.ts` (transiciones), `Simulador.test.ts` (estados y admisión) |
| RF04 | Asignar memoria contigua | `GestorMemoria.asignar`, `PoliticaAsignacion`, `FirstFit`, `BestFit`, `WorstFit`, `BloqueMemoria` | `Politicas.test.ts`, `GestorMemoria.test.ts`, `BloqueMemoria.test.ts`, `Coalescencia.test.ts` (selección según política) |
| RF05 | Liberar y coalescencia | `GestorMemoria.liberar`, `#coalescer`, `#fusionarConSiguiente` | `Coalescencia.test.ts` |
| RF06 | Avanzar un tick determinista | `Simulador.avanzarTick`, `avanzarTicks` | `Simulador.test.ts` (avance por ticks) |
| RF07 | Round-Robin | `PlanificadorCpu`, `PlanificadorRoundRobin` | `PlanificadorRoundRobin.test.ts`, `Simulador.test.ts` (avance por ticks) |
| RF08 | Entrada/Salida | `EventoES`, `Proceso.programarES`, `Proceso.debeBloquearse`, `Simulador.programarES`, `Simulador.#actualizarBloqueados` | `EventoES.test.ts`, `PlanificadorRoundRobin.test.ts` (bloqueo), `Simulador.test.ts` (Entrada/Salida) |
| RF09 | Métricas | `CalculadorMetricas`, `CalculadorMetricasEstandar`, `MetricasLectura`, `Simulador.metricas` | `CalculadorMetricas.test.ts`, `Simulador.test.ts` (métricas) |
| RF10 | Consultar el estado | `Simulador` (`tickActual`, `procesoEnCpu`, `listos`, `esperandoMemoria`, `bloqueados`, `terminados`, `mapaMemoria`) | `Simulador.test.ts`, `GestorMemoria.test.ts` (mapa protegido) |

## Diagramas

Cada diagrama está en dos versiones: la imagen (`.png`) y la fuente editable (`.mmd`, formato
[Mermaid](https://mermaid.js.org/), que se puede editar en <https://mermaid.live>).

| Diagrama | Imagen | Fuente editable |
|---|---|---|
| Clases | [clases.png](docs/diagramas/clases.png) | [clases.mmd](docs/diagramas/clases.mmd) |
| Secuencia RF03/RF04: admisión y asignación de memoria | [png](docs/diagramas/secuencia-rf03-admision.png) | [mmd](docs/diagramas/secuencia-rf03-admision.mmd) |
| Secuencia RF07: un tick de Round-Robin | [png](docs/diagramas/secuencia-rf07-round-robin.png) | [mmd](docs/diagramas/secuencia-rf07-round-robin.mmd) |
| Secuencia RF08: bloqueo por E/S y retorno | [png](docs/diagramas/secuencia-rf08-entrada-salida.png) | [mmd](docs/diagramas/secuencia-rf08-entrada-salida.mmd) |

## Decisiones de diseño

- **Encapsulamiento:** todos los atributos son privados (`#`). El estado solo cambia con métodos
  que validan las reglas, y hacia afuera se entregan copias congeladas (`instantanea()`).
- **Interfaces:** el `Simulador` depende de `AdministradorMemoria`, `PlanificadorCpu` y
  `CalculadorMetricas`, no de las clases concretas.
- **Polimorfismo:** `GestorMemoria` llama a `politica.elegir(...)` sin saber qué política es.
  Agregar una política nueva no obliga a tocar el gestor.
- **Composición en lugar de herencia:** el simulador *tiene* una memoria, un planificador y un
  calculador. La única herencia es `ErrorSimulacion extends Error`, que sí es un "es un".
- **Sin clases abstractas:** las tres políticas no comparten código, solo el contrato, así que
  alcanza con una interfaz.
- **Cambios de contexto:** se cuentan en la expulsión por quantum con otros Listos y en el
  bloqueo por E/S. No se cuentan el despacho inicial, la finalización ni la renovación de quantum.
- **Eventos de E/S:** cada proceso admite un solo evento. Se rechaza si el disparo o la duración
  no son enteros positivos, si el disparo supera la CPU total del proceso o si ya quedó en el
  pasado. Si el disparo coincide con el último tick de CPU, el proceso termina y no se bloquea.
- **Empates entre huecos:** Best-Fit y Worst-Fit eligen el de menor dirección.

## Autor

Mariann — Ingeniería en Sistemas de Información, UCP (2026).
