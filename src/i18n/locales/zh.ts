import type { Messages } from '../types';

const zh: Messages = {
  // Block Kit: 收集中
  'collecting.blocks': '🐿️ 正在从 *{{channelCount}}个频道* 收集 :{{emoji}}: 橡果... 请稍候',
  'collecting.fallback': '🐿️ 正在从{{channelCount}}个频道收集 :{{emoji}}: 橡果...',
  // Block Kit: 完成
  'completion.header': '收集完成',
  'completion.body': '✅ 已收集 *{{count}}* 颗橡果\n\n📄 <{{canvasUrl}}|查看Canvas>',
  'completion.fallback': '✅ 已收集{{count}}颗橡果 📄 Canvas: {{canvasUrl}}',
  'completion.limitWarning': '⚠️ 发现超过500条消息\n请缩短时间范围后重试\n示例: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ 已跳过（Bot未加入）: {{channels}}',
  'completion.hint': '💡 提示: 使用时间范围过滤以避免重复！示例: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: 无结果
  'noResult.message': 'ℹ️ 未找到匹配的消息',
  'noResult.fallback': '未找到匹配的消息',
  // Block Kit: 锁冲突
  'lock.conflict': '⏳ 松鼠正在收集 :{{emoji}}: 橡果\n请稍后重试',
  'lock.conflictFallback': '⏳ 正在收集 :{{emoji}}: 橡果中',
  // 命令解析错误
  'error.noEmoji': '请指定一个表情符号\n示例: `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}` 不是有效的表情符号\n请使用 `:emoji:` 格式',
  'error.tooManyChannels': '最多可以指定9个频道（包括当前频道共10个）',
  'error.multiplePeriods': '❌ 只能指定一个时间范围',
  'error.invalidPeriod': '时间范围必须至少为1天',
  'error.periodTooLong': '时间范围不能超过{{maxDays}}天',
  'error.inputTooLong': '输入内容过长（最多500个字符）',
  'error.userRateLimited': '⏳ 您已达到执行频率限制\n请稍后重试',
  'error.channelNotFound': '❌ 未找到频道 {{channels}}',
  // 命令语法示例
  'command.periodExample': '过去7天',
  // API错误
  'error.missingScope': '❌ 应用缺少必要的权限\n请让管理员重新安装',
  'error.authInvalid': '❌ 应用认证无效\n请让管理员重新安装',
  'error.authError': '❌ 发生认证错误\n请联系管理员',
  'error.rateLimited': '⏳ 松鼠们正忙\n请稍后重试',
  'error.channelNotFoundApi': '❌ 未找到指定的频道',
  'error.canvasEditFailed': '❌ 没有编辑Canvas的权限\n请与频道管理员确认权限',
  'error.canvasCreateFailed': '❌ 创建Canvas失败\n请稍后重试',
  'error.unknown': '❌ 发生意外错误: {{code}}',
  'error.genericFallback': '❌ 发生意外错误\n请稍后重试',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: 橡果收集结果',
  'markdown.lastUpdated': '最后更新: {{datetime}}',
  'markdown.messageCount': '已收集消息: {{count}}',
  'markdown.targetChannels': '目标频道: {{count}}',
  'markdown.viewMessage': ':link: 查看消息',
  'markdown.linkFailed': '(链接不可用)',
};

export default zh;
