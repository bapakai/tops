import { NextResponse } from "next/server";

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIELDS="id,name,category,description,barber_note,face_shapes,hair_types,hair_textures,densities,lengths,maintenance_level,collection_order,reference_image_url,is_featured";

export async function GET(request:Request){
  try{
    if(!URL||!KEY) return NextResponse.json({data:[],error:"Supabase belum dikonfigurasi."},{status:500});
    const params=new URL(request.url).searchParams;
    const featured=params.get("featured")==="true";
    const all=params.get("all")==="true";
    const requested=Math.min(Math.max(Number(params.get("limit")??(featured?15:50))||15,1),100);
    const url=new URL(`${URL}/rest/v1/topsid_hairstyles`);
    url.searchParams.set("select",FIELDS);
    url.searchParams.set("is_active","eq.true");
    if(featured&&!all) url.searchParams.set("is_featured","eq.true");
    url.searchParams.set("order","collection_order.asc,id.asc");
    url.searchParams.set("limit",String(requested));
    const r=await fetch(url,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`},next:{revalidate:60}});
    if(!r.ok) throw new Error(await r.text());
    return NextResponse.json({data:await r.json(),scope:featured?"featured_collection":"knowledge_base"});
  }catch(error){
    console.error("TOPSID hairstyles error:",error);
    return NextResponse.json({data:[],error:"Gagal mengambil koleksi model rambut."},{status:500});
  }
}
