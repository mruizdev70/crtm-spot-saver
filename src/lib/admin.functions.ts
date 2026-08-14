import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const crearUsuarioSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  login_md: z.string().trim().min(2).max(100),
  nombre_apellidos: z.string().trim().min(2).max(150),
  unidad_id: z.string().uuid().nullable(),
  es_responsable: z.boolean(),
  rol: z.enum(["admin", "titular", "estandar"]),
  matriculas: z.array(z.string().trim().min(4).max(15)).max(3),
});

export const crearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => crearUsuarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: esStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!esStaff) throw new Error("Solo Administración o Autoridad pueden dar de alta usuarios.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authError || !created.user) throw new Error(authError?.message ?? "No se pudo crear el usuario.");

    const uid = created.user.id;

    const { error: perfilError } = await supabaseAdmin.from("profiles").insert({
      id: uid,
      login_md: data.login_md,
      nombre_apellidos: data.nombre_apellidos,
      unidad_id: data.unidad_id,
      es_responsable: data.es_responsable,
    });
    if (perfilError) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(perfilError.message);
    }

    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.rol });

    const matriculas = [...new Set(data.matriculas.filter(Boolean).map((m) => m.toUpperCase()))];
    if (matriculas.length) {
      await supabaseAdmin
        .from("matriculas")
        .insert(matriculas.map((matricula) => ({ user_id: uid, matricula })));
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      accion: "alta_usuario",
      detalles: { nuevo_usuario: data.login_md, rol: data.rol },
    });

    return { id: uid };
  });

const actualizarUsuarioSchema = z.object({
  user_id: z.string().uuid(),
  nombre_apellidos: z.string().trim().min(2).max(150),
  login_md: z.string().trim().min(2).max(100),
  unidad_id: z.string().uuid().nullable(),
  es_responsable: z.boolean(),
  rol: z.enum(["admin", "titular", "estandar"]),
  matriculas: z.array(z.string().trim().min(4).max(15)).max(3),
});

export const actualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actualizarUsuarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: esStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!esStaff) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        nombre_apellidos: data.nombre_apellidos,
        login_md: data.login_md,
        unidad_id: data.unidad_id,
        es_responsable: data.es_responsable,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.rol });

    await supabaseAdmin.from("matriculas").delete().eq("user_id", data.user_id);
    const matriculas = [...new Set(data.matriculas.filter(Boolean).map((m) => m.toUpperCase()))];
    if (matriculas.length) {
      await supabaseAdmin
        .from("matriculas")
        .insert(matriculas.map((matricula) => ({ user_id: data.user_id, matricula })));
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      accion: "edicion_usuario",
      detalles: { usuario: data.login_md, rol: data.rol },
    });

    return { ok: true };
  });

const eliminarUsuarioSchema = z.object({ user_id: z.string().uuid() });

export const eliminarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eliminarUsuarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: esStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!esStaff) throw new Error("Sin permisos.");
    if (data.user_id === context.userId)
      throw new Error("No puedes eliminar tu propia cuenta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("login_md")
      .eq("id", data.user_id)
      .maybeSingle();

    await supabaseAdmin.from("reservations").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("waitlist_notifications").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("spot_titulares").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("matriculas").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("sanctions").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("audit_logs").update({ user_id: null }).eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      accion: "baja_usuario",
      detalles: { usuario: perfil?.login_md ?? data.user_id },
    });

    return { ok: true };
  });
