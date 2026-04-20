export const DEFAULT_MENSAGEM_ANIVERSARIO =
  "🎂 Feliz aniversário, {nome}! A equipe da clínica deseja a você um dia incrível! 🎉";

export function isMensagemConfigurada(
  config?: { mensagem?: string | null } | null,
) {
  return Boolean(config?.mensagem?.trim());
}

export function buildMensagemPreview(
  template: string | null | undefined,
  nome: string,
) {
  return (template?.trim() || DEFAULT_MENSAGEM_ANIVERSARIO).replace(
    /{nome}/g,
    nome,
  );
}