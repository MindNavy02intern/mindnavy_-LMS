// Category types — per backend categories.service.js mapNode() shape.
// 2-level max depth: root nodes have `children[]`, subcategories do not.
// courseCount = DIRECT assignments only (not summed from children).

export interface CategoryNode {
  id:          string;
  name:        string;
  parentId:    string | null;   // null = root category
  courseCount: number;
  createdAt:   string;          // ISO
  updatedAt:   string;          // ISO
  children?:   CategoryNode[];  // present (possibly empty) on root nodes; absent on subcategories
}

// POST /categories body
export interface CreateCategoryPayload {
  name:      string;
  parentId?: string | null;   // null or absent = root; uuid = subcategory
}

// PATCH /categories/:id body — at least one field required
export interface UpdateCategoryPayload {
  name?:     string;
  parentId?: string | null;
}

// Domain errors returned by the backend (controller maps these to 400/409):
// DUPLICATE_CATEGORY — name already taken among siblings
// PARENT_NOT_FOUND   — given parentId doesn't exist
// MAX_DEPTH          — parent is already a subcategory (depth would be 3)
// SELF_PARENT        — parentId === id
// HAS_CHILDREN_MOVE  — moving a parent that has children would create depth 3
// HAS_CHILDREN_DELETE — category has subcategories → delete blocked
// HAS_COURSES        — category has assigned courses → delete blocked
export type CategoryErrorCode =
  | 'DUPLICATE_CATEGORY'
  | 'PARENT_NOT_FOUND'
  | 'MAX_DEPTH'
  | 'SELF_PARENT'
  | 'HAS_CHILDREN_MOVE'
  | 'HAS_CHILDREN_DELETE'
  | 'HAS_COURSES';

export class CategoryApiError extends Error {
  status:    number;
  errorCode: CategoryErrorCode | null;
  constructor(status: number, message: string, errorCode?: CategoryErrorCode) {
    super(message);
    this.status    = status;
    this.errorCode = errorCode ?? null;
    this.name      = 'CategoryApiError';
  }
}
