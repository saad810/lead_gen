import connectMongo from "@/app/lib/mongodb";
import Company from "@/app/models/company.model";

export async function GET(req: Request) {
  await connectMongo();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const sortField = searchParams.get("sort") || "mcNumber";
  const order = searchParams.get("order") === "desc" ? -1 : 1;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const filter = q
    ? {
        $or: [
          { companyName: { $regex: q, $options: "i" } },
          { mcNumber: { $regex: q, $options: "i" } },
        ],
      }
    : {};

  const skip = (page - 1) * limit;

  const [companies, total] = await Promise.all([
    Company.find(filter).sort({ [sortField]: order }).skip(skip).limit(limit).lean(),
    Company.countDocuments(filter),
  ]);

  return Response.json({
    companies,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
