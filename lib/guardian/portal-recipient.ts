export function normalizePortalPhone(value: unknown) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0090")) digits = digits.slice(4);
    if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
    if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
    return /^5\d{9}$/.test(digits) ? `+90${digits}` : "";
}

type StudentContact = {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    guardian_name?: string | null;
    guardian_phone?: string | null;
    guardian_email?: string | null;
};

export function resolvePortalRecipient(student: StudentContact, group?: { name?: string | null; course_type?: string | null } | null) {
    const guardianName = student.guardian_name?.trim() || "";
    const guardianPhone = normalizePortalPhone(student.guardian_phone);
    const groupType = [group?.course_type, group?.name].join(" ").toLocaleLowerCase("tr-TR");
    const adult = /yetişkin|yetiskin|adult|master/.test(groupType);
    const useSelf = adult && !(guardianName && guardianPhone);
    const fullName = useSelf ? [student.first_name, student.last_name].filter(Boolean).join(" ").trim() : guardianName;
    const phone = useSelf ? normalizePortalPhone(student.phone) : guardianPhone;
    const label = useSelf ? "Kursiyerin" : "Velinin";
    return {
        fullName,
        phone,
        email: useSelf ? "" : student.guardian_email?.trim().toLowerCase() || "",
        relationship: useSelf ? "Kendisi" : "Veli",
        error: !fullName ? `${label} adı kayıtlı değil.` : !phone ? `${label} geçerli cep telefonu kayıtlı değil.` : "",
    };
}
