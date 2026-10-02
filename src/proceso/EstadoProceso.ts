/** Estados posibles de un proceso durante la simulacion (RF03). */
export enum EstadoProceso {
  Nuevo = 'NUEVO',
  EsperandoMemoria = 'ESPERANDO_MEMORIA',
  Listo = 'LISTO',
  Ejecutando = 'EJECUTANDO',
  Bloqueado = 'BLOQUEADO',
  Terminado = 'TERMINADO',
}