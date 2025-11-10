import connectMongo from "@/app/lib/mongodb";
import Company from "@/app/models/company.model";

export async function GET(req: Request) {
    //   await connect;
    await connectMongo();


    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const sortField = searchParams.get("sort") || "mcNumber";
    const order = searchParams.get("order") === "desc" ? -1 : 1;

    const filter = q
        ? {
            $or: [
                { companyName: { $regex: q, $options: "i" } },
                { mcNumber: { $regex: q, $options: "i" } },
            ],
        }
        : {};

    const companies = await Company.find(filter)
        .sort({ [sortField]: order })
        .limit(200)
        .lean();

    return Response.json(companies);
}
