import { publicApi } from '../api';

export type UploadFormImageError = { status?: number; error?: string };

export async function uploadFormImage(publicId: string, fieldId: string, file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  try {
    const response = await publicApi.post<{ token: string }>(
      `/api/public/forms/${encodeURIComponent(publicId)}/fields/${encodeURIComponent(fieldId)}/uploads`,
      body
    );
    return response.data.token;
  } catch (error) {
    const failure = error as { response?: { status?: number; data?: { error?: string } } };
    throw { status: failure.response?.status, error: failure.response?.data?.error } satisfies UploadFormImageError;
  }
}
