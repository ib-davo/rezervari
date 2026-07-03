import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cities = await prisma.city.findMany({
      orderBy: [{ isOrigin: "desc" }, { name: "asc" }],
      include: { country: true },
    });

    return NextResponse.json({
      success: true,
      origins: cities
        .filter((c) => c.isOrigin)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          countryName: c.country.name,
          countrySlug: c.country.slug,
        })),
      destinations: cities
        .filter((c) => !c.isOrigin)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          countryName: c.country.name,
          countrySlug: c.country.slug,
        })),
    });
  } catch (error) {
    console.error("public/cities GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load cities" },
      { status: 500 }
    );
  }
}
