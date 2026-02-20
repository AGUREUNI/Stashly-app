import type { Messages } from '../types';

const fr: Messages = {
  // Block Kit: Collecte en cours
  'collecting.blocks': '🐿️ Collecte de glands :{{emoji}}: dans *{{channelCount}} canaux*... Veuillez patienter',
  'collecting.fallback': '🐿️ Collecte de glands :{{emoji}}: dans {{channelCount}} canaux...',
  // Block Kit: Terminé
  'completion.header': 'Collecte terminée',
  'completion.body': '✅ *{{count}}* glands collectés\n\n📄 <{{canvasUrl}}|Voir le Canvas>',
  'completion.fallback': '✅ {{count}} glands collectés 📄 Canvas : {{canvasUrl}}',
  'completion.limitWarning': '⚠️ Plus de 500 messages trouvés\nVeuillez réduire la période et réessayer\nExemple : `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ Ignorés (Bot non membre) : {{channels}}',
  'completion.hint': '💡 Astuce : Utilisez un filtre de période pour éviter les doublons ! Exemple : `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: Aucun résultat
  'noResult.message': 'ℹ️ Aucun message correspondant trouvé',
  'noResult.fallback': 'Aucun message correspondant trouvé',
  // Block Kit: Conflit de verrou
  'lock.conflict': '⏳ Un écureuil collecte déjà les glands :{{emoji}}:\nVeuillez patienter et réessayer',
  'lock.conflictFallback': '⏳ Collecte de glands :{{emoji}}: déjà en cours',
  // Erreurs du parseur
  'error.noEmoji': 'Veuillez spécifier un emoji\nExemple : `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}` n\'est pas un emoji valide\nVeuillez utiliser le format `:emoji:`',
  'error.tooManyChannels': 'Vous pouvez spécifier jusqu\'à 9 canaux (10 avec le canal actuel)',
  'error.multiplePeriods': '❌ Une seule période peut être spécifiée',
  'error.invalidPeriod': 'La période doit être d\'au moins 1 jour',
  'error.periodTooLong': 'La période ne peut pas dépasser {{maxDays}} jours',
  'error.inputTooLong': 'L\'entrée est trop longue (max 500 caractères)',
  'error.userRateLimited': '⏳ Vous avez atteint la limite de requêtes\nVeuillez patienter et réessayer',
  'error.channelNotFound': '❌ Canal {{channels}} introuvable',
  // Exemple de syntaxe
  'command.periodExample': 'derniers 7 jours',
  // Erreurs de plan
  'error.planMultiChannel': '❌ La collecte multi-canal est une fonctionnalité du plan Pro\nPassez au plan Pro pour utiliser cette fonctionnalité\n👉 <{{upgradeUrl}}|Voir le plan Pro>',
  'error.planPeriodTooLong': '❌ La collecte au-delà des 30 derniers jours est une fonctionnalité du plan Pro\nPassez au plan Pro pour collecter sur n\'importe quelle période\n👉 <{{upgradeUrl}}|Voir le plan Pro>',
  // Erreurs API
  'error.missingScope': '❌ L\'application manque de permissions\nVeuillez demander à un administrateur de réinstaller',
  'error.authInvalid': '❌ L\'authentification de l\'application est invalide\nVeuillez demander à un administrateur de réinstaller',
  'error.authError': '❌ Une erreur d\'authentification s\'est produite\nVeuillez contacter un administrateur',
  'error.rateLimited': '⏳ Les écureuils sont occupés\nVeuillez patienter et réessayer',
  'error.channelNotFoundApi': '❌ Le canal spécifié est introuvable',
  'error.canvasEditFailed': '❌ Pas de permission pour modifier le Canvas\nVeuillez vérifier les permissions avec l\'administrateur du canal',
  'error.canvasCreateFailed': '❌ Échec de la création du Canvas\nVeuillez patienter et réessayer',
  'error.unknown': '❌ Une erreur inattendue s\'est produite : {{code}}',
  'error.genericFallback': '❌ Une erreur inattendue s\'est produite\nVeuillez patienter et réessayer',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: Résultats de la collecte de glands',
  'markdown.lastUpdated': 'Dernière mise à jour : {{datetime}}',
  'markdown.messageCount': 'Messages collectés : {{count}}',
  'markdown.targetChannels': 'Canaux ciblés : {{count}}',
  'markdown.viewMessage': ':link: Voir le message',
  'markdown.linkFailed': '(lien indisponible)',
};

export default fr;
