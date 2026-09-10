import type { Locale } from "@/lib/locale";
import type { Session } from "@/lib/session";

export type FaqItem = { question: string; answer: string };
export type FaqCategory = {
  title: string;
  // Omitted = visible to every role. Present = only these roles see it.
  roles?: Session["role"][];
  items: FaqItem[];
};

// Content written from the actual behavior of each screen — see
// docs/superpowers/specs if a design doc exists, otherwise this is the
// closest thing to a spec: keep it in sync with the real flow whenever a
// described screen changes.
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Ponto",
    items: [
      {
        question: "Como eu bato o ponto?",
        answer:
          'Toque em "Bater Ponto" na tela inicial. Cada toque registra um horário, e o sistema intercala entrada e saída automaticamente (1º toque = entrada, 2º = saída, e assim por diante) — por isso é importante não pular nenhuma batida.',
      },
      {
        question: "E se eu bater o ponto sem internet (no app)?",
        answer:
          "O ponto é registrado normalmente com o horário real do momento, mesmo offline. Assim que o celular reconectar, ele sincroniza sozinho — enquanto isso, um aviso mostra quantos pontos estão aguardando sincronização.",
      },
      {
        question: "Onde vejo meus pontos batidos?",
        answer:
          'Em "Histórico de pontos" (cada batida individual) ou "Folha de ponto" (horas agrupadas por dia, com total trabalhado e exportação em PDF).',
      },
      {
        question: "Esqueci de bater o ponto ou bati na hora errada. O que eu faço?",
        answer:
          'Use "Ajustar meu ponto" e descreva o que precisa corrigir. O pedido vai para aprovação do seu gestor ou RH — ele não corrige o ponto sozinho, só registra o que aconteceu para quem decide. Acompanhe o status em "Solicitações de ajustes".',
      },
      {
        question: "O que é o Banco de Horas?",
        answer:
          "É a diferença entre as horas que você deveria trabalhar e as que realmente trabalhou, calculada automaticamente a partir dos seus pontos batidos — sem lançamento manual. Mostra saldo (positivo ou negativo), DSR estimado e o valor das horas extras. Com saldo positivo, dá para solicitar compensação, que também passa por aprovação do gestor/RH.",
      },
    ],
  },
  {
    title: "Férias",
    items: [
      {
        question: "Como solicito férias?",
        answer:
          'Na tela Férias, escolha a data de início e a data de fim do período e envie. O pedido fica "Pendente" até seu gestor ou RH aprovar ou recusar.',
      },
      {
        question: "O que são período aquisitivo e concessivo?",
        answer:
          'São prazos definidos pela CLT: o período aquisitivo é o ano em que você "ganha o direito" às férias, contado a partir da sua contratação; o concessivo é o ano seguinte, o prazo para efetivamente tirá-las. A tela de Férias mostra essas datas e avisa quando o prazo concessivo está perto de vencer — férias vencidas geram pagamento em dobro.',
      },
      {
        question: "Onde vejo as férias que eu já tirei antes?",
        answer: 'Em "Histórico de férias", na própria tela Férias.',
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        question: "Quais documentos admissionais preciso enviar?",
        answer:
          "RG, CPF, comprovante de endereço, certidão de casamento e certidão de nascimento dos filhos (quando aplicável) — até 3 fotos por documento. Cada um é revisado por gestor ou RH; se for recusado, você reenvia as fotos e ele volta para análise.",
      },
      {
        question: "Como envio um atestado?",
        answer:
          "Tire uma foto do atestado — o sistema lê automaticamente (OCR) e preenche CID, CRM, médico e dias de afastamento para você conferir antes de enviar. Por privacidade, só o RH vê os dados clínicos; seu gestor só vê que você está afastado e por quantos dias.",
      },
      {
        question: "Onde vejo meu holerite?",
        answer:
          'Na aba Holerites, dentro de Documentos. O RH publica e você só visualiza — é possível expandir os valores (bruto, INSS, IRRF, benefícios, líquido) e baixar em PDF.',
      },
      {
        question: "Como envio o contrato assinado?",
        answer:
          "Na aba Contrato, envie o arquivo assinado. Esse envio não passa por aprovação — é só um registro de que foi enviado.",
      },
      {
        question: "Certificações passam por aprovação?",
        answer:
          "Não. É um registro pessoal que você mesmo cadastra (nome, instituição, validade), sem revisão do RH.",
      },
    ],
  },
  {
    title: "Onboarding",
    items: [
      {
        question: "O que preciso fazer no onboarding?",
        answer:
          "Cinco etapas: assinar o contrato, enviar os documentos admissionais, assistir ao vídeo de boas-vindas, conhecer o time e marcar os acessos configurados (SGN Portal, Movidesk, e-mail corporativo, Teams e Site24x7).",
      },
      {
        question: "Terminei todas as etapas — por que ainda não tenho acesso completo?",
        answer:
          "Concluir as 5 etapas não libera o acesso sozinho: seu gestor ou RH precisa liberar manualmente depois de conferir tudo. Você recebe um aviso assim que isso acontecer.",
      },
    ],
  },
  {
    title: "Benefícios",
    items: [
      {
        question: "O que aparece na tela de Benefícios?",
        answer:
          "Seu saldo de vale-refeição e vale-transporte (valor atual e crédito mensal), além do clube de vantagens — parceiros com desconto, só para consulta, sem resgate pelo app.",
      },
    ],
  },
  {
    title: "Mural e Notificações",
    items: [
      {
        question: "Posso publicar no mural?",
        answer:
          "Só gestor e RH publicam comunicados. Como colaborador, você pode visualizar os posts, reagir com ❤️ e ver quem faz aniversário no mês.",
      },
      {
        question: "Quando recebo notificações?",
        answer:
          "Nestas situações: pagamento depositado, ponto esquecido, novo post no mural, mudança de status de um documento seu, etapa de onboarding concluída (para gestor/RH), acesso liberado e evolução de carreira.",
      },
    ],
  },
  {
    title: "Minha Conta",
    items: [
      {
        question: "Como troco minha foto de perfil?",
        answer:
          'No menu do seu usuário (ícone no topo direito), toque no lápis sobre a foto e escolha "Trocar foto" ou "Remover foto".',
      },
      {
        question: "Como troco minha senha?",
        answer: 'No menu do usuário, toque em "Alterar senha" e informe a senha atual e a nova.',
      },
      {
        question: "Como atualizo meus dados pessoais (endereço, telefone etc.)?",
        answer:
          'No menu do usuário, toque em "Meu Perfil". Você edita RG, data de nascimento, estado civil, telefone e endereço — nome, cargo e salário continuam exclusivos de RH/gestor.',
      },
    ],
  },
  {
    title: "Para gestores e RH",
    roles: ["gestor", "rh"],
    items: [
      {
        question: "O que aparece em Aprovações?",
        answer:
          "Uma fila única com pedidos pendentes de atestados, férias, ajustes de ponto e compensações de banco de horas — tudo num só lugar, com histórico do que já foi decidido.",
      },
      {
        question: "Como gerencio os colaboradores?",
        answer:
          'Em Colaboradores, você cadastra e edita dados (cargo, time, nível, convenção, salário, horário esperado etc.) e acessa a Lixeira de colaboradores removidos.',
      },
      {
        question: "O que é o Plantão/Escala?",
        answer:
          "Um quadro semanal onde você atribui plantões a colaboradores em datas específicas, navegando semana a semana.",
      },
      {
        question: "O que é Gestão de Carreiras?",
        answer:
          "Uma avaliação de carreira, exclusiva de gestor: você pontua o colaborador em princípios e competências fixas, confere os requisitos do próximo nível e decide formalmente a promoção — que já ajusta nível e salário quando aprovada.",
      },
    ],
  },
];

export async function getFaqCategories(locale: Locale): Promise<FaqCategory[]> {
  if (locale === "en") {
    return (await import("./faq-content.en")).FAQ_CATEGORIES_EN;
  }
  if (locale === "es") {
    return (await import("./faq-content.es")).FAQ_CATEGORIES_ES;
  }
  return FAQ_CATEGORIES;
}
