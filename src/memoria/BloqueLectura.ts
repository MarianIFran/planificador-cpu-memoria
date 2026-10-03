/** Vista de solo lectura de un bloque del mapa de memoria (RF04, RF10). */
export interface BloqueLectura {
  /** Direccion donde empieza el bloque, en KB. */
  readonly inicio: number;
  /** Tamanio del bloque, en KB. */
  readonly tamanio: number;
  /** PID del proceso que lo ocupa, o null si esta libre. */
  readonly pid: number | null;
  readonly libre: boolean;
}