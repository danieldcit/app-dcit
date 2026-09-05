// Optional employee fields shared between the create and edit colaborador
// forms/actions.
//
// This lives in its own plain module — not in actions.ts — because
// actions.ts has a file-level "use server" directive, and Next.js requires
// every export of such a file to be an async function; exporting this
// array (even as a re-export) from actions.ts fails the build with
// "A 'use server' file can only export async functions, found object."
// See node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md.
export const OPTIONAL_FIELDS = [
  "email",
  "cargo",
  "team",
  "nivel",
  "convencaoId",
  "salarioMensal",
  "cpf",
  "rg",
  "dataNascimento",
  "estadoCivil",
  "enderecoRua",
  "enderecoNumero",
  "enderecoBairro",
  "enderecoCidade",
  "enderecoEstado",
  "enderecoCep",
] as const;
