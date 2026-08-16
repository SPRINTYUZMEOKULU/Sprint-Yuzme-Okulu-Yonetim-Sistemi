"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = [
  "owner",
  "admin",
] as const;

function text(
  value: FormDataEntryValue | null,
  max = 500
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function bool(
  formData: FormData,
  key: string
) {
  return formData.get(key) === "true";
}

function makeFieldKey(label: string) {
  const normalized = label
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `custom_${normalized}_${Date.now()}`;
}

export async function toggleFieldVisibility(
  formData: FormData
) {
  const profile =
    await requireProfile([...allowedRoles]);

  const supabase =
    await createClient();

  const id =
    text(formData.get("id"), 100);

  const nextVisible =
    bool(
      formData,
      "next_visible"
    );

  if (!id) return;

  const { error } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .update({
        is_visible:
          nextVisible,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/ayarlar/on-kayit-formu"
  );

  revalidatePath(
    "/on-kayit"
  );
}

export async function toggleFieldRequired(
  formData: FormData
) {
  const profile =
    await requireProfile([...allowedRoles]);

  const supabase =
    await createClient();

  const id =
    text(formData.get("id"), 100);

  const nextRequired =
    bool(
      formData,
      "next_required"
    );

  if (!id) return;

  const { error } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .update({
        is_required:
          nextRequired,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/ayarlar/on-kayit-formu"
  );

  revalidatePath(
    "/on-kayit"
  );
}

export async function updateField(
  formData: FormData
) {
  const profile =
    await requireProfile([...allowedRoles]);

  const supabase =
    await createClient();

  const id =
    text(formData.get("id"), 100);

  const label =
    text(
      formData.get("label"),
      180
    );

  const placeholder =
    text(
      formData.get("placeholder"),
      250
    ) || null;

  const helpText =
    text(
      formData.get("help_text"),
      1000
    ) || null;

  const sortOrder =
    Number(
      formData.get(
        "sort_order"
      ) || 100
    );

  const appliesTo =
    text(
      formData.get("applies_to"),
      20
    );

  if (
    !id ||
    !label
  ) {
    throw new Error(
      "Alan adı boş bırakılamaz."
    );
  }

  const {
    data: current,
    error: currentError,
  } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .select(
        "id,is_system"
      )
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .single();

  if (
    currentError ||
    !current
  ) {
    throw new Error(
      "Form alanı bulunamadı."
    );
  }

  const updateData: Record<
    string,
    unknown
  > = {
    label,
    placeholder,
    help_text:
      helpText,
    sort_order:
      Number.isFinite(
        sortOrder
      )
        ? sortOrder
        : 100,
    applies_to:
      ["all", "child", "adult"].includes(
        appliesTo
      )
        ? appliesTo
        : "all",
    updated_at:
      new Date().toISOString(),
  };

  const { error } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .update(updateData)
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/ayarlar/on-kayit-formu"
  );

  revalidatePath(
    "/on-kayit"
  );
}

export async function createCustomField(
  formData: FormData
) {
  const profile =
    await requireProfile([...allowedRoles]);

  const supabase =
    await createClient();

  if (
    !profile.organization_id
  ) {
    throw new Error(
      "Organizasyon bulunamadı."
    );
  }

  const label =
    text(
      formData.get("label"),
      180
    );

  const fieldType =
    text(
      formData.get(
        "field_type"
      ),
      30
    );

  const sectionKey =
    text(
      formData.get(
        "section_key"
      ),
      50
    ) || "additional";

  const placeholder =
    text(
      formData.get(
        "placeholder"
      ),
      250
    ) || null;

  const helpText =
    text(
      formData.get(
        "help_text"
      ),
      1000
    ) || null;

  const appliesTo =
    text(
      formData.get(
        "applies_to"
      ),
      20
    );

  const rawOptions =
    text(
      formData.get(
        "options"
      ),
      4000
    );

  const required =
    formData.get(
      "is_required"
    ) === "on";

  const visible =
    formData.get(
      "is_visible"
    ) !== null;

  const sortOrder =
    Number(
      formData.get(
        "sort_order"
      ) || 900
    );

  if (!label) {
    throw new Error(
      "Yeni alan için bir başlık yazın."
    );
  }

  const validTypes = [
    "text",
    "textarea",
    "number",
    "date",
    "phone",
    "select",
    "radio",
    "checkbox",
    "multiselect",
    "info",
  ];

  if (
    !validTypes.includes(
      fieldType
    )
  ) {
    throw new Error(
      "Geçersiz alan tipi."
    );
  }

  let options: Array<{
    value: string;
    label: string;
  }> = [];

  if (
    [
      "select",
      "radio",
      "multiselect",
    ].includes(
      fieldType
    )
  ) {
    options =
      rawOptions
        .split("\n")
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)
        .map(
          (
            option,
            index
          ) => ({
            value:
              `option_${index + 1}`,
            label:
              option,
          })
        );

    if (
      options.length ===
      0
    ) {
      throw new Error(
        "Seçenekli alanlarda en az bir seçenek yazmalısınız."
      );
    }
  }

  const { error } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .insert({
        organization_id:
          profile.organization_id,

        field_key:
          makeFieldKey(
            label
          ),

        section_key:
          sectionKey,

        label,

        field_type:
          fieldType,

        placeholder,

        help_text:
          helpText,

        options,

        is_visible:
          visible,

        is_required:
          required,

        is_system:
          false,

        is_deletable:
          true,

        applies_to:
          ["all", "child", "adult"].includes(
            appliesTo
          )
            ? appliesTo
            : "all",

        sort_order:
          Number.isFinite(
            sortOrder
          )
            ? sortOrder
            : 900,
      });

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/ayarlar/on-kayit-formu"
  );

  revalidatePath(
    "/on-kayit"
  );
}

export async function deleteCustomField(
  formData: FormData
) {
  const profile =
    await requireProfile([...allowedRoles]);

  const supabase =
    await createClient();

  const id =
    text(
      formData.get("id"),
      100
    );

  if (!id) return;

  const {
    data: field,
    error:
      fieldError,
  } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .select(
        "id,is_system,is_deletable"
      )
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .single();

  if (
    fieldError ||
    !field
  ) {
    throw new Error(
      "Form alanı bulunamadı."
    );
  }

  if (
    field.is_system ||
    !field.is_deletable
  ) {
    throw new Error(
      "Sistem alanları silinemez."
    );
  }

  const { error } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .delete()
      .eq("id", id)
      .eq(
        "organization_id",
        profile.organization_id
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/ayarlar/on-kayit-formu"
  );

  revalidatePath(
    "/on-kayit"
  );
}
