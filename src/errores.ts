/** Error que se lanza cuando se rompe una regla del dominio del simulador. */
export class ErrorSimulacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorSimulacion';
  }
}

/** Valida que un valor sea un entero mayor a cero. */
export function exigirEnteroPositivo(valor: number, nombre: string): void {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new ErrorSimulacion(`${nombre} debe ser un entero positivo (recibido: ${valor})`);
  }
}