import type { FaqCategory } from "./faq-content";

// Spanish translation of faq-content.ts — see faq-content.en.ts for the
// same rationale (parallel array, not run through the t() dictionary).
export const FAQ_CATEGORIES_ES: FaqCategory[] = [
  {
    title: "Registro horario",
    items: [
      {
        question: "¿Cómo registro mi entrada/salida?",
        answer:
          'Toque en "Registrar" en la pantalla principal. Cada toque registra un horario, y el sistema alterna entrada y salida automáticamente (1er toque = entrada, 2do = salida, y así sucesivamente) — por eso es importante no saltarse ningún registro.',
      },
      {
        question: "¿Qué pasa si registro sin internet (en la app)?",
        answer:
          "El registro se guarda normalmente con la hora real del momento, incluso sin conexión. En cuanto el celular se reconecte, se sincroniza solo — mientras tanto, un aviso muestra cuántos registros están esperando sincronización.",
      },
      {
        question: "¿Dónde veo mis registros de entrada/salida?",
        answer:
          'En "Historial de registros" (cada marca individual) o "Hoja de horas" (horas agrupadas por día, con total trabajado y exportación en PDF).',
      },
      {
        question: "Olvidé registrar mi entrada/salida o lo hice a la hora equivocada. ¿Qué hago?",
        answer:
          'Use "Ajustar mi registro" y describa lo que necesita corregir. La solicitud va a la aprobación de su gerente o RR. HH. — no corrige el registro por sí sola, solo deja constancia de lo ocurrido para quien decide. Siga el estado en "Solicitudes de ajuste".',
      },
      {
        question: "¿Qué es el Banco de horas?",
        answer:
          "Es la diferencia entre las horas que debería trabajar y las que realmente trabajó, calculada automáticamente a partir de sus registros — sin carga manual. Muestra el saldo (positivo o negativo), el DSR estimado y el valor de las horas extra. Con saldo positivo, puede solicitar compensación, que también pasa por la aprobación del gerente/RR. HH.",
      },
    ],
  },
  {
    title: "Vacaciones",
    items: [
      {
        question: "¿Cómo solicito vacaciones?",
        answer:
          'En la pantalla de Vacaciones, elija la fecha de inicio y de fin del período y envíe la solicitud. Queda "Pendiente" hasta que su gerente o RR. HH. la apruebe o la rechace.',
      },
      {
        question: "¿Qué son el período adquisitivo y el concesivo?",
        answer:
          'Son plazos definidos por la legislación laboral brasileña (CLT): el período adquisitivo es el año en que usted "gana el derecho" a las vacaciones, contado desde su contratación; el concesivo es el año siguiente, el plazo para tomarlas efectivamente. La pantalla de Vacaciones muestra estas fechas y avisa cuando el plazo concesivo está por vencer — las vacaciones vencidas generan pago doble.',
      },
      {
        question: "¿Dónde veo las vacaciones que ya tomé antes?",
        answer: 'En "Historial de vacaciones", en la propia pantalla de Vacaciones.',
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        question: "¿Qué documentos de admisión necesito enviar?",
        answer:
          "Documento de identidad, CPF, comprobante de domicilio, certificado de matrimonio y certificados de nacimiento de los hijos (cuando corresponda) — hasta 3 fotos por documento. Cada uno es revisado por el gerente o RR. HH.; si es rechazado, usted reenvía las fotos y vuelve a análisis.",
      },
      {
        question: "¿Cómo envío un certificado médico?",
        answer:
          "Tome una foto del certificado — el sistema lo lee automáticamente (OCR) y completa el código de diagnóstico, el número de colegiado, el médico y los días de baja para que usted los revise antes de enviar. Por privacidad, solo RR. HH. ve los datos clínicos; su gerente solo ve que usted está de baja y por cuántos días.",
      },
      {
        question: "¿Dónde veo mi recibo de sueldo?",
        answer:
          "En la pestaña Recibos de sueldo, dentro de Documentos. RR. HH. lo publica y usted solo lo visualiza — puede expandir los valores (bruto, seguridad social, retención, beneficios, neto) y descargarlo en PDF.",
      },
      {
        question: "¿Cómo envío el contrato firmado?",
        answer:
          "En la pestaña Contrato, suba el archivo firmado. Este envío no pasa por aprobación — es solo un registro de que fue enviado.",
      },
      {
        question: "¿Las certificaciones pasan por aprobación?",
        answer:
          "No. Es un registro personal que usted mismo carga (nombre, institución, vigencia), sin revisión de RR. HH.",
      },
    ],
  },
  {
    title: "Incorporación",
    items: [
      {
        question: "¿Qué necesito hacer en la incorporación?",
        answer:
          "Cinco pasos: firmar el contrato, enviar los documentos de admisión, ver el video de bienvenida, conocer al equipo y marcar los accesos configurados (Portal SGN, Movidesk, correo corporativo, Teams y Site24x7).",
      },
      {
        question: "Terminé todos los pasos — ¿por qué todavía no tengo acceso completo?",
        answer:
          "Completar los 5 pasos no habilita el acceso por sí solo: su gerente o RR. HH. debe habilitarlo manualmente después de revisar todo. Recibirá un aviso en cuanto eso ocurra.",
      },
    ],
  },
  {
    title: "Beneficios",
    items: [
      {
        question: "¿Qué aparece en la pantalla de Beneficios?",
        answer:
          "Su saldo de vale de comida y vale de transporte (monto actual y crédito mensual), además del club de ventajas — socios con descuento, solo para consulta, sin canje por la app.",
      },
    ],
  },
  {
    title: "Mural y Notificaciones",
    items: [
      {
        question: "¿Puedo publicar en el mural?",
        answer:
          "Solo el gerente y RR. HH. publican comunicados. Como colaborador, puede ver las publicaciones, reaccionar con ❤️ y ver quién cumple años este mes.",
      },
      {
        question: "¿Cuándo recibo notificaciones?",
        answer:
          "En estas situaciones: pago depositado, registro olvidado, nueva publicación en el mural, cambio de estado de un documento suyo, paso de incorporación completado (para gerente/RR. HH.), acceso habilitado y progreso de carrera.",
      },
    ],
  },
  {
    title: "Mi Cuenta",
    items: [
      {
        question: "¿Cómo cambio mi foto de perfil?",
        answer:
          'En el menú de su usuario (ícono arriba a la derecha), toque el lápiz sobre la foto y elija "Cambiar foto" o "Quitar foto".',
      },
      {
        question: "¿Cómo cambio mi contraseña?",
        answer:
          'En el menú del usuario, toque "Cambiar contraseña" e ingrese la contraseña actual y la nueva.',
      },
      {
        question: "¿Cómo actualizo mis datos personales (domicilio, teléfono, etc.)?",
        answer:
          'En el menú del usuario, toque "Mi Perfil". Puede editar documento de identidad, fecha de nacimiento, estado civil, teléfono y domicilio — el nombre, el puesto y el salario siguen siendo exclusivos de RR. HH./gerente.',
      },
    ],
  },
  {
    title: "Para gerentes y RR. HH.",
    roles: ["gestor", "rh"],
    items: [
      {
        question: "¿Qué aparece en Aprobaciones?",
        answer:
          "Una única cola con solicitudes pendientes de certificados médicos, vacaciones, ajustes de registro y compensaciones del banco de horas — todo en un solo lugar, con historial de lo ya decidido.",
      },
      {
        question: "¿Cómo gestiono a los colaboradores?",
        answer:
          "En Colaboradores, registra y edita datos (puesto, equipo, nivel, convenio, salario, horario esperado, etc.) y accede a la Papelera de colaboradores eliminados.",
      },
      {
        question: "¿Qué es Turnos?",
        answer:
          "Un tablero semanal donde asigna turnos a los colaboradores en fechas específicas, navegando semana a semana.",
      },
      {
        question: "¿Qué es Gestión de carreras?",
        answer:
          "Una evaluación de carrera, exclusiva del gerente: usted puntúa al colaborador en principios y competencias fijas, verifica los requisitos del próximo nivel y decide formalmente el ascenso — que ajusta nivel y salario automáticamente al ser aprobado.",
      },
    ],
  },
];
