import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCanvasTitle, findCanvas, createCanvas, appendToCanvas, upsertCanvas } from './canvas-manager';
import { createMockClient } from '../test-helpers/mock-client';
import { AppError } from '../types';

describe('getCanvasTitle', () => {
  it('should generate title with emoji', () => {
    expect(getCanvasTitle('thumbsup')).toBe(':thumbsup: Collection Log');
  });

  it('should handle emoji with underscores', () => {
    expect(getCanvasTitle('white_check_mark')).toBe(':white_check_mark: Collection Log');
  });
});

describe('findCanvas', () => {
  it('should return null when no canvases exist', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({ files: [], response_metadata: {} });

    const result = await findCanvas(client, 'C123', 'thumbsup');
    expect(result).toBeNull();
  });

  it('should return matching canvas by title', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({
      files: [
        { id: 'F1', title: ':thumbsup: Collection Log', updated: 100 },
        { id: 'F2', title: 'Other Canvas', updated: 200 },
      ],
      response_metadata: {},
    });

    const result = await findCanvas(client, 'C123', 'thumbsup');
    expect(result).toEqual({ id: 'F1', title: ':thumbsup: Collection Log', updated: 100 });
  });

  it('should return most recently updated canvas when multiple match', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({
      files: [
        { id: 'F_OLD', title: ':thumbsup: Collection Log', updated: 100 },
        { id: 'F_NEW', title: ':thumbsup: Collection Log', updated: 300 },
      ],
      response_metadata: {},
    });

    const result = await findCanvas(client, 'C123', 'thumbsup');
    expect(result?.id).toBe('F_NEW');
  });

  it('should handle pagination', async () => {
    const client = createMockClient();
    client.files.list
      .mockResolvedValueOnce({
        files: [{ id: 'F1', title: 'Other', updated: 1 }],
        response_metadata: { next_cursor: 'cursor1' },
      })
      .mockResolvedValueOnce({
        files: [{ id: 'F2', title: ':star: Collection Log', updated: 2 }],
        response_metadata: {},
      });

    const result = await findCanvas(client, 'C123', 'star');
    expect(result?.id).toBe('F2');
    expect(client.files.list).toHaveBeenCalledTimes(2);
  });
});

describe('createCanvas', () => {
  it('should create canvas and return id and url', async () => {
    const client = createMockClient();
    client.canvases.create.mockResolvedValue({ canvas_id: 'F_NEW' });

    const result = await createCanvas(client, 'C123', 'thumbsup', '# Content', 'T123', 'myteam');
    expect(result.canvasId).toBe('F_NEW');
    expect(result.canvasUrl).toBe('https://myteam.slack.com/docs/T123/F_NEW');
  });

  it('should use canvas_url from response if available', async () => {
    const client = createMockClient();
    client.canvases.create.mockResolvedValue({
      canvas_id: 'F_NEW',
      canvas_url: 'https://custom.url/canvas',
    });

    const result = await createCanvas(client, 'C123', 'thumbsup', '# Content', 'T123', 'myteam');
    expect(result.canvasUrl).toBe('https://custom.url/canvas');
  });

  it('should throw AppError when canvas_id is missing', async () => {
    const client = createMockClient();
    client.canvases.create.mockResolvedValue({});

    await expect(createCanvas(client, 'C123', 'thumbsup', '# Content', 'T123', 'myteam'))
      .rejects.toThrow(AppError);
  });
});

describe('appendToCanvas', () => {
  it('should call canvases.edit with insert_at_end', async () => {
    const client = createMockClient();

    await appendToCanvas(client, 'F_CANVAS', '## New content');
    expect(client.canvases.edit).toHaveBeenCalledWith({
      canvas_id: 'F_CANVAS',
      changes: [
        {
          operation: 'insert_at_end',
          document_content: {
            type: 'markdown',
            markdown: '## New content',
          },
        },
      ],
    });
  });
});

describe('upsertCanvas', () => {
  it('should create new canvas when none exists', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({ files: [], response_metadata: {} });
    client.canvases.create.mockResolvedValue({ canvas_id: 'F_NEW' });

    const result = await upsertCanvas(
      client, 'C123', 'thumbsup', '# New', '---\n# Append', 'T123', 'myteam',
    );
    expect(result.isNew).toBe(true);
    expect(result.canvasUrl).toContain('F_NEW');
  });

  it('should append to existing canvas when canAppend is true (default)', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({
      files: [{ id: 'F_EXISTING', title: ':thumbsup: Collection Log', updated: 100 }],
      response_metadata: {},
    });

    const result = await upsertCanvas(
      client, 'C123', 'thumbsup', '# New', '---\n# Append', 'T123', 'myteam',
    );
    expect(result.isNew).toBe(false);
    expect(result.canvasUrl).toContain('F_EXISTING');
    expect(client.canvases.edit).toHaveBeenCalled();
  });

  it('should create new canvas when canAppend is false and no existing canvas', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({ files: [], response_metadata: {} });
    client.canvases.create.mockResolvedValue({ canvas_id: 'F_NEW' });

    const result = await upsertCanvas(
      client, 'C123', 'thumbsup', '# New', '---\n# Append', 'T123', 'myteam', false,
    );
    expect(result.isNew).toBe(true);
    expect(result.canvasUrl).toContain('F_NEW');
  });

  it('should delete existing canvas and create new when canAppend is false (overwrite)', async () => {
    const client = createMockClient();
    client.files.list.mockResolvedValue({
      files: [{ id: 'F_EXISTING', title: ':thumbsup: Collection Log', updated: 100 }],
      response_metadata: {},
    });
    client.canvases.create.mockResolvedValue({ canvas_id: 'F_NEW' });

    const result = await upsertCanvas(
      client, 'C123', 'thumbsup', '# New', '---\n# Append', 'T123', 'myteam', false,
    );

    // 既存 Canvas を削除して新規作成（上書き）
    expect(client.canvases.delete).toHaveBeenCalledWith({ canvas_id: 'F_EXISTING' });
    expect(client.canvases.create).toHaveBeenCalled();
    expect(client.canvases.edit).not.toHaveBeenCalled();
    expect(result.isNew).toBe(true);
    expect(result.canvasUrl).toContain('F_NEW');
  });
});
