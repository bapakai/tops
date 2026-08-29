import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const model = body?.model;
    const photo = body?.photo;

    if (!model?.name) {
      return NextResponse.json(
        { error: "Model rambut belum dipilih." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: "preview",
      preview: {
        modelName: String(model.name),
        photo: typeof photo === "string" ? photo : null,
        message: "Preview siap ditampilkan.",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Request preview tidak valid." },
      { status: 400 }
    );
  }
}
