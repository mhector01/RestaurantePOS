import prisma from "@/lib/prisma";
import { ProductModal } from "@/components/ProductModal";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { PageHeader } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [productos, categorias] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const products = productos.map((p) => ({ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId }));
  const categories = categorias.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Menú" description="Productos y precios que ven los meseros.">
        <ProductModal categories={categories} />
      </PageHeader>
      <ProductsManager products={products} categories={categories} />
    </>
  );
}
