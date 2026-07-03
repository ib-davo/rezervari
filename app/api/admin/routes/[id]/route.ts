import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.basePrice !== undefined) data.basePrice = Number(body.basePrice);
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.weeklyDepartures !== undefined) data.weeklyDepartures = Number(body.weeklyDepartures);
    if (body.active !== undefined) data.active = !!body.active;
    if (body.originCityId !== undefined) data.originCityId = body.originCityId;
    if (body.destinationCityId !== undefined) data.destinationCityId = body.destinationCityId;

    const route = await prisma.route.update({ where: { id }, data });

    // === Sincronizare bidirecțională cu ruta inversă (originCity ↔ destinationCity) ===
    //
    // Cele 2 direcții ale unei rute (Chișinău → Birmingham vs Birmingham →
    // Chișinău) reprezintă același produs comercial: drumul X ↔ Chișinău.
    // Admin-ul a confirmat că vrea ca prețul/moneda să rămână mereu identice
    // între ele — dacă editezi una, cealaltă primește exact aceleași valori,
    // chiar dacă valorile vechi coincideau (idempotent → safe).
    //
    // Dacă ruta inversă nu există deloc, o cream automat copiindu-i atributele
    // de la cea editată. Asta previne starea unde admin schimbă prețul dar
    // simetria nu se realizează pentru că cealaltă direcție pur și simplu
    // lipsea din DB (cazul reclamat: Birmingham→Moldova editat 150 GBP, dar
    // Moldova→Birmingham nu există → fără sync vizibil).
    let inverseUpdated = false;
    let inverseCreated = false;
    const shouldSync =
      data.basePrice !== undefined ||
      data.currency !== undefined ||
      data.description !== undefined ||
      data.weeklyDepartures !== undefined ||
      data.active !== undefined;

    if (shouldSync) {
      try {
        const inverse = await prisma.route.findUnique({
          where: {
            originCityId_destinationCityId: {
              originCityId: route.destinationCityId,
              destinationCityId: route.originCityId,
            },
          },
          select: { id: true },
        });

        const syncData: Record<string, unknown> = {};
        if (data.basePrice !== undefined) syncData.basePrice = route.basePrice;
        if (data.currency !== undefined) syncData.currency = route.currency;
        if (data.description !== undefined) syncData.description = route.description;
        if (data.weeklyDepartures !== undefined) syncData.weeklyDepartures = route.weeklyDepartures;
        if (data.active !== undefined) syncData.active = route.active;

        if (inverse) {
          await prisma.route.update({ where: { id: inverse.id }, data: syncData });
          inverseUpdated = true;
        } else if (data.basePrice !== undefined || data.currency !== undefined) {
          // Cream ruta inversă DOAR când admin a atins prețul/moneda — semn
          // clar de intenție comercială. Nu creem ruta inversă doar pentru
          // un toggle de `active` (poate fi exact opusul a ce vrea admin-ul).
          await prisma.route.create({
            data: {
              originCityId: route.destinationCityId,
              destinationCityId: route.originCityId,
              basePrice: route.basePrice,
              currency: route.currency,
              description: route.description ?? null,
              weeklyDepartures: route.weeklyDepartures,
              active: route.active,
            },
          });
          inverseCreated = true;
        }
      } catch (syncErr) {
        console.warn("admin/routes PATCH inverse sync:", syncErr);
      }
    }

    return NextResponse.json({ success: true, route, inverseUpdated, inverseCreated });
  } catch (error) {
    console.error("admin/routes PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to update route" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripCount = await prisma.trip.count({ where: { routeId: id } });
    if (tripCount > 0) {
      return NextResponse.json(
        { success: false, error: `Ruta are ${tripCount} curse asociate. Dezactiveaz-o în loc să o ștergi.` },
        { status: 409 }
      );
    }
    await prisma.route.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("admin/routes DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete route" }, { status: 500 });
  }
}
