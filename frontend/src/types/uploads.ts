// Upload API types — exact shapes from "Course Builder + Uploads — API Contract v1".
// Field names must stay in sync with the backend validator (uploads.validator.js).

export type UploadKind = 'thumbnail' | 'video';

export interface UploadSignRequest {
  fileName: string;
  fileType: string;
  kind: UploadKind;
  courseId: string;
}

export interface UploadSignResponse {
  uploadUrl: string;
  path: string;
  kind: UploadKind;
  maxBytes: number;
  expiresIn: number; // seconds
}

export interface UploadConfirmRequest {
  courseId: string;
  path: string;
  kind: UploadKind;
  lessonId?: string;
}

export interface UploadConfirmResponse {
  url: string;
}

// Typed API error so callers can branch on status code without parsing strings.
export class UploadApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UploadApiError';
  }
}
