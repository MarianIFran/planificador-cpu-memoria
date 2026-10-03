// Punto de entrada de la biblioteca: lo que puede usar quien la importe.
export { ErrorSimulacion } from './errores';
export type { AdministradorMemoria } from './memoria/AdministradorMemoria';
export { BestFit } from './memoria/BestFit';
export type { BloqueLectura } from './memoria/BloqueLectura';
export { FirstFit } from './memoria/FirstFit';
export { GestorMemoria } from './memoria/GestorMemoria';
export type { PoliticaAsignacion } from './memoria/PoliticaAsignacion';
export { WorstFit } from './memoria/WorstFit';
export { CalculadorMetricasEstandar } from './metricas/CalculadorMetricas';
export type { CalculadorMetricas, DatosMetricas } from './metricas/CalculadorMetricas';
export type { MetricasLectura } from './metricas/MetricasLectura';
export type { PlanificadorCpu } from './planificacion/PlanificadorCpu';
export { PlanificadorRoundRobin } from './planificacion/PlanificadorRoundRobin';
export { EstadoProceso } from './proceso/EstadoProceso';
export type { ProcesoLectura } from './proceso/ProcesoLectura';
export { MEMORIA_REFERENCIA, QUANTUM_REFERENCIA } from './simulador/ConfiguracionSimulacion';
export type { ConfiguracionSimulacion } from './simulador/ConfiguracionSimulacion';
export { Simulador } from './simulador/Simulador';