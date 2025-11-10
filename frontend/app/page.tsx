"use client";

import { useEffect, useState } from "react";

interface Company {
  _id: string;
  companyName?: string;
  mcNumber?: string;
  entityType?: string;
  operatingStatus?: string;
  createdAt?: string;
}

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("mcNumber");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/companies?q=${q}&sort=${sort}&order=${order}`);
      const data = await res.json();
      setCompanies(data);
    };
    fetchData();
  }, [q, sort, order]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">FMCSA Companies</h1>

      <div className="flex gap-3 mb-4">
        <input
          className="border p-2 flex-1 rounded"
          placeholder="Search by MC Number or Company Name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border p-2 rounded"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="mcNumber">MC Number</option>
          <option value="createdAt">Created Date</option>
        </select>
        <button
          className="border p-2 rounded"
          onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
        >
          {order === "asc" ? "↑" : "↓"}
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-2">MC Number</th>
            <th className="p-2">Company Name</th>
            <th className="p-2">Entity</th>
            <th className="p-2">Status</th>
            <th className="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c._id} className="border-b hover:bg-gray-50">
              <td className="p-2">{c.mcNumber}</td>
              <td className="p-2">{c.companyName}</td>
              <td className="p-2">{c.entityType}</td>
              <td className="p-2">{c.operatingStatus}</td>
              <td className="p-2">
                {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
