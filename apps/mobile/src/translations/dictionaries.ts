import type { Locale } from "@/lib/locale";

// Message-catalog style ("gettext" pattern), same approach as the web app's
// apps/web/src/translations/dictionaries.ts — keyed by the original
// Portuguese source string so untranslated call sites keep showing
// Portuguese automatically instead of an abstract key like "menu.perfil".
type Dictionary = Record<string, string>;

const en: Dictionary = {
  // Tabs / navigation
  "Ponto": "Time Clock",
  "Banco de Horas": "Overtime Bank",
  "Férias": "Vacation",
  "Documentos": "Documents",
  "Mural": "Notice Board",
  "Onboarding": "Onboarding",
  "Notificações": "Notifications",
  "Mais opções": "More options",

  // Perfil screen
  "Perfil": "Profile",
  "Colaborador": "Employee",
  "Gestor": "Manager",
  "RH": "HR",
  "Editar foto": "Edit photo",
  "Tirar foto": "Take photo",
  "Galeria": "Gallery",
  "Remover foto": "Remove photo",
  "Fechar": "Close",
  "Alterar senha": "Change password",
  "Senha alterada com sucesso.": "Password changed successfully.",
  "Senha atual": "Current password",
  "Nova senha": "New password",
  "Confirmar nova senha": "Confirm new password",
  "Salvando...": "Saving...",
  "Salvar nova senha": "Save new password",
  "As senhas não coincidem.": "The passwords don't match.",
  "A nova senha precisa ter pelo menos 8 caracteres.": "The new password must be at least 8 characters.",
  "Senha atual incorreta.": "Current password is incorrect.",
  "Meu Perfil": "My Profile",
  "Central de Ajuda": "Help Center",
  "Boas-vindas / Onboarding": "Welcome / Onboarding",
  "Benefícios e clube de vantagens": "Benefits & perks club",
  "Operacional / TI": "Operations / IT",
  "Atestados da equipe": "Team medical certificates",
  "Sair da conta": "Sign out",
  "Idioma": "Language",

  // Personal data modal
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
  "Data de nascimento inválida. Use o formato DD/MM/AAAA.": "Invalid date of birth. Use the DD/MM/YYYY format.",

  // Ajuda
  "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.":
    "Common questions about using SGP. If you can't find what you're looking for here, talk to your manager or HR.",
};

const es: Dictionary = {
  // Tabs / navigation
  "Ponto": "Registro horario",
  "Banco de Horas": "Banco de horas",
  "Férias": "Vacaciones",
  "Documentos": "Documentos",
  "Mural": "Mural",
  "Onboarding": "Incorporación",
  "Notificações": "Notificaciones",
  "Mais opções": "Más opciones",

  // Perfil screen
  "Perfil": "Perfil",
  "Colaborador": "Colaborador",
  "Gestor": "Gerente",
  "RH": "RR. HH.",
  "Editar foto": "Editar foto",
  "Tirar foto": "Tomar foto",
  "Galeria": "Galería",
  "Remover foto": "Quitar foto",
  "Fechar": "Cerrar",
  "Alterar senha": "Cambiar contraseña",
  "Senha alterada com sucesso.": "Contraseña cambiada con éxito.",
  "Senha atual": "Contraseña actual",
  "Nova senha": "Nueva contraseña",
  "Confirmar nova senha": "Confirmar nueva contraseña",
  "Salvando...": "Guardando...",
  "Salvar nova senha": "Guardar nueva contraseña",
  "As senhas não coincidem.": "Las contraseñas no coinciden.",
  "A nova senha precisa ter pelo menos 8 caracteres.": "La nueva contraseña debe tener al menos 8 caracteres.",
  "Senha atual incorreta.": "La contraseña actual es incorrecta.",
  "Meu Perfil": "Mi Perfil",
  "Central de Ajuda": "Centro de Ayuda",
  "Boas-vindas / Onboarding": "Bienvenida / Incorporación",
  "Benefícios e clube de vantagens": "Beneficios y club de ventajas",
  "Operacional / TI": "Operativo / TI",
  "Atestados da equipe": "Certificados médicos del equipo",
  "Sair da conta": "Cerrar sesión",
  "Idioma": "Idioma",

  // Personal data modal
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
  "Data de nascimento inválida. Use o formato DD/MM/AAAA.": "Fecha de nacimiento inválida. Use el formato DD/MM/AAAA.",

  // Ajuda
  "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.":
    "Preguntas frecuentes sobre cómo usar el SGP. Si no encuentra lo que busca aquí, hable con su gerente o con RR. HH.",
};

const DICTIONARIES: Record<Locale, Dictionary> = { pt: {}, en, es };

export function translate(locale: Locale, source: string): string {
  return DICTIONARIES[locale][source] ?? source;
}
