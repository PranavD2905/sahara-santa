import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/db";
import { isDomainError } from "@/server/errors";
import { getGroupView } from "@/server/groups";
import { requireUser } from "@/server/session";

/** A shared membership boundary; music belongs to the global player. */
export default async function GroupLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireUser(`/groups/${id}`);
  try {
    await getGroupView(db, me.id, id);
  } catch (error) {
    if (isDomainError(error) && error.code === "not-found") notFound();
    throw error;
  }
  return children;
}
