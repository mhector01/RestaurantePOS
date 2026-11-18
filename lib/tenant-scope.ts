// Filtro automático por restaurante para Prisma.
//
// Toda consulta lleva `restaurantId` en el where, y todo lo que se crea (también lo anidado:
// `items: { create: [...] }`, `connect`, `createMany`…) queda a nombre del restaurante actual.
// Así ninguna pantalla puede ver ni tocar datos de otro restaurante aunque reciba un id ajeno.
// Segunda barrera: los triggers `tenant_guard` de la base de datos (migración multi_restaurante).
import { Prisma } from "@prisma/client";

type Rec = Record<string, unknown>;
type Rel = { model: string; owning: boolean };

const TENANT_FIELD = "restaurantId";
const ROOT_MODEL = "Restaurant";

// Relaciones de cada modelo, sacadas del esquema generado. En Prisma 7 el esquema que trae el cliente
// no dice qué lado guarda la llave, así que se deduce por la convención del proyecto:
// la relación `category` es "propia" si el modelo tiene el campo `categoryId`.
const relations = new Map<string, Map<string, Rel>>();
for (const m of Prisma.dmmf.datamodel.models) {
  const scalars = new Set(m.fields.filter((f) => f.kind === "scalar").map((f) => f.name));
  const rels = new Map<string, Rel>();
  for (const f of m.fields) {
    if (f.kind === "object") rels.set(f.name, { model: f.type, owning: scalars.has(`${f.name}Id`) });
  }
  relations.set(m.name, rels);
}

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
const each = (v: unknown, fn: (x: Rec) => unknown) => (Array.isArray(v) ? v.map((x) => fn(x as Rec)) : fn(v as Rec));

/** Datos de un create: agrega el restaurante (como escalar o como relación, según el estilo usado). */
function createData(model: string, data: unknown, rid: number): Rec {
  if (!isObj(data)) return data as Rec;
  const rels = relations.get(model);
  const out = writeData(model, data, rid);
  delete out[TENANT_FIELD];
  delete out.restaurant;
  // Si alguna relación propia viene como objeto (category: { connect }), Prisma espera el estilo "checked"
  const checked = !!rels && Object.keys(data).some((k) => rels.get(k)?.owning && rels.get(k)?.model !== ROOT_MODEL && isObj(data[k]));
  if (checked) out.restaurant = { connect: { id: rid } };
  else out[TENANT_FIELD] = rid;
  return out;
}

/** Recorre las escrituras anidadas de un create/update y las deja a nombre del restaurante. */
function writeData(model: string, data: Rec, rid: number): Rec {
  const rels = relations.get(model);
  const out: Rec = { ...data };
  if (!rels) return out;
  for (const [key, value] of Object.entries(data)) {
    const rel = rels.get(key);
    if (!rel || rel.model === ROOT_MODEL || !isObj(value)) continue;
    out[key] = nested(rel.model, value, rid);
  }
  return out;
}

const scopeWhere = (w: unknown, rid: number) => ({ ...(isObj(w) ? w : {}), [TENANT_FIELD]: rid });

function nested(model: string, ops: Rec, rid: number): Rec {
  const out: Rec = { ...ops };
  if (ops.create !== undefined) out.create = each(ops.create as Rec, (x) => createData(model, x, rid));
  if (isObj(ops.createMany)) {
    const cm = ops.createMany as Rec;
    out.createMany = { ...cm, data: each(cm.data as Rec, (x) => ({ ...x, [TENANT_FIELD]: rid })) };
  }
  if (ops.connect !== undefined) out.connect = each(ops.connect as Rec, (x) => scopeWhere(x, rid));
  if (ops.connectOrCreate !== undefined) {
    out.connectOrCreate = each(ops.connectOrCreate as Rec, (x) => ({
      ...x,
      where: scopeWhere(x.where, rid),
      create: createData(model, x.create, rid),
    }));
  }
  if (ops.upsert !== undefined) {
    out.upsert = each(ops.upsert as Rec, (x) => ({
      ...x,
      create: createData(model, x.create, rid),
      update: isObj(x.update) ? writeData(model, x.update, rid) : x.update,
    }));
  }
  if (ops.update !== undefined) {
    out.update = each(ops.update as Rec, (x) =>
      isObj(x.data) ? { ...x, data: writeData(model, x.data as Rec, rid) } : isObj(x) ? writeData(model, x, rid) : x
    );
  }
  return out;
}

export function scopeArgs(model: string, operation: string, args: Rec | undefined, rid: number): Rec {
  const a: Rec = { ...(args ?? {}) };
  if (WHERE_OPS.has(operation)) a.where = scopeWhere(a.where, rid);
  switch (operation) {
    case "create":
      a.data = createData(model, a.data, rid);
      break;
    case "createMany":
    case "createManyAndReturn":
      a.data = each(a.data as Rec, (x) => ({ ...x, [TENANT_FIELD]: rid }));
      break;
    case "update":
    case "updateMany":
    case "updateManyAndReturn":
      if (isObj(a.data)) {
        a.data = writeData(model, a.data, rid);
        delete (a.data as Rec)[TENANT_FIELD]; // nadie se cambia de restaurante
        delete (a.data as Rec).restaurant;
      }
      break;
    case "upsert":
      a.create = createData(model, a.create, rid);
      if (isObj(a.update)) {
        a.update = writeData(model, a.update, rid);
        delete (a.update as Rec)[TENANT_FIELD];
        delete (a.update as Rec).restaurant;
      }
      break;
  }
  return a;
}

export function tenantExtension(getRestaurantId: () => Promise<number>) {
  return Prisma.defineExtension({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === ROOT_MODEL) return query(args);
          const rid = await getRestaurantId();
          return query(scopeArgs(model, operation, args as Rec, rid) as typeof args);
        },
      },
    },
  });
}
