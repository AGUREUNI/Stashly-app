import type { Messages } from '../types';

const ko: Messages = {
  // Block Kit: 수집 중
  'collecting.blocks': '🐿️ *{{channelCount}}개 채널*에서 :{{emoji}}: 수집 중... 잠시 기다려주세요',
  'collecting.fallback': '🐿️ {{channelCount}}개 채널에서 :{{emoji}}: 수집 중...',
  // Block Kit: 완료
  'completion.header': '수집 완료',
  'completion.body': '✅ *{{count}}건*의 메시지를 수집했습니다\n\n📄 <{{canvasUrl}}|Canvas 확인>',
  'completion.fallback': '✅ {{count}}건의 메시지를 수집했습니다 📄 Canvas: {{canvasUrl}}',
  'completion.limitWarning': '⚠️ 500건 이상의 메시지가 발견되었습니다\n기간을 줄여서 다시 시도해주세요\n예시: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ 건너뜀 (Bot 미참여): {{channels}}',
  'completion.hint': '💡 팁: 중복을 피하려면 기간 필터를 사용하세요! 예시: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: 결과 없음
  'noResult.message': 'ℹ️ 일치하는 메시지를 찾지 못했습니다',
  'noResult.fallback': '일치하는 메시지를 찾지 못했습니다',
  // Block Kit: 잠금 충돌
  'lock.conflict': '⏳ :{{emoji}}: 수집이 이미 진행 중입니다\n잠시 후 다시 시도해주세요',
  'lock.conflictFallback': '⏳ :{{emoji}}: 수집이 이미 진행 중입니다',
  // 명령어 파서 오류
  'error.noEmoji': '이모지를 지정해주세요\n예시: `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}`은(는) 유효한 이모지가 아닙니다\n`:emoji:` 형식을 사용해주세요',
  'error.tooManyChannels': '채널은 최대 9개까지 지정할 수 있습니다 (현재 채널 포함 10개)',
  'error.multiplePeriods': '❌ 기간은 하나만 지정할 수 있습니다',
  'error.invalidPeriod': '기간은 최소 1일 이상이어야 합니다',
  'error.channelNotFound': '❌ 채널 {{channels}}을(를) 찾을 수 없습니다',
  // 명령어 구문 예시
  'command.periodExample': '최근 7일',
  // API 오류
  'error.missingScope': '❌ 앱에 필요한 권한이 없습니다\n관리자에게 재설치를 요청해주세요',
  'error.authInvalid': '❌ 앱 인증이 유효하지 않습니다\n관리자에게 재설치를 요청해주세요',
  'error.authError': '❌ 인증 오류가 발생했습니다\n관리자에게 문의해주세요',
  'error.rateLimited': '⏳ 요청이 너무 많습니다\n잠시 후 다시 시도해주세요',
  'error.channelNotFoundApi': '❌ 지정된 채널을 찾을 수 없습니다',
  'error.canvasEditFailed': '❌ Canvas 편집 권한이 없습니다\n채널 관리자에게 권한을 확인해주세요',
  'error.canvasCreateFailed': '❌ Canvas 생성에 실패했습니다\n잠시 후 다시 시도해주세요',
  'error.unknown': '❌ 예기치 않은 오류가 발생했습니다: {{code}}',
  'error.genericFallback': '❌ 예기치 않은 오류가 발생했습니다\n잠시 후 다시 시도해주세요',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: 수집 결과',
  'markdown.lastUpdated': '최종 업데이트: {{datetime}}',
  'markdown.messageCount': '수집된 메시지: {{count}}건',
  'markdown.targetChannels': '대상 채널: {{count}}',
  'markdown.viewMessage': ':link: 메시지 보기',
  'markdown.linkFailed': '(링크 사용 불가)',
};

export default ko;
