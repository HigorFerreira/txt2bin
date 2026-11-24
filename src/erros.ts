/** Erro ligado a uma linha do arquivo-fonte. */
export class ErroFonte extends Error {
  constructor(public linha: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroFonte';
  }
  formatar(arquivo = 'entrada'): string {
    return `${arquivo}:${this.linha}: ${this.message}`;
  }
}

/** Teste por forma, que funciona mesmo se o empacotador duplicar a classe. */
export function ehErroFonte(e: unknown): e is ErroFonte {
  return e instanceof ErroFonte || (e instanceof Error && e.name === 'ErroFonte' && typeof (e as ErroFonte).linha === 'number');
}
