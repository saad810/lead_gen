"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";

interface Company {
  _id: string;
  companyName?: string;
  mcNumber?: string;
  entityType?: string;
  operatingStatus?: string;
  phone?: string;
  createdAt?: string;
}

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("mcNumber");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/companies?q=${q}&sort=${sort}&order=${order}&page=${page}&limit=${limit}`
        );
        const data = await res.json();
        setCompanies(data.companies);
        setTotalPages(data.totalPages);
      } catch (err) {
        console.error("Failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [q, sort, order, page]);

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const cleanMcNumber = (mc?: string) => (mc ? mc.replace(/[^0-9]/g, "") : "");

 

  const isNotAuthorized = (status?: string) =>
    status?.toLowerCase().includes("not authorized");

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-gray-800">
      <h1 className="text-xl font-semibold mb-6 tracking-tight text-black">
        FMCSA Directory
      </h1>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          className="border border-gray-300 bg-gray-50 text-sm p-2 flex-1 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
          placeholder="Search company or MC number..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <div className="flex gap-2">
          <select
            className="border border-gray-300 bg-gray-50 text-sm p-2 rounded flex-1"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
          >
            <option value="mcNumber">MC Number</option>
            <option value="createdAt">Created</option>
          </select>
          <button
            className="border border-gray-300 bg-gray-50 p-2 rounded hover:bg-gray-100"
            onClick={() => {
              setPage(1);
              setOrder(order === "asc" ? "desc" : "asc");
            }}
          >
            {order === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Loader */}
      {loading && (
        <div className="flex justify-center items-center py-10 text-gray-500">
          <Loader2 className="animate-spin w-5 h-5 mr-2" />
          Loading companies...
        </div>
      )}

      {/* Desktop Table */}
      {!loading && (
        <div className="hidden sm:block">
          <table className="w-full border-collapse text-sm text-gray-700">
            <thead className="border-b border-gray-300 bg-gray-100">
              <tr className="text-left">
                <th className="p-2 font-medium">Company</th>
                <th className="p-2 font-medium">MC #</th>
                <th className="p-2 font-medium">Entity</th>
                <th className="p-2 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c._id}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                    isNotAuthorized(c.operatingStatus)
                      ? "border-red-200 bg-red-50"
                      : ""
                  }`}
                >
                  <td className="p-2 font-medium">{c.companyName || "-"}</td>

                  <td className="p-2 flex items-center gap-1">
                    <span>{cleanMcNumber(c.mcNumber)}</span>
                    {c.mcNumber && (
                      <Copy
                        className="w-4 h-4 cursor-pointer text-gray-500 hover:text-black"
                        onClick={() => copyToClipboard(cleanMcNumber(c.mcNumber))}
                      />
                    )}
                  </td>

                  <td className="p-2">{c.entityType || "-"}</td>

                  <td className="p-2 flex items-center gap-1">
                    <span>{c.phone || "-"}</span>
                    {c.phone && (
                      <Copy
                        className="w-4 h-4 cursor-pointer text-gray-500 hover:text-black"
                        onClick={() => copyToClipboard(c.phone!)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Card Layout */}
      {!loading && (
        <div className="sm:hidden flex flex-col gap-3">
          {companies.map((c) => (
            <div
              key={c._id}
              className={`border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm ${
                isNotAuthorized(c.operatingStatus)
                  ? "border-red-300 bg-red-50"
                  : ""
              }`}
            >
              <div className="font-semibold mb-1">{c.companyName || "-"}</div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">MC:</span>
                <div className="flex items-center gap-1">
                  <span>{cleanMcNumber(c.mcNumber)}</span>
                  {c.mcNumber && (
                    <Copy
                      className="w-4 h-4 cursor-pointer text-gray-500 hover:text-black"
                      onClick={() => copyToClipboard(cleanMcNumber(c.mcNumber))}
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Entity:</span>
                <span>{c.entityType || "-"}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Phone:</span>
                <div className="flex items-center gap-1">
                  <span>{c.phone || "-"}</span>
                  {c.phone && (
                    <Copy
                      className="w-4 h-4 cursor-pointer text-gray-500 hover:text-black"
                      onClick={() => copyToClipboard(c.phone!)}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            Prev
          </button>

          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
