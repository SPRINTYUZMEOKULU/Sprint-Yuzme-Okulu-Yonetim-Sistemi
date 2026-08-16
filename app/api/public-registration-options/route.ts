import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          error:
            "Bağlantı ayarları eksik.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const supabase =
      createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

    /*
     * Kurumu bul
     */
    const {
      data: organization,
      error: organizationError,
    } = await supabase
      .from("organizations")
      .select("id")
      .eq(
        "name",
        "Sprint Yüzme Okulu"
      )
      .single();

    if (
      organizationError ||
      !organization
    ) {
      console.error(
        "Organization error:",
        organizationError
      );

      return NextResponse.json(
        {
          error:
            "Kurum bulunamadı.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    /*
     * Tüm form seçeneklerini paralel yükle
     */
    const [
      branchesResult,
      groupsResult,
      schedulesResult,
      packagesResult,
      levelsResult,
      formFieldsResult,
    ] = await Promise.all([
      supabase
        .from("branches")
        .select(
          "id,name"
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "name",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "training_groups"
        )
        .select(
          `
          id,
          branch_id,
          level_id,
          name,
          capacity,
          course_type,
          description,
          sort_order
          `
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "is_active",
          true
        )
        .eq(
          "public_registration",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "lesson_schedules"
        )
        .select(
          `
          id,
          group_id,
          weekday,
          start_time,
          end_time
          `
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "weekday",
          {
            ascending: true,
          }
        )
        .order(
          "start_time",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "course_packages"
        )
        .select(
          `
          id,
          name,
          lesson_count,
          price
          `
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "lesson_count",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "swimming_levels"
        )
        .select(
          `
          id,
          name,
          sort_order
          `
        )
        .eq(
          "organization_id",
          organization.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),

      /*
       * ÖN KAYIT FORMU AYARLARI
       */
      supabase
        .from(
          "registration_form_fields"
        )
        .select(
          `
          id,
          field_key,
          section_key,
          label,
          field_type,
          placeholder,
          help_text,
          options,
          is_visible,
          is_required,
          is_system,
          is_deletable,
          applies_to,
          sort_order
          `
        )
        .eq(
          "organization_id",
          organization.id
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),
    ]);

    /*
     * Kritik sorgu hatalarını kontrol et
     */
    const queryErrors = [
      branchesResult.error,
      groupsResult.error,
      schedulesResult.error,
      packagesResult.error,
      levelsResult.error,
      formFieldsResult.error,
    ].filter(Boolean);

    if (
      queryErrors.length
    ) {
      console.error(
        "Public registration query errors:",
        queryErrors
      );

      return NextResponse.json(
        {
          error:
            "Kayıt seçeneklerinin bir bölümü yüklenemedi.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    /*
     * Sadece yayında olan form alanlarını
     * ayrıca hazır olarak veriyoruz.
     *
     * Böylece istemci isterse tüm alanları,
     * isterse yalnızca görünür alanları kullanabilir.
     */
    const formFields =
      formFieldsResult.data ||
      [];

    const visibleFormFields =
      formFields.filter(
        (field) =>
          field.is_visible
      );

    return NextResponse.json(
      {
        branches:
          branchesResult.data ||
          [],

        groups:
          groupsResult.data ||
          [],

        schedules:
          schedulesResult.data ||
          [],

        packages:
          packagesResult.data ||
          [],

        levels:
          levelsResult.data ||
          [],

        /*
         * Tüm ayarlar
         */
        formFields,

        /*
         * Canlı formda gösterilecek alanlar
         */
        visibleFormFields,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "public-registration-options GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Kayıt seçenekleri yüklenemedi.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
