import type { Messages } from '../types';

const es: Messages = {
  // Block Kit: Recopilando
  'collecting.blocks': '🐿️ Recopilando bellotas :{{emoji}}: de *{{channelCount}} canales*... Por favor espere',
  'collecting.fallback': '🐿️ Recopilando bellotas :{{emoji}}: de {{channelCount}} canales...',
  // Block Kit: Completado
  'completion.header': 'Recopilación completa',
  'completion.body': '✅ Se recopilaron *{{count}}* bellotas\n\n📄 <{{canvasUrl}}|Ver Canvas>',
  'completion.fallback': '✅ Se recopilaron {{count}} bellotas 📄 Canvas: {{canvasUrl}}',
  'completion.limitWarning': '⚠️ Se encontraron más de 500 mensajes\nPor favor reduzca el período e intente de nuevo\nEjemplo: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ Omitidos (Bot no es miembro): {{channels}}',
  'completion.hint': '💡 Consejo: ¡Use un filtro de período para evitar duplicados! Ejemplo: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: Sin resultados
  'noResult.message': 'ℹ️ No se encontraron mensajes coincidentes',
  'noResult.fallback': 'No se encontraron mensajes coincidentes',
  // Block Kit: Conflicto de bloqueo
  'lock.conflict': '⏳ Una ardilla ya está recopilando bellotas :{{emoji}}:\nPor favor espere e intente de nuevo',
  'lock.conflictFallback': '⏳ Ya se están recopilando bellotas :{{emoji}}:',
  // Errores del parser
  'error.noEmoji': 'Por favor especifique un emoji\nEjemplo: `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}` no es un emoji válido\nPor favor use el formato `:emoji:`',
  'error.tooManyChannels': 'Puede especificar hasta 9 canales (10 incluyendo el canal actual)',
  'error.multiplePeriods': '❌ Solo se puede especificar un período',
  'error.invalidPeriod': 'El período debe ser de al menos 1 día',
  'error.periodTooLong': 'El período no puede exceder {{maxDays}} días',
  'error.inputTooLong': 'La entrada es demasiado larga (máx. 500 caracteres)',
  'error.userRateLimited': '⏳ Has alcanzado el límite de ejecuciones\nPor favor espera e intenta de nuevo',
  'error.channelNotFound': '❌ Canal {{channels}} no encontrado',
  // Ejemplo de sintaxis
  'command.periodExample': 'últimos 7 días',
  // Errores de plan
  'error.planMultiChannel': '❌ La recopilación de múltiples canales es una función del plan Pro\nActualice a Pro para usar esta función\n👉 <{{upgradeUrl}}|Ver plan Pro>',
  'error.planPeriodTooLong': '❌ Recopilar más allá de los últimos 30 días es una función del plan Pro\nActualice a Pro para recopilar desde cualquier período\n👉 <{{upgradeUrl}}|Ver plan Pro>',
  // Errores de API
  'error.missingScope': '❌ La aplicación no tiene los permisos necesarios\nPor favor pida a un administrador que reinstale',
  'error.authInvalid': '❌ La autenticación de la aplicación no es válida\nPor favor pida a un administrador que reinstale',
  'error.authError': '❌ Ocurrió un error de autenticación\nPor favor contacte a un administrador',
  'error.rateLimited': '⏳ Las ardillas están ocupadas\nPor favor espere e intente de nuevo',
  'error.channelNotFoundApi': '❌ El canal especificado no fue encontrado',
  'error.canvasEditFailed': '❌ Sin permiso para editar el Canvas\nPor favor verifique los permisos con el administrador del canal',
  'error.canvasCreateFailed': '❌ Error al crear el Canvas\nPor favor espere e intente de nuevo',
  'error.unknown': '❌ Ocurrió un error inesperado: {{code}}',
  'error.genericFallback': '❌ Ocurrió un error inesperado\nPor favor espere e intente de nuevo',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: Resultados de la recopilación de bellotas',
  'markdown.lastUpdated': 'Última actualización: {{datetime}}',
  'markdown.messageCount': 'Mensajes recopilados: {{count}}',
  'markdown.targetChannels': 'Canales objetivo: {{count}}',
  'markdown.viewMessage': ':link: Ver mensaje',
  'markdown.linkFailed': '(enlace no disponible)',
};

export default es;
