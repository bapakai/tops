import { NextResponse } from "next/server";
import { analyzeHairPhoto } from "../../../lib/topsid-vision";
import { fitAdjustments, scoreHairstyle, type UserHairProfile } from "../../../lib/topsid-scoring";
import { checkAndIncrementUsage } from "../../../lib/topsid-usage";

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIELDS="id,name,category,description,barber_note,face_shapes,hair_types,hair_textures,densities,lengths,maintenance_level,collection_order,reference_image_url";

function restHeaders(){return {apikey:KEY!,Authorization:`Bearer ${KEY!}`,"Content-Type":"application/json"};}

export async function POST(request:Request){
  try{
    if(!SUPABASE_URL||!KEY) throw new Error("Supabase belum dikonfigurasi.");
    const body=await request.json();
    const hairstyleId=typeof body?.hairstyle_id==="string"?body.hairstyle_id:"";
    if(!hairstyleId) return NextResponse.json({error:"Model rambut belum dipilih."},{status:400});

    const deviceId=typeof body?.device_id==="string"?body.device_id:null;
    const usage=await checkAndIncrementUsage(deviceId);
    if(!usage.allowed) return NextResponse.json({error:`Jatah gratis hari ini abis (${usage.count}/${usage.limit}). Isi kredit atau coba lagi besok.`,code:"usage_limit"},{status:429});

    const a=await analyzeHairPhoto(body?.image);
    const url=new URL(`${SUPABASE_URL}/rest/v1/topsid_hairstyles`);
    url.searchParams.set("select",FIELDS);
    url.searchParams.set("id",`eq.${hairstyleId}`);
    url.searchParams.set("limit","1");
    const r=await fetch(url,{headers:restHeaders(),cache:"no-store"});
    if(!r.ok) throw new Error("Model rambut tidak dapat ditemukan.");
    const rows=await r.json();
    const style=rows?.[0];
    if(!style) return NextResponse.json({error:"Model rambut tidak ditemukan di knowledge base."},{status:404});

    const profile=a.profile as UserHairProfile;
    const scored=scoreHairstyle(profile,style);
    const score=scored.score;
    const reasons=scored.reasons.length?scored.reasons.slice(0,4):["Belum cukup sinyal untuk memastikan kecocokan model ini."];
    const adjustments=fitAdjustments(profile,style);

    return NextResponse.json({
      data:{
        score,profile,
        model:{...style,score,reasons},
        reasons,
        adjustments,
        engine:{version:"2.0",type:"fit-check",note:"Estimasi berbasis karakter visual yang terlihat pada foto."}
      }
    });
  }catch(error){
    console.error("TOPSID fit check error:",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Fit check belum berhasil."},{status:500});
  }
}
