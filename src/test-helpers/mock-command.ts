/**
 * /canvas-collect コマンドオブジェクトのモックファクトリ
 */
export function createMockCommand(overrides: Record<string, any> = {}) {
  return {
    text: ':thumbsup:',
    channel_id: 'C_CURRENT',
    user_id: 'U_USER',
    team_id: 'T_TEAM',
    team_domain: 'myworkspace',
    ...overrides,
  };
}
