import type { Locale } from "@/lib/locale";

// Message-catalog style ("gettext" pattern): keyed by the original
// Portuguese source string, not by an abstract id. This lets translation be
// applied incrementally — call sites that aren't wrapped in t() yet keep
// showing Portuguese automatically, instead of an untranslated key like
// "nav.ponto". Only EN/ES need entries; pt is the identity (falls through).
type Dictionary = Record<string, string>;

const en: Dictionary = {
  // Sidebar / nav
  "Ponto": "Time Clock",
  "Histórico de Pontos": "Time Clock History",
  "Folha de Ponto": "Timesheet",
  "Colaboradores": "Employees",
  "Plantão": "Shift Schedule",
  "Aprovações": "Approvals",
  "Documentos": "Documents",
  "Mural": "Notice Board",
  "Benefícios": "Benefits",
  "Pagamentos": "Payments",
  "Onboarding": "Onboarding",
  "Horas": "Hours",
  "Banco de Horas": "Overtime Bank",
  "Férias": "Vacation",
  "Holerites": "Payslips",
  "Notificações": "Notifications",
  "Colaborador": "Employee",
  "Gestor": "Manager",
  "RH": "HR",
  "Gestão de Carreiras": "Career Management",
  "Fiscal & Tributos 2026": "Fiscal & Tax 2026",
  "Sistema de Gestão de Pessoas": "People Management System",
  "Expandir menu": "Expand menu",
  "Recolher menu": "Collapse menu",
  "Recolher": "Collapse",
  "Expandir": "Expand",

  // Search
  "Buscar": "Search",
  "Buscar telas...": "Search screens...",
  "Nada encontrado para": "Nothing found for",

  // Notifications
  "Marcar todas como lidas": "Mark all as read",
  "Ver todas": "View all",
  "Nenhuma notificação.": "No notifications.",

  // User menu
  "Menu do usuário": "User menu",
  "Editar foto": "Edit photo",
  "Trocar foto": "Change photo",
  "Enviando...": "Uploading...",
  "Remover foto": "Remove photo",
  "Fechar": "Close",
  "Alterar senha": "Change password",
  "Meu Perfil": "My Profile",
  "Central de Ajuda": "Help Center",
  "Sair": "Sign out",
  "Idioma": "Language",
  "Senha atual": "Current password",
  "Nova senha": "New password",
  "Confirmar nova senha": "Confirm new password",
  "Salvar nova senha": "Save new password",
  "Salvando...": "Saving...",
  "Senha alterada com sucesso.": "Password changed successfully.",
  "Preencha todos os campos.": "Fill in all fields.",
  "As senhas não coincidem.": "The passwords don't match.",
  "A nova senha precisa ter pelo menos 8 caracteres.": "The new password must be at least 8 characters.",
  "Senha atual incorreta.": "Current password is incorrect.",
  "Não foi possível alterar a senha.": "Couldn't change the password.",

  // Personal data dialog
  "RG": "National ID",
  "Data de nascimento": "Date of birth",
  "Estado civil": "Marital status",
  "Solteiro(a)": "Single",
  "Casado(a)": "Married",
  "Divorciado(a)": "Divorced",
  "Viúvo(a)": "Widowed",
  "União estável": "Domestic partnership",
  "Telefone": "Phone",
  "CEP": "ZIP code",
  "Rua": "Street",
  "Número": "Number",
  "Bairro": "Neighborhood",
  "Cidade": "City",
  "Estado (UF)": "State",
  "Salvar": "Save",
  "Dados salvos com sucesso.": "Data saved successfully.",

  // Ajuda
  "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.":
    "Common questions about using SGP. If you can't find what you're looking for here, talk to your manager or HR.",
};

const es: Dictionary = {
  // Sidebar / nav
  "Ponto": "Registro horario",
  "Histórico de Pontos": "Historial de registros",
  "Folha de Ponto": "Hoja de horas",
  "Colaboradores": "Colaboradores",
  "Plantão": "Turnos",
  "Aprovações": "Aprobaciones",
  "Documentos": "Documentos",
  "Mural": "Mural",
  "Benefícios": "Beneficios",
  "Pagamentos": "Pagos",
  "Onboarding": "Incorporación",
  "Horas": "Horas",
  "Banco de Horas": "Banco de horas",
  "Férias": "Vacaciones",
  "Holerites": "Recibos de sueldo",
  "Notificações": "Notificaciones",
  "Colaborador": "Colaborador",
  "Gestor": "Gerente",
  "RH": "RR. HH.",
  "Gestão de Carreiras": "Gestión de carreras",
  "Fiscal & Tributos 2026": "Fiscal y Tributos 2026",
  "Sistema de Gestão de Pessoas": "Sistema de Gestión de Personas",
  "Expandir menu": "Expandir menú",
  "Recolher menu": "Contraer menú",
  "Recolher": "Contraer",
  "Expandir": "Expandir",

  // Search
  "Buscar": "Buscar",
  "Buscar telas...": "Buscar pantallas...",
  "Nada encontrado para": "No se encontró nada para",

  // Notifications
  "Marcar todas como lidas": "Marcar todas como leídas",
  "Ver todas": "Ver todas",
  "Nenhuma notificação.": "Ninguna notificación.",

  // User menu
  "Menu do usuário": "Menú del usuario",
  "Editar foto": "Editar foto",
  "Trocar foto": "Cambiar foto",
  "Enviando...": "Subiendo...",
  "Remover foto": "Quitar foto",
  "Fechar": "Cerrar",
  "Alterar senha": "Cambiar contraseña",
  "Meu Perfil": "Mi Perfil",
  "Central de Ajuda": "Centro de Ayuda",
  "Sair": "Cerrar sesión",
  "Idioma": "Idioma",
  "Senha atual": "Contraseña actual",
  "Nova senha": "Nueva contraseña",
  "Confirmar nova senha": "Confirmar nueva contraseña",
  "Salvar nova senha": "Guardar nueva contraseña",
  "Salvando...": "Guardando...",
  "Senha alterada com sucesso.": "Contraseña cambiada con éxito.",
  "Preencha todos os campos.": "Complete todos los campos.",
  "As senhas não coincidem.": "Las contraseñas no coinciden.",
  "A nova senha precisa ter pelo menos 8 caracteres.": "La nueva contraseña debe tener al menos 8 caracteres.",
  "Senha atual incorreta.": "La contraseña actual es incorrecta.",
  "Não foi possível alterar a senha.": "No se pudo cambiar la contraseña.",

  // Personal data dialog
  "RG": "Documento de identidad",
  "Data de nascimento": "Fecha de nacimiento",
  "Estado civil": "Estado civil",
  "Solteiro(a)": "Soltero/a",
  "Casado(a)": "Casado/a",
  "Divorciado(a)": "Divorciado/a",
  "Viúvo(a)": "Viudo/a",
  "União estável": "Unión de hecho",
  "Telefone": "Teléfono",
  "CEP": "Código postal",
  "Rua": "Calle",
  "Número": "Número",
  "Bairro": "Barrio",
  "Cidade": "Ciudad",
  "Estado (UF)": "Provincia",
  "Salvar": "Guardar",
  "Dados salvos com sucesso.": "Datos guardados con éxito.",

  // Ajuda
  "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.":
    "Preguntas frecuentes sobre cómo usar el SGP. Si no encuentra lo que busca aquí, hable con su gerente o con RR. HH.",
};

const DICTIONARIES: Record<Locale, Dictionary> = { pt: {}, en, es };

export function translate(locale: Locale, source: string): string {
  return DICTIONARIES[locale][source] ?? source;
}
