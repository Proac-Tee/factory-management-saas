"use server";

import { revalidatePath } from "next/cache";
import { formFields } from "@/entities/validation";
import { type AccessResult, allowEmail, changeRole, removeAccess } from "@/use-cases/access";

// Thin wrappers: the use-cases check permission and parse the input.

const after = (result: AccessResult) => {
	if (result.ok) revalidatePath("/access");
	return result;
};

export async function allowEmailAction(_: AccessResult | null, form: FormData): Promise<AccessResult> {
	return after(await allowEmail(formFields(form)));
}

export async function changeRoleAction(email: string, role: string) {
	return after(await changeRole({ email, role }));
}

export async function removeAccessAction(email: string) {
	return after(await removeAccess(email));
}
