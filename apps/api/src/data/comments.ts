import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, users } from '../db/schema.js';

const publicColumns = {
  id: comments.id,
  parentId: comments.parentId,
  userId: comments.userId,
  guestAvatar: comments.guestAvatar,
  body: comments.body,
  editedAt: comments.editedAt,
  deletedAt: comments.deletedAt,
  createdAt: comments.createdAt,
  name: users.name,
  firstName: users.firstName,
  lastName: users.lastName,
  role: users.role,
};

type PublicRow = {
  id: number;
  parentId: number | null;
  userId: number | null;
  guestAvatar: string | null;
  body: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
};

export function toPublicComment(row: PublicRow) {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    parentId: row.parentId,
    createdAt: row.createdAt,
    edited: row.editedAt !== null,
    deleted,
    body: deleted ? '' : row.body,
    author: deleted
      ? null
      : row.userId === null
        ? { kind: 'guest' as const, avatar: row.guestAvatar }
        : {
            kind: 'reader' as const,
            userId: row.userId,
            name: row.name ?? '',
            firstName: row.firstName,
            lastName: row.lastName,
            isStaff: row.role === 'admin' || row.role === 'super_admin',
          },
  };
}

export async function getPublicComments(postId: number) {
  const rows = await db
    .select(publicColumns)
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
    .orderBy(asc(comments.createdAt));

  const parentsWithLiveReplies = new Set(
    rows.filter((row) => row.parentId !== null && row.deletedAt === null).map((row) => row.parentId),
  );
  const shown = rows.filter((row) => row.deletedAt === null || parentsWithLiveReplies.has(row.id));
  const shownIds = new Set(shown.map((row) => row.id));

  return shown.filter((row) => row.parentId === null || shownIds.has(row.parentId)).map(toPublicComment);
}

export async function getPublicComment(id: number) {
  const [row] = await db.select(publicColumns).from(comments).leftJoin(users, eq(comments.userId, users.id)).where(eq(comments.id, id));
  return row ? toPublicComment(row) : null;
}